# One-shot fix for "support AI / AI features not working".
# Root cause: deployed Supabase edge functions are STALE (they only check the
# legacy LOVABLE_API_KEY env var) AND the AI gateway key is not set on the project.
#
# How to run (PowerShell, from repo root):
#   $env:SUPABASE_ACCESS_TOKEN = "<your supabase access token>"
#   $env:AI_GATEWAY_API_KEY    = "<your ai gateway key>"   # optional if already set
#   powershell -ExecutionPolicy Bypass -File scripts/fix-ai.ps1
#
# Requires Node.js (npx). Uses the Supabase CLI via npx so no global install needed.

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "ERROR: Set SUPABASE_ACCESS_TOKEN first (https://supabase.com/dashboard/account/tokens)" -ForegroundColor Red
  exit 1
}

$REF = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "ojkesspghyqmjmupybva" }
Write-Host "Project ref: $REF" -ForegroundColor Cyan

# 1. Link the project (idempotent)
npx --yes supabase@latest link --project-ref $REF
if ($LASTEXITCODE -ne 0) { throw "supabase link failed" }

# 2. Set the AI gateway key secret (both new + legacy name for compatibility)
if ($env:AI_GATEWAY_API_KEY) {
  Write-Host "Setting AI_GATEWAY_API_KEY secret..." -ForegroundColor Cyan
  npx --yes supabase@latest secrets set AI_GATEWAY_API_KEY=$env:AI_GATEWAY_API_KEY --project-ref $REF
  npx --yes supabase@latest secrets set LOVABLE_API_KEY=$env:AI_GATEWAY_API_KEY --project-ref $REF
}

# 3. Redeploy ALL edge functions that talk to the AI gateway with CURRENT code
#    (current source checks AI_GATEWAY_API_KEY || LOVABLE_API_KEY, and health_check
#     no longer requires the key — this fixes the stale "LOVABLE_API_KEY not configured" errors).
$functions = @(
  "support-ai",
  "generate-hero-card",
  "admin-setting-advisor",
  "parse-receipt",
  "ai-dynamic-pricing",
  "predict-dispatch-time"
)
foreach ($f in $functions) {
  Write-Host "Deploying $f..." -ForegroundColor Cyan
  npx --yes supabase@latest functions deploy $f --project-ref $REF --no-verify-jwt
  if ($LASTEXITCODE -ne 0) { Write-Host "WARN: deploy of $f failed" -ForegroundColor Yellow }
}

Write-Host "`nDone. Verify: POST https://$REF.supabase.co/functions/v1/support-ai" -ForegroundColor Green
Write-Host '  body: {"action":"health_check"}  ->  should return {"ok":true}' -ForegroundColor Green
Write-Host "If the AI gateway key above was a Lovable-only key and is now dead, replace it in the project secrets with a working AI_GATEWAY_API_KEY." -ForegroundColor Yellow
