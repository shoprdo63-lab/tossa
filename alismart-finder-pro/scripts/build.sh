#!/bin/bash

# Build script for AliSmart Finder Pro Chrome Extension
# This script builds the extension and prepares it for distribution

echo "🚀 AliSmart Finder Pro - Build Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js version: $(node -v)"

# Clean previous build
print_info "Cleaning previous build..."
rm -rf dist
print_success "Cleaned dist/ directory"

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "$1" == "--install" ]; then
    print_info "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    print_success "Dependencies installed"
fi

# Determine build mode
if [ "$1" == "--dev" ] || [ "$1" == "-d" ]; then
    BUILD_MODE="development"
    print_info "Building in DEVELOPMENT mode..."
else
    BUILD_MODE="production"
    print_info "Building in PRODUCTION mode..."
fi

# Build with Vite
print_info "Running Vite build..."
npm run build -- --mode $BUILD_MODE

if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi

print_success "Build completed successfully!"

# Verify dist contents
print_info "Verifying build output..."

if [ ! -f "dist/manifest.json" ]; then
    print_error "manifest.json not found in dist/"
    exit 1
fi

if [ ! -f "dist/content.js" ]; then
    print_error "content.js not found in dist/"
    exit 1
fi

if [ ! -f "dist/background.js" ]; then
    print_error "background.js not found in dist/"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    print_error "index.html not found in dist/"
    exit 1
fi

print_success "All required files present in dist/"

# Display build info
print_info "Build Summary:"
echo "  📦 Content Script: dist/content.js"
echo "  📦 Background: dist/background.js"
echo "  📦 Sidebar UI: dist/index.html"
echo "  📦 Manifest: dist/manifest.json"
echo "  📦 Assets: dist/assets/"

# Count files in dist
FILE_COUNT=$(find dist -type f | wc -l)
print_info "Total files in dist/: $FILE_COUNT"

# Create ZIP for distribution if in production mode
if [ "$BUILD_MODE" == "production" ] && ([ "$2" == "--zip" ] || [ "$1" == "--zip" ]); then
    print_info "Creating distribution ZIP..."
    
    VERSION=$(cat package.json | grep '"version"' | head -1 | cut -d'"' -f4)
    ZIP_NAME="alismart-finder-pro-v${VERSION}.zip"
    
    cd dist
    zip -r "../$ZIP_NAME" . -x "*.map"  # Exclude source maps
    cd ..
    
    if [ -f "$ZIP_NAME" ]; then
        print_success "Created $ZIP_NAME"
        ls -lh "$ZIP_NAME"
    else
        print_error "Failed to create ZIP file"
    fi
fi

print_success "Build process complete! 🎉"
echo ""
echo "Next steps:"
echo "  1. Open Chrome and go to chrome://extensions/"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked' and select the 'dist' folder"
echo ""
