$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if ($IsWindows -eq $false -and $env:OS -ne 'Windows_NT') { throw 'Windows is required for Rationarium.exe' }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$nodeBinary = (Get-Command node).Source
$output = Join-Path (Get-Location) 'dist\Rationarium.exe'
$blob = Join-Path (Get-Location) 'dist\rationarium.blob'
$config = Join-Path (Get-Location) 'dist\sea-config.json'
@{ main = (Join-Path (Get-Location) 'dist\server.cjs'); output = $blob; disableExperimentalSEAWarning = $true; useCodeCache = $false } | ConvertTo-Json | Set-Content -Encoding UTF8 $config
node --experimental-sea-config $config
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Copy-Item -LiteralPath $nodeBinary -Destination $output -Force
npx postject $output NODE_SEA_BLOB $blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Built $output"
