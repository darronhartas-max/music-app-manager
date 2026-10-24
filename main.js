// Music App Manager v2.0 - Electron Main Process
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// Modular backend services
const configStore = require('./src/main/configStore');
const appScanner = require('./src/main/appScanner');
const pluginScanner = require('./src/main/pluginScanner');

let mainWindow = null;

function createWindow() {
    const isMac = process.platform === 'darwin';

    const windowOptions = {
        width: 1440,
        height: 920,
        minWidth: 1040,
        minHeight: 640,
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false
        },
        show: false
    };

    if (isMac) {
        windowOptions.titleBarStyle = 'hiddenInset';
        windowOptions.frame = true;
    } else {
        // Windows PC custom title bar with native controls
        windowOptions.titleBarStyle = 'hidden';
        windowOptions.titleBarOverlay = {
            color: '#0a0a0f',
            symbolColor: '#e0e0e0',
            height: 40
        };
    }

    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers

// 1. App Launching (safe, non-shell-injection)
ipcMain.handle('launch-app', async (event, appPath, appName) => {
    try {
        if (!fs.existsSync(appPath)) {
            throw new Error(`Application file not found at: ${appPath}`);
        }

        if (process.platform === 'darwin') {
            // For macOS .app bundles, use `open` via execFile safely
            return new Promise((resolve, reject) => {
                execFile('open', ['-a', appPath], (err) => {
                    if (err) {
                        // Fallback to direct shell open
                        shell.openPath(appPath).then((openErr) => {
                            if (openErr) reject({ success: false, error: openErr, appName });
                            else resolve({ success: true, appName });
                        });
                    } else {
                        resolve({ success: true, appName });
                    }
                });
            });
        } else {
            // Windows & Linux: open via shell.openPath safely
            const err = await shell.openPath(appPath);
            if (err) throw new Error(err);
            return { success: true, appName };
        }
    } catch (error) {
        console.error(`[Main] Error launching ${appName}:`, error);
        return {
            success: false,
            error: error.message || 'Unknown launch error',
            appName
        };
    }
});

// 2. Configuration Management
ipcMain.handle('load-config', async () => {
    return configStore.load();
});

ipcMain.handle('save-config', async (event, configData) => {
    return configStore.save(configData);
});

// 3. File existence & Reveal
ipcMain.handle('check-app-exists', async (event, targetPath) => {
    try {
        return fs.existsSync(targetPath);
    } catch (e) {
        return false;
    }
});

ipcMain.handle('show-item-in-folder', async (event, targetPath) => {
    try {
        if (fs.existsSync(targetPath)) {
            shell.showItemInFolder(targetPath);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
});

// 4. Scanning Applications
ipcMain.handle('scan-apps', async () => {
    try {
        const config = configStore.load();
        const customPaths = (config.settings && config.settings.customAppPaths) || [];

        return await appScanner.scan({
            customPaths,
            onProgress: (progress) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-progress', progress);
                }
            }
        });
    } catch (error) {
        console.error('[Main] Error scanning apps:', error);
        throw error;
    }
});

// 5. Scanning Audio Plugins
ipcMain.handle('scan-plugins', async () => {
    try {
        const config = configStore.load();
        const customPaths = (config.settings && config.settings.customPluginPaths) || [];

        return await pluginScanner.scan({
            customPaths,
            onProgress: (progress) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-progress', progress);
                }
            }
        });
    } catch (error) {
        console.error('[Main] Error scanning plugins:', error);
        throw error;
    }
});

// 6. Real Icon Extraction (uses sips on macOS .app bundles and getFileIcon on Windows)
ipcMain.handle('extract-app-icon', async (event, appPath) => {
    try {
        return await appScanner.extractIcon(appPath);
    } catch (e) {
        return null;
    }
});

// 7. File & Directory Dialogs
ipcMain.handle('select-app-file', async () => {
    const isMac = process.platform === 'darwin';
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Applications', extensions: isMac ? ['app'] : ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
});

// 8. Open external link & User Guide
ipcMain.handle('open-external', async (event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        shell.openExternal(url);
    }
});

let guideWindow = null;

ipcMain.handle('open-user-guide', async () => {
    try {
        if (guideWindow && !guideWindow.isDestroyed()) {
            guideWindow.show();
            guideWindow.focus();
            return { success: true };
        }

        guideWindow = new BrowserWindow({
            width: 1120,
            height: 820,
            minWidth: 800,
            minHeight: 600,
            backgroundColor: '#0a0a0f',
            title: `Music App Manager v${app.getVersion()} — User Guide`,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false
            },
            titleBarStyle: 'default',
            autoHideMenuBar: true,
            show: false
        });

        guideWindow.on('closed', () => {
            guideWindow = null;
        });

        const guidePath = path.join(__dirname, 'docs', 'user-guide.html');
        await guideWindow.loadFile(guidePath);
        guideWindow.show();
        guideWindow.focus();
        return { success: true };
    } catch (err) {
        console.error('[Main] Failed to open user guide:', err);
        return { success: false, error: err.message };
    }
});

// 9. Platform & App Version Info
ipcMain.handle('get-platform', async () => {
    return {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        appVersion: app.getVersion()
    };
});

// 10. Batch Disk Space Calculation for Existing Library Paths
ipcMain.handle('get-paths-sizes', async (event, pathsList) => {
    if (!Array.isArray(pathsList)) return {};
    const sizes = {};
    for (const p of pathsList) {
        if (p && typeof p === 'string' && !sizes[p]) {
            sizes[p] = await pluginScanner.calculatePathSize(p);
        }
    }
    return sizes;
});
