#!/bin/bash
# Start the development server on Windows

# Colors
$green = "Green"
$blue = "Cyan"

Write-Host "🚀 Starting Subscriber Dashboard Server..." -ForegroundColor $blue
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Download from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if MongoDB is running
Write-Host "Checking MongoDB connection..." -ForegroundColor $blue
try {
    $mongotest = mongosh --eval "db.admin.ping()" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ MongoDB is running" -ForegroundColor $green
    } else {
        Write-Host "⚠ MongoDB might not be running" -ForegroundColor Yellow
        Write-Host "Make sure MongoDB is started before running the server" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not verify MongoDB status" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting development server..." -ForegroundColor $blue
Write-Host ""

# Start the server
npm run dev
