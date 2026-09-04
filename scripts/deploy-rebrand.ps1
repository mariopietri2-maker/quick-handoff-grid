# fresh2go rebrand deploy helper
# Commits ONLY the fresh2go branding changes and pushes to origin/main.
# This triggers the Railway / Vercel auto-deploy for the live site.
#
# Important: this repo also contains OTHER unrelated uncommitted changes
# (workflows, sql, native files, assets). This script intentionally stages
# ONLY files that contain the new "fresh2go" brand token, so the deploy commit
# does NOT sweep unrelated divergent work into production.
#
# Requirements: git on PATH + credentials for origin. Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-rebrand.ps1

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath ".\.git")) {
    Write-Error "No .git here. Run this from the quick-handoff-grid repo root."
}

Write-Host "==> Checking git availability"
git --version | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Error "git not found on PATH." }

# Sanity: fail safeties
Write-Host "==> Current branch (must be main)"
git rev-parse --abbrev-ref HEAD | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Staging ONLY fresh2go-branded files"
# Stage by token match (case-sensitive exact new brand). This is the set of
# files edited for the rebrand; the old project never contained "fresh2go".
$staged = @()
Get-ChildItem -Path "." -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|\\dist\\|\\e2e-artifacts\\|\\.git\\|\\.gradle\\|\\build\\|\\android-' } |
    ForEach-Object {
        $ext = $_.Extension.ToLower()
        if ($ext -notin @('.ts','.tsx','.js','.jsx','.kt','.java','.html','.json','.xml','.css','.md','.txt','.svg','.ps1','.sh','.py','.toml')) { return }
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        if ($null -ne $c -and ($c.Contains('fresh2go') -or $c.Contains('FRESH2GO') -or $c.Contains('fresh 2go'))) {
            $path = $_.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
            $staged += $path
            git add -- "$path"
        }
    }

$staged = $staged | Sort-Object -Unique
Write-Host "Staged $($staged.Count) fresh2go-branded files."
$staged | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "==> Staged diff stat (branding only)"
git diff --cached --stat

Write-Host ""
Write-Host "NOTE: unrelated modified files are left UNSTAGED and will NOT be deployed."
git status --short

Write-Host ""
Write-Host "Confirm the staged diff above, then continue? (y/n)"
$resp = Read-Host
if ($resp -notmatch '^y') { Write-Host "Aborted (nothing committed)."; exit 0 }

Write-Host "==> Commit"
git commit -m "Rebrand to fresh2go (basket logo) across web, PWA, native apps, supabase"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Push to origin/main (triggers Railway/Vercel deploy)"
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Push failed. Check credentials and rerun: git push origin main"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Done. Live deploy triggered from commit on main."
