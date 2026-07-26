# GitHub Pages automatic portfolio deployment

PulseFlow includes a dedicated GitHub Actions workflow at `.github/workflows/pages.yml`.
It builds the React application in standalone demo mode and publishes `apps/web/dist` to GitHub Pages.

## What happens on every push to `main`

1. GitHub checks out the repository.
2. Node.js 24 is configured.
3. GitHub Pages metadata is read, including the correct repository base path.
4. Dependencies are installed with `npm ci` when a lockfile exists, with a safe first-push fallback to `npm install`.
5. Vite builds the browser-only demo with `VITE_DEMO_MODE=true`.
6. `.nojekyll`, a `404.html` fallback and deployment metadata are added.
7. The static artifact is uploaded and deployed to the `github-pages` environment.

The base URL is not hardcoded. A fork or renamed repository is built using the path returned by `actions/configure-pages`.

## Enable Pages after the first push

GitHub requires repository administrator permission to create the Pages site. The included helper performs that repository-level configuration and dispatches the workflow.

### Windows / PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\enable-github-pages.ps1
```

### Linux / macOS

```bash
./scripts/enable-github-pages.sh
```

Both helpers also place the published URL in the repository **Website** field and default to `drsklgfa/pulseflow`. Other repositories can be supplied explicitly:

```powershell
.\scripts\enable-github-pages.ps1 -Owner "YOUR-USER" -Repository "YOUR-REPO"
```

```bash
./scripts/enable-github-pages.sh YOUR-USER YOUR-REPO
```

## Manual equivalent

In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. Then run **Actions → Deploy interactive demo to GitHub Pages → Run workflow**.

## Expected address

```text
https://drsklgfa.github.io/pulseflow/
```

The GitHub Pages version is an interactive browser demo. It persists state in local storage and does not expose API keys, a database or external services.
