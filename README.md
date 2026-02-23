# PageForge

Self-hosted static site deployment platform. Push code via Git or upload a ZIP, and PageForge builds it in an isolated Docker container, uploads the artifacts to S3-compatible storage, and serves them through a reverse proxy with automatic subdomain routing.

## Architecture

```
Browser
  |
  v
Next.js Dashboard (apps/web)
  |-- REST API (CRUD for projects, deployments, env vars, domains)
  |-- HTTP polling for live build logs (stored in MongoDB)
  |
  +-- MongoDB (data store)
  +-- Redis (BullMQ job queue + Pub/Sub for log streaming)
  +-- MinIO (S3-compatible artifact storage)
  |
  v
Build Worker (apps/worker)
  |-- Consumes BullMQ jobs
  |-- Runs builds in isolated Docker containers (dockerode)
  |-- Streams logs via Redis Pub/Sub, persists to MongoDB
  |-- Uploads build output to MinIO
  |-- Updates Caddy routes via admin API
  |
  v
Caddy (reverse proxy)
  |-- Routes *.<domain> to MinIO artifacts
  |-- Dynamic route management via JSON admin API
  |-- Rewrites directory paths to index.html automatically
```

## Project Structure

```
PageForge/
  apps/
    web/           Next.js 14 dashboard + API + custom server.ts
    worker/        BullMQ build worker with Docker orchestration
  packages/
    shared/        TypeScript types, constants, helpers
  infra/
    docker-compose.yml   MongoDB, Redis, MinIO, Caddy, Cloudflared
    caddy.json           Caddy JSON config (admin API bootstrap)
    init-minio.sh        Creates MinIO bucket with public read
```

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** and **Docker Compose**
- Docker socket accessible at `/var/run/docker.sock` (for the worker to create build containers)

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone <repo-url> PageForge
cd PageForge
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp .env.example apps/web/.env
cp .env.example apps/worker/.env
```

The defaults work out of the box for local development. No changes needed.

### 3. Start infrastructure and run

```bash
pnpm setup    # Installs deps, builds shared pkg, starts Docker services, inits MinIO
pnpm dev      # Starts web dashboard + worker with hot reload
```

- **Dashboard**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (login: `pageforge` / `pageforge-secret`)
- **Caddy Admin API**: http://localhost:2019

### 4. DNS for local subdomain testing

To test project subdomains locally, add entries to `/etc/hosts`:

```
127.0.0.1  pageforge.local
127.0.0.1  my-project.pageforge.local
```

Or use `dnsmasq` to resolve `*.pageforge.local` to `127.0.0.1`.

---

## Deploying on a VPS (Public Access)

This section covers everything needed to run PageForge on a VPS and expose it publicly via Cloudflare Tunnel. Follow every step — the networking has several non-obvious requirements.

### Overview of what you're setting up

```
Internet → Cloudflare CDN → Tunnel → cloudflared (host network)
  |
  ├── *.yourdomain.com         → localhost:80 (Caddy → MinIO artifacts)
  └── dashboard.yourdomain.com → localhost:3000 (Next.js dashboard)
```

Key architectural decisions:
- **cloudflared runs with `network_mode: host`** so it can reach both Caddy (port 80) and the Next.js dev server (port 3000) on localhost. On Linux, Docker containers on bridge networks cannot reach host ports without extra configuration.
- **Caddy runs in Docker** on a bridge network alongside MinIO. The worker tells Caddy to reverse-proxy to MinIO using the Docker network hostname (`pageforge-minio:9000`).
- **The worker and web app run on the host** (not in Docker), so they talk to Caddy's admin API on `localhost:2019` and to MongoDB/Redis on `localhost`.

### Step 1: Create a Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) > **Networks** > **Tunnels**
2. Click **Create a tunnel**, pick a name (e.g., `pageforge`)
3. On the "Install connector" step, select **Docker** and copy the tunnel token (the long base64 string after `--token`)

### Step 2: Configure tunnel public hostnames (order matters!)

In the Cloudflare tunnel settings, add **two public hostname entries** in this exact order:

| Priority | Public hostname | Service | Notes |
|---|---|---|---|
| **1 (first)** | `dashboard.yourdomain.com` | `http://localhost:3000` | Next.js dashboard |
| **2 (second)** | `*.yourdomain.com` | `http://localhost:80` | Project subdomains via Caddy |

