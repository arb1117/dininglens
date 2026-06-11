# DiningLens backend smoke test
#
# Verifies the entitlement/identity perimeter without spending AI calls:
#   - /health is public
#   - gated routes return 401 when no install ID header is sent
#   - /entitlements/me works with an install ID (no active entitlement required)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/smoke-backend.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/smoke-backend.ps1 -BaseUrl https://dininglens-api.onrender.com

param(
    [string]$BaseUrl = "http://127.0.0.1:3001",
    [string]$InstallId = "smoke-test-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
)

$BaseUrl = $BaseUrl.TrimEnd('/')

function Invoke-SmokeRequest {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers,
        [string]$Body
    )
    $params = @{
        Method          = $Method
        Uri             = "$BaseUrl$Path"
        TimeoutSec      = 60
        UseBasicParsing = $true
        ErrorAction     = 'Stop'
    }
    if ($Headers) { $params.Headers = $Headers }
    if ($Body) {
        $params.Body = $Body
        $params.ContentType = 'application/json'
    }
    try {
        $res = Invoke-WebRequest @params
        return [int]$res.StatusCode
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        return -1   # network error / server unreachable
    }
}

$idHeader = @{ 'X-DiningLens-Install-Id' = $InstallId }

$checks = @(
    @{ Name = 'GET /health (public)';                      Method = 'GET';  Path = '/health';            Headers = $null;      Body = $null;   Expected = 200 },
    @{ Name = 'GET /entitlements/me (no install ID)';      Method = 'GET';  Path = '/entitlements/me';   Headers = $null;      Body = $null;   Expected = 401 },
    @{ Name = 'GET /entitlements/me (with install ID)';    Method = 'GET';  Path = '/entitlements/me';   Headers = $idHeader;  Body = $null;   Expected = 200 },
    @{ Name = 'GET /barcode?code=12345 (no install ID)';   Method = 'GET';  Path = '/barcode?code=12345'; Headers = $null;     Body = $null;   Expected = 401 },
    @{ Name = 'POST /calculate-tdee (no install ID)';      Method = 'POST'; Path = '/calculate-tdee';    Headers = $null;      Body = '{}';    Expected = 401 },
    @{ Name = 'POST /lookup-nutrition (no install ID)';    Method = 'POST'; Path = '/lookup-nutrition';  Headers = $null;      Body = '{}';    Expected = 401 }
)

Write-Host ""
Write-Host "DiningLens backend smoke test"
Write-Host "Base URL:   $BaseUrl"
Write-Host "Install ID: $InstallId (throwaway)"
Write-Host ""

$results = @()
foreach ($check in $checks) {
    $actual = Invoke-SmokeRequest -Method $check.Method -Path $check.Path -Headers $check.Headers -Body $check.Body
    $results += [pscustomobject]@{
        Endpoint = $check.Name
        Expected = $check.Expected
        Actual   = if ($actual -eq -1) { 'UNREACHABLE' } else { $actual }
        Result   = if ($actual -eq $check.Expected) { 'PASS' } else { 'FAIL' }
    }
}

$results | Format-Table -AutoSize | Out-String | Write-Host

$failed = @($results | Where-Object { $_.Result -eq 'FAIL' })
if ($failed.Count -gt 0) {
    Write-Host "$($failed.Count) of $($results.Count) checks FAILED." -ForegroundColor Red
    exit 1
}

Write-Host "All $($results.Count) checks passed." -ForegroundColor Green
exit 0
