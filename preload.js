// Preload script - Security bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

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

    // Scan for music apps
    scanApps: () => ipcRenderer.invoke('scan-apps'),

    // Extract real icon for an app at a given path
    extractAppIcon: (appPath) => ipcRenderer.invoke('extract-app-icon', appPath),

    // Reveal item in Finder / File Explorer
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),

    // File dialogs
    selectAppFile: () => ipcRenderer.invoke('select-app-file'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // Open external link
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Get platform info
    getPlatform: () => ipcRenderer.invoke('get-platform'),

    // Calculate on-disk sizes for a list of paths
    getPathsSizes: (pathsList) => ipcRenderer.invoke('get-paths-sizes', pathsList),

    // Freeze / Unfreeze a plugin file into or out of the Plugin Vault
    setPluginFrozen: (payload) => ipcRenderer.invoke('set-plugin-frozen', payload),

    // Open the User Guide window
    openUserGuide: () => ipcRenderer.invoke('open-user-guide'),

    // Scan progress notifications
    onScanProgress: (callback) => {
        ipcRenderer.removeAllListeners('scan-progress');
        ipcRenderer.on('scan-progress', (event, data) => callback(data));
    },

    // Check if running in Electron
    isElectron: true
});
