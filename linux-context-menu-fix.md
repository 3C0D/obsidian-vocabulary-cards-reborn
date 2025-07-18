# Linux Context Menu Fix

## Problem Description

Some Linux users, particularly those using Flatpak installations of Obsidian, reported issues with the right-click context menu not appearing when clicking on vocabulary card blocks. This issue was documented in [GitHub Issue #1](https://github.com/3C0D/obsidian-vocabulary-cards-reborn/issues/1#issuecomment-3088677323).

## Root Cause

The issue appears to be related to:
1. **Flatpak sandboxing**: Flatpak applications may have restricted access to certain system events
2. **Linux desktop environment variations**: Different desktop environments handle context menus differently
3. **Event propagation**: The context menu event might be intercepted or blocked by the system

## Implemented Solutions

### 1. Enhanced Error Handling

**File**: `src/utils.ts`

Added robust error handling in the `handleContextMenu` function:
- `event.preventDefault()` and `event.stopPropagation()` to prevent conflicts
- Fallback mechanism: if `menu.showAtMouseEvent(event)` fails, try showing at element position
- Final fallback: show a notification if all methods fail

### 2. Automatic Linux Detection

**File**: `src/variables.ts`

The plugin now automatically detects Linux systems and enables the context menu button by default:
```typescript
const isLinux = Platform.isLinux || (typeof process !== 'undefined' && process.platform === 'linux');
showContextMenuButton: isLinux // Enable by default on Linux
```

### 3. Enhanced Settings UI

**File**: `src/settingTab.ts`

Improved the settings interface for Linux users:
- Dynamic description based on operating system
- Special warning message for Linux users
- Recommendation to enable the context menu button

### 4. Keyboard Shortcut Alternative

**File**: `src/main.ts`

Added `Shift+F10` keyboard shortcut as an alternative to right-click:
- Works for both `voca-card` and `voca-table` blocks
- Creates synthetic mouse event at element center
- Makes elements focusable with `tabindex="0"`

### 5. Updated Documentation

**File**: `README.md`

Added comprehensive documentation about:
- Alternative access methods for context menu
- Specific guidance for Linux users
- Keyboard shortcut instructions

## Usage Instructions for Linux Users

### Method 1: Context Menu Button
1. Go to Settings → Vocabulary Cards Reborn
2. Enable "Show context menu button" (should be enabled by default on Linux)
3. Click the ☰ button that appears on vocabulary blocks

### Method 2: Keyboard Shortcut
1. Click on a vocabulary block to focus it
2. Press `Shift+F10`
3. The context menu will appear

### Method 3: Right-click (if working)
- Right-click directly on the vocabulary block
- If this doesn't work, use methods 1 or 2 above

## Testing

To test the fixes:
1. Create a vocabulary block with `voca-card` or `voca-table`
2. Try right-clicking - should work with enhanced error handling
3. If right-click fails, try `Shift+F10`
4. Verify the context menu button appears (especially on Linux)
5. Check that all context menu options work correctly

## Future Improvements

Potential enhancements for better Linux compatibility:
- Add more keyboard shortcuts for individual menu actions
- Implement touch/gesture support for mobile Linux devices
- Add system notification when context menu fails
- Consider alternative UI patterns for problematic environments