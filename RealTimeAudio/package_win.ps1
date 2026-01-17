# Package script for Windows
# Run after building the VST

# Assume Inno Setup is installed and iscc is in PATH

# Change to the script directory
Set-Location $PSScriptRoot

# Run Inno Setup compiler
iscc setup.iss

Write-Host "Installer created in installer\RealTimeAudio_Installer.exe"