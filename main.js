// Music App Manager - Electron Main Process
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// Safe wrapper around execSync — returns null instead of throwing
function execSyncSafe(cmd) {
    try {
        return execSync(cmd, { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    } catch (e) {
        return null;
    }
}

// --- Shared Scanner Helpers ---
const BUNDLE_MANUFACTURERS = {
    'com.ableton': 'Ableton',
    'com.apple.garageband': 'Apple',
    'com.apple.logic': 'Apple',
    'com.apple.mainstage': 'Apple',
    'com.avid': 'Avid',
    'com.steinberg': 'Steinberg',
    'com.image-line': 'Image-Line',
    'com.presonus': 'PreSonus',
    'com.cockos': 'Cockos',
    'com.bitwig': 'Bitwig',
    'com.reasonstudios': 'Reason Studios',
    'com.propellerhead': 'Reason Studios',
    'com.native-instruments': 'Native Instruments',
    'de.native-instruments': 'Native Instruments',
    'com.arturia': 'Arturia',
    'com.xferrecords': 'Xfer Records',
    'com.spectrasonics': 'Spectrasonics',
    'com.vitalaudio': 'Vital Audio',
    'com.matt-tytel': 'Vital Audio',
    'com.ikmultimedia': 'IK Multimedia',
    'com.positivegrid': 'Positive Grid',
    'com.neuraldsp': 'Neural DSP',
    'com.izotope': 'iZotope',
    'com.fabfilter': 'FabFilter',
    'com.waves': 'Waves',
    'com.soundtoys': 'Soundtoys',
    'com.valhalladsp': 'Valhalla DSP',
    'com.celemony': 'Celemony',
    'com.antarestech': 'Antares',
    'com.output': 'Output',
    'com.cherryaudio': 'Cherry Audio',
    'com.cherry-audio': 'Cherry Audio',
    'com.softube': 'Softube',
    'com.plugin-alliance': 'Plugin Alliance',
    'com.pluginalliance': 'Plugin Alliance',
    'com.uhe': 'u-he',
    'de.uhe': 'u-he',
    'com.kilohearts': 'Kilohearts',
    'com.noiseengineering': 'Noise Engineering',
    'com.audiodamage': 'Audio Damage',
    'com.sugar-bytes': 'Sugar Bytes',
    'com.sugarbytes': 'Sugar Bytes',
    'com.zynaptiq': 'Zynaptiq',
    'com.soundradix': 'SoundRadix',
    'com.eventide': 'Eventide',
    'com.goodhertz': 'Goodhertz',
    'com.slate-digital': 'Slate Digital',
    'com.slatedigital': 'Slate Digital',
    'com.exponentialaudio': 'Exponential Audio',
    'com.2caudio': '2CAudio',
    'com.liquidsonics': 'Liquid Sonics',
    'com.audioease': 'Audio Ease',
    'com.airwindows': 'Airwindows',
    'com.klanghelm': 'Klanghelm',
    'uk.co.acustica': 'Acustica Audio',
    'com.acusticaaudio': 'Acustica Audio',
    'com.meldaproduction': 'Melda Production',
    'com.apulsoft': 'Apulsoft',
    'com.brainworx': 'Brainworx',
    'com.overloud': 'Overloud',
    'com.leapwing': 'Leapwing Audio',
    'com.newfangled': 'Newfangled Audio',
    'com.roland': 'Roland',
    'com.korg': 'Korg',
    'com.yamaha': 'Yamaha',
    'com.moogmusic': 'Moog',
    'com.spitfireaudio': 'Spitfire Audio',
    'com.eastwestsounds': 'EastWest',
    'com.heavyocity': 'Heavyocity',
    'com.8dio': '8Dio',
    'com.orchestraltools': 'Orchestral Tools',
    'com.algoriddim': 'Algoriddim',
    'com.pioneerdj': 'Pioneer DJ',
    'com.serato': 'Serato',
    'com.makemusic': 'MakeMusic',
};

const readPlist = (plistPath) => {
    try {
        if (!fs.existsSync(plistPath)) return null;
        const json = execSyncSafe(`plutil -convert json -o - "${plistPath}"`);
        return json ? JSON.parse(json) : null;
    } catch (e) {
        return null;
    }
};

const manufacturerFromBundleId = (bundleId) => {
    if (!bundleId) return null;
    const lower = bundleId.toLowerCase();
    for (const [domain, name] of Object.entries(BUNDLE_MANUFACTURERS)) {
        if (lower.startsWith(domain)) return name;
    }
    // Deep guess based on domain segments
    const parts = lower.split('.');
    if (parts.length >= 2) {
        const seg = parts[1];
        const skip = new Set(['apple', 'google', 'microsoft', 'adobe', 'electron', 'app', 'com', 'net', 'org']);
        if (!skip.has(seg)) {
            return seg
                .replace(/-/g, ' ')
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }
    }
    return null;
};

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

// Open User Guide in its own window
ipcMain.handle('open-user-guide', async () => {
    const guideWin = new BrowserWindow({
        width: 1060,
        height: 780,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#0a0a0f',
        title: 'Music App Manager — User Guide',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset',
    });
    guideWin.loadFile(path.join(__dirname, 'docs', 'user-guide.html'));
    guideWin.once('ready-to-show', () => guideWin.show());
});

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
    const scanDirectory = (dirPath, maxDepth = 5, currentDepth = 0) => {
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
                        console.log(`[Plugin Found] ${file} (${format}) at ${fullPath}`);

                        // Clean up plugin name
                        let pluginName = file.replace(/\.(vst3|vst|component|dll)$/i, '');

                        // --- Start Enhanced Detection ---
                        let manufacturer = 'Unknown';
                        let type = 'unknown';

                        // 1. Try Info.plist on macOS
                        if (platform === 'darwin' && stats.isDirectory()) {
                            const plistPath = path.join(fullPath, 'Contents/Info.plist');
                            const plist = readPlist(plistPath);
                            if (plist) {
                                // Extract manufacturer from bundle ID
                                const bundleId = plist.CFBundleIdentifier || plist.CFBundleName;
                                const mfr = manufacturerFromBundleId(bundleId);
                                if (mfr) manufacturer = mfr;

                                // Try to guess type from plist keys or description
                                const haystack = (JSON.stringify(plist) + ' ' + fullPath).toLowerCase();
                                if (/instrument|synth|sampler|drum/i.test(haystack)) type = 'instrument';
                                else if (/effect|filter|reverb|delay|eq/i.test(haystack)) type = 'effect';
                            }
                        }

                        // 2. Fallback to path/name keywords for Manufacturer
                        if (manufacturer === 'Unknown') {
                            const KNOWN_PUBLISHERS = {
                                'Arturia': /arturia|analog lab|pigments|v collection/i,
                                'Native Instruments': /native instruments|ni |kontakt|massive|reaktor/i,
                                'Waves': /waves/i,
                                'FabFilter': /fabfilter|pro-q|pro-c|pro-l/i,
                                'iZotope': /izotope|ozone|neutron|rx /i,
                                'Soundtoys': /soundtoys/i,
                                'Valhalla DSP': /valhalla/i,
                                'Softube': /softube/i,
                                'Slate Digital': /slate digital|fg-x|verbcms/i,
                                'Neural DSP': /neural dsp|archetype/i,
                                'IK Multimedia': /ik multimedia|amplitube|sampletank|t-rack/i,
                                'Plugin Alliance': /plugin alliance|brainworx|spl |unfiltered audio|bx_/i,
                                'u-he': /u-he|diva|zebra|hive|repro/i,
                                'Spectrasonics': /spectrasonics|omnisphere|keyscape|trilian/i,
                                'Universal Audio': /universal audio|uao|ucloud/i,
                                'Output': /output|arcade|exhale|portal|thermal/i,
                                'Cherry Audio': /cherry audio|ca2600|dco-106|surrealistic|polymode|eight voice|mercury-6|gx-80/i,
                                'Kilohearts': /kilohearts|khs /i,
                                'Eventide': /eventide/i,
                                'Celemony': /celemony|melodyne/i,
                                'Antares': /antares|autotune/i,
                                'MeldaProduction': /meldaproduction/i,
                                'Ableton': /ableton/i,
                                'Apple': /apple/i,
                                'Steinberg': /steinberg/i,
                                'Applied Acoustics Systems': /Applied Acoustics Systems|AAS /i,
                                'LennarDigital': /LennarDigital|Sylenth/i,
                                'Xfer Records': /Xfer Records|Serum|OTT/i,
                                'Reveal Sound': /Reveal Sound|Spire/i,
                                'Vital Audio': /Vital Audio|Vital/i,
                            };

                            for (const [name, regex] of Object.entries(KNOWN_PUBLISHERS)) {
                                if (regex.test(fullPath) || regex.test(pluginName)) {
                                    manufacturer = name;
                                    break;
                                }
                            }
                        }

                        // 3. Fallback to secondary path part (e.g. /Manufacturer/Plugin)
                        if (manufacturer === 'Unknown') {
                            const pathParts = fullPath.split(path.sep);
                            if (pathParts.length > 2) {
                                // Common pattern on Windows: C:\Program Files\VSTPlugins\Manufacturer\Plugin.dll
                                // Common pattern on macOS: /Library/Audio/Plug-Ins/VST/Manufacturer/Plugin.vst
                                const possibleManufacturer = pathParts[pathParts.length - 2];
                                const skipDirs = ['vst3', 'vst', 'components', 'vstplugins', 'plugins', 'audio', 'library', 'plug-ins', 'common files'];
                                if (!skipDirs.includes(possibleManufacturer.toLowerCase())) {
                                    manufacturer = possibleManufacturer;
                                }
                            }
                        }

                        // 4. Enhance Type detection
                        if (type === 'unknown') {
                            const haystack = (fullPath + ' ' + pluginName).toLowerCase();
                            const instrKeywords = [
                                'synth', 'piano', 'drum', 'bass', 'guitar', 'organ', 'strings', 'brass', 'sampler',
                                'kontakt', 'oscillator', 'vco', 'analog', 'fm', 'wavetable', 'spectral', 'granular',
                                'kick', 'snare', 'percussion', 'mallet', 'orchestral', 'choir', 'keys', 'rhodes',
                                'wurli', 'clavi', 'hammond', 'poly', 'mono', 'omnisphere', 'serum', 'vital',
                                'massive', 'pigments', 'diva', 'zebra', 'hive', 'repro', 'sylenth', 'arcade',
                                'falcon', 'halion', 'sampletank', 'spire', 'nexus', 'avenger', 'model 72', 'model 84',
                                'arp 2600', 'buchla', 'cs-80', 'dx7', 'emulator', 'fairlight', 'jup-8', 'matrix-12',
                                'mellotron', 'mini v', 'modular v', 'oberheim', 'prophet', 'solina', 'synclavier',
                                'synthi', 'vocoder v', 'vox continental', 'augmented', 'stage-73', 'b-3 v', 'farfisa'
                            ];
                            const effectKeywords = [
                                'reverb', 'delay', 'eq', 'equalizer', 'compressor', 'limiter', 'satn', 'distortion',
                                'drive', 'fuzz', 'amp', 'cab', 'speaker', 'chorus', 'flanger', 'phaser', 'tremolo',
                                'vibrato', 'filter', 'gate', 'expander', 'de-esser', 'transient', 'shaper', 'pitch',
                                'shift', 'harmony', 'autotune', 'melodyne', 'vocoder', 'convolution', 'plate',
                                'room', 'hall', 'spring', 'tape', 'tube', 'console', 'channel strip', 'meter',
                                'visualizer', 'scope', 'analyzer', 'clipper', 'stereo', 'width', 'image', 'utility',
                                'ozone', 'neutron', 'nectar', 'pro-q', 'pro-c', 'pro-l', 'saturn', 'valhalla',
                                'shaperbox', 'half-time', 'portal', 'thermal', 'blackhole', 'vintage verb', 'delay vvv'
                            ];

                            if (instrKeywords.some(k => haystack.includes(k))) type = 'instrument';
                            else if (effectKeywords.some(k => haystack.includes(k))) type = 'effect';
                        }
                        // --- End Enhanced Detection ---

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
                        console.log(`Recurse into: ${fullPath} (depth: ${currentDepth}/${maxDepth})`);
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

        console.log(`Plugin merge success: ${newPlugins.length} added, ${configData.plugins.length} total.`);

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

// Scan for music apps in /Applications
ipcMain.handle('scan-apps', async (event) => {
    const getAppsDirs = () => {
        if (process.platform === 'darwin') return ['/Applications'];
        if (process.platform === 'win32') {
            const dirs = ['C:\\Program Files', 'C:\\Program Files (x86)'];
            // Add user-local programs if they exist
            const localApps = path.join(os.homedir(), 'AppData\\Local\\Programs');
            if (fs.existsSync(localApps)) dirs.push(localApps);
            return dirs;
        }
        return [];
    };

    const appsDirs = getAppsDirs();
    const scannedApps = [];

    // Apple's own category identifiers for audio/music apps
    const MUSIC_CATEGORIES = new Set([
        'public.app-category.music',
        'public.app-category.audio',
    ]);

    // suggester uses the shared BUNDLE_MANUFACTURERS and helper functions now.

    // ── Suggest a category from all available signals ──
    const suggestCategory = (fileName, bundleId) => {
        const haystack = (fileName + ' ' + (bundleId || '')).toLowerCase();
        if (/ableton|logic pro|pro tools|cubase|fl studio|studio one|reaper|bitwig|reason|garageband|mainstage|ardour/.test(haystack)) return 'DAWs';
        if (/serum|massive|vital|omnisphere|pigments|analog lab|keyscape|diva|zebra|hive|nexus|avenger|phase plant|cherry|voltage|mercury|synth|korg|moog|arp |obx|reaktor/.test(haystack)) return 'Synths';
        if (/guitar|amplitube|bias|neural|helix|kemper|amp sim/.test(haystack)) return 'Guitar & Bass';
        if (/izotope|fabfilter|waves|soundtoys|valhalla|melodyne|auto-tune|ozone|neutron|slate|brainworx|softube|eventide/.test(haystack)) return 'Audio Tools';
        if (/traktor|rekordbox|serato|virtual dj|djay/.test(haystack)) return 'Utilities';
        return 'Utilities';
    };

    for (const appsDir of appsDirs) {
        try {
            if (!fs.existsSync(appsDir)) continue;
            const files = fs.readdirSync(appsDir);

            for (const file of files) {
                if (process.platform === 'darwin' && !file.endsWith('.app')) continue;
                if (process.platform === 'win32' && !file.endsWith('.exe')) continue;

                const filePath = path.join(appsDir, file);
                const appName = file.replace(/\.(app|exe)$/, '');
                const fileName = appName.toLowerCase();

                let isMusicApp = false;
                let detectionMethod = '';
                let confidence = 'Low';
                let manufacturer = 'Unknown';
                let bundleId = '';
                let plist = null;

                // ── Strategy 1: Read Info.plist (most reliable on macOS) ──
                if (process.platform === 'darwin') {
                    plist = readPlist(path.join(filePath, 'Contents', 'Info.plist'));

                    if (plist) {
                        bundleId = (plist.CFBundleIdentifier || '').toLowerCase();

                        // (a) Apple's own audio/music category flag — definitive
                        const appCat = (plist.LSApplicationCategoryType || '').toLowerCase();
                        if (MUSIC_CATEGORIES.has(appCat)) {
                            isMusicApp = true;
                            detectionMethod = 'plist-category';
                            confidence = 'High';
                        }

                        // (b) Bundle ID matches a known music publisher
                        if (!isMusicApp) {
                            const knownPublisher = Object.keys(BUNDLE_MANUFACTURERS)
                                .some(d => bundleId.startsWith(d));
                            if (knownPublisher) {
                                isMusicApp = true;
                                detectionMethod = 'plist-bundleid';
                                confidence = 'High';
                            }
                        }

                        // Resolve manufacturer from bundle ID
                        const mfrFromId = manufacturerFromBundleId(bundleId);
                        if (mfrFromId) manufacturer = mfrFromId;

                        // Fallback: parse NSHumanReadableCopyright for company name
                        if (manufacturer === 'Unknown') {
                            const copy = plist.NSHumanReadableCopyright || plist.CFBundleGetInfoString || '';
                            const m = copy.match(/©?\s*\d{4}[\s,\-–]+([^.,()]+)/);
                            if (m) manufacturer = m[1].trim().replace(/^(by\s+)/i, '');
                        }
                    }
                }

                // ── Strategy 2: Known music app keyword in filename ──
                if (!isMusicApp && KNOWN_KEYWORDS.some(k => fileName.includes(k))) {
                    isMusicApp = true;
                    detectionMethod = 'keyword-known';
                    confidence = 'High';
                }

                // ── Strategy 3: Generic music term in filename ──
                if (!isMusicApp && GENERIC_TERMS.some(t => fileName.includes(t))) {
                    isMusicApp = true;
                    detectionMethod = 'keyword-generic';
                    confidence = 'Medium';
                }

                if (!isMusicApp) continue;

                // Keyword-based manufacturer fallback (when plist didn't help)
                if (manufacturer === 'Unknown') {
                    const mfr = [
                        [/arturia|pigments|analog lab|v collection/, 'Arturia'],
                        [/cherry audio|voltage modular|mercury-6/, 'Cherry Audio'],
                        [/ableton/, 'Ableton'],
                        [/logic|garageband|mainstage/, 'Apple'],
                        [/kontakt|massive|komplete|reaktor|guitar rig|traktor|maschine/, 'Native Instruments'],
                        [/serum|xfer/, 'Xfer Records'],
                        [/vital/, 'Vital Audio'],
                        [/omnisphere|keyscape|trilian|stylus/, 'Spectrasonics'],
                        [/izotope|ozone|neutron|nectar/, 'iZotope'],
                        [/fabfilter|pro-q|pro-c|pro-r|pro-l|saturn/, 'FabFilter'],
                        [/waves/, 'Waves'],
                        [/valhalla/, 'Valhalla DSP'],
                        [/melodyne/, 'Celemony'],
                        [/soundtoys/, 'Soundtoys'],
                        [/slate digital|fresh air/, 'Slate Digital'],
                        [/softube/, 'Softube'],
                        [/neural dsp/, 'Neural DSP'],
                        [/positive grid|bias amp/, 'Positive Grid'],
                        [/amplitube/, 'IK Multimedia'],
                        [/u-he|diva|zebra|hive|repro|bazille/, 'u-he'],
                        [/sugar.bytes/, 'Sugar Bytes'],
                        [/spitfire/, 'Spitfire Audio'],
                        [/east.?west/, 'EastWest'],
                        [/reaper/, 'Cockos'],
                        [/bitwig/, 'Bitwig'],
                        [/fl studio|fruity/, 'Image-Line'],
                        [/studio one/, 'PreSonus'],
                        [/cubase|nuendo|wavelab/, 'Steinberg'],
                        [/pro tools/, 'Avid'],
                        [/rekordbox/, 'Pioneer DJ'],
                        [/serato/, 'Serato'],
                        [/djay/, 'Algoriddim'],
                        [/sibelius/, 'Avid'],
                        [/finale/, 'MakeMusic'],
                        [/dorico/, 'Steinberg'],
                    ].find(([re]) => re.test(fileName));
                    if (mfr) manufacturer = mfr[1];
                }

                // ── Extract real app icon via sips (.icns → PNG → base64) ──
                // nativeImage.createFromPath does NOT support .icns — use sips instead
                let iconDataUrl = null;
                if (process.platform === 'darwin' && plist) {
                    try {
                        let iconFile = plist.CFBundleIconFile || plist.CFBundleIconName || '';
                        if (iconFile && !iconFile.endsWith('.icns')) iconFile += '.icns';
                        if (iconFile) {
                            const icnsPath = path.join(filePath, 'Contents', 'Resources', iconFile);
                            if (fs.existsSync(icnsPath)) {
                                const tmpPng = path.join(os.tmpdir(), `icon_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
                                execSyncSafe(`sips -s format png -z 64 64 "${icnsPath}" --out "${tmpPng}"`);
                                if (fs.existsSync(tmpPng)) {
                                    const pngData = fs.readFileSync(tmpPng);
                                    iconDataUrl = 'data:image/png;base64,' + pngData.toString('base64');
                                    fs.unlinkSync(tmpPng);
                                }
                            }
                        }
                    } catch (e) {
                        // Icon extraction failed — will fall back to emoji
                    }
                }

                scannedApps.push({
                    name: appName,
                    path: filePath,
                    manufacturer: manufacturer,
                    suggestedCategory: suggestCategory(fileName, bundleId),
                    icon: iconDataUrl || '🎵',
                    detectionMethod: detectionMethod,
                    confidence: confidence,
                    bundleId: bundleId,
                });
            }
        } catch (error) {
            console.error(`Error scanning directory ${appsDir}:`, error);
        }
    }

    console.log(`App scan complete. Found ${scannedApps.length} music apps.`);
    return scannedApps;
});
// Extract icon for a single app path (used to refresh icons on existing config entries)
ipcMain.handle('extract-app-icon', async (event, appPath) => {
    try {
        const plistPath = path.join(appPath, 'Contents', 'Info.plist');
        if (fs.existsSync(plistPath)) {
            const plist = JSON.parse(
                execSyncSafe(`plutil -convert json -o - "${plistPath}"`)
            );
            if (plist) {
                let iconFile = plist.CFBundleIconFile || plist.CFBundleIconName || '';
                if (iconFile && !iconFile.endsWith('.icns')) iconFile += '.icns';
                if (iconFile) {
                    const icnsPath = path.join(appPath, 'Contents', 'Resources', iconFile);
                    if (fs.existsSync(icnsPath)) {
                        const tmpPng = path.join(os.tmpdir(), `icon_${Date.now()}.png`);
                        execSyncSafe(`sips -s format png -z 64 64 "${icnsPath}" --out "${tmpPng}"`);
                        if (fs.existsSync(tmpPng)) {
                            const pngData = fs.readFileSync(tmpPng);
                            fs.unlinkSync(tmpPng);
                            return 'data:image/png;base64,' + pngData.toString('base64');
                        }
                    }
                }
            }
        }
        return null;
    } catch (e) {
        return null;
    }
});

