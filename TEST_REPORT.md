# Test report — PulseFlow v1.0.1

## Static validation

| Check | Result |
| --- | --- |
| Required repository files | Passed |
| JSON parsing | Passed |
| YAML parsing | Passed |
| TypeScript/TSX syntax transpilation | Passed |
| Prisma model and uniqueness checks | Passed |
| Workspace version consistency | Passed |
| Compose service inventory | Passed |
| GitHub Actions version policy | Passed |
| GitHub Pages permission and action chain | Passed |
| Dynamic Pages base-path configuration | Passed |
| Bash activation helper syntax | Passed |
| Common committed-secret patterns | Passed |
| ZIP integrity | Generated during packaging |
| Manifest SHA-256 inventory | Passed |

## Executed pure runtime checks

Domain, security, formatting and notification-template modules were transpiled and executed directly with Node.js. All assertions passed, including token expiry, password verification, invalid signatures and HTML escaping.

## Automated test sources included

| Layer | Coverage focus |
| --- | --- |
| Contracts unit tests | Domain transitions, money normalization, idempotency, tokens, passwords and webhook signatures |
| API unit tests | Self-contained payment provider behavior |
| Worker unit tests | Templates and deterministic retry failure modes |
| Web unit tests | Currency, dates and status formatting |
| API integration tests | PostgreSQL, Redis, login, authorization, idempotent creation, signed events, persistence and queueing |

## Runtime execution status in this artifact environment

Not executed because Docker is unavailable and DNS access to `registry.npmjs.org` is blocked. The CI workflow installs dependencies and provisions PostgreSQL/Redis service containers to execute these tests after the repository is pushed.
