import Dockerode from 'dockerode';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { artifactPrefix } from '@pageforge/shared';
import { publishLog, publishStatus, publishSystemLog } from './logger';
import { uploadArtifacts, downloadFromMinio } from './artifacts';

// ─── Types ───────────────────────────────────────────────────────

export interface BuildJobData {
  deploymentId: string;
  projectSlug: string;
}

interface DeploymentDoc {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  projectSlug: string;
  status: string;
  sourceSnapshot: {
    type: 'git' | 'zip';
    gitUrl?: string;
    gitBranch?: string;
    gitToken?: string;
    zipPath?: string;
  };
  buildConfig: {
    installCommand: string;
    buildCommand: string;
    outputDirectory: string;
  };
  artifactPath?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface ProjectDoc {
  _id: mongoose.Types.ObjectId;
  environmentVariables: Array<{ key: string; value: string }>;
}

// ─── Docker Setup ────────────────────────────────────────────────

const docker = new Dockerode({
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
});

const BUILD_IMAGE = process.env.BUILD_IMAGE || 'node:20-alpine';
const MEMORY_LIMIT = parseInt(process.env.BUILD_MEMORY_LIMIT || '536870912', 10);
const CPU_LIMIT = parseInt(process.env.BUILD_CPU_LIMIT || '1000000000', 10);
const GVISOR_ENABLED = process.env.GVISOR_ENABLED === 'true';

// ─── Model Access ────────────────────────────────────────────────

function getDeploymentModel() {
  return mongoose.model('Deployment');
}

function getProjectModel() {
  return mongoose.model('Project');
}

// ─── Build Executor ──────────────────────────────────────────────

export async function handleBuildJob(data: BuildJobData): Promise<void> {
  const { deploymentId, projectSlug } = data;
  const DeploymentModel = getDeploymentModel();
  const ProjectModel = getProjectModel();

  let container: Dockerode.Container | null = null;
  let tempDir: string | null = null;

  try {
    // Fetch deployment
    const deployment = (await DeploymentModel.findById(deploymentId).lean()) as DeploymentDoc | null;
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Fetch project for env vars
    const project = (await ProjectModel.findById(deployment.projectId).lean()) as ProjectDoc | null;
    if (!project) {
      throw new Error(`Project for deployment ${deploymentId} not found`);
    }

    // Update status to building
    await DeploymentModel.findByIdAndUpdate(deploymentId, {
      status: 'building',
      startedAt: new Date(),
    });
    await publishStatus(deploymentId, 'building');
    await publishSystemLog(deploymentId, 'Build started');

    // Create temp directory for build output extraction
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `pageforge-build-${deploymentId}-`));

    // Prepare environment variables
    const envVars: string[] = [
      'CI=true',
      `NODE_ENV=production`,
      ...project.environmentVariables.map((v) => `${v.key}=${v.value}`),
    ];

    // Inject git auth token as env var (never in the build script text)
    const { sourceSnapshot, buildConfig } = deployment;
    if (sourceSnapshot.gitToken) {
      envVars.push(`GIT_AUTH_TOKEN=${sourceSnapshot.gitToken}`);
    }

    // Build the shell script to execute inside the container
    const buildScript = generateBuildScript(sourceSnapshot, buildConfig);

    await publishSystemLog(deploymentId, `Using image: ${BUILD_IMAGE}`);
    await publishSystemLog(deploymentId, `Source type: ${sourceSnapshot.type}`);

    // Ensure build image is available
    await ensureImage(BUILD_IMAGE, deploymentId);

    // Prepare container config
    const containerConfig: Dockerode.ContainerCreateOptions = {
      Image: BUILD_IMAGE,
      Cmd: ['sh', '-c', buildScript],
      Env: envVars,
      WorkingDir: '/build',
      HostConfig: {
        Memory: MEMORY_LIMIT,
        NanoCpus: CPU_LIMIT,
        Privileged: false,
        NetworkMode: 'bridge',
        AutoRemove: false, // We remove manually after extracting output
        SecurityOpt: ['no-new-privileges'],
      },
      NetworkDisabled: false, // Need network for git clone and npm install
    };

    // Use gVisor runtime if enabled
    if (GVISOR_ENABLED) {
      containerConfig.HostConfig!.Runtime = 'runsc';
      await publishSystemLog(deploymentId, 'Using gVisor runtime for isolation');
    }

