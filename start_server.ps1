#!/usr/bin/env pwsh
# Travello Backend Server Startup Script
# This script starts the Django backend server with proper error handling

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Travello Backend Server" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to backend directory
$BackendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $BackendPath)) {
    Write-Host "ERROR: Backend directory not found at $BackendPath" -ForegroundColor Red
    exit 1
}

Set-Location $BackendPath
Write-Host "✓ Changed directory to: $BackendPath" -ForegroundColor Green

# Check if virtual environment is activated
if (-not $env:VIRTUAL_ENV) {
    Write-Host "⚠ Warning: Virtual environment not activated" -ForegroundColor Yellow
    Write-Host "  Consider activating .venv before running this script" -ForegroundColor Yellow
    Write-Host ""
}

# Check if manage.py exists
if (-not (Test-Path "manage.py")) {
    Write-Host "ERROR: manage.py not found in backend directory" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found manage.py" -ForegroundColor Green

# Run database migrations
Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Cyan
python manage.py migrate --noinput

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Database migrations failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Migrations completed successfully" -ForegroundColor Green

# Collect static files (optional, uncomment if needed)
# Write-Host ""
# Write-Host "Collecting static files..." -ForegroundColor Cyan
# python manage.py collectstatic --noinput --clear

# Start the server
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Starting Django development server..." -ForegroundColor Cyan
Write-Host "Server will be available at:" -ForegroundColor Yellow
Write-Host "  - http://localhost:8000" -ForegroundColor Yellow
Write-Host "  - http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Start server on all interfaces
python manage.py runserver 0.0.0.0:8000
