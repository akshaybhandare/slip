# ==============================================================================
# Slip Universal Uninstaller (Windows PowerShell)
# Usage:
#   irm https://get.slip.so/uninstall.ps1 | iex
#   .\uninstall.ps1 [-Dir "C:\custom\path"] [-Purge]
# ==============================================================================
$ErrorActionPreference = "Stop"
param (
    [string]$Dir = "$HOME\.slip",
    [switch]$Purge = $false,
    [switch]$Force = $false
)

Write-Host "======================================================" -ForegroundColor Yellow
Write-Host "🗑️  Slip Windows Uninstaller" -ForegroundColor Yellow
Write-Host "Target directory: $Dir" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Yellow

# 1. Stop Running Background Instance
$PidFile = "$Dir\.slip.pid"
if (Test-Path $PidFile) {
    try {
        $ProcessId = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($ProcessId) {
            Write-Host "🛑 Stopping running Slip process (PID: $ProcessId)..."
            Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
        }
    } catch {}
}

# 2. Handle Data Protection Prompt
if ((Test-Path "$Dir\data") -and -not $Purge -and -not $Force -and [Environment]::UserInteractive) {
    Write-Host ""
    $Choice = Read-Host "Do you want to KEEP your database & bookmarks in $Dir\data? [Y/n]"
    if ($Choice -match "^[Nn]") {
        $Purge = $true
    }
}

# 3. Clean up Files
if ($Purge) {
    Write-Host "🔥 Completely removing $Dir..." -ForegroundColor Red
    Remove-Item -Recurse -Force $Dir -ErrorAction SilentlyContinue
    Write-Host "`n✓ Slip and all associated data completely removed." -ForegroundColor Green
} else {
    Write-Host "🧹 Removing application files and keeping data..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "$Dir\bin", "$Dir\source", "$Dir\logs", "$Dir\slip.env", "$Dir\.slip.pid" -ErrorAction SilentlyContinue
    Write-Host "`n✓ Slip application uninstalled." -ForegroundColor Green
    Write-Host "ℹ️  Database preserved at: $Dir\data`n" -ForegroundColor Yellow
}
