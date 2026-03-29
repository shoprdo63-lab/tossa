# AliSmart Finder Pro - Windows Build Script
# This PowerShell script builds the extension and prepares it for distribution

param(
    [switch]$Dev,
    [switch]$Zip,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ErrorMsg($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Info($message) {
    Write-Host "ℹ️  $message" -ForegroundColor Yellow
}

Write-Host "🚀 AliSmart Finder Pro - Build Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Success "Node.js version: $nodeVersion"
} catch {
    Write-ErrorMsg "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
}

# Extract major version
$majorVersion = [int]($nodeVersion -replace 'v', '').Split('.')[0]
if ($majorVersion -lt 18) {
    Write-ErrorMsg "Node.js version 18+ is required. Current version: $nodeVersion"
    exit 1
}

# Clean previous build
Write-Info "Cleaning previous build..."
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}
Write-Success "Cleaned dist/ directory"

# Install dependencies if needed
if ((-not (Test-Path "node_modules")) -or $Install) {
    Write-Info "Installing dependencies..."
    try {
        npm install
        Write-Success "Dependencies installed"
    } catch {
        Write-ErrorMsg "Failed to install dependencies"
        exit 1
    }
}

# Determine build mode
if ($Dev) {
    $buildMode = "development"
    Write-Info "Building in DEVELOPMENT mode..."
} else {
    $buildMode = "production"
    Write-Info "Building in PRODUCTION mode..."
}

# Build with Vite
Write-Info "Running Vite build..."
try {
    npm run build -- --mode $buildMode
    Write-Success "Build completed successfully!"
} catch {
    Write-ErrorMsg "Build failed"
    exit 1
}

# Verify dist contents
Write-Info "Verifying build output..."

$requiredFiles = @(
    "dist\manifest.json",
    "dist\content.js",
    "dist\background.js",
    "dist\index.html"
)

$allFilesPresent = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-ErrorMsg "$file not found"
        $allFilesPresent = $false
    }
}

if (-not $allFilesPresent) {
    Write-ErrorMsg "Build verification failed"
    exit 1
}

Write-Success "All required files present in dist/"

# Display build info
Write-Info "Build Summary:"
Write-Host "  📦 Content Script: dist\content.js"
Write-Host "  📦 Background: dist\background.js"
Write-Host "  📦 Sidebar UI: dist\index.html"
Write-Host "  📦 Manifest: dist\manifest.json"
Write-Host "  📦 Assets: dist\assets\"

# Count files in dist
$fileCount = (Get-ChildItem -Path "dist" -Recurse -File).Count
Write-Info "Total files in dist/: $fileCount"

# Create ZIP for distribution if in production mode
if ((-not $Dev) -and $Zip) {
    Write-Info "Creating distribution ZIP..."
    
    # Get version from package.json
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $version = $packageJson.version
    $zipName = "alismart-finder-pro-v$version.zip"
    
    if (Test-Path $zipName) {
        Remove-Item $zipName -Force
    }
    
    try {
        Compress-Archive -Path "dist\*" -DestinationPath $zipName -Force
        Write-Success "Created $zipName"
        
        $zipInfo = Get-Item $zipName
        Write-Info "ZIP size: $([math]::Round($zipInfo.Length / 1KB, 2)) KB"
    } catch {
        Write-ErrorMsg "Failed to create ZIP file"
    }
}

Write-Success "Build process complete! 🎉"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Open Chrome and go to chrome://extensions/"
Write-Host "  2. Enable 'Developer mode'"
Write-Host "  3. Click 'Load unpacked' and select the 'dist' folder"
Write-Host ""

# Pause if running by double-click
if (-not $Host.Name.Contains("ISE")) {
    Write-Host "Press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
