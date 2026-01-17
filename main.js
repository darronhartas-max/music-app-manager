// Electron Main Process
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

// Create the main application window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false
        },
        titleBarStyle: 'hiddenInset', // macOS style
        frame: true,
        show: false // Don't show until ready
    });

    // Load the app
    mainWindow.loadFile('renderer/index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development mode
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

// Launch application
ipcMain.handle('launch-app', async (event, appPath, appName) => {
    return new Promise((resolve, reject) => {
        const platform = process.platform;
        let command;

        if (platform === 'darwin') {
            // macOS
            if (appPath.endsWith('.app')) {
                command = `open -a "${appPath}"`;
            } else {
                command = `open "${appPath}"`;
            }
        } else if (platform === 'win32') {
            // Windows
            command = `start "" "${appPath}"`;
        } else {
            // Linux
            command = `xdg-open "${appPath}"`;
        }

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error launching ${appName}:`, error);
                reject({
                    success: false,
                    error: error.message,
                    appName: appName
                });
            } else {
                console.log(`Successfully launched ${appName}`);
                resolve({
                    success: true,
                    appName: appName
                });
            }
        });
    });
});

// Load configuration
ipcMain.handle('load-config', async () => {
    try {
        const configPath = path.join(__dirname, 'config', 'apps-config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
});

// Save configuration
ipcMain.handle('save-config', async (event, configData) => {
    try {
        const configPath = path.join(__dirname, 'config', 'apps-config.json');
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Error saving config:', error);
        throw error;
    }
});

// Check if app exists
ipcMain.handle('check-app-exists', async (event, appPath) => {
    try {
        return fs.existsSync(appPath);
    } catch (error) {
        return false;
    }
});

// Scan for plugins (enhanced implementation)
ipcMain.handle('scan-plugins', async (event) => {
    const platform = process.platform;
    const plugins = [];
    let scannedCount = 0;

    let pluginPaths = [];

    if (platform === 'darwin') {
        pluginPaths = [
            '/Library/Audio/Plug-Ins/VST3',
            '/Library/Audio/Plug-Ins/VST',
            '/Library/Audio/Plug-Ins/Components',
            path.join(os.homedir(), 'Library/Audio/Plug-Ins/VST3'),
            path.join(os.homedir(), 'Library/Audio/Plug-Ins/VST'),
            path.join(os.homedir(), 'Library/Audio/Plug-Ins/Components')
        ];
    } else if (platform === 'win32') {
        pluginPaths = [
            'C:\\Program Files\\Common Files\\VST3',
            'C:\\Program Files\\Steinberg\\VSTPlugins',
            'C:\\Program Files\\Common Files\\VST2',
            'C:\\Program Files (x86)\\Common Files\\VST3',
            'C:\\Program Files (x86)\\Steinberg\\VSTPlugins',
            path.join(os.homedir(), 'AppData\\Local\\Programs\\Common\\VST3')
        ];
    }

    // Helper function to scan directory recursively
    const scanDirectory = (dirPath, maxDepth = 2, currentDepth = 0) => {
        if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return;

        try {
            const files = fs.readdirSync(dirPath);

            files.forEach(file => {
                try {
                    const fullPath = path.join(dirPath, file);
                    const stats = fs.statSync(fullPath);

                    // Determine format
                    let format = null;
                    let isPlugin = false;

                    if (file.endsWith('.vst3') || (stats.isDirectory() && file.endsWith('.vst3'))) {
                        format = 'VST3';
                        isPlugin = true;
                    } else if (file.endsWith('.vst') || (stats.isDirectory() && file.endsWith('.vst'))) {
                        format = 'VST';
                        isPlugin = true;
                    } else if (file.endsWith('.component') || (stats.isDirectory() && file.endsWith('.component'))) {
                        format = 'AU';
                        isPlugin = true;
                    } else if (file.endsWith('.dll') && dirPath.includes('VST')) {
                        format = 'VST';
                        isPlugin = true;
                    }

                    if (isPlugin) {
                        scannedCount++;

                        // Clean up plugin name
                        let pluginName = file.replace(/\.(vst3|vst|component|dll)$/i, '');

                        // Try to extract manufacturer from path or name
                        let manufacturer = 'Unknown';
                        const pathParts = fullPath.split(path.sep);

                        // Look for manufacturer in path (common pattern: .../Manufacturer/PluginName)
                        if (pathParts.length > 2) {
                            const possibleManufacturer = pathParts[pathParts.length - 2];
                            if (possibleManufacturer !== 'VST3' &&
                                possibleManufacturer !== 'VST' &&
                                possibleManufacturer !== 'Components' &&
                                possibleManufacturer !== 'VSTPlugins') {
                                manufacturer = possibleManufacturer;
                            }
                        }

                        // Guess plugin type based on common naming patterns
                        let type = 'unknown';
                        const lowerName = pluginName.toLowerCase();

                        // Instrument indicators
                        if (lowerName.includes('synth') ||
                            lowerName.includes('piano') ||
                            lowerName.includes('drum') ||
                            lowerName.includes('bass') ||
                            lowerName.includes('guitar') ||
                            lowerName.includes('organ') ||
                            lowerName.includes('strings') ||
                            lowerName.includes('brass') ||
                            lowerName.includes('sampler') ||
                            lowerName.includes('kontakt')) {
                            type = 'instrument';
                        }
                        // Effect indicators
                        else if (lowerName.includes('reverb') ||
                            lowerName.includes('delay') ||
                            lowerName.includes('eq') ||
                            lowerName.includes('compressor') ||
                            lowerName.includes('limiter') ||
                            lowerName.includes('saturator') ||
                            lowerName.includes('distortion') ||
                            lowerName.includes('chorus') ||
                            lowerName.includes('flanger') ||
                            lowerName.includes('phaser')) {
                            type = 'effect';
                        }

                        plugins.push({
                            name: pluginName,
                            path: fullPath,
                            format: format,
                            type: type,
                            manufacturer: manufacturer,
                            notes: '',
                            dateScanned: new Date().toISOString()
                        });

                        // Send progress update
                        if (mainWindow && scannedCount % 10 === 0) {
                            mainWindow.webContents.send('scan-progress', {
                                count: scannedCount,
                                current: pluginName
                            });
                        }
                    } else if (stats.isDirectory() && currentDepth < maxDepth) {
                        // Recurse into subdirectories
                        scanDirectory(fullPath, maxDepth, currentDepth + 1);
                    }
                } catch (err) {
                    // Skip files we can't access
                    console.error(`Error scanning file ${file}:`, err.message);
                }
            });
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }
    };

    // Scan all plugin paths
    for (const pluginPath of pluginPaths) {
        console.log(`Scanning: ${pluginPath}`);
        scanDirectory(pluginPath);
    }

    console.log(`Plugin scan complete. Found ${plugins.length} plugins.`);
    return {
        plugins: plugins,
        count: plugins.length,
        scannedPaths: pluginPaths.filter(p => fs.existsSync(p))
    };
});

// Open external link
ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
});

// Get platform info
ipcMain.handle('get-platform', async () => {
    return {
        platform: process.platform,
        arch: process.arch,
        version: process.version
    };
});

// Open file dialog to select app
ipcMain.handle('select-app-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Applications', extensions: process.platform === 'darwin' ? ['app'] : ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Open file dialog to select plugin
ipcMain.handle('select-plugin-file', async () => {
    const { dialog } = require('electron');
    const filters = process.platform === 'darwin'
        ? [
            { name: 'Audio Plugins', extensions: ['vst3', 'vst', 'component'] },
            { name: 'All Files', extensions: ['*'] }
        ]
        : [
            { name: 'Audio Plugins', extensions: ['vst3', 'vst', 'dll'] },
            { name: 'All Files', extensions: ['*'] }
        ];

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Merge scanned plugins with existing config
ipcMain.handle('merge-plugins', async (event, scannedPlugins) => {
    try {
        const configPath = path.join(__dirname, 'config', 'apps-config.json');
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Get existing plugin paths
        const existingPaths = new Set(configData.plugins.map(p => p.path));

        // Add only new plugins
        const newPlugins = scannedPlugins.filter(p => !existingPaths.has(p.path));

        // Merge
        configData.plugins = [...configData.plugins, ...newPlugins];

        // Save
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');

        return {
            success: true,
            added: newPlugins.length,
            total: configData.plugins.length
        };
    } catch (error) {
        console.error('Error merging plugins:', error);
        throw error;
    }
});
