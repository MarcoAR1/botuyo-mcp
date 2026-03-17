#!/usr/bin/env pwsh
# deploy.ps1 - Publish @botuyo/mcp to npm
# Usage: .\deploy.ps1 [patch|minor|major]
#        .\deploy.ps1          (default: patch)

param(
  [string]$Bump = "patch"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host "`n== @botuyo/mcp Deploy ==" -ForegroundColor Cyan

# ── 1. Validate bump type ──────────────────────────────────────────────────────
if ($Bump -notin @("patch", "minor", "major")) {
  Write-Host "❌ Invalid bump type: $Bump. Use patch, minor, or major." -ForegroundColor Red
  exit 1
}

Set-Location $ProjectDir

# ── 2. Build ───────────────────────────────────────────────────────────────────
Write-Host "[1/4] Building TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build failed." -ForegroundColor Red; exit 1 }
Write-Host "  ✅ Build OK" -ForegroundColor Green

# ── 3. Bump version ───────────────────────────────────────────────────────────
Write-Host "[2/4] Bumping version ($Bump)..." -ForegroundColor Yellow
$NewVersion = (npm version $Bump --no-git-tag-version) -replace "^v", ""
Write-Host "  ✅ New version: $NewVersion" -ForegroundColor Green

# ── 4. Git commit + tag ───────────────────────────────────────────────────────
Write-Host "[3/4] Committing and tagging..." -ForegroundColor Yellow
git add package.json package-lock.json
git commit --no-verify -m "chore: release v$NewVersion"
git tag "v$NewVersion"
git push --no-verify origin main --tags
Write-Host "  ✅ Pushed v$NewVersion" -ForegroundColor Green

# ── 5. Publish ────────────────────────────────────────────────────────────────
Write-Host "[4/4] Publishing to npm..." -ForegroundColor Yellow
npm publish --access public
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Publish failed." -ForegroundColor Red; exit 1 }

Write-Host "`n== Published @botuyo/mcp@$NewVersion ==" -ForegroundColor Cyan
Write-Host "  npm: https://www.npmjs.com/package/@botuyo/mcp" -ForegroundColor White