    // Handle ZIP source: bind mount the zip file
    if (sourceSnapshot.type === 'zip' && sourceSnapshot.zipPath) {
      const zipLocalPath = path.join(tempDir, 'source.zip');
      await publishSystemLog(deploymentId, 'Downloading source ZIP from storage...');
      await downloadFromMinio(sourceSnapshot.zipPath, zipLocalPath);

      // Bind mount the zip file into the container
      containerConfig.HostConfig!.Binds = [`${zipLocalPath}:/tmp/source.zip:ro`];
    }

    // Create and start container
    await publishSystemLog(deploymentId, 'Creating build container...');
    container = await docker.createContainer(containerConfig);
    await container.start();

    await publishSystemLog(deploymentId, `Container started: ${container.id.slice(0, 12)}`);

    // Stream logs (sanitize any secrets from output)
    const secrets: string[] = [];
    if (sourceSnapshot.gitToken) secrets.push(sourceSnapshot.gitToken);

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: false,
    });

    // Process log stream
    await streamContainerLogs(logStream, deploymentId, secrets);

    // Wait for container to finish
    const result = await container.wait();
    const exitCode = result.StatusCode;

    await publishSystemLog(deploymentId, `Build process exited with code ${exitCode}`);

    if (exitCode !== 0) {
      throw new Error(`Build failed with exit code ${exitCode}`);
    }

    // Extract output directory from container
    await publishStatus(deploymentId, 'uploading');
    await publishSystemLog(deploymentId, 'Extracting build artifacts...');

    const outputDir = buildConfig.outputDirectory;
    const outputPath = path.join(tempDir, 'output');
    await fs.mkdir(outputPath, { recursive: true });

    try {
      await extractFromContainer(container, `/build/app/${outputDir}`, outputPath);
    } catch {
      // Try alternate paths
      try {
        await extractFromContainer(container, `/build/${outputDir}`, outputPath);
      } catch {
        throw new Error(
          `Could not find output directory "${outputDir}" in the container. ` +
          'Ensure your build command produces output in the configured directory.'
        );
      }
    }

    // Upload artifacts to MinIO
    await publishSystemLog(deploymentId, 'Uploading artifacts to storage...');
    const fileCount = await uploadArtifacts(deploymentId, outputPath);
    await publishSystemLog(deploymentId, `Uploaded ${fileCount} files`);

    // Mark deployment as ready
    const artifactPath = artifactPrefix(deploymentId);
    await DeploymentModel.findByIdAndUpdate(deploymentId, {
      status: 'ready',
      artifactPath,
      completedAt: new Date(),
    });
    await publishStatus(deploymentId, 'ready');
    await publishSystemLog(deploymentId, 'Deployment is live!');

    // Update Caddy route for the project's default subdomain
    await updateCaddyRoute(projectSlug, deploymentId);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown build error';
    console.error(`[Executor] Build failed for ${deploymentId}:`, errorMessage);

    await publishLog(deploymentId, `ERROR: ${errorMessage}`, 'stderr');
    await publishStatus(deploymentId, 'failed');

    const DeploymentModel = getDeploymentModel();
    await DeploymentModel.findByIdAndUpdate(deploymentId, {
      status: 'failed',
      error: errorMessage,
      completedAt: new Date(),
    });
  } finally {
    // Cleanup container
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        // Container may have been auto-removed
      }
    }

    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
  }
}

// ─── Helper Functions ────────────────────────────────────────────

/**
 * Generate the shell script that runs inside the build container.
 */
function generateBuildScript(
  source: DeploymentDoc['sourceSnapshot'],
  config: DeploymentDoc['buildConfig']
): string {
  const lines: string[] = ['set -e', 'mkdir -p /build && cd /build'];

  if (source.type === 'git') {
    lines.push(
      `echo "Installing git..."`,
      `(apk add --no-cache git 2>/dev/null || (apt-get update -qq && apt-get install -y -qq git 2>/dev/null)) || true`
    );
    const branch = source.gitBranch || 'main';

    // Build the clone URL — inject token for private repo auth
    // Token is passed via GIT_AUTH_TOKEN env var to avoid leaking in the script
    if (source.gitToken) {
      lines.push(
        `echo "Configuring git credentials..."`,
        // Use git credential helper to inject the token without exposing it in clone URL logs
        `git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=$GIT_AUTH_TOKEN"; }; f'`,
      );
    }

    lines.push(
      `echo "Cloning repository..."`,
      `git clone --depth 1 --branch "${branch}" "${source.gitUrl}" app`,
      `cd app`
    );
  } else {
    // ZIP source — install unzip on Alpine or Debian-based images
    lines.push(
      `echo "Installing unzip..."`,
      `(apk add --no-cache unzip 2>/dev/null || (apt-get update -qq && apt-get install -y -qq unzip 2>/dev/null)) || true`,
      `echo "Extracting source archive..."`,
      `mkdir -p app && cd app`,
      `unzip -q /tmp/source.zip -d .`,
      // Handle case where zip contains a single top-level directory
      `if [ $(ls -d */ 2>/dev/null | wc -l) -eq 1 ] && [ ! -f package.json ]; then`,
      `  INNER=$(ls -d */); cp -a "$INNER". .; rm -rf "$INNER"`,
      `fi`
    );
  }

  // Diagnostic: detect package manager and check availability
  lines.push(
    `echo "--- Environment diagnostics ---"`,
    `echo "Node: $(node --version 2>/dev/null || echo 'NOT FOUND')"`,
    `echo "npm:  $(npm --version 2>/dev/null || echo 'NOT FOUND')"`,
    `echo "yarn: $(yarn --version 2>/dev/null || echo 'NOT FOUND')"`,
    `echo "pnpm: $(pnpm --version 2>/dev/null || echo 'NOT FOUND')"`,
    `echo "-------------------------------"`,
  );

  // Extract the first word of the install/build command to check if it exists
  const installBin = config.installCommand.trim().split(/\s+/)[0] ?? '';
  const buildBin = config.buildCommand.trim().split(/\s+/)[0] ?? '';

  const checkCommand = (bin: string, label: string) => {
    // Only check if the binary isn't a shell builtin or path
    if (bin && !['cd', 'echo', 'set', 'export', 'true'].includes(bin)) {
      return [
        `if ! command -v ${bin} >/dev/null 2>&1; then`,
        `  echo "ERROR: '${bin}' is not available in this build image (${BUILD_IMAGE})."`,
        `  echo "The ${label} command '${bin}' was not found. Available package managers: $(which npm yarn pnpm 2>/dev/null | tr '\\n' ' ' || echo 'none detected')"`,
        `  echo "Tip: Either change the ${label} command in project settings, or use a build image that includes '${bin}'."`,
        `  exit 127`,
        `fi`,
      ];
    }
    return [];
  };

  lines.push(...checkCommand(installBin, 'install'));
  lines.push(...checkCommand(buildBin, 'build'));

  lines.push(
    `echo "Running install command: ${config.installCommand}"`,
    config.installCommand,
    `echo "Running build command: ${config.buildCommand}"`,
    config.buildCommand,
    `echo "Build completed successfully"`
  );

  return lines.join('\n');
}

/**
 * Ensure the Docker image is available locally.
 */
async function ensureImage(image: string, deploymentId: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
  } catch {
    await publishSystemLog(deploymentId, `Pulling image ${image}...`);
    const stream = await docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await publishSystemLog(deploymentId, `Image ${image} pulled successfully`);
  }
}

/**
 * Stream container logs and publish them via Redis.
 * Sanitizes any secrets from log output before publishing.
 */
function streamContainerLogs(
  logStream: NodeJS.ReadableStream,
  deploymentId: string,
  secrets: string[] = []
): Promise<void> {
  return new Promise((resolve) => {
    let buffer = '';

    logStream.on('data', (chunk: Buffer) => {
      // Docker multiplexed stream: first 8 bytes are header
      // Byte 0: stream type (1=stdout, 2=stderr)
      // Bytes 4-7: payload size (big-endian uint32)
      let offset = 0;
      while (offset < chunk.length) {
        if (offset + 8 > chunk.length) break;

        const streamType = chunk[offset];
        const payloadSize = chunk.readUInt32BE(offset + 4);
        offset += 8;

        if (offset + payloadSize > chunk.length) {
          // Partial frame, read what we can
          const partial = chunk.subarray(offset).toString('utf8');
          const stream = streamType === 2 ? 'stderr' : 'stdout';
          processLines(partial, deploymentId, stream as 'stdout' | 'stderr', secrets);
          break;
        }

        const payload = chunk.subarray(offset, offset + payloadSize).toString('utf8');
        const stream = streamType === 2 ? 'stderr' : 'stdout';
        processLines(payload, deploymentId, stream as 'stdout' | 'stderr', secrets);

        offset += payloadSize;
      }
    });

    logStream.on('end', resolve);
    logStream.on('error', () => resolve());
  });
}

/**
 * Sanitize secrets from a string (replace with [REDACTED]).
 */
function sanitize(text: string, secrets: string[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length > 0) {
      // Use split+join instead of regex to avoid special char issues
      result = result.split(secret).join('[REDACTED]');
    }
  }
  return result;
}

/**
 * Process text into individual lines and publish each.
 */
function processLines(
  text: string,
  deploymentId: string,
  stream: 'stdout' | 'stderr',
  secrets: string[] = []
): void {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed) {
      const safe = secrets.length > 0 ? sanitize(trimmed, secrets) : trimmed;
      // Fire and forget — don't block log processing
      publishLog(deploymentId, safe, stream).catch(() => {});
    }
  }
}

/**
 * Extract files from a container path to a local directory using `docker cp`.
 */
async function extractFromContainer(
  container: Dockerode.Container,
  containerPath: string,
  localPath: string
): Promise<void> {
  const archiveStream = await container.getArchive({ path: containerPath });
  const tar = await import('tar-stream');
  const extract = tar.extract();

  await new Promise<void>((resolve, reject) => {
    extract.on('entry', async (header, stream, next) => {
      // Remove the first path component (the directory name itself)
      const parts = header.name.split('/');
      parts.shift(); // Remove root directory
      const relativePath = parts.join('/');

      if (!relativePath) {
        stream.resume();
        next();
        return;
      }

      const fullPath = path.join(localPath, relativePath);

      if (header.type === 'directory') {
        await fs.mkdir(fullPath, { recursive: true });
        stream.resume();
        next();
      } else if (header.type === 'file') {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', async () => {
          await fs.writeFile(fullPath, Buffer.concat(chunks));
          next();
        });
        stream.on('error', reject);
      } else {
        stream.resume();
        next();
      }
    });

    extract.on('finish', resolve);
    extract.on('error', reject);

    archiveStream.pipe(extract);
  });
}

/**
 * Update Caddy to serve the new deployment for the project's subdomain.
 */
async function updateCaddyRoute(projectSlug: string, deploymentId: string): Promise<void> {
  const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || 'http://localhost:2019';
  const MINIO_INTERNAL_URL = process.env.MINIO_INTERNAL_URL || 'http://pageforge-minio:9000';
  const PAGEFORGE_DOMAIN = process.env.PAGEFORGE_DOMAIN || 'pageforge.local';
  const MINIO_BUCKET_NAME = 'pageforge-artifacts';

  const subdomain = `${projectSlug}.${PAGEFORGE_DOMAIN}`;
  const prefix = artifactPrefix(deploymentId);

  try {
    // Get current routes
    let routes: Array<Record<string, unknown>> = [];
    try {
      const res = await fetch(
        `${CADDY_ADMIN_URL}/config/apps/http/servers/static/routes`
      );
      if (res.ok) {
        routes = (await res.json()) as Array<Record<string, unknown>>;
      }
    } catch {
      // Caddy may not be running
    }

    // Build new route — uses a subroute to handle index.html for directory paths
    const newRoute = {
      match: [{ host: [subdomain] }],
      handle: [
        {
          handler: 'subroute',
          routes: [
            {
              // Append index.html to paths ending with /
              match: [{ path_regexp: { pattern: '/$' } }],
              handle: [
                {
                  handler: 'rewrite',
                  uri: '{http.request.uri}index.html',
                },
              ],
            },
            {
              // Prefix all requests with the MinIO bucket/artifact path
              handle: [
                {
                  handler: 'rewrite',
                  uri: `/${MINIO_BUCKET_NAME}/${prefix}{http.request.uri}`,
                },
                {
                  handler: 'reverse_proxy',
                  upstreams: [{ dial: new URL(MINIO_INTERNAL_URL).host }],
                  headers: {
                    request: {
                      set: {
                        Host: [new URL(MINIO_INTERNAL_URL).host],
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    // Replace existing route for this subdomain or add new
    const filtered = routes.filter(
      (r: Record<string, unknown>) => {
        const match = r.match as Array<{ host?: string[] }> | undefined;
        return !match?.some((m) => m.host?.includes(subdomain));
      }
    );
    filtered.push(newRoute);

    // Update Caddy — use PATCH to replace existing routes array
    const updateRes = await fetch(
      `${CADDY_ADMIN_URL}/config/apps/http/servers/static/routes`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtered),
      }
    );

    // If PATCH fails (routes key doesn't exist yet), try PUT
    if (!updateRes.ok) {
      await fetch(
        `${CADDY_ADMIN_URL}/config/apps/http/servers/static/routes`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filtered),
        }
      );
    }

    console.log(`[Executor] Caddy route updated for ${subdomain}`);
  } catch (err) {
    console.warn('[Executor] Could not update Caddy route:', err);
    // Non-fatal — the deployment is still ready
  }
}
