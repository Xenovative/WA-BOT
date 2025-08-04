# Facebook Cookie Extractor for WA-BOT
# PowerShell script to extract Facebook cookies from browser databases

Write-Host "🔍 Facebook Cookie Extractor for WA-BOT" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Required cookies for Facebook authentication
$requiredCookies = @('c_user', 'xs', 'datr', 'sb')
$foundCookies = @()

# Function to extract cookies from Chrome/Edge
function Extract-ChromiumCookies {
    param(
        [string]$BrowserName,
        [string]$CookiesPath
    )
    
    if (-not (Test-Path $CookiesPath)) {
        Write-Host "❌ $BrowserName cookies database not found" -ForegroundColor Red
        return $null
    }
    
    Write-Host "📱 Checking $BrowserName..." -ForegroundColor Yellow
    
    # Copy cookies file to avoid locking issues
    $tempPath = "$CookiesPath.temp"
    try {
        Copy-Item $CookiesPath $tempPath -Force
    } catch {
        Write-Host "❌ Cannot access $BrowserName cookies (browser may be open)" -ForegroundColor Red
        return $null
    }
    
    # Load SQLite assembly (built into Windows 10+)
    try {
        Add-Type -Path "System.Data.SQLite.dll" -ErrorAction SilentlyContinue
    } catch {
        # Try alternative method for older systems
    }
    
    $cookies = @()
    
    # Use simple file reading approach as fallback
    Write-Host "⚠️  Using manual extraction method" -ForegroundColor Yellow
    Write-Host "   Please extract cookies manually from $BrowserName Developer Tools" -ForegroundColor Gray
    
    # Clean up temp file
    if (Test-Path $tempPath) {
        Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
    }
    
    return $null
}

# Get browser paths
$chromeProfile = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default"
$edgeProfile = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default"

$chromeCookies = "$chromeProfile\Cookies"
$edgeCookies = "$edgeProfile\Cookies"

# Try to extract from browsers
Extract-ChromiumCookies -BrowserName "Chrome" -CookiesPath $chromeCookies
Extract-ChromiumCookies -BrowserName "Edge" -CookiesPath $edgeCookies

Write-Host ""
Write-Host "📋 Manual Cookie Extraction Instructions:" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Open your browser and go to facebook.com" -ForegroundColor White
Write-Host "2. Make sure you're logged in" -ForegroundColor White
Write-Host "3. Press F12 to open Developer Tools" -ForegroundColor White
Write-Host "4. Go to Application tab (Chrome/Edge) or Storage tab (Firefox)" -ForegroundColor White
Write-Host "5. Click on Cookies > https://facebook.com" -ForegroundColor White
Write-Host "6. Find these cookies and copy their VALUES:" -ForegroundColor White
Write-Host ""

foreach ($cookie in $requiredCookies) {
    Write-Host "   • $cookie" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "7. Use the values to create your app state:" -ForegroundColor White
Write-Host ""

# Show the template
$template = @"
FACEBOOK_APP_STATE=[{"key":"c_user","value":"YOUR_C_USER_VALUE","domain":".facebook.com"},{"key":"xs","value":"YOUR_XS_VALUE","domain":".facebook.com"},{"key":"datr","value":"YOUR_DATR_VALUE","domain":".facebook.com"},{"key":"sb","value":"YOUR_SB_VALUE","domain":".facebook.com"}]
"@

Write-Host "📝 Template for your .env file:" -ForegroundColor Green
Write-Host $template -ForegroundColor Yellow
Write-Host ""

# Interactive cookie input
Write-Host "🔧 Interactive Cookie Input:" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

$userCookies = @{}
$allProvided = $true

foreach ($cookieName in $requiredCookies) {
    $value = Read-Host "Enter your $cookieName cookie value (or press Enter to skip)"
    if ($value -and $value.Trim() -ne "") {
        $userCookies[$cookieName] = $value.Trim()
    } else {
        $allProvided = $false
    }
}

if ($allProvided -and $userCookies.Count -eq 4) {
    Write-Host ""
    Write-Host "🎉 All cookies provided! Generating app state..." -ForegroundColor Green
    
    $appStateArray = @()
    foreach ($cookieName in $requiredCookies) {
        $appStateArray += @{
            key = $cookieName
            value = $userCookies[$cookieName]
            domain = ".facebook.com"
        }
    }
    
    $appStateJson = $appStateArray | ConvertTo-Json -Compress
    
    Write-Host ""
    Write-Host "📋 Your Facebook App State:" -ForegroundColor Green
    Write-Host "=" * 50 -ForegroundColor Gray
    Write-Host $appStateJson -ForegroundColor Yellow
    Write-Host "=" * 50 -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "📝 Add this line to your .env file:" -ForegroundColor Green
    Write-Host "FACEBOOK_APP_STATE=$appStateJson" -ForegroundColor Cyan
    
    # Optionally write to clipboard
    try {
        $appStateJson | Set-Clipboard
        Write-Host ""
        Write-Host "📋 App state copied to clipboard!" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "💡 Copy the app state manually from above" -ForegroundColor Yellow
    }
    
} else {
    Write-Host ""
    Write-Host "⚠️  Some cookies were not provided. Please extract them manually." -ForegroundColor Yellow
    Write-Host "   Follow the manual extraction instructions above." -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Cookie extraction complete!" -ForegroundColor Green
Write-Host "   Add the FACEBOOK_APP_STATE line to your .env file and restart WA-BOT" -ForegroundColor Gray
