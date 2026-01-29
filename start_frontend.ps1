# Start React Frontend Server
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Starting Travello Frontend Application..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend will be available at:" -ForegroundColor Cyan
Write-Host "  Local: http://localhost:3000" -ForegroundColor Green
Write-Host "  Network: http://<your-ip>:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Important:" -ForegroundColor Yellow
Write-Host "  • Make sure the backend is running at http://localhost:8000" -ForegroundColor White
Write-Host "  • API URL is configured: REACT_APP_API_URL=http://localhost:8000/api" -ForegroundColor White
Write-Host "  • If this is first run, npm will install dependencies (takes 2-3 min)" -ForegroundColor White
Write-Host ""
Write-Host "To stop: Press Ctrl+C" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "f:\Travello Project\Travello Project\frontend"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies... (This may take a few minutes)" -ForegroundColor Yellow
    Write-Host ""
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting React development server..." -ForegroundColor Green
Write-Host ""
npm start
