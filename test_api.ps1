# Test API endpoints
Write-Host "Testing Travello API endpoints..." -ForegroundColor Cyan

$baseURL = "http://localhost:8000/api"

# Test 1: Check if server is running
Write-Host "`nTest 1: Checking if server is running..." -ForegroundColor Yellow
try {
    $response = curl -s -w "%{http_code}" -o /dev/null "$baseURL/token/"
    Write-Host "Server response code: $response" -ForegroundColor Green
} catch {
    Write-Host "Server not responding" -ForegroundColor Red
    exit 1
}

# Test 2: Test signup endpoint
Write-Host "`nTest 2: Testing signup endpoint..." -ForegroundColor Yellow
$signupData = @{
    email = "testuser@example.com"
    username = "testuser"
    password = "TestPassword123!"
    password_confirm = "TestPassword123!"
    recaptcha_token = "test-token"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseURL/signup/" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $signupData `
        -ErrorAction Stop

    Write-Host "Signup successful: $($response.StatusCode)" -ForegroundColor Green
    $userData = $response.Content | ConvertFrom-Json
    Write-Host "Response: $($userData | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Signup error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorContent = $reader.ReadToEnd()
        Write-Host "Error details: $errorContent" -ForegroundColor Red
    }
}

# Test 3: Test login endpoint
Write-Host "`nTest 3: Testing login endpoint..." -ForegroundColor Yellow
$loginData = @{
    email = "testuser@example.com"
    password = "TestPassword123!"
    recaptcha_token = "test-token"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseURL/login/" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $loginData `
        -ErrorAction Stop

    Write-Host "Login successful: $($response.StatusCode)" -ForegroundColor Green
    $loginData = $response.Content | ConvertFrom-Json
    Write-Host "Tokens received: Access token length = $($loginData.tokens.access.Length)" -ForegroundColor Green
} catch {
    Write-Host "Login error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nAPI Tests Complete!" -ForegroundColor Cyan
