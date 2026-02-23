import { MINIO_BUCKET, artifactPrefix } from '@pageforge/shared';

const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || 'http://localhost:2019';
const MINIO_INTERNAL_URL = process.env.MINIO_INTERNAL_URL || 'http://pageforge-minio:9000';

interface CaddyRoute {
  match?: { host?: string[]; path_regexp?: { pattern: string } }[];
  handle: object[];
}

/**
 * Build a Caddy route config that proxies a domain to the MinIO-stored artifacts.
 */
function buildRoute(domain: string, deploymentId: string): CaddyRoute {
  const artifactPath = artifactPrefix(deploymentId);

  return {
    match: [{ host: [domain] }],
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
                uri: `/${MINIO_BUCKET}/${artifactPath}{http.request.uri}`,
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
}

/**
 * Get current Caddy config routes.
 */
async function getRoutes(): Promise<CaddyRoute[]> {
  try {
    const res = await fetch(
      `${CADDY_ADMIN_URL}/config/apps/http/servers/static/routes`,
      { method: 'GET' }
    );
    if (!res.ok) return [];
    return (await res.json()) as CaddyRoute[];
  } catch {
    console.warn('[Caddy] Could not fetch routes — Caddy may not be running');
    return [];
  }
}

/**
 * Set all routes in Caddy config.
 */
async function setRoutes(routes: CaddyRoute[]): Promise<void> {
  // Try PATCH first (replace existing routes), fall back to PUT (create new)
  let res = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/static/routes`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routes),
    }
  );

  if (!res.ok) {
    res = await fetch(
      `${CADDY_ADMIN_URL}/config/apps/http/servers/static/routes`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routes),
      }
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Caddy] Failed to set routes: ${res.status} ${body}`);
  }
}

/**
 * Add or update a route for a given domain pointing to a deployment's artifacts.
 */
export async function upsertRoute(domain: string, deploymentId: string): Promise<void> {
  const routes = await getRoutes();
  const newRoute = buildRoute(domain, deploymentId);

  // Remove existing route for this domain if it exists
  const filtered = routes.filter(
    (r) => !r.match?.some((m) => m.host?.includes(domain))
  );

  filtered.push(newRoute);
  await setRoutes(filtered);
  console.log(`[Caddy] Route set for ${domain} → deployment ${deploymentId}`);
}

/**
 * Remove routes for a given domain.
 */
export async function removeRoute(domain: string): Promise<void> {
  const routes = await getRoutes();
  const filtered = routes.filter(
    (r) => !r.match?.some((m) => m.host?.includes(domain))
  );
  await setRoutes(filtered);
  console.log(`[Caddy] Route removed for ${domain}`);
}

/**
 * Update the default subdomain route when a deployment goes live.
 */
export async function updateProjectRoute(
  projectSlug: string,
  deploymentId: string
): Promise<void> {
  const baseDomain = process.env.PAGEFORGE_DOMAIN || 'pageforge.local';
  const subdomain = `${projectSlug}.${baseDomain}`;
  await upsertRoute(subdomain, deploymentId);
}
