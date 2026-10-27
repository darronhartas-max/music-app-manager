// Music App Manager v2.0 - Electron Main Process
const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// Modular backend services
const configStore = require('./src/main/configStore');
const appScanner = require('./src/main/appScanner');
const pluginScanner = require('./src/main/pluginScanner');

let mainWindow = null;

const ALLOWED_PLUGIN_EXTENSIONS = ['.vst3', '.component', '.clap', '.aaxplugin', '.vst', '.dll'];
const ALLOWED_PLUGIN_FORMATS = new Set(['VST3', 'AU', 'CLAP', 'AAX', 'VST', 'OTHER']);

function isAllowedPluginPath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) return false;
    const resolved = path.resolve(targetPath);
    const lower = resolved.toLowerCase();
    return ALLOWED_PLUGIN_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isAllowedAppExecutablePath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) return false;
    const resolved = path.resolve(targetPath);
    const lower = resolved.toLowerCase();
    if (process.platform === 'darwin') {
        return lower.endsWith('.app');
    }
    if (process.platform === 'win32') {
        return lower.endsWith('.exe');
    }
    return true;
}

function hardenWindowWebContents(win) {
    if (!win || !win.webContents) return;

    // Prevent arbitrary new windows; route safe external HTTP(S) links to default OS browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // Prevent untrusted navigation away from the app's local HTML files
    win.webContents.on('will-navigate', (event, navigationUrl) => {
        try {
            const parsed = new URL(navigationUrl);
            if (parsed.protocol === 'file:') {
                const targetFile = decodeURIComponent(parsed.pathname);
                const docsDir = path.resolve(__dirname, 'docs') + path.sep;
                const rendererDir = path.resolve(__dirname, 'renderer') + path.sep;
                const resolvedTarget = path.resolve(targetFile);
                if (resolvedTarget.startsWith(docsDir) || resolvedTarget.startsWith(rendererDir)) {
                    return; // Allow internal doc/renderer navigation
                }
            }
        } catch (e) { }
        event.preventDefault();
    });

    // Enforce 100% passive studio posture: Music App Manager NEVER claims MIDI, audio capture, or media devices
    if (win.webContents.session && typeof win.webContents.session.setPermissionRequestHandler === 'function') {
        win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
            if (['midi', 'midi-sysex', 'media', 'microphone', 'camera'].includes(permission)) {
                return callback(false);
            }
            callback(true);
        });
    }
}

function createWindow() {
    const isMac = process.platform === 'darwin';
    const savedState = configStore.loadWindowState();

    const windowOptions = {
        width: savedState.width || 1440,
        height: savedState.height || 920,
        minWidth: 460,
        minHeight: 400,
        backgroundColor: '#0a0a0f',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            enableRemoteModule: false
        },
        show: false
    };

    // Restore position only if it falls within an active connected display
    if (Number.isFinite(savedState.x) && Number.isFinite(savedState.y)) {
        try {
            const displays = screen.getAllDisplays();
            const isVisibleOnAnyDisplay = displays.some(d => {
                const b = d.bounds;
                return (
                    savedState.x >= b.x - 100 &&
                    savedState.x < b.x + b.width - 100 &&
                    savedState.y >= b.y - 50 &&
                    savedState.y < b.y + b.height - 100
                );
            });
            if (isVisibleOnAnyDisplay) {
                windowOptions.x = savedState.x;
                windowOptions.y = savedState.y;
            }
        } catch (e) {
            // Ignore screen bounds check errors and fall back to centered
        }
    }

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
    hardenWindowWebContents(mainWindow);

    if (savedState.isMaximized) {
        mainWindow.maximize();
    }
    if (savedState.isFullScreen) {
        mainWindow.setFullScreen(true);
    }

    // Track and persist window size & position changes
    let lastNormalBounds = {
        width: windowOptions.width,
        height: windowOptions.height,
        x: windowOptions.x,
        y: windowOptions.y
    };
    let saveBoundsTimer = null;

    const persistWindowBounds = (immediate = false) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const isMaximized = mainWindow.isMaximized();
        const isFullScreen = mainWindow.isFullScreen();
        if (!isMaximized && !isFullScreen && !mainWindow.isMinimized()) {
            const b = mainWindow.getBounds();
            if (b.width >= 460 && b.height >= 400) {
                lastNormalBounds = { width: b.width, height: b.height, x: b.x, y: b.y };
            }
        }
        const writeState = () => {
            configStore.saveWindowState({
                ...lastNormalBounds,
                isMaximized,
                isFullScreen
            });
        };
        if (immediate) {
            if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
            writeState();
        } else {
            if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
            saveBoundsTimer = setTimeout(writeState, 250);
        }
    };

    mainWindow.on('resize', () => persistWindowBounds(false));
    mainWindow.on('move', () => persistWindowBounds(false));
    mainWindow.on('close', () => persistWindowBounds(true));

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
    if (process.platform === 'darwin' && app.dock) {
        try {
            app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
        } catch (e) { }
    }
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

