# compiler.ps1 — Compile memoire.tex (or another document of this folder, e.g.
# jeu-seau.tex) into a PDF with MiKTeX or TeX Live, without latexmk (so no Perl
# is needed): pdflatex, biber, then pdflatex twice for the table of contents and
# cross-references. Run from any folder:
#   powershell -ExecutionPolicy Bypass -File memoire\rapport\compiler.ps1 [jeu-seau]
# Stops at the first failing step and points at the log.

param([string]$Document = "memoire")

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

foreach ($tool in @("pdflatex", "biber")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Error "$tool introuvable : installez MiKTeX (winget install MiKTeX.MiKTeX) puis rouvrez le terminal."
    }
}

$steps = @(
    @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "$Document.tex"),
    @("biber", $Document),
    @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "$Document.tex"),
    @("pdflatex", "-interaction=nonstopmode", "-halt-on-error", "$Document.tex")
)
foreach ($step in $steps) {
    Write-Host "> $($step -join ' ')"
    & $step[0] $step[1..($step.Length - 1)] | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Échec de '$($step[0])' : voir $Document.log (ou $Document.blg pour biber)."
    }
}
Write-Host "OK : $PSScriptRoot\$Document.pdf"
