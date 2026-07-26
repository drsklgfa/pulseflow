[CmdletBinding()]
param(
    [string]$Owner = "drsklgfa",
    [string]$Repository = "pulseflow",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$repoFullName = "$Owner/$Repository"

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. Install GitHub CLI and try again."
    }
}

Assert-Command "gh"

Write-Host "Checking GitHub authentication..." -ForegroundColor Cyan
gh auth status | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated. Run: gh auth login"
}

Write-Host "Checking repository $repoFullName..." -ForegroundColor Cyan
gh repo view $repoFullName --json nameWithOwner,defaultBranchRef | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Repository $repoFullName was not found. Push the project first, then run this script again."
}

Write-Host "Enabling GitHub Pages with GitHub Actions as the build source..." -ForegroundColor Cyan
$null = gh api "repos/$repoFullName/pages" 2>$null
if ($LASTEXITCODE -eq 0) {
    gh api --method PUT "repos/$repoFullName/pages" -f build_type=workflow -F https_enforced=true | Out-Null
} else {
    gh api --method POST "repos/$repoFullName/pages" -f build_type=workflow | Out-Null
}
if ($LASTEXITCODE -ne 0) {
    throw "GitHub Pages could not be enabled. Confirm that you are the repository owner/admin."
}

Write-Host "Enabling and dispatching the Pages workflow..." -ForegroundColor Cyan
gh workflow enable pages.yml --repo $repoFullName | Out-Null
gh workflow run pages.yml --repo $repoFullName --ref $Branch | Out-Null

$siteUrl = "https://$Owner.github.io/$Repository/"
Write-Host "Adding the live demo to the repository Website field..." -ForegroundColor Cyan
gh repo edit $repoFullName --homepage $siteUrl | Out-Null

Write-Host "GitHub Pages is configured." -ForegroundColor Green
Write-Host "Workflow: https://github.com/$repoFullName/actions/workflows/pages.yml"
Write-Host "Expected site: $siteUrl"
Write-Host "The first deployment will appear after the GitHub Actions run finishes."
