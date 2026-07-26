# Start here

PulseFlow can be evaluated in three ways.

## 1. Fastest: GitHub Pages

After the first push, run `powershell -ExecutionPolicy Bypass -File .\scripts\enable-github-pages.ps1`. It activates Pages with GitHub Actions and dispatches the `pages.yml` workflow, which publishes an interactive browser demo at:

```text
https://drsklgfa.github.io/pulseflow/
```

It stores demo state in the browser and does not need a backend.

## 2. Complete: Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:3000`, sign in with the demo credentials from the README and use Failure Lab.

## 3. Technical review

Start with these files:

1. `docs/ARCHITECTURE.md`
2. `packages/database/prisma/schema.prisma`
3. `apps/api/src/webhooks/webhooks.service.ts`
4. `apps/worker/src/processor.ts`
5. `.github/workflows/ci.yml`
6. `docs/TESTING.md`

## Portfolio checklist after upload

- Confirm CI is green.
- Run the included Pages activation helper and confirm the deployment workflow is green.
- Add repository description and topics from `PORTFOLIO.md`.
- Add the Pages URL to the repository Website field.
- Create a `v1.0.1` release after CI succeeds.
- Pin the repository to the GitHub profile.
