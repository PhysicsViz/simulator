# compiler.ps1 — Compile ia-utilisation.tex (one page, no bibliography) with
# pdflatex, twice. Run from any folder:
#   powershell -ExecutionPolicy Bypass -File memoire\ia-utilisation\compiler.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
foreach ($pass in 1..2) {
    & pdflatex -interaction=nonstopmode -halt-on-error ia-utilisation.tex | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Échec de pdflatex : voir ia-utilisation.log."
    }
}
Write-Host "OK : $PSScriptRoot\ia-utilisation.pdf"
