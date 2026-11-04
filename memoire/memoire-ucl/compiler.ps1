# compiler.ps1 — Compile the EPL thesis skeleton: first the official covers
# (couverture/couverture.tex -> couverture.pdf), then the body memoire.tex with
# pdflatex, biber, pdflatex x2. Run from any folder:
#   powershell -ExecutionPolicy Bypass -File memoire\memoire-ucl\compiler.ps1
# Stops at the first failing step and points at the log.

$ErrorActionPreference = "Stop"

foreach ($tool in @("pdflatex", "biber")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Error "$tool introuvable : installez MiKTeX (winget install MiKTeX.MiKTeX) puis rouvrez le terminal."
    }
}

function Invoke-Step($folder, $command) {
    Push-Location $folder
    try {
        Write-Host "> $($command -join ' ')"
        & $command[0] $command[1..($command.Length - 1)] | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Échec de '$($command[0])' dans $folder : voir le fichier .log (ou .blg pour biber)."
        }
    } finally {
        Pop-Location
    }
}

$covers = Join-Path $PSScriptRoot "couverture"
Invoke-Step $covers @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "couverture.tex")
foreach ($step in @(
    @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "memoire.tex"),
    @("biber", "memoire"),
    @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "memoire.tex"),
    @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "memoire.tex")
)) {
    Invoke-Step $PSScriptRoot $step
}
Write-Host "OK : $PSScriptRoot\memoire.pdf"
