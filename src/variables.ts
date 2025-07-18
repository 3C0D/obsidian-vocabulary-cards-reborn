import type { Settings } from "obsidian ";


import { Platform } from 'obsidian';

// Detect if we're on Linux to enable context menu button by default
const isLinux = Platform.isLinux || (typeof process !== 'undefined' && process.platform === 'linux');

export const DEFAULT_SETTINGS: Settings = {
    stats: {},
    showTime: 3,
    explainTime: 3,
    disableConfirmationButtons: true,
    showContextMenuButton: isLinux // Enable by default on Linux due to potential context menu issues
};