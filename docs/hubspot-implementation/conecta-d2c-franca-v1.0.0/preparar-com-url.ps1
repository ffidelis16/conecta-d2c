param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$AssetBaseUrl
)

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $packageDirectory 'developer-files\conecta-d2c-franca.template.html'
$destination = Join-Path $packageDirectory 'developer-files\conecta-d2c-franca-pronto.html'
$template = [System.IO.File]::ReadAllText($source)
$prepared = $template.Replace('__ASSET_BASE_URL__', $AssetBaseUrl.Trim().TrimEnd('/'))
if ($prepared -match '__ASSET_BASE_URL__') { throw 'A URL dos assets nao foi aplicada.' }
[System.IO.File]::WriteAllText($destination, $prepared, [System.Text.UTF8Encoding]::new($false))
Write-Host "HTML pronto: $destination"
