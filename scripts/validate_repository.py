#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
NOTES: list[str] = []
SKIP_PARTS = {'.git', 'node_modules', 'dist', 'coverage'}


def fail(message: str) -> None:
    ERRORS.append(message)


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid JSON {path.relative_to(ROOT)}: {exc}")
        return {}


def load_yaml(path: Path) -> object:
    try:
        return yaml.safe_load(path.read_text(encoding='utf-8'))
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid YAML {path.relative_to(ROOT)}: {exc}")
        return {}


required = [
    'README.md',
    'START_HERE.md',
    'PORTFOLIO.md',
    'RESTORE.md',
    'CHANGELOG.md',
    'SECURITY.md',
    'LICENSE',
    '.env.example',
    'compose.yaml',
    'apps/api/Dockerfile',
    'apps/worker/Dockerfile',
    'apps/web/Dockerfile',
    'packages/database/prisma/schema.prisma',
    'docs/assets/pulseflow-hero.svg',
    'docs/assets/dashboard-preview.svg',
    'docs/assets/architecture.svg',
    '.github/workflows/ci.yml',
    '.github/workflows/pages.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/dependency-review.yml',
    'docs/GITHUB_PAGES.md',
    'scripts/enable-github-pages.ps1',
    'scripts/enable-github-pages.sh',
]
for item in required:
    if not (ROOT / item).is_file():
        fail(f"Required file is missing: {item}")

json_files = []
yaml_files = []
source_files = []
for path in ROOT.rglob('*'):
    if not path.is_file() or any(part in SKIP_PARTS for part in path.relative_to(ROOT).parts):
        continue
    if path.suffix == '.json':
        json_files.append(path)
    if path.suffix in {'.yml', '.yaml'} or path.name == 'compose.yaml':
        yaml_files.append(path)
    if path.suffix in {'.ts', '.tsx', '.js', '.cjs', '.mjs', '.py', '.yml', '.yaml'}:
        source_files.append(path)

for path in json_files:
    load_json(path)
for path in yaml_files:
    load_yaml(path)

root_package = load_json(ROOT / 'package.json')
if isinstance(root_package, dict):
    if root_package.get('version') != '1.0.1':
        fail('Root package version must be 1.0.1.')
    if root_package.get('engines', {}).get('node') != '>=24.0.0':
        fail('Node engine must require Node.js 24 or newer.')

workspace_packages = [
    ROOT / 'apps/api/package.json',
    ROOT / 'apps/worker/package.json',
    ROOT / 'apps/web/package.json',
    ROOT / 'packages/contracts/package.json',
    ROOT / 'packages/database/package.json',
]
for path in workspace_packages:
    package = load_json(path)
    if isinstance(package, dict) and package.get('version') != '1.0.1':
        fail(f"Workspace version is not 1.0.1: {path.relative_to(ROOT)}")

compose = load_yaml(ROOT / 'compose.yaml')
if isinstance(compose, dict):
    services = set((compose.get('services') or {}).keys())
    expected = {'postgres', 'redis', 'mailpit', 'setup', 'api', 'worker', 'web'}
    missing = expected - services
    if missing:
        fail(f"Compose services missing: {', '.join(sorted(missing))}")

schema = (ROOT / 'packages/database/prisma/schema.prisma').read_text(encoding='utf-8')
for model in ['User', 'Payment', 'WebhookEvent', 'Notification', 'ProcessingEvent', 'AuditLog']:
    if f'model {model} ' not in schema:
        fail(f"Prisma model missing: {model}")
for unique_field in ['idempotencyKey String            @unique', 'externalEventId String    @unique']:
    if unique_field not in schema:
        fail(f"Expected Prisma idempotency constraint missing: {unique_field}")

workflow_text = '\n'.join(path.read_text(encoding='utf-8') for path in (ROOT / '.github/workflows').glob('*.yml'))
for action in ['actions/checkout@v7', 'actions/setup-node@v7', 'github/codeql-action/init@v4']:
    if action not in workflow_text:
        fail(f"Expected current GitHub Action reference missing: {action}")
if 'node-version: 24' not in workflow_text:
    fail('GitHub Actions must test on Node.js 24.')
pages_workflow = (ROOT / '.github/workflows/pages.yml').read_text(encoding='utf-8')
for expected in [
    'actions/configure-pages@v5',
    'actions/upload-pages-artifact@v4',
    'actions/deploy-pages@v4',
    'VITE_BASE_PATH: "${{ steps.pages.outputs.base_path }}/"',
    'VITE_DEMO_MODE: "true"',
    'pages: write',
    'id-token: write',
]:
    if expected not in pages_workflow:
        fail(f'Pages workflow configuration missing: {expected}')
if 'upload-pages-artifact@v5' in pages_workflow:
    fail('Invalid GitHub Pages artifact action major version remains in workflow.')

example = (ROOT / '.env.example').read_text(encoding='utf-8')
for key in ['APP_VERSION=1.0.1', 'PAYMENT_PROVIDER=mock', 'NOTIFICATION_PROVIDER=smtp']:
    if key not in example:
        fail(f"Environment example missing: {key}")

secret_patterns = {
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'Stripe live key': re.compile(r'\bsk_live_[A-Za-z0-9]{12,}'),
    'AWS access key': re.compile(r'\bAKIA[0-9A-Z]{16}\b'),
    'GitHub token': re.compile(r'\bgh[pousr]_[A-Za-z0-9_]{30,}\b'),
}
for path in source_files + [ROOT / '.env.example']:
    text = path.read_text(encoding='utf-8', errors='ignore')
    for label, pattern in secret_patterns.items():
        if pattern.search(text):
            fail(f"Possible {label} committed in {path.relative_to(ROOT)}")

for forbidden in ['apps/api/src/payments/dto/simulate-payment.dto.ts', 'apps/api/src/payments/payments.service.test.ts']:
    if (ROOT / forbidden).exists():
        fail(f"Obsolete v0.1 file still exists: {forbidden}")

result = subprocess.run(
    ['node', 'scripts/validate_typescript.cjs'],
    cwd=ROOT,
    text=True,
    capture_output=True,
    check=False,
)
if result.returncode != 0:
    fail('TypeScript syntax validation failed:\n' + result.stdout + result.stderr)
else:
    NOTES.append(result.stdout.strip())

file_count = sum(
    1
    for path in ROOT.rglob('*')
    if path.is_file() and not any(part in SKIP_PARTS for part in path.relative_to(ROOT).parts)
)
NOTES.append(f'Repository files inspected: {file_count}')
NOTES.append(f'JSON files parsed: {len(json_files)}')
NOTES.append(f'YAML files parsed: {len(yaml_files)}')

for note in NOTES:
    print(f'[OK] {note}')
if ERRORS:
    for error in ERRORS:
        print(f'[ERROR] {error}', file=sys.stderr)
    print(f'Validation failed with {len(ERRORS)} error(s).', file=sys.stderr)
    raise SystemExit(1)
print('Repository validation passed.')
