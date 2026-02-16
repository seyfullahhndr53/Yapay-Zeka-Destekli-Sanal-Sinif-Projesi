# Multi-Platform Chrome Extension - Simple Development Runner
# Bu script sadece HTTP modunda çalışır (development için)

Write-Host "🚀 Starting Multi-Platform Chrome Extension Development Server..." -ForegroundColor Green
Write-Host "📍 HTTP Mode (Development)" -ForegroundColor Yellow

# Python path kontrolü
$pythonCmd = "python"
if (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

Write-Host "🐍 Using Python: $pythonCmd" -ForegroundColor Cyan

# Environment variables
$env:DEVELOPMENT_MODE = "true"
$env:DISABLE_SSL = "true"
$env:CORS_ORIGINS = "chrome-extension://*,https://meet.google.com,https://*.zoom.us,https://*.zoom.com,https://*.bigbluebutton.org"
$env:API_KEY = "student_secret_key_2025"
$env:TEACHER_API_KEY = "teacher_admin_key_2025"

# Requirements check
Write-Host "📦 Checking requirements..." -ForegroundColor Blue
& $pythonCmd -m pip install -r requirements.txt --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install requirements" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Requirements installed" -ForegroundColor Green

# Create log directory
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Name "logs" | Out-Null
}

# Start server
Write-Host "🌐 Starting Flask server on http://127.0.0.1:5001" -ForegroundColor Green
Write-Host "📊 CORS enabled for all extension origins" -ForegroundColor Blue
Write-Host "🔓 SSL disabled for development" -ForegroundColor Yellow
Write-Host "" 
Write-Host "Chrome Extension URLs:" -ForegroundColor Magenta
Write-Host "  • Student Extension: ./student-extension/" -ForegroundColor White
Write-Host "  • Teacher Extension: ./teacher-extension/" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "================================" -ForegroundColor Gray

try {
    & $pythonCmd python_server_central.py
} catch {
    Write-Host "❌ Server failed to start: $_" -ForegroundColor Red
    exit 1
}
