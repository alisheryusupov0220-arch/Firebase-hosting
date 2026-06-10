# deploy-firebase.ps1
# Deploys Firestore security rules and indexes to Firebase.
# Run this script from the root of the project (where firebase.json is located).
#
# Prerequisites:
#   1. Firebase CLI installed:  npm install -g firebase-tools
#   2. Logged in:               firebase login
#   3. Project selected:        firebase use <your-project-id>
#
# Usage:
#   .\scripts\deploy-firebase.ps1
#   .\scripts\deploy-firebase.ps1 -RulesOnly
#   .\scripts\deploy-firebase.ps1 -IndexesOnly

param(
    [switch]$RulesOnly,
    [switch]$IndexesOnly
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  FLOW Invent — Firebase Deployment Tool" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check firebase CLI is available
if (-not (Get-Command "firebase" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Firebase CLI not found. Install it with:" -ForegroundColor Red
    Write-Host "  npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Confirm active project
$project = firebase use 2>&1
Write-Host "Active Firebase project: $project" -ForegroundColor Green
Write-Host ""

if ($RulesOnly) {
    Write-Host "[1/1] Deploying Firestore security rules..." -ForegroundColor Yellow
    firebase deploy --only firestore:rules
    Write-Host ""
    Write-Host "[OK] Rules deployed successfully." -ForegroundColor Green
}
elseif ($IndexesOnly) {
    Write-Host "[1/1] Deploying Firestore indexes..." -ForegroundColor Yellow
    firebase deploy --only firestore:indexes
    Write-Host ""
    Write-Host "[OK] Indexes deployed successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "NOTE: Index build can take a few minutes. Check status at:" -ForegroundColor Cyan
    Write-Host "  https://console.firebase.google.com/project/_/firestore/indexes" -ForegroundColor White
}
else {
    Write-Host "[1/2] Deploying Firestore security rules..." -ForegroundColor Yellow
    firebase deploy --only firestore:rules
    Write-Host ""
    Write-Host "[2/2] Deploying Firestore indexes..." -ForegroundColor Yellow
    firebase deploy --only firestore:indexes
    Write-Host ""
    Write-Host "[OK] Rules and indexes deployed successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "NOTE: Index build can take a few minutes. Check status at:" -ForegroundColor Cyan
    Write-Host "  https://console.firebase.google.com/project/_/firestore/indexes" -ForegroundColor White
}

Write-Host ""
