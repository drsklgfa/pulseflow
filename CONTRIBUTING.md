# Contributing

## Development setup

1. Fork and clone the repository.
2. Use Node.js 24 and Docker Compose v2.
3. Run `npm install` and `npm run prisma:generate`.
4. Start dependencies or the complete stack with Docker Compose.
5. Keep changes focused and update documentation for observable behavior.

## Before opening a pull request

```bash
npm run validate:repo
npm run typecheck
npm run test:coverage
RUN_INTEGRATION=true npm run test:integration
npm run build
docker compose config --quiet
```

Use conventional, descriptive commits such as:

```text
feat: add outbound webhook notification adapter
fix: prevent duplicate notification creation
chore: update GitHub Actions runtime
```

Never commit `.env`, provider credentials, production payloads or personal customer data.
