$ResourceGroup = "otd-dashboard-rg"
$Apps = @(
    @{ Name = "otd-dashboard-api"; Label = "Backend API" },
    @{ Name = "otd-dashboard-app"; Label = "Frontend Web App" }
)

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI (az) not found. Run: winget install Microsoft.AzureCLI"
    exit 1
}

Write-Host "`n=== OTD Dashboard Toggle ===" -ForegroundColor White

foreach ($app in $Apps) {
    $state = az webapp show --name $app.Name --resource-group $ResourceGroup --query "state" --output tsv 2>$null

    if (-not $state) {
        Write-Warning "$($app.Label): could not get state. Run 'az login' if not authenticated."
        continue
    }

    Write-Host "`n$($app.Label) is currently: $state"

    if ($state -eq "Running") {
        Write-Host "  Stopping..." -ForegroundColor Yellow
        az webapp stop --name $app.Name --resource-group $ResourceGroup --output none
        Write-Host "  Stopped." -ForegroundColor Yellow
    } elseif ($state -eq "Stopped") {
        Write-Host "  Starting..." -ForegroundColor Cyan
        az webapp start --name $app.Name --resource-group $ResourceGroup --output none
        Write-Host "  Started." -ForegroundColor Green
    } else {
        Write-Warning "  Unexpected state '$state' - skipping."
    }
}

Write-Host "`nDone.`n" -ForegroundColor White
