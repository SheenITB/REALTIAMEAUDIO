@echo off
REM Build Environment Verification Script for RealTimeAudio Plugin
REM This script checks if all required files and paths are correctly configured

echo ========================================
echo RealTimeAudio Build Environment Check
echo ========================================
echo.

set PROJECT_ROOT=%~dp0
set IPLUG2_ROOT=%PROJECT_ROOT%iPlug2-master

echo Checking critical paths...
echo.

REM Check IPLUG2_ROOT
echo [1/8] Checking iPlug2-master folder...
if exist "%IPLUG2_ROOT%" (
    echo    ✓ Found: %IPLUG2_ROOT%
) else (
    echo    ✗ NOT FOUND: %IPLUG2_ROOT%
    echo    ERROR: iPlug2-master folder is missing!
    goto :error
)

REM Check JSON header
echo [2/8] Checking json.hpp...
if exist "%PROJECT_ROOT%Dependencies\Extras\nlohmann\json.hpp" (
    echo    ✓ Found: Dependencies\Extras\nlohmann\json.hpp
) else (
    echo    ✗ NOT FOUND: Dependencies\Extras\nlohmann\json.hpp
    goto :error
)

REM Check NChanDelay
echo [3/8] Checking NChanDelay.h...
if exist "%PROJECT_ROOT%IPlug\Extras\NChanDelay.h" (
    echo    ✓ Found: IPlug\Extras\NChanDelay.h
) else (
    echo    ✗ NOT FOUND: IPlug\Extras\NChanDelay.h
    goto :error
)

REM Check IPlugVST3
echo [4/8] Checking IPlugVST3.h...
if exist "%PROJECT_ROOT%IPlug\VST3\IPlugVST3.h" (
    echo    ✓ Found: IPlug\VST3\IPlugVST3.h
) else (
    echo    ✗ NOT FOUND: IPlug\VST3\IPlugVST3.h
    goto :error
)

REM Check IPlugWebViewEditorDelegate
echo [5/8] Checking IPlugWebViewEditorDelegate.h...
if exist "%PROJECT_ROOT%IPlug\Extras\WebView\IPlugWebViewEditorDelegate.h" (
    echo    ✓ Found: IPlug\Extras\WebView\IPlugWebViewEditorDelegate.h
) else (
    echo    ✗ NOT FOUND: IPlug\Extras\WebView\IPlugWebViewEditorDelegate.h
    goto :error
)

REM Check VST3 SDK
echo [6/8] Checking VST3 SDK...
if exist "%PROJECT_ROOT%Dependencies\IPlug\VST3_SDK\pluginterfaces" (
    echo    ✓ Found: Dependencies\IPlug\VST3_SDK\pluginterfaces
) else (
    echo    ✗ NOT FOUND: Dependencies\IPlug\VST3_SDK\pluginterfaces
    echo    WARNING: VST3 SDK may not be properly installed
)

REM Check common-win.props
echo [7/8] Checking common-win.props...
if exist "%IPLUG2_ROOT%\common-win.props" (
    echo    ✓ Found: iPlug2-master\common-win.props
) else (
    echo    ✗ NOT FOUND: iPlug2-master\common-win.props
    goto :error
)

REM Check RealTimeAudio config
echo [8/8] Checking RealTimeAudio-win.props...
if exist "%PROJECT_ROOT%RealTimeAudio\config\RealTimeAudio-win.props" (
    echo    ✓ Found: RealTimeAudio\config\RealTimeAudio-win.props
) else (
    echo    ✗ NOT FOUND: RealTimeAudio\config\RealTimeAudio-win.props
    goto :error
)

echo.
echo ========================================
echo ✓ All critical files found!
echo ========================================
echo.
echo Project is ready to build. Open the solution:
echo   %PROJECT_ROOT%RealTimeAudio\RealTimeAudio.sln
echo.
echo Build configurations available:
echo   - Debug ^| Win32
echo   - Debug ^| x64
echo   - Release ^| Win32
echo   - Release ^| x64
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo ✗ Build environment check FAILED
echo ========================================
echo.
echo Please ensure:
echo   1. All git submodules are initialized
echo   2. Dependencies are properly extracted
echo   3. VST3 SDK is present in Dependencies\IPlug\VST3_SDK
echo.
echo Run this command to initialize submodules:
echo   git submodule update --init --recursive
echo.
pause
exit /b 1
