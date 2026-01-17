# Syntax Error Quick Reference Guide

## Common MSVC Syntax Errors and Fixes

### Error: "syntax error: illegal token on right side of '::'"

**Cause:** Usually caused by macro expansion issues or incorrect namespace resolution.

**Example Problem:**
```cpp
// This might cause issues if SomeType is a macro
SomeType::(SomeFunc)();
```

**Fix:**
```cpp
// Remove unnecessary parentheses
SomeType::SomeFunc();
```

---

### Error: "syntax error: ')'"

**Cause:** Often caused by preprocessor macro issues or missing semicolons.

**Common Scenarios:**

1. **Missing semicolon in previous line:**
```cpp
// WRONG
class MyClass {
public:
    void doSomething()  // Missing semicolon
}

// CORRECT
class MyClass {
public:
    void doSomething();
};
```

2. **Macro expansion issues:**
```cpp
// Check if macros like BEGIN_IPLUG_NAMESPACE are properly defined
BEGIN_IPLUG_NAMESPACE
class MyClass {};
END_IPLUG_NAMESPACE
```

---

### Error: "identifier 'max' is undefined" or "'min': is not a member of 'std'"

**Cause:** Windows.h defines `max` and `min` as macros, conflicting with `std::max` and `std::min`.

**Fix 1 - Define NOMINMAX (Already applied in project):**
```cpp
#define NOMINMAX
#include <windows.h>
```

**Fix 2 - Use parentheses:**
```cpp
// Instead of:
auto result = std::max(a, b);

// Use:
auto result = (std::max)(a, b);
```

---

### CRT Secure Function Warnings

**Already suppressed in project via `_CRT_SECURE_NO_WARNINGS`**, but here are the secure alternatives:

#### strcpy → strcpy_s
```cpp
// OLD (unsafe)
char dest[100];
strcpy(dest, src);

// NEW (secure)
char dest[100];
strcpy_s(dest, sizeof(dest), src);
// Or better:
strcpy_s(dest, src);  // C++ overload deduces size
```

#### sprintf → sprintf_s
```cpp
// OLD
char buffer[256];
sprintf(buffer, "Value: %d", value);

// NEW
char buffer[256];
sprintf_s(buffer, sizeof(buffer), "Value: %d", value);
```

#### gmtime → gmtime_s
```cpp
// OLD
time_t rawtime;
time(&rawtime);
struct tm* timeinfo = gmtime(&rawtime);

// NEW
time_t rawtime;
time(&rawtime);
struct tm timeinfo;
gmtime_s(&timeinfo, &rawtime);  // Note: arguments reversed!
```

#### _vsnprintf → _vsnprintf_s
```cpp
// OLD
_vsnprintf(buffer, size, format, args);

// NEW
_vsnprintf_s(buffer, size, _TRUNCATE, format, args);
```

---

### Windows-Specific Header Order

**Important:** Include Windows headers in this order to avoid conflicts:

```cpp
// 1. Define Windows macros first
#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#define VC_EXTRALEAN

// 2. Include Windows headers
#include <windows.h>

// 3. Then include standard library
#include <algorithm>
#include <string>

// 4. Then project headers
#include "IPlugParameter.h"
```

---

### Checking for Macro Issues

If you get cryptic syntax errors, use the preprocessor output:

**In Visual Studio:**
1. Right-click the .cpp file → Properties
2. C/C++ → Preprocessor → Preprocess to a File: **Yes**
3. Build the project
4. Check the `.i` file in the intermediate directory

**Or use compiler flag:**
```
/P     Preprocesses to a file
/EP    Preprocesses to stdout without line numbers
```

---

### Common IPlug2 Namespace Issues

**Ensure these macros are properly used:**

```cpp
// At the start of header files
BEGIN_IPLUG_NAMESPACE

class MyClass {
    // ...
};

END_IPLUG_NAMESPACE

// At the start of cpp files
#include "MyClass.h"

BEGIN_IPLUG_NAMESPACE

void MyClass::DoSomething() {
    // ...
}

END_IPLUG_NAMESPACE
```

**These macros expand to:**
```cpp
#define BEGIN_IPLUG_NAMESPACE namespace iplug {
#define END_IPLUG_NAMESPACE }
```

---

### Platform-Specific Code

**Check platform detection:**
```cpp
#ifdef OS_WIN
    // Windows-specific code
    #include <windows.h>
#elif defined OS_MAC
    // macOS-specific code
#elif defined OS_LINUX
    // Linux-specific code
#endif
```

**OS_WIN should be defined** in your project. Check preprocessor definitions:
- Project Properties → C/C++ → Preprocessor → Preprocessor Definitions
- Should include: `WIN32`, `_WINDOWS`, or similar

---

### Function Pointer Syntax

**Watch out for function pointer declarations:**

```cpp
// Potentially problematic
typedef void (*MyFunc)();

// Better with modern C++
using MyFunc = std::function<void()>;
```

---

### Template Syntax

**Use typename for dependent types:**

```cpp
// WRONG
template<typename T>
void func() {
    T::SomeType var;  // Error if SomeType is a type
}

// CORRECT
template<typename T>
void func() {
    typename T::SomeType var;
}
```

---

## Debugging Strategy

1. **Isolate the Error:**
   - Comment out large sections to find the exact line
   - Look at the error line number in the compiler output

2. **Check Includes:**
   - Ensure all required headers are included
   - Check for circular dependencies

3. **Verify Macros:**
   - Use `/P` to see preprocessor output
   - Check macro definitions in headers

4. **Clean Build:**
   - Delete intermediate files
   - Rebuild from scratch

5. **Check Compiler Version:**
   - Ensure using Visual Studio 2022 (v143 toolset)
   - Older compilers may have different behaviors

---

## Project-Specific Notes

### Files Most Likely to Have Issues:
1. `IPlugEditorDelegate.h` - Complex interface with many forward declarations
2. `IPlugUtilities.h` - Heavy macro usage
3. `IPlugMidi.h` - Platform-specific code
4. `IPlugParameter.cpp` - Template implementations

### If Errors Persist in These Files:
1. Check that `IPlugPlatform.h` is properly included
2. Verify `OS_WIN` is defined
3. Ensure Windows SDK version matches (10.0)
4. Check that `_CRT_SECURE_NO_WARNINGS` is defined globally

---

## Quick Test

**To verify your environment is working, try building a minimal test file:**

```cpp
// test.cpp
#define _CRT_SECURE_NO_WARNINGS
#define NOMINMAX

#include <windows.h>
#include <algorithm>
#include <string>

int main() {
    int a = 10, b = 20;
    int max_val = std::max(a, b);
    
    char buffer[100];
    strcpy(buffer, "Hello");
    
    return 0;
}
```

If this compiles without errors, your basic environment is correct.

---

*For project-specific issues, see [BUILD_FIX.md](BUILD_FIX.md)*
