# setup-pm2.ps1
Write-Host "Setting up PM2 for WhatsXENO..." -ForegroundColor Cyan

# 1. Install PM2 globally
Write-Host "`n[1/4] Installing PM2 globally..." -ForegroundColor Yellow
npm install -g pm2

# 2. Get npm global path
$npmPath = npm config get prefix
$pm2Path = Join-Path $npmPath "node_modules\pm2\bin\pm2"

# 3. Add to PATH if not already there
Write-Host "`n[2/4] Adding PM2 to PATH..." -ForegroundColor Yellow
$env:Path += ";$npmPath"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$npmPath", [System.EnvironmentVariableTarget]::User)

# 4. Start the app with PM2
Write-Host "`n[3/4] Starting WhatsXENO with PM2..." -ForegroundColor Yellow
& "$pm2Path" start index.js --name "whatsxeno"

# 5. Set up auto-start
Write-Host "`n[4/4] Setting up PM2 auto-start..." -ForegroundColor Yellow
& "$pm2Path" save
& "$pm2Path" startup

Write-Host "`nSetup complete! WhatsXENO is now running with PM2." -ForegroundColor Green
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  pm2 list           # List running apps"
Write-Host "  pm2 logs           # View logs"
Write-Host "  pm2 restart whatsxeno # Restart your app"
Write-Host "  pm2 delete whatsxeno  # Stop and remove the app"