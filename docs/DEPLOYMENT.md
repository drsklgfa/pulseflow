# Deployment options

The repository does not require deployment for portfolio use. GitHub Pages and the local Docker stack are the primary supported presentation paths.

## GitHub-only portfolio

1. Push the repository to `drsklgfa/pulseflow`.
2. Run `powershell -ExecutionPolicy Bypass -File .\scripts\enable-github-pages.ps1`.
3. The helper configures Pages with `build_type=workflow`, enables `pages.yml` and dispatches the first deployment.
4. Add `https://drsklgfa.github.io/pulseflow/` to the repository Website field.

The same operation can be performed manually in **Settings → Pages → Source: GitHub Actions**. Full details are in [GitHub Pages deployment](GITHUB_PAGES.md).

The published build sets `VITE_DEMO_MODE=true`; no API URL or secret is included.

## Single Docker host

```bash
docker compose up -d --build
```

Place a TLS reverse proxy in front of ports 3000 and 3333 for a public environment, and change all demo secrets.

## Split services

The source is ready to deploy as separate units:

- `apps/web/Dockerfile` — static Nginx frontend;
- `apps/api/Dockerfile` — API and migration-capable image;
- `apps/worker/Dockerfile` — asynchronous worker;
- managed PostgreSQL;
- managed Redis.

Required runtime variables are documented in `.env.example`.

## Scaling

- Scale API replicas behind a load balancer.
- Scale workers independently or increase `WORKER_CONCURRENCY`.
- Keep one controlled migration job per release.
- Preserve WebSocket fan-out through the shared Redis channel.
- Use managed PostgreSQL connection pooling when replica count increases.

## External providers

Switch providers only after the base stack is healthy:

```env
PAYMENT_PROVIDER=stripe
NOTIFICATION_PROVIDER=resend
```

See [Provider configuration](guides/PROVIDERS.md).
