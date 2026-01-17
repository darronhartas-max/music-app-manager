// Preload script - Security bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Launch an application
    launchApp: (appPath, appName) => ipcRenderer.invoke('launch-app', appPath, appName),

    // Load configuration
    loadConfig: () => ipcRenderer.invoke('load-config'),

    // Save configuration
    saveConfig: (configData) => ipcRenderer.invoke('save-config', configData),

    // Check if app exists
    checkAppExists: (appPath) => ipcRenderer.invoke('check-app-exists', appPath),

    // Scan for plugins
    scanPlugins: () => ipcRenderer.invoke('scan-plugins'),

    // Open external link
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Get platform info
    getPlatform: () => ipcRenderer.invoke('get-platform'),

    // File dialogs
    selectAppFile: () => ipcRenderer.invoke('select-app-file'),
    selectPluginFile: () => ipcRenderer.invoke('select-plugin-file'),

    // Merge scanned plugins with config
    mergePlugins: (scannedPlugins) => ipcRenderer.invoke('merge-plugins', scannedPlugins),

    // Scan for music apps
    scanApps: () => ipcRenderer.invoke('scan-apps'),

    // Listen for scan progress
    onScanProgress: (callback) => {
        ipcRenderer.on('scan-progress', (event, data) => callback(data));
    },

    // Check if running in Electron
    isElectron: true
});
