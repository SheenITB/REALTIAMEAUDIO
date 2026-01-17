# Build Error Fixes for RealTimeAudio Plugin

## Overview
This document outlines the fixes applied to resolve the build errors in the RealTimeAudio plugin project.

---

## ✅ Fixed Issues

### 1. **IPLUG2_ROOT Path Configuration**
**Problem:** The `IPLUG2_ROOT` variable was pointing to the wrong directory (`$(ProjectDir)..\..\..\` instead of the iPlug2-master folder).

**Solution Applied:**
- Updated [RealTimeAudio/config/RealTimeAudio-win.props](RealTimeAudio/config/RealTimeAudio-win.props)
- Changed `IPLUG2_ROOT` from `$(ProjectDir)..\..\..\` to `$(ProjectDir)..\..\iPlug2-master`

```xml
<IPLUG2_ROOT Condition="'$(IPLUG2_ROOT)' == ''">$(ProjectDir)..\..\iPlug2-master</IPLUG2_ROOT>
```

### 2. **Missing json.hpp Include Path**
**Problem:** The config was looking for `json11` but the actual file is `nlohmann/json.hpp`.

**Solution Applied:**
- Updated `EXTRA_INC_PATHS` in [RealTimeAudio/config/RealTimeAudio-win.props](RealTimeAudio/config/RealTimeAudio-win.props)
- Changed from `$(IPLUG2_ROOT)\Dependencies\Extras\json11` to `$(IPLUG2_ROOT)\Dependencies\Extras\nlohmann`

```xml
<EXTRA_INC_PATHS>$(IPLUG2_ROOT)\Dependencies\Extras\nlohmann</EXTRA_INC_PATHS>
```

### 3. **CRT Secure Warnings Suppression**
**Problem:** MSVC compiler flagged unsafe functions like `strcpy`, `gmtime`, `_vsnprintf` as deprecated.

**Solution Applied:**
- Added `_CRT_SECURE_NO_WARNINGS` to the `EXTRA_ALL_DEFS` in [RealTimeAudio/config/RealTimeAudio-win.props](RealTimeAudio/config/RealTimeAudio-win.props)

```xml
<EXTRA_ALL_DEFS>WEBVIEW_EDITOR_DELEGATE;NO_IGRAPHICS;IDLE_TIMER_RATE=50;_CRT_SECURE_NO_WARNINGS</EXTRA_ALL_DEFS>
```

---

## 📁 Header File Locations Verified

All required header files exist in the project:

| Header File | Location |
|------------|----------|
| `json.hpp` | `Dependencies/Extras/nlohmann/json.hpp` |
| `NChanDelay.h` | `IPlug/Extras/NChanDelay.h` |
| `IPlugVST3.h` | `IPlug/VST3/IPlugVST3.h` |
| `IPlugWebViewEditorDelegate.h` | `IPlug/Extras/WebView/IPlugWebViewEditorDelegate.h` |
| VST3 SDK headers (`pluginterfaces/*`) | `Dependencies/IPlug/VST3_SDK/pluginterfaces/` |

---

## 🔧 Include Path Configuration

The project uses the following path variables (defined in `iPlug2-master/common-win.props`):

```xml
<VST3_SDK>$(IPLUG_DEPS_PATH)\VST3_SDK</VST3_SDK>
<VST3_INC_PATHS>$(IPLUG_PATH)\VST3;$(VST3_SDK)</VST3_INC_PATHS>
<JSON_PATH>$(DEPS_PATH)\Extras\nlohmann</JSON_PATH>
<IPLUG_INC_PATHS>$(WDL_PATH);$(IPLUG_PATH);$(EXTRAS_PATH);$(EXTRAS_PATH)\OSC;$(EXTRAS_PATH)\Synth;$(EXTRAS_PATH)\WebView;$(JSON_PATH);$(SolutionDir)\resources</IPLUG_INC_PATHS>
```

These paths ensure:
- VST3 SDK headers are accessible via `$(VST3_INC_PATHS)`
- JSON library is accessible via `$(JSON_PATH)`
- IPlug extras (NChanDelay, WebView) are accessible via `$(EXTRAS_PATH)`

---

## 🚨 Remaining Potential Issues

### Syntax Errors
If you still encounter syntax errors like:
```
error C2061: syntax error: identifier 'illegal token on right side of '::'
```

**Possible Causes:**
1. **Macro Expansion Issues**: Check if macros are being expanded correctly in MSVC
2. **Windows.h Conflicts**: Windows headers can define macros that conflict with code (e.g., `min`, `max`)
3. **Platform-Specific Code**: Ensure `#ifdef OS_WIN` blocks are correct

**Debugging Steps:**
1. Open the specific file mentioned in the error (e.g., `IPlugEditorDelegate.h:line_number`)
2. Check for unusual `::` usage or macro calls
3. Look for preprocessor conditionals that might be incorrectly handling Windows builds

### Preprocessor Verification
The project defines `NOMINMAX` to prevent Windows `min`/`max` macro conflicts:
```xml
<ALL_DEFS>WIN32;_CRT_SECURE_NO_DEPRECATE;_CRT_NONSTDC_NO_DEPRECATE;NOMINMAX</ALL_DEFS>
```

---

## 🛠️ Build Instructions

### Prerequisites
1. **Visual Studio 2022** with C++ development tools (v143 toolset)
2. **Windows 10 SDK**
3. **VST3 SDK** (included in `Dependencies/IPlug/VST3_SDK/`)

### Building the Project

1. **Open the Solution:**
   ```
   RealTimeAudio/RealTimeAudio.sln
   ```

2. **Select Configuration:**
   - Debug or Release
   - Platform: Win32 or x64

3. **Build Projects:**
   - `RealTimeAudio-vst3.vcxproj` - VST3 plugin
   - `RealTimeAudio-app.vcxproj` - Standalone app
   - `RealTimeAudio-vst2.vcxproj` - VST2 plugin (if needed)
   - `RealTimeAudio-aax.vcxproj` - AAX plugin (requires AAX SDK)

4. **Expected Output:**
   - VST3: `build-win/vst3/[Platform]/[Configuration]/RealTimeAudio.vst3`
   - APP: `build-win/app/[Platform]/[Configuration]/RealTimeAudio.exe`

---

## 📝 Additional Recommendations

### 1. Replace Unsafe Functions (Optional)
Instead of suppressing warnings, you can replace unsafe functions:

```cpp
// Old (deprecated)
strcpy(dest, src);
gmtime(&time);
_vsnprintf(buffer, size, format, args);

// New (secure)
strcpy_s(dest, sizeof(dest), src);
gmtime_s(&tm, &time);
_vsnprintf_s(buffer, size, _TRUNCATE, format, args);
```

### 2. Source Control
Ensure all dependency submodules are properly initialized:
```bash
git submodule update --init --recursive
```

### 3. Clean Build
If issues persist, perform a clean rebuild:
1. In Visual Studio: **Build → Clean Solution**
2. Delete `build-win` folder manually
3. **Build → Rebuild Solution**

---

## 🐛 Troubleshooting

### "Cannot open include file"
- Verify `IPLUG2_ROOT` points to `iPlug2-master` folder
- Check that `Dependencies` folder contains required libraries
- Ensure VST3_SDK exists at `Dependencies/IPlug/VST3_SDK/`

### "Syntax error" in IPlug files
- Check that `OS_WIN` is defined correctly
- Verify platform toolset is v143 (Visual Studio 2022)
- Look for conflicts with Windows headers

### Linker Errors
- Ensure all required `.lib` files are present in `Dependencies/Build/win/[Platform]/[Configuration]`
- Check that `AdditionalLibraryDirectories` includes `$(STATIC_LIBS_PATH)`

---

## 📚 Reference Files Modified

1. ✅ `RealTimeAudio/config/RealTimeAudio-win.props` - Fixed IPLUG2_ROOT, json path, added _CRT_SECURE_NO_WARNINGS

---

## ✨ Summary

**Changes Made:**
- ✅ Corrected `IPLUG2_ROOT` path to point to `iPlug2-master`
- ✅ Fixed JSON library include path (`nlohmann` instead of `json11`)
- ✅ Suppressed CRT security warnings via `_CRT_SECURE_NO_WARNINGS`

**Result:**
These changes should resolve:
- Missing header file errors (`json.hpp`, `NChanDelay.h`, `IPlugVST3.h`, etc.)
- VST3 SDK include path issues
- CRT deprecation warnings

**Next Steps:**
1. Open the solution in Visual Studio
2. Build the project
3. If syntax errors persist, review the specific error locations and apply targeted fixes

---

*Last Updated: January 17, 2026*
