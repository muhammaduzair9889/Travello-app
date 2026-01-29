# Web Scraping Setup Script
# Run this to install all dependencies for the web scraping system

Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "  TRAVELLO WEB SCRAPING - DEPENDENCY INSTALLER" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"
$scraperDir = Join-Path $backendDir "scraper"

Write-Host "`n[1/4] Checking Python..." -ForegroundColor Yellow

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found! Please install Python from https://www.python.org/" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/4] Installing Python dependencies..." -ForegroundColor Yellow

# Navigate to backend directory
Set-Location $backendDir

# Install Python packages
Write-Host "Installing: selenium, webdriver-manager..." -ForegroundColor Cyan
pip install selenium==4.16.0 webdriver-manager==4.0.1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Python packages installed successfully" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning: Some Python packages may have failed to install" -ForegroundColor Yellow
}

Write-Host "`n[3/4] Checking Node.js..." -ForegroundColor Yellow

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>&1
    $npmVersion = npm --version 2>&1
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
    Write-Host "✓ npm found: v$npmVersion" -ForegroundColor Green
    
    Write-Host "`n[4/4] Installing Node.js dependencies (Puppeteer)..." -ForegroundColor Yellow
    
    # Navigate to scraper directory
    Set-Location $scraperDir
    
    # Install npm packages
    Write-Host "Installing: puppeteer, puppeteer-extra, puppeteer-extra-plugin-stealth..." -ForegroundColor Cyan
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Node.js packages installed successfully" -ForegroundColor Green
        $puppeteerInstalled = $true
    } else {
        Write-Host "⚠ Warning: Puppeteer installation may have issues" -ForegroundColor Yellow
        $puppeteerInstalled = $false
    }
    
} catch {
    Write-Host "⚠ Node.js not found - Puppeteer scraper will not be available" -ForegroundColor Yellow
    Write-Host "  Download Node.js from: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "  Selenium scraper will still work!" -ForegroundColor Green
    $puppeteerInstalled = $false
}

# Return to script directory
Set-Location $scriptDir

Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION SUMMARY" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

Write-Host "`n✓ Python packages: selenium, webdriver-manager" -ForegroundColor Green

if ($puppeteerInstalled) {
    Write-Host "✓ Node.js packages: puppeteer (with stealth plugin)" -ForegroundColor Green
} else {
    Write-Host "⚠ Puppeteer not installed (Node.js required)" -ForegroundColor Yellow
}

Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

Write-Host "`n1. Run test suite:" -ForegroundColor Yellow
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   python test_scraper.py" -ForegroundColor White

Write-Host "`n2. Start Django server:" -ForegroundColor Yellow
Write-Host "   python manage.py runserver" -ForegroundColor White

Write-Host "`n3. Test API endpoint:" -ForegroundColor Yellow
Write-Host '   curl -X POST http://localhost:8000/api/scraper/test/' -ForegroundColor White

Write-Host "`n4. Try scraping:" -ForegroundColor Yellow
Write-Host '   curl -X POST http://localhost:8000/api/scraper/scrape-hotels/ \' -ForegroundColor White
Write-Host '     -H "Content-Type: application/json" \' -ForegroundColor White
Write-Host '     -d ''{"city":"Lahore","checkin":"2026-02-10","checkout":"2026-02-15"}''' -ForegroundColor White

Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "  DOCUMENTATION" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

Write-Host "`n📖 Full Guide: WEB_SCRAPING_DOCUMENTATION.md" -ForegroundColor Cyan
Write-Host "🚀 Quick Start: WEB_SCRAPING_QUICK_START.md" -ForegroundColor Cyan
Write-Host "✅ Summary: WEB_SCRAPING_COMPLETE.md" -ForegroundColor Cyan

Write-Host "`n⚠️  LEGAL NOTICE:" -ForegroundColor Yellow
Write-Host "   This scraper is for EDUCATIONAL purposes only." -ForegroundColor White
Write-Host "   Always respect Booking.com's Terms of Service." -ForegroundColor White
Write-Host "   Consider using official APIs for production use." -ForegroundColor White

Write-Host "`n✓ Setup complete! Happy scraping! 🎉`n" -ForegroundColor Green
