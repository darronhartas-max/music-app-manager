// Music App Manager - Electron Main Process
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

// Scan for music apps in /Applications
ipcMain.handle('scan-apps', async (event) => {
    const appsDir = process.platform === 'darwin' ? '/Applications' : 'C:\\Program Files';
    const scannedApps = [];

    // Apple's own category identifiers for audio/music apps
    const MUSIC_CATEGORIES = new Set([
        'public.app-category.music',
        'public.app-category.audio',
    ]);

    // Bundle-ID domain prefix → manufacturer name
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

    // Broad fallback keyword list (covers apps whose plist is unhelpful)
    const KNOWN_KEYWORDS = [
        'ableton', 'logic pro', 'pro tools', 'cubase', 'nuendo', 'fl studio', 'studio one',
        'reaper', 'bitwig', 'reason', 'garageband', 'audacity', 'ardour', 'mainstage',
        'serum', 'massive', 'omnisphere', 'kontakt', 'komplete', 'arturia',
        'pigments', 'analog lab', 'keyscape', 'trilian', 'stylus rmx',
        'vital', 'phase plant', 'surge', 'helm', 'dexed', 'tyrell',
        'guitar rig', 'amplitube', 'bias amp', 'neural', 'helix native',
        'izotope', 'ozone', 'neutron', 'rx audio', 'nectar', 'stutter edit',
        'fabfilter', 'pro-q', 'pro-c', 'pro-r', 'pro-l', 'saturn', 'timeless',
        'waves', 'soundtoys', 'valhalla', 'melodyne', 'auto-tune', 'autotune',
        'splice', 'output', 'arcade', 'exhale',
        'spitfire', 'east west', 'heavyocity', '8dio',
        'u-he', 'diva', 'zebra', 'hive', 'repro', 'bazille',
        'sylenth', 'nexus', 'avenger', 'sektor',
        'cherry audio', 'voltage modular', 'mercury-6', 'arp odyssey', 'obx',
        'softube', 'slate digital', 'plugin alliance',
        'eventide', 'blackhole', 'h3000', 'micropitch',
        'goodhertz', 'tone control',
        'traktor', 'rekordbox', 'serato', 'virtual dj', 'djay',
        'sonic pi', 'max/msp', 'reaktor',
        'loopback', 'audio hijack', 'soundsource',
        'maschine', 'push', 'komplete kontrol',
        'sibelius', 'dorico', 'musescore', 'finale', 'notion',
    ];

    const GENERIC_TERMS = [
        'synth', 'synthesizer', 'sampler', 'drum machine', 'beat maker',
        'midi controller', 'audio editor', 'reverb unit', 'modular',
        'vocoder', 'arpeggiator', 'looper', 'sequencer',
    ];

    // ── Read and parse an app's Info.plist via plutil ──
    const readPlist = (plistPath) => {
        try {
            if (!fs.existsSync(plistPath)) return null;
            const { execSync } = require('child_process');
            const json = execSync(
                `plutil -convert json -o - "${plistPath}"`,
                { timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] }
            );
            return JSON.parse(json.toString());
        } catch (e) {
            return null;
        }
    };

    // ── Extract manufacturer from bundle ID ──
    const manufacturerFromBundleId = (bundleId) => {
        if (!bundleId) return null;
        const lower = bundleId.toLowerCase();
        for (const [domain, name] of Object.entries(BUNDLE_MANUFACTURERS)) {
            if (lower.startsWith(domain)) return name;
        }
        // Auto-format the second segment as a best-guess company name
        // e.g. "com.cherryaudio.voltage" → "Cherryaudio" → "Cherry Audio" (close enough)
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

    try {
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

            // ── Extract real app icon from bundle ──
            let iconDataUrl = null;
            if (process.platform === 'darwin' && plist) {
                try {
                    const { nativeImage } = require('electron');
                    let iconFile = plist.CFBundleIconFile || plist.CFBundleIconName || '';
                    if (iconFile && !iconFile.endsWith('.icns')) iconFile += '.icns';
                    if (iconFile) {
                        const icnsPath = path.join(filePath, 'Contents', 'Resources', iconFile);
                        if (fs.existsSync(icnsPath)) {
                            const img = nativeImage.createFromPath(icnsPath);
                            if (!img.isEmpty()) {
                                iconDataUrl = img.resize({ width: 64, height: 64 }).toDataURL();
                            }
                        }
                    }
                    // Fallback: let Electron find the icon itself
                    if (!iconDataUrl) {
                        const img = nativeImage.createFromPath(filePath);
                        if (!img.isEmpty()) {
                            iconDataUrl = img.resize({ width: 64, height: 64 }).toDataURL();
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

        console.log(`App scan complete. Found ${scannedApps.length} music apps (plist introspection enabled).`);
        return scannedApps;

    } catch (error) {
        console.error('Error scanning apps:', error);
        return [];
    }
});
// Extract icon for a single app path (used to refresh icons on existing config entries)
ipcMain.handle('extract-app-icon', async (event, appPath) => {
    try {
        const { nativeImage } = require('electron');
        // Try reading from Info.plist first
        const plistPath = path.join(appPath, 'Contents', 'Info.plist');
        if (fs.existsSync(plistPath)) {
            const { execSync } = require('child_process');
            const plist = JSON.parse(
                execSync(`plutil -convert json -o - "${plistPath}"`,
                    { timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] }).toString()
            );
            let iconFile = plist.CFBundleIconFile || plist.CFBundleIconName || '';
            if (iconFile && !iconFile.endsWith('.icns')) iconFile += '.icns';
            if (iconFile) {
                const icnsPath = path.join(appPath, 'Contents', 'Resources', iconFile);
                if (fs.existsSync(icnsPath)) {
                    const img = nativeImage.createFromPath(icnsPath);
                    if (!img.isEmpty()) {
                        return img.resize({ width: 64, height: 64 }).toDataURL();
                    }
                }
            }
        }
        // Fallback: Electron's own icon resolver
        const img = nativeImage.createFromPath(appPath);
        if (!img.isEmpty()) {
            return img.resize({ width: 64, height: 64 }).toDataURL();
        }
        return null;
    } catch (e) {
        return null;
    }
});

