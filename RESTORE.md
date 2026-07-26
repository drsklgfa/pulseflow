# Restore and verification guide

This file is the continuity point for PulseFlow v1.0.1.

## Restore from the checkpoint ZIP

```bash
unzip pulseflow-v1.0.1-github-pages-ready.zip
cd pulseflow-v1.0.1
```

On Windows PowerShell:

```powershell
Expand-Archive .\pulseflow-v1.0.1-github-pages-ready.zip -DestinationPath .
Set-Location .\pulseflow-v1.0.1
```

## Verify archive integrity

Linux/macOS:

```bash
sha256sum -c pulseflow-v1.0.1-github-pages-ready.zip.sha256
```

PowerShell:

```powershell
Get-FileHash .\pulseflow-v1.0.1-github-pages-ready.zip -Algorithm SHA256
```

Compare the result with the `.sha256` file delivered beside the archive.

## Verify repository contents

```bash
python3 scripts/validate_repository.py
python3 scripts/create_manifest.py
```

`MANIFEST.json` contains the SHA-256 hash and byte count of every source artifact in the checkpoint.

## Complete runtime validation

With internet access and Docker installed:

```bash
npm install --no-audit --no-fund
npm run prisma:generate
npm run typecheck
npm run test:coverage
docker compose config --quiet
docker compose up --build
```

Then verify:

```text
Dashboard:  http://localhost:3000
Swagger:    http://localhost:3333/docs
Mailpit:    http://localhost:8025
Readiness:  http://localhost:3333/api/v1/health/ready
```

## Database reset

```bash
docker compose down -v --remove-orphans
docker compose up --build
```

## GitHub restoration

```bash
git init
git add .
git commit -m "feat: release PulseFlow portfolio edition v1.0.1"
git branch -M main
git remote add origin https://github.com/drsklgfa/pulseflow.git
git push -u origin main
```

After the first push, activate and dispatch GitHub Pages:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\enable-github-pages.ps1
```

Then monitor `.github/workflows/pages.yml`. After CI succeeds, create tag `v1.0.1`.
