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

// Scan for plugins (basic implementation)
ipcMain.handle('scan-plugins', async () => {
    const platform = process.platform;
    const plugins = [];

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
            'C:\\Program Files (x86)\\Steinberg\\VSTPlugins'
        ];
    }

    for (const pluginPath of pluginPaths) {
        if (fs.existsSync(pluginPath)) {
            try {
                const files = fs.readdirSync(pluginPath);

                files.forEach(file => {
                    const fullPath = path.join(pluginPath, file);
                    const stats = fs.statSync(fullPath);

                    // Determine format
                    let format = 'Unknown';
                    if (file.endsWith('.vst3') || stats.isDirectory() && file.endsWith('.vst3')) {
                        format = 'VST3';
                    } else if (file.endsWith('.vst')) {
                        format = 'VST';
                    } else if (file.endsWith('.component')) {
                        format = 'AU';
                    }

                    if (format !== 'Unknown') {
                        plugins.push({
                            name: file.replace(/\.(vst3|vst|component)$/, ''),
                            path: fullPath,
                            format: format,
                            type: 'unknown', // Would need metadata parsing
                            manufacturer: 'Unknown',
                            notes: ''
                        });
                    }
                });
            } catch (error) {
                console.error(`Error scanning ${pluginPath}:`, error);
            }
        }
    }

    return plugins;
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
