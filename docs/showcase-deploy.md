# Showcase deployment

How the public-facing dashboard at `groundbreaker.revops.it.com` is wired up.

## Architecture

```
Internet
  ↓ (TLS terminated by Cloudflare)
Cloudflare tunnel  (cloudflared container, cloudflare_default network)
  ↓ (plain HTTP)
Caddy reverse proxy  (caddy container, joined to BOTH networks)
  ├── groundbreaker.revops.it.com
  │     ├── /api/*        → rewrites to /webhook/* → n8n (99 API workflow)
  │     └── /*            → static files from frontend/dist (React SPA)
  └── n8n.revops.it.com  → reverse-proxy → n8n UI (port 5678)
       (Caddy injects n8n's basic-auth header so HR sees only one prompt)
```

Both subdomains live behind a **single basic-auth gate** at the Caddy layer.
Default credentials in `.env.example`: user `lumina`, password set when generating
the bcrypt hash (see below).

## Required Cloudflare tunnel routes

The `cloudflared` container runs with a `TUNNEL_TOKEN` (set in its own
docker-compose, not this repo) — routes are managed in the Cloudflare dashboard,
not via local YAML.

In **one.dash.cloudflare.com → Networks → Tunnels → [your tunnel] → Public Hostname → Add a public hostname**, add two routes:

| Subdomain | Domain | Service |
|-----------|--------|---------|
| `groundbreaker` | `revops.it.com` | `http://caddy:80` |
| `n8n` | `revops.it.com` | `http://caddy:80` |

Both point at the same caddy container; caddy differentiates by `Host` header.

> Service URL alternative: `http://groundbreaker-caddy-1:80` also works
> (full container name). Both resolve on `cloudflare_default`.

## Bring-up sequence

```bash
cp .env.example .env                         # fill in API keys
docker run --rm caddy:2-alpine \
  caddy hash-password --plaintext 'YOUR-PASS'  # paste hash into Caddyfile
echo -n "admin:<n8n_password>" | base64       # paste into .env as N8N_INTERNAL_AUTH

cd frontend && npm install && npm run build && cd ..
docker compose up -d                          # n8n + postgres + caddy

# Import workflows/01..06 + workflows/99_api.json into n8n
# Add the 2 Cloudflare tunnel routes per the table above
```

## Verifying without the tunnel

```bash
CADDY_IP=$(docker inspect groundbreaker-caddy-1 \
  --format '{{(index .NetworkSettings.Networks "groundbreaker_default").IPAddress}}')

# Should be 401:
curl -o /dev/null -w "%{http_code}\n" \
  --resolve "groundbreaker.revops.it.com:80:$CADDY_IP" \
  http://groundbreaker.revops.it.com/

# Should be 200, returning the dashboard HTML:
curl --resolve "groundbreaker.revops.it.com:80:$CADDY_IP" \
  -u "lumina:YOUR-PASS" \
  http://groundbreaker.revops.it.com/ | head

# Should return live pipeline state JSON:
curl --resolve "groundbreaker.revops.it.com:80:$CADDY_IP" \
  -u "lumina:YOUR-PASS" \
  http://groundbreaker.revops.it.com/api/state | jq .stats
```

## Auth model

- HR enters `lumina` / `<password>` once at the browser prompt.
- Caddy validates against its bcrypt hash. The hash is inlined in `Caddyfile`
  (one-way; not secret). The password is the shared credential.
- For requests to n8n (UI on `n8n.revops.it.com` or `/api/*` on the dashboard
  domain), Caddy injects n8n's own basic-auth header upstream. n8n's
  `N8N_BASIC_AUTH_*` stays active in case anyone bypasses Caddy.
- LAN-direct access to `http://<vm-ip>:5678` still requires n8n's `admin`
  password — defense-in-depth.