**CRITICAL: The specific hostname (`dashboard.`) MUST come BEFORE the wildcard (`*.**).** Cloudflare matches ingress rules top-to-bottom. If the wildcard is first, `dashboard.yourdomain.com` will match `*` and be routed to Caddy (port 80) instead of Next.js (port 3000), returning a blank page.

Also note: use `localhost` — NOT `caddy:80` or `host.docker.internal:3000`. Since cloudflared runs with `network_mode: host`, Docker DNS names don't resolve. And `host.docker.internal` does not resolve on Linux hosts either.

### Step 3: Add DNS records in Cloudflare

Go to **Cloudflare DNS** for your domain and add:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `dashboard` | `<tunnel-id>.cfargotunnel.com` | Proxied (orange cloud) |
| CNAME | `*` | `<tunnel-id>.cfargotunnel.com` | Proxied (orange cloud) |

Your tunnel ID is shown in the tunnel details page (a UUID like `649284b2-08d8-...`).

The **wildcard CNAME** is required for project subdomains (`myproject.yourdomain.com`) to resolve. Without it, only `dashboard.yourdomain.com` will work.

### Step 4: Configure .env files

Edit the root `.env`:

```bash
# Set your real domain (replaces pageforge.local)
PAGEFORGE_DOMAIN=yourdomain.com
NEXT_PUBLIC_PAGEFORGE_DOMAIN=yourdomain.com

# Paste your Cloudflare tunnel token
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYWJj...your-token-here
```

**Important:** You must also update the `.env` files inside `apps/web/` and `apps/worker/` — these override the root `.env` when running in development mode:

```bash
# apps/web/.env — update these lines:
PAGEFORGE_DOMAIN=yourdomain.com
NEXT_PUBLIC_PAGEFORGE_DOMAIN=yourdomain.com

# apps/worker/.env — update this line:
PAGEFORGE_DOMAIN=yourdomain.com
```

`NEXT_PUBLIC_PAGEFORGE_DOMAIN` is needed because the dashboard UI runs client-side in the browser — React components can only access env vars prefixed with `NEXT_PUBLIC_`. Without this, the UI will show `project.pageforge.local` instead of `project.yourdomain.com`.

Both `PAGEFORGE_DOMAIN` and `NEXT_PUBLIC_PAGEFORGE_DOMAIN` must always have the same value.

### Step 5: Start everything

```bash
pnpm setup              # First time: install deps, build, start infra, init MinIO
pnpm infra:tunnel       # Start core services + cloudflared tunnel
pnpm dev                # Start web dashboard + worker
```

Check tunnel logs to verify it connected:

```bash
pnpm infra:tunnel:logs
```

You should see lines like:
```
INF Registered tunnel connection connIndex=0 ... location=xxx protocol=quic
INF Updated to new configuration config="..." version=N
```

### Step 6: Deploy a project and verify

1. Open `https://dashboard.yourdomain.com`
2. Create a new project (Git URL or ZIP)
3. Click "Deploy"
4. Once the build finishes (status: `ready`), visit `https://projectslug.yourdomain.com`

If the deployed site doesn't load, check:
- The wildcard DNS record exists (Step 3)
- The tunnel ingress order is correct (Step 2)
- The worker's `PAGEFORGE_DOMAIN` matches your domain (Step 4)
- Caddy has the route: `curl http://localhost:2019/config/apps/http/servers/static/routes`

### Step 7: Re-deploy existing projects after domain change

If you had projects deployed under the old domain (`pageforge.local`), their Caddy routes still use the old hostname. You need to re-deploy each project to update the Caddy routing to the new domain. Just click "Deploy" on each project in the dashboard.

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/pageforge` | MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_ACCESS_KEY` | `pageforge` | MinIO access key |
| `MINIO_SECRET_KEY` | `pageforge-secret` | MinIO secret key |
| `MINIO_BUCKET` | `pageforge-artifacts` | MinIO bucket name |
| `MINIO_INTERNAL_URL` | `http://pageforge-minio:9000` | MinIO URL as seen by Caddy (Docker network hostname) |
| `CADDY_ADMIN_URL` | `http://localhost:2019` | Caddy admin API URL |
| `PAGEFORGE_DOMAIN` | `pageforge.local` | Base domain for project subdomains (server-side) |
| `NEXT_PUBLIC_PAGEFORGE_DOMAIN` | `pageforge.local` | Same as above, but exposed to the browser UI |
| `PAGEFORGE_PORT` | `3000` | Dashboard port |
| `BUILD_IMAGE` | `node:20-alpine` | Docker image for build containers |
| `BUILD_MEMORY_LIMIT` | `536870912` | Container memory limit (512MB) |
| `BUILD_CPU_LIMIT` | `1000000000` | Container CPU limit (1 core) |
| `GVISOR_ENABLED` | `false` | Use gVisor runtime for extra isolation |
| `CLOUDFLARE_TUNNEL_TOKEN` | *(empty)* | Cloudflare Tunnel token (leave empty for local-only) |

---

## Switching Between Local and Public Mode

```bash
# Local only (no tunnel, uses pageforge.local)
pnpm infra:up

# Public via Cloudflare Tunnel (uses your real domain)
pnpm infra:tunnel

# Stop everything (including tunnel if running)
pnpm infra:down
```

When switching modes, update `PAGEFORGE_DOMAIN` and `NEXT_PUBLIC_PAGEFORGE_DOMAIN` in **all three `.env` files** (root, `apps/web/.env`, `apps/worker/.env`) and restart `pnpm dev`. Re-deploy projects to update their Caddy routes.

---

## Networking Gotchas & Troubleshooting

These are the issues we hit during development. Documenting them here so you don't have to debug them again.

### cloudflared shows help text and exits

The `cloudflare/cloudflared` Docker image has an entrypoint of `["cloudflared", "--no-autoupdate"]`. If you put `--no-autoupdate` in your `command:` as well, it gets duplicated and confuses the argument parser. The compose file handles this correctly with a custom entrypoint — don't add `--no-autoupdate` yourself.

### cloudflared says "variable is not set" / token is blank

Docker Compose reads `.env` from the **project directory** (where the compose file lives), NOT the current working directory. Since our compose file is at `infra/docker-compose.yml`, Compose looks for `infra/.env` which doesn't exist. All `pnpm infra:*` scripts include `--env-file .env` to fix this. If you run `docker compose` manually, always add `--env-file .env`:

```bash
docker compose --env-file .env -f infra/docker-compose.yml --profile tunnel up -d
```

### Dashboard shows blank page via tunnel (content-length: 0)

Three possible causes:

1. **Ingress rule order wrong** — The wildcard `*` rule is matching before the specific `dashboard.` rule. Fix: put the specific hostname first in Cloudflare tunnel settings.

2. **host.docker.internal doesn't resolve** — On Linux, `host.docker.internal` is NOT available by default (unlike Docker Desktop on Mac/Windows). That's why cloudflared uses `network_mode: host` and ingress targets should be `http://localhost:3000`, not `http://host.docker.internal:3000`.

3. **Docker containers can't reach host ports** — On Linux, containers on bridge networks often can't reach the host's listening ports due to iptables rules. Using `network_mode: host` for cloudflared bypasses this entirely.

### Caddy returns empty response for project subdomains

Caddy's MinIO reverse proxy needs to handle directory paths. Requesting `/` maps to a MinIO key ending with `/` which doesn't exist. The route config includes a subroute that rewrites paths ending in `/` to append `index.html` before forwarding to MinIO. This is handled automatically by the worker when creating routes.

### Caddy route updates fail with "key already exists"

The worker uses PATCH (to update existing routes) with a PUT fallback (to create new ones). If you see this error in worker logs, it's handled — the fallback will succeed.

### Caddy routes lost on restart

Routes added via the Caddy admin API are in-memory only. If Caddy restarts (e.g., `docker compose restart caddy`), all project routes are lost. Fix: re-deploy each project to recreate its route. The base Caddy config in `caddy.json` is persistent (it bootstraps the admin API and static server).

### MINIO_INTERNAL_URL — why it exists

The worker tells Caddy to reverse-proxy to MinIO. Caddy runs inside Docker, so it needs the Docker network hostname (`pageforge-minio:9000`), not `localhost:9000`. The `MINIO_INTERNAL_URL` env var controls this. Don't change it unless you've moved MinIO outside Docker.

### node:20-alpine doesn't have git

The build container uses `node:20-alpine` which doesn't include `git`. The build script auto-installs it via `apk add git` (Alpine) or `apt-get install git` (Debian) before cloning. This adds a few seconds to Git-based builds.

---

## How It Works

### Creating a project

1. Open the dashboard and click "New Project"
2. Enter a name, choose source type (Git URL or ZIP upload), and configure build settings
3. The project gets a slug-based subdomain: `<slug>.<PAGEFORGE_DOMAIN>`

### Deploying

1. Go to your project and click "Deploy"
2. The API creates a deployment record and enqueues a BullMQ job
3. The worker picks up the job and:
   - Creates an isolated Docker container with memory/CPU limits
   - Clones the Git repo or extracts the ZIP
   - Runs `install` and `build` commands
   - Streams build logs to Redis Pub/Sub, persists them to MongoDB
   - Uploads the build output directory to MinIO
   - Updates Caddy routes so the subdomain serves the new artifacts
4. Watch the build live via the deployment detail page (polls every 2s)

### Custom domains

1. Add a domain in the project's Domains tab
2. Create a CNAME record pointing your domain to `<slug>.<PAGEFORGE_DOMAIN>`
3. Click "Verify" to check DNS resolution
4. Once verified, Caddy routes are updated to serve your project at the custom domain

### Environment variables

Set build-time environment variables in the project's Environment tab. These are injected into the Docker build container.

## API Reference

All API routes are under `/api/`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:slug` | Get project by slug |
| `PATCH` | `/api/projects/:slug` | Update project |
| `DELETE` | `/api/projects/:slug` | Delete project |
| `GET` | `/api/projects/:slug/deployments` | List deployments |
| `POST` | `/api/projects/:slug/deployments` | Trigger deployment |
| `GET` | `/api/projects/:slug/deployments/:id` | Get deployment (includes build logs) |
| `PUT` | `/api/projects/:slug/env` | Set environment variables |
| `POST` | `/api/projects/:slug/domains` | Add custom domain |
| `DELETE` | `/api/projects/:slug/domains/:domain` | Remove domain |
| `PATCH` | `/api/projects/:slug/domains/:domain` | Verify domain DNS |
| `POST` | `/api/upload/:slug` | Upload ZIP source |

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start web + worker in dev mode |
| `pnpm build` | Production build (shared, then web + worker) |
| `pnpm setup` | Install deps, build shared, start infra, init MinIO |
| `pnpm infra:up` | Start Docker Compose services (local only) |
| `pnpm infra:down` | Stop all services (including tunnel) |
| `pnpm infra:logs` | Tail Docker Compose logs |
| `pnpm infra:tunnel` | Start all services + Cloudflare Tunnel |
| `pnpm infra:tunnel:down` | Stop all services + tunnel |
| `pnpm infra:tunnel:logs` | Tail tunnel container logs |

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS
- **Backend**: Next.js API routes, custom `server.ts` for HTTP server
- **Worker**: Node.js, BullMQ, dockerode
- **Database**: MongoDB (Mongoose)
- **Queue**: Redis (BullMQ)
- **Log Streaming**: Redis Pub/Sub + MongoDB persistence + HTTP polling
- **Storage**: MinIO (S3-compatible)
- **Reverse Proxy**: Caddy (JSON admin API for dynamic routing)
- **Tunnel**: Cloudflare Tunnel (optional, Docker-based)
- **Build Isolation**: Docker containers with memory/CPU limits, optional gVisor
- **Monorepo**: pnpm workspaces
- **Language**: TypeScript throughout
