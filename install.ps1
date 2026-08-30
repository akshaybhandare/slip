# ==============================================================================
# Slip Universal Installer (Windows PowerShell)
# Usage:
#   irm https://get.slip.so/install.ps1 | iex
#   irm https://raw.githubusercontent.com/akshaybhandare/Slip/main/install.ps1 | iex
# ==============================================================================
$ErrorActionPreference = "Stop"

$Repo = "akshaybhandare/Slip"
$DefaultDir = "$HOME\.slip"
$DefaultPort = "3000"

Write-Host @"
   ____  ___      
  / __/ / (_)___  
 _\ \  / / / __ \ 
/___/ /_/_/ .___/ 
         /_/      
 A lightning-fast, self-hosted visual bookmark archive
"@ -ForegroundColor Cyan

# 1. Determine Installation Path
if ($env:SLIP_DIR) {
    $SlipDir = $env:SLIP_DIR
} elseif ([Environment]::UserInteractive) {
    $InputPath = Read-Host "Install path [$DefaultDir]"
    $SlipDir = if ($InputPath) { $InputPath } else { $DefaultDir }
} else {
    $SlipDir = $DefaultDir
}

$Port = if ($env:PORT) { $env:PORT } else { $DefaultPort }

Write-Host "📦 Installing Slip into $SlipDir (Port: $Port)..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$SlipDir\bin", "$SlipDir\data\cache", "$SlipDir\logs" | Out-Null

# 2. Architecture & Download Precompiled Release Package
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "arm64" }
$Target = "slip-windows-$Arch.zip"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$Target"
$ZipPath = "$env:TEMP\$Target"

$Downloaded = $false
try {
    Write-Host "⬇️  Downloading Slip standalone bundle ($Target)..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -ErrorAction Stop
    Expand-Archive -Path $ZipPath -DestinationPath "$SlipDir\bin" -Force
    Remove-Item $ZipPath -ErrorAction SilentlyContinue
    $Downloaded = $true
} catch {
    Write-Host "⚠️  No precompiled GitHub release binary found, falling back to source clone..." -ForegroundColor Yellow
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Node.js is required for source fallback: https://nodejs.org" -ForegroundColor Red
        exit 1
    }

    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue
    if ($ScriptDir -and (Test-Path "$ScriptDir\backend\package.json") -and (Test-Path "$ScriptDir\frontend\package.json")) {
        Write-Host "📁 Copying local workspace source to $SlipDir\source..."
        New-Item -ItemType Directory -Force -Path "$SlipDir\source" | Out-Null
        Copy-Item -Recurse "$ScriptDir\backend" "$SlipDir\source\"
        Copy-Item -Recurse "$ScriptDir\frontend" "$SlipDir\source\"
        Remove-Item -Recurse -Force "$SlipDir\source\backend\node_modules", "$SlipDir\source\frontend\node_modules" -ErrorAction SilentlyContinue
    } elseif (-not (Test-Path "$SlipDir\source")) {
        git clone --depth 1 "https://github.com/$Repo.git" "$SlipDir\source"
    } else {
        git -C "$SlipDir\source" pull --quiet
    }

    # Build backend
    Set-Location -Path "$SlipDir\source\backend"
    npm install --legacy-peer-deps --quiet
    npm run build --quiet
    npm prune --omit=dev --quiet

    # Build frontend
    Set-Location -Path "$SlipDir\source\frontend"
    npm install --legacy-peer-deps --quiet
    npm run build --quiet

    # Copy assembled files to bin
    New-Item -ItemType Directory -Force -Path "$SlipDir\bin\backend", "$SlipDir\bin\frontend-dist" | Out-Null
    Copy-Item -Recurse "$SlipDir\source\backend\dist" "$SlipDir\bin\backend\"
    Copy-Item -Recurse "$SlipDir\source\backend\node_modules" "$SlipDir\bin\backend\"
    Copy-Item "$SlipDir\source\backend\package.json" "$SlipDir\bin\backend\"
    Copy-Item -Recurse "$SlipDir\source\frontend\dist\*" "$SlipDir\bin\frontend-dist\"
}

# 3. Create slip.cmd executable wrapper if not present
$WrapperPath = "$SlipDir\bin\slip.cmd"
if (-not (Test-Path $WrapperPath)) {
    @"
@echo off
set "SCRIPT_DIR=%~dp0"
set "SLIP_BASE_DIR=%~dp0.."
if not defined SLIP_DIR set "SLIP_DIR=%SLIP_BASE_DIR%"
if exist "%SCRIPT_DIR%frontend-dist" set "FRONTEND_DIST=%SCRIPT_DIR%frontend-dist"

if exist "%SCRIPT_DIR%backend\dist\cli.js" (
    node "%SCRIPT_DIR%backend\dist\cli.js" %*
) else if exist "%SCRIPT_DIR%dist\cli.js" (
    node "%SCRIPT_DIR%dist\cli.js" %*
) else if exist "%SCRIPT_DIR%slip-bin.exe" (
    "%SCRIPT_DIR%slip-bin.exe" %*
)
"@ | Set-Content -Path $WrapperPath
}

# 4. Generate slip.env Configuration
$EnvPath = "$SlipDir\slip.env"
if (-not (Test-Path $EnvPath)) {
    $Secret = [System.Guid]::NewGuid().ToString("N")
    @"
SLIP_DIR=$SlipDir
PORT=$Port
HOST=0.0.0.0
DB_PATH=$SlipDir\data\bookmarks.db
CACHE_DIR=$SlipDir\data\cache
SESSION_SECRET=$Secret
NODE_ENV=production
"@ | Set-Content -Path $EnvPath
}

# 5. Add to User PATH if not present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$BinDir = "$SlipDir\bin"
if ($UserPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$BinDir", "User")
    $env:Path += ";$BinDir"
}

# 6. Start Slip Background Daemon
Write-Host "🚀 Starting Slip..." -ForegroundColor Green
& "$BinDir\slip.cmd" start -d -p $Port

Write-Host @"

======================================================
✨ Slip installed successfully!
======================================================
🌐 Web Interface:     http://localhost:$Port
📁 Data Directory:    $SlipDir\data
⚙️  Configuration:     $SlipDir\slip.env
📋 Live Logs:         $SlipDir\logs\slip.log

💡 Manage Slip anywhere using the CLI:
   slip status      Check server status
   slip stop        Stop background server
   slip start -d    Start server as daemon
   slip logs        View live application logs
   slip uninstall   Uninstall cleanly with data protection
"@ -ForegroundColor Green