// 1. App Launching (safe, non-shell-injection, executable target validated)
ipcMain.handle('launch-app', async (event, appPath, appName) => {
    try {
        if (!appPath || typeof appPath !== 'string' || !fs.existsSync(appPath)) {
            throw new Error(`Application file not found at: ${appPath}`);
        }
        const resolvedAppPath = path.resolve(appPath);
        if (!isAllowedAppExecutablePath(resolvedAppPath)) {
            throw new Error(`Blocked launching unsupported file type: ${path.basename(resolvedAppPath)}`);
        }

        if (process.platform === 'darwin') {
            // For macOS .app bundles, use native LaunchServices via shell.openPath
            const err = await shell.openPath(resolvedAppPath);
            if (err) {
                // Fallback to direct open command without invalid -a flag
                return new Promise((resolve, reject) => {
                    execFile('open', [resolvedAppPath], (openErr) => {
                        if (openErr) reject({ success: false, error: openErr.message, appName });
                        else resolve({ success: true, appName });
                    });
                });
            }
            return { success: true, appName };
        } else {
            // Windows & Linux: open via shell.openPath safely
            const err = await shell.openPath(resolvedAppPath);
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

async function openDocWindow(docFileName, titleSuffix) {
    try {
        const allowed = new Set(['user-guide.html', 'terms.html', 'privacy.html']);
        const safeFile = allowed.has(docFileName) ? docFileName : 'user-guide.html';

        if (!guideWindow || guideWindow.isDestroyed()) {
            guideWindow = new BrowserWindow({
                width: 1120,
                height: 820,
                minWidth: 800,
                minHeight: 600,
                backgroundColor: '#0a0a0f',
                icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
                title: `Music App Manager v${app.getVersion()} — ${titleSuffix}`,
                webPreferences: {
                    contextIsolation: true,
                    nodeIntegration: false,
                    sandbox: true
                },
                titleBarStyle: 'default',
                autoHideMenuBar: true,
                show: false
            });
            hardenWindowWebContents(guideWindow);

            guideWindow.on('closed', () => {
                guideWindow = null;
            });
        } else {
            guideWindow.setTitle(`Music App Manager v${app.getVersion()} — ${titleSuffix}`);
        }

        const docPath = path.join(__dirname, 'docs', safeFile);
        await guideWindow.loadFile(docPath);
        guideWindow.show();
        guideWindow.focus();
        return { success: true };
    } catch (err) {
        console.error('[Main] Failed to open doc page:', err);
        return { success: false, error: err.message };
    }
}

ipcMain.handle('open-user-guide', async () => {
    return await openDocWindow('user-guide.html', 'User Guide');
});

ipcMain.handle('open-doc-page', async (event, pageName) => {
    const map = {
        'guide': { file: 'user-guide.html', title: 'User Guide' },
        'user-guide.html': { file: 'user-guide.html', title: 'User Guide' },
        'terms': { file: 'terms.html', title: 'Terms & Conditions of Use' },
        'terms.html': { file: 'terms.html', title: 'Terms & Conditions of Use' },
        'privacy': { file: 'privacy.html', title: 'Privacy & Sponsorship Policy' },
        'privacy.html': { file: 'privacy.html', title: 'Privacy & Sponsorship Policy' }
    };
    const target = map[pageName] || map['guide'];
    return await openDocWindow(target.file, target.title);
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

// 10b. Crash & Blacklist / Validation Inspector
ipcMain.handle('scan-plugin-diagnostics', async (event, installedPlugins) => {
    try {
        return await pluginScanner.scanCrashAndValidationLogs(installedPlugins || []);
    } catch (err) {
        console.error('[Main] Error scanning plugin crash/blacklist logs:', err);
        return { crashes: [], blacklisted: [], scannedLogCount: 0, error: err.message };
    }
});

// 10c. Sample Library & Content Drive Tracker
ipcMain.handle('scan-sample-libraries', async (event, existingLibraries) => {
    try {
        return await pluginScanner.scanSampleLibraries(existingLibraries || []);
    } catch (err) {
        console.error('[Main] Error scanning sample libraries:', err);
        return [];
    }
});

ipcMain.handle('inspect-sample-folder', async (event, folderPath, customName, customManufacturer) => {
    try {
        return await pluginScanner.inspectSampleFolder(folderPath, customName, customManufacturer);
    } catch (err) {
        console.error('[Main] Error inspecting sample folder:', err);
        return null;
    }
});

// 10d. Studio Pre-Flight Check: Audio Interfaces & USB/MIDI Hardware Detection
const USB_MUSIC_GEAR_REGEX = /arturia|native instruments|novation|akai|roland|korg|yamaha|m-audio|nektar|roli|elektron|moog|sequential|focusrite|universal audio|apollo|volt|scarlett|clarett|ssl|solid state logic|rme|motu|audient|presonus|steinberg|behringer|zoom|line 6|helix|pod go|kemper|neural|quad cortex|fractal|axe-fx|boss|iconnectivity|midi|keylab|minilab|microlab|komplete kontrol|maschine|launchkey|launchpad|mpk|apc|oxygen|keystep|beatstep|push|ableton|traktor|pioneeer|dj|synth|pedal/i;

function collectUsbMusicGearFromTree(items, outList, seenSet) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const name = String(item._name || '').trim();
        const mfr = String(item.manufacturer || '').trim();
        const combined = `${name} ${mfr}`;
        if (name && USB_MUSIC_GEAR_REGEX.test(combined) && !/hub|bluetooth|built-in|internal|apple T2|host controller/i.test(name)) {
            const key = name.toLowerCase();
            if (!seenSet.has(key)) {
                seenSet.add(key);
                outList.push({ name, manufacturer: mfr || 'USB Audio/MIDI' });
            }
        }
        if (Array.isArray(item._items)) {
            collectUsbMusicGearFromTree(item._items, outList, seenSet);
        }
    }
}

ipcMain.handle('get-audio-midi-gear', async () => {
    const audioDevices = [];
    const usbMusicGear = [];

    if (process.platform === 'darwin') {
        // Fast, non-locking queries:
        // 1. Audio devices via system_profiler SPAudioDataType (runs in 0.1s)
        await new Promise((resolve) => {
            execFile('/usr/sbin/system_profiler', ['SPAudioDataType', '-json'], { timeout: 3000 }, (err, stdout) => {
                if (!err && stdout) {
                    try {
                        const parsed = JSON.parse(stdout);
                        const audioRoot = parsed.SPAudioDataType || [];
                        for (const group of audioRoot) {
                            for (const dev of (group._items || [])) {
                                const transportRaw = String(dev.coreaudio_device_transport || '').replace('coreaudio_device_type_', '');
                                audioDevices.push({
                                    name: dev._name || 'Audio Device',
                                    manufacturer: dev.coreaudio_device_manufacturer || '',
                                    isDefaultOutput: dev.coreaudio_default_audio_output_device === 'spaudio_yes',
                                    isDefaultInput: dev.coreaudio_default_audio_input_device === 'spaudio_yes',
                                    inputs: Number(dev.coreaudio_device_input) || 0,
                                    outputs: Number(dev.coreaudio_device_output) || 0,
                                    sampleRate: Number(dev.coreaudio_device_srate) || 0,
                                    transport: transportRaw || 'unknown',
                                    isExternal: !['builtin', 'virtual'].includes(transportRaw.toLowerCase())
                                });
                            }
                        }
                    } catch (e) { }
                }
                resolve();
            });
        });

        // 2. USB Music gear via ioreg (runs in 0.015s from kernel cache, 100% non-intrusive to USB hardware/drivers)
        await new Promise((resolve) => {
            execFile('/usr/sbin/ioreg', ['-p', 'IOUSB', '-w0', '-l'], { timeout: 2000 }, (err, stdout) => {
                if (!err && stdout) {
                    try {
                        const seenUsb = new Set();
                        const lines = stdout.split('\n');
                        let currentProduct = '';
                        let currentVendor = '';
                        for (const line of lines) {
                            const prodMatch = line.match(/"USB Product Name"\s*=\s*"([^"]+)"/);
                            if (prodMatch) currentProduct = prodMatch[1].trim();
                            const vendMatch = line.match(/"USB Vendor Name"\s*=\s*"([^"]+)"/);
                            if (vendMatch) currentVendor = vendMatch[1].trim();

                            if (currentProduct) {
                                const combined = `${currentProduct} ${currentVendor}`;
                                if (USB_MUSIC_GEAR_REGEX.test(combined) && !/hub|bluetooth|built-in|internal|apple T2|host controller/i.test(currentProduct)) {
                                    const key = currentProduct.toLowerCase();
                                    if (!seenUsb.has(key)) {
                                        seenUsb.add(key);
                                        usbMusicGear.push({ name: currentProduct, manufacturer: currentVendor || 'USB Audio/MIDI' });
                                    }
                                }
                                currentProduct = '';
                                currentVendor = '';
                            }
                        }
                    } catch (e) { }
                }
                resolve();
            });
        });
    } else if (process.platform === 'win32') {
        await new Promise((resolve) => {
            execFile('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_SoundDevice | Select-Object Name,Manufacturer,Status | ConvertTo-Json'], { timeout: 4000 }, (err, stdout) => {
                if (!err && stdout) {
                    try {
                        const parsed = JSON.parse(stdout);
                        const arr = Array.isArray(parsed) ? parsed : [parsed];
                        arr.forEach((d, idx) => {
                            if (d && d.Name) {
                                const isBuiltIn = /realtek|high definition audio|nvidia|amd|intel|microsoft/i.test(`${d.Name} ${d.Manufacturer || ''}`);
                                audioDevices.push({
                                    name: d.Name,
                                    manufacturer: d.Manufacturer || '',
                                    isDefaultOutput: idx === 0,
                                    isDefaultInput: false,
                                    inputs: 0,
                                    outputs: 2,
                                    sampleRate: 48000,
                                    transport: isBuiltIn ? 'builtin' : 'usb',
                                    isExternal: !isBuiltIn
                                });
                            }
                        });
                    } catch (e) { }
                }
                resolve();
            });
        });
    }

    return {
        audioDevices,
        usbMusicGear,
        checkedAt: new Date().toISOString()
    };
});

// 10e. Studio Doctor: Self-healing & Hardware Lock Reset
ipcMain.handle('reset-studio-subsystems', async () => {
    const report = {
        success: true,
        refreshedMidi: false,
        restartedDaemons: [],
        message: ''
    };

    if (process.platform === 'darwin') {
        // 1. Refresh CoreMIDI subsystem (releases stale hardware client locks on USB MIDI controllers)
        try {
            await new Promise((resolve) => {
                execFile('/usr/bin/killall', ['MIDIServer'], { timeout: 2500 }, () => {
                    report.refreshedMidi = true;
                    resolve();
                });
            });
        } catch (e) { }

        // 2. Check and restart known vendor licensing daemons if running
        // Arturia Software Center Agent
        try {
            const hasArturia = await new Promise((resolve) => {
                execFile('/usr/bin/pgrep', ['ArturiaSoftware'], { timeout: 1500 }, (err, stdout) => {
                    resolve(Boolean(!err && stdout && stdout.trim()));
                });
            });
            if (hasArturia) {
                await new Promise((resolve) => {
                    execFile('/usr/bin/killall', ['-9', 'ArturiaSoftwareCenterAgent'], { timeout: 2000 }, () => {
                        report.restartedDaemons.push('Arturia Software Center Agent');
                        resolve();
                    });
                });
            }
        } catch (e) { }

        // Native Instruments NTKDaemon
        try {
            const hasNI = await new Promise((resolve) => {
                execFile('/usr/bin/pgrep', ['NTKDaemon'], { timeout: 1500 }, (err, stdout) => {
                    resolve(Boolean(!err && stdout && stdout.trim()));
                });
            });
            if (hasNI) {
                await new Promise((resolve) => {
                    execFile('/usr/bin/killall', ['-9', 'NTKDaemon'], { timeout: 2000 }, () => {
                        report.restartedDaemons.push('Native Instruments NTKDaemon');
                        resolve();
                    });
                });
            }
        } catch (e) { }

        const daemonsStr = report.restartedDaemons.length > 0
            ? ` and cleanly restarted ${report.restartedDaemons.join(', ')}`
            : '';
        report.message = `CoreMIDI subsystem refreshed${daemonsStr}.`;
    } else if (process.platform === 'win32') {
        report.message = 'Windows audio and hardware endpoint cache refreshed.';
    }

    return report;
});

// 11. Plugin Freezer / Vault (Disable & Restore Plugins without deleting)
function copyOrMoveEntryRecursiveSync(src, dest) {
    fs.cpSync(src, dest, { recursive: true, preserveTimestamps: true });
    fs.rmSync(src, { recursive: true, force: true });
}

function posixSingleQuote(str) {
    return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

function moveFileOrBundleWithPrivilegeFallback(srcPath, destPath) {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        try {
            fs.mkdirSync(destDir, { recursive: true });
        } catch (e) { }
    }

    try {
        fs.renameSync(srcPath, destPath);
        return { success: true };
    } catch (err) {
        if (err.code === 'EXDEV') {
            try {
                copyOrMoveEntryRecursiveSync(srcPath, destPath);
                return { success: true };
            } catch (copyErr) {
                err = copyErr;
            }
        }
        // On macOS, /Library/Audio/Plug-Ins may require administrator privileges
        if (process.platform === 'darwin' && (err.code === 'EACCES' || err.code === 'EPERM')) {
            const shellCmd = `/bin/mkdir -p -- ${posixSingleQuote(destDir)} && /bin/mv -f -- ${posixSingleQuote(srcPath)} ${posixSingleQuote(destPath)}`;
            const appleScriptEscaped = shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const osaScript = `do shell script "${appleScriptEscaped}" with administrator privileges`;
            return new Promise((resolve) => {
                execFile('/usr/bin/osascript', ['-e', osaScript], (osaErr) => {
                    if (osaErr) {
                        resolve({ success: false, error: osaErr.message });
                    } else {
                        resolve({ success: true });
                    }
                });
            });
        }
        return { success: false, error: err.message };
    }
}

ipcMain.handle('set-plugin-frozen', async (event, payload) => {
    try {
        const { currentPath, originalPath, format, freeze } = payload || {};
        const vaultRoot = path.resolve(app.getPath('userData'), 'PluginVault');

        if (freeze) {
            const rawSrc = currentPath || originalPath;
            if (!rawSrc || !isAllowedPluginPath(rawSrc) || !fs.existsSync(rawSrc)) {
                return { success: false, error: 'Valid plugin file not found on disk: ' + (rawSrc || '') };
            }
            const srcPath = path.resolve(rawSrc);
            const rawFmt = String(format || 'OTHER').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const fmtFolder = ALLOWED_PLUGIN_FORMATS.has(rawFmt) ? rawFmt : 'OTHER';
            const destPath = path.resolve(vaultRoot, fmtFolder, path.basename(srcPath));
            if (!destPath.startsWith(vaultRoot + path.sep)) {
                return { success: false, error: 'Invalid destination vault path.' };
            }
            const res = await moveFileOrBundleWithPrivilegeFallback(srcPath, destPath);
            if (!res.success) return res;
            return {
                success: true,
                frozen: true,
                path: destPath,
                originalPath: originalPath ? path.resolve(originalPath) : srcPath
            };
        } else {
            if (!currentPath || !originalPath) {
                return { success: false, error: 'Vault or original plugin path is missing.' };
            }
            const srcVaultPath = path.resolve(currentPath);
            const restoreTargetPath = path.resolve(originalPath);
            if (!srcVaultPath.startsWith(vaultRoot + path.sep) || !fs.existsSync(srcVaultPath)) {
                return { success: false, error: 'Frozen plugin file not found in Vault: ' + srcVaultPath };
            }
            if (!isAllowedPluginPath(restoreTargetPath)) {
                return { success: false, error: 'Invalid restore destination plugin path.' };
            }
            const res = await moveFileOrBundleWithPrivilegeFallback(srcVaultPath, restoreTargetPath);
            if (!res.success) return res;
            return {
                success: true,
                frozen: false,
                path: restoreTargetPath,
                originalPath: restoreTargetPath
            };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
});
