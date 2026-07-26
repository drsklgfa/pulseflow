# Validation report — PulseFlow v1.0.1

Date: 2026-07-25

## Final source validation

| Validation | Result |
| --- | --- |
| Required project, documentation and workflow files | Passed |
| Workspace versions (`1.0.1`) and Node engine policy | Passed |
| JSON parsing | Passed |
| YAML and Docker Compose parsing | Passed |
| TypeScript/TSX isolated syntax transpilation | Passed |
| Prisma model inventory and unique idempotency fields | Passed |
| Required Compose services | Passed |
| GitHub Actions references and Node 24 configuration | Passed |
| Pages permissions, dynamic base path and deploy action chain | Passed |
| PowerShell/Bash Pages activation helpers present | Passed |
| Common real-secret signature scan | Passed |
| Obsolete v0.1 source conflict scan | Passed |
| Source manifest generation and verification | Passed |
| Final ZIP integrity and checksum | Performed during checkpoint packaging |

## Executed pure runtime checks

The following modules were transpiled and executed with the Node.js runtime available in the generation environment:

- decimal amounts to integer minor units;
- ISO currency normalization;
- valid and invalid payment transitions;
- exponential retry delay calculation;
- deterministic SHA-256 idempotency keys;
- access-token creation, verification and expiry;
- Scrypt password hashing and comparison;
- valid and invalid HMAC webhook signatures;
- Brazilian real formatting and title formatting;
- HTML escaping and notification template rendering.

All checks passed.

## Additional review corrections

The final review corrected:

1. rate-limit environment names so Compose, `.env.example` and the API guard use the same settings;
2. shared package build ordering before Prisma seed, tests and consumer type-checking;
3. invalid webhooks with unknown payment IDs so rejected security events cannot violate the foreign key;
4. obsolete frontend fixture and duplicate pull-request template files;
5. GitHub Pages and security workflows for current action major versions;
6. repository-aware Vite base paths, `.nojekyll`, `404.html` fallback and Pages deployment metadata;
7. activation helpers that create/update the Pages site with `build_type=workflow` and dispatch `pages.yml`.

## Runtime validation boundary

The generation environment does not provide Docker and cannot resolve `registry.npmjs.org`. Therefore it was not possible here to install the complete third-party dependency graph, execute Vitest against installed libraries, run Prisma against a live PostgreSQL instance, start Redis/BullMQ or perform a Docker smoke test.

Those runtime gates are implemented in `.github/workflows/ci.yml`, which provisions PostgreSQL and Redis, installs packages, generates Prisma Client, deploys migrations, seeds data, performs strict TypeScript checks, runs unit and integration tests, builds all applications and validates Docker Compose.

The package is a final portfolio source checkpoint, but the first green CI run remains the required external proof of full runtime compatibility.
