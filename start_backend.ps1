# Start Django Backend Server
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Starting Travello Backend Server..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Admin Credentials:" -ForegroundColor Yellow
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Backend will be available at:" -ForegroundColor Cyan
Write-Host "  API: http://localhost:8000/api" -ForegroundColor Green
Write-Host "  Admin Panel: http://localhost:8000/admin" -ForegroundColor Green
Write-Host "  Token: http://localhost:8000/api/token/" -ForegroundColor Green
Write-Host ""
Write-Host "Login/Signup endpoints:" -ForegroundColor Cyan
Write-Host "  POST /api/signup/" -ForegroundColor Green
Write-Host "  POST /api/login/" -ForegroundColor Green
Write-Host "  POST /api/admin/login/" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "f:\Travello Project\Travello Project\backend"

# Check system
Write-Host "Running system checks..." -ForegroundColor Yellow
python manage.py check
if ($LASTEXITCODE -ne 0) {
    Write-Host "System check failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting Django development server..." -ForegroundColor Green
python manage.py runserver 0.0.0.0:8000
