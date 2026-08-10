param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$AssetBaseUrl
)

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $packageDirectory 'developer-files\conecta-d2c-fortaleza.template.html'
$destination = Join-Path $packageDirectory 'developer-files\conecta-d2c-fortaleza-pronto.html'
$normalizedUrl = $AssetBaseUrl.Trim().TrimEnd('/')
$template = [System.IO.File]::ReadAllText($source)

if ($template.IndexOf('__ASSET_BASE_URL__', [System.StringComparison]::Ordinal) -lt 0) {
  throw 'Token de URL não encontrado. Não use este script em um arquivo já preparado.'
}

$prepared = $template.Replace('__ASSET_BASE_URL__', $normalizedUrl)
if ($prepared -match '__ASSET_BASE_URL__') {
  throw 'A URL dos assets não foi aplicada integralmente.'
}

[System.IO.File]::WriteAllText($destination, $prepared, [System.Text.UTF8Encoding]::new($false))
Write-Host "HTML pronto: $destination"
Write-Host "Base de assets: $normalizedUrl"
