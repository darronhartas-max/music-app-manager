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

// --- Configuration Management ---
const getConfigPath = () => {
    // In production, we MUST use the userData directory as the app.asar is read-only
    const userDataPath = app.getPath('userData');
    const projectConfigFolder = path.join(__dirname, 'config');
    const userDataConfigFolder = path.join(userDataPath, 'config');
    const fileName = 'apps-config.json';

    const projectPath = path.join(projectConfigFolder, fileName);
    const userPath = path.join(userDataConfigFolder, fileName);

    // Migration: If user data doesn't exist but project data does (e.g. during dev transitions)
    // we try to move it once.
    if (!fs.existsSync(userPath) && fs.existsSync(projectPath)) {
        try {
            if (!fs.existsSync(userDataConfigFolder)) fs.mkdirSync(userDataConfigFolder, { recursive: true });
            fs.copyFileSync(projectPath, userPath);
            console.log('Migrated configuration to userData folder');
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }

    return userPath;
};

// Load configuration
ipcMain.handle('load-config', async () => {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return { categories: [], plugins: [], recentApps: [], settings: {} };
        }
        const configData = fs.readFileSync(configPath, 'utf8');
        if (!configData.trim()) return { categories: [], plugins: [], recentApps: [], settings: {} };
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error loading config:', error);
        return { categories: [], plugins: [], recentApps: [], settings: {} };
    }
});

// Save configuration (Atomic write)
ipcMain.handle('save-config', async (event, configData) => {
    try {
        const configPath = getConfigPath();
        const configFolder = path.dirname(configPath);

        if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder, { recursive: true });

        const tempPath = configPath + '.tmp';

        // Write to temporary file first
        fs.writeFileSync(tempPath, JSON.stringify(configData, null, 2), 'utf8');

        // Atomically rename it
        fs.renameSync(tempPath, configPath);

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

    const scanDirectory = (dirPath, maxDepth = 5, currentDepth = 0) => {
        if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return;

        try {
            const files = fs.readdirSync(dirPath);

            files.forEach(file => {
                try {
                    const fullPath = path.join(dirPath, file);
                    const stats = fs.statSync(fullPath);

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
                        let pluginName = file.replace(/\.(vst3|vst|component|dll)$/i, '');
                        let manufacturer = 'Unknown';
                        let type = 'unknown';

                        if (platform === 'darwin' && stats.isDirectory()) {
                            const plistPath = path.join(fullPath, 'Contents/Info.plist');
                            const plist = readPlist(plistPath);
                            if (plist) {
                                const bundleId = plist.CFBundleIdentifier || plist.CFBundleName;
                                const mfr = manufacturerFromBundleId(bundleId);
                                if (mfr) manufacturer = mfr;
                                const haystack = (JSON.stringify(plist) + ' ' + fullPath).toLowerCase();
                                if (/instrument|synth|sampler|drum/i.test(haystack)) type = 'instrument';
                                else if (/effect|filter|reverb|delay|eq/i.test(haystack)) type = 'effect';
                            }
                        }

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

                        if (manufacturer === 'Unknown') {
                            const pathParts = fullPath.split(path.sep);
                            if (pathParts.length > 2) {
                                const possibleManufacturer = pathParts[pathParts.length - 2];
                                const skipDirs = ['vst3', 'vst', 'components', 'vstplugins', 'plugins', 'audio', 'library', 'plug-ins', 'common files'];
                                if (!skipDirs.includes(possibleManufacturer.toLowerCase())) {
                                    manufacturer = possibleManufacturer;
                                }
                            }
                        }

                        if (type === 'unknown') {
                            const haystack = (fullPath + ' ' + pluginName).toLowerCase();
                            const instrKeywords = ['synth', 'piano', 'drum', 'bass', 'guitar', 'organ', 'strings', 'brass', 'sampler', 'kontakt', 'oscillator', 'vco', 'analog', 'fm', 'wavetable', 'spectral', 'granular', 'kick', 'snare', 'percussion', 'mallet', 'orchestral', 'choir', 'keys', 'rhodes', 'wurli', 'clavi', 'hammond', 'poly', 'mono', 'omnisphere', 'serum', 'vital', 'massive', 'pigments', 'diva', 'zebra', 'hive', 'repro', 'sylenth', 'arcade', 'falcon', 'halion', 'sampletank', 'spire', 'nexus', 'avenger', 'model 72', 'model 84', 'arp 2600', 'buchla', 'cs-80', 'dx7', 'emulator', 'fairlight', 'jup-8', 'matrix-12', 'mellotron', 'mini v', 'modular v', 'oberheim', 'prophet', 'solina', 'synclavier', 'synthi', 'vocoder v', 'vox continental', 'augmented', 'stage-73', 'b-3 v', 'farfisa'];
                            const effectKeywords = ['reverb', 'delay', 'eq', 'equalizer', 'compressor', 'limiter', 'satn', 'distortion', 'drive', 'fuzz', 'amp', 'cab', 'speaker', 'chorus', 'flanger', 'phaser', 'tremolo', 'vibrato', 'filter', 'gate', 'expander', 'de-esser', 'transient', 'shaper', 'pitch', 'shift', 'harmony', 'autotune', 'melodyne', 'vocoder', 'convolution', 'plate', 'room', 'hall', 'spring', 'tape', 'tube', 'console', 'channel strip', 'meter', 'visualizer', 'scope', 'analyzer', 'clipper', 'stereo', 'width', 'image', 'utility', 'ozone', 'neutron', 'nectar', 'pro-q', 'pro-c', 'pro-l', 'saturn', 'valhalla', 'shaperbox', 'half-time', 'portal', 'thermal', 'blackhole', 'vintage verb', 'delay vvv'];
                            if (instrKeywords.some(k => haystack.includes(k))) type = 'instrument';
                            else if (effectKeywords.some(k => haystack.includes(k))) type = 'effect';
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

                        if (mainWindow && scannedCount % 10 === 0) {
                            mainWindow.webContents.send('scan-progress', { count: scannedCount, current: pluginName });
                        }
                    } else if (stats.isDirectory() && currentDepth < maxDepth) {
                        scanDirectory(fullPath, maxDepth, currentDepth + 1);
                    }
                } catch (err) { }
            });
        } catch (error) { }
    };

    for (const pluginPath of pluginPaths) {
        scanDirectory(pluginPath);
    }

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
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
});

// Open file dialog to select plugin
ipcMain.handle('select-plugin-file', async () => {
    const { dialog } = require('electron');
    const filters = process.platform === 'darwin'
        ? [{ name: 'Audio Plugins', extensions: ['vst3', 'vst', 'component'] }, { name: 'All Files', extensions: ['*'] }]
        : [{ name: 'Audio Plugins', extensions: ['vst3', 'vst', 'dll'] }, { name: 'All Files', extensions: ['*'] }];
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
});

// Scan for music apps in /Applications
ipcMain.handle('scan-apps', async (event) => {
    const getAppsDirs = () => {
        if (process.platform === 'darwin') return ['/Applications'];
        if (process.platform === 'win32') {
            const dirs = ['C:\\Program Files', 'C:\\Program Files (x86)'];
            const localApps = path.join(os.homedir(), 'AppData\\Local\\Programs');
            if (fs.existsSync(localApps)) dirs.push(localApps);
            return dirs;
        }
        return [];
    };

    const KNOWN_KEYWORDS = [
        'ableton', 'logic pro', 'pro tools', 'cubase', 'nuendo', 'fl studio', 'studio one', 'reaper', 'bitwig', 'reason',
        'garageband', 'mainstage', 'dorico', 'finale', 'sibelius', 'serum', 'massive', 'vital', 'omnisphere', 'pigments',
        'analog lab', 'v collection', 'komplete kontrol', 'kontakt', 'maschine', 'traktor', 'rekordbox', 'serato',
        'amplitube', 'bias fx', 'neural dsp', 'archetype', 'guir rig', 'melodyne', 'autotune', 'izotope', 'ozone',
        'neutron', 'nectar', 'waves central', 'arturia software center', 'native access', 'avid link', 'splice',
        'volca', 'korg', 'moog', 'roland cloud', 'vcv rack', 'cherry audio', 'voltage modular', 'synth', 'tone king',
        'piano v', 'synthi v', 'jup-8', 'cs-80', 'mellotron', 'solina', 'mini v', 'modular v', 'prophet', 'ms-20', 'jun-6', 'op-xa', 'cmi v', 'clavi v', 'wurlitzer', 'vox continental', 'sem v'
    ];

    const GENERIC_TERMS = [
        'audio', 'music', 'sound', 'studio', 'sequencer', 'daw', 'synth', 'synthesizer', 'instrument', 'plugin',
        'vst', 'vst3', 'vst2', 'au ', 'component', 'sampler', 'drum machine', 'groovebox', 'dj ', 'turntable',
        'mixing', 'mastering', 'record', 'oscillator', 'filter', 'keyboard', 'piano', 'guitar', 'bass', 'drums',
        'orchestra', 'tuner', 'metronome', 'score', 'notation', 'midi'
    ];

    const suggestCategory = (fileName, bundleId, manufacturer) => {
        const haystack = (fileName + ' ' + (bundleId || '')).toLowerCase();
        if (/ableton|logic pro|pro tools|cubase|fl studio|studio one|reaper|bitwig|reason|garageband|mainstage|dorico|finale|sibelius|ardour/.test(haystack)) return 'DAWs';
        if (/serum|massive|vital|omnisphere|pigments|analog lab|v collection|kontakt|maschine|komplete kontrol|instruments|syrene|synergy|diva|zebra|hive|nexus|avenger|phase plant|ca2600|voltage|mercury|synth|korg|moog|arp |obx|reaktor|battery|absynth|fm8|falcon|halion|sampletank|arcade|spire|sylenth|model 72|model 84|augmented|modular|solina|mellotron|synclavier|buchla|cs-80|jup-8|matrix-12|vocoder v|stage-73|b-3 v|farfisa|piano v|synthi v|mini v|prophet|oberheim|dx7|cz v|sq80|emulator|ms-20|jun-6|op-xa|cmi v|clavi v|wurlitzer|vox continental|sem v/.test(haystack)) return 'Synths';
        if (/guitar|amplitube|bias|neural|helix|kemper|amp sim|archetype|rig |tone king|cory wong|gojira|abasi|nolly/.test(haystack)) return 'Guitar & Bass';
        if (/izotope|fabfilter|waves|soundtoys|valhalla|melodyne|auto-tune|ozone|neutron|rx |nectar|slate|brainworx|softube|eventide|mercury recorder|ozone|imager|maximizer|denoiser/.test(haystack)) return 'Audio Tools';
        if (/traktor|rekordbox|serato|virtual dj|djay|waves central|native access|avid link|splice|software center|download|install|manager/.test(haystack)) return 'Utilities';

        // Fallback checks by manufacturer
        const mfr = (manufacturer || '').toLowerCase();
        if (['arturia', 'spectrasonics', 'u-he', 'vital audio', 'xfer records', 'cherry audio', 'moog', 'korg', 'roland'].includes(mfr)) {
            return 'Synths';
        }
        if (['fabfilter', 'soundtoys', 'valhalla dsp', 'izotope', 'slate digital'].includes(mfr)) {
            return 'Audio Tools';
        }

        return 'Utilities';
    };

    const appsDirs = getAppsDirs();
    const scannedApps = [];

    const scanAppsDirectory = (dirPath, maxDepth = 1, currentDepth = 0) => {
        if (!fs.existsSync(dirPath)) return;
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                if (file.startsWith('.') || file === 'Contents' || file === 'Frameworks') continue;

                let isApp = false;
                if (process.platform === 'darwin' && file.endsWith('.app')) isApp = true;
                if (process.platform === 'win32' && file.endsWith('.exe')) isApp = true;

                if (isApp) {
                    processAppFile(filePath, file);
                } else if (currentDepth < maxDepth) {
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.isDirectory()) scanAppsDirectory(filePath, maxDepth, currentDepth + 1);
                    } catch (e) { }
                }
            }
        } catch (error) { }
    };

    const processAppFile = (filePath, file) => {
        const appName = file.replace(/\.(app|exe)$/, '');
        const fileName = appName.toLowerCase();
        let isMusicApp = false;
        let detectionMethod = '';
        let confidence = 'Low';
        let manufacturer = 'Unknown';
        let bundleId = '';
        let plist = null;

        if (process.platform === 'darwin') {
            plist = readPlist(path.join(filePath, 'Contents', 'Info.plist'));
            if (plist) {
                bundleId = (plist.CFBundleIdentifier || '').toLowerCase();
                const appCat = (plist.LSApplicationCategoryType || '').toLowerCase();
                if (appCat.includes('music') || appCat.includes('audio')) {
                    isMusicApp = true; detectionMethod = 'plist-category'; confidence = 'High';
                }
                if (!isMusicApp) {
                    const knownPublisher = Object.keys(BUNDLE_MANUFACTURERS).some(d => bundleId.startsWith(d));
                    if (knownPublisher) {
                        isMusicApp = true; detectionMethod = 'plist-bundleid'; confidence = 'High';
                    }
                }
                const mfrFromId = manufacturerFromBundleId(bundleId);
                if (mfrFromId) manufacturer = mfrFromId;
            }
        }

        if (!isMusicApp && KNOWN_KEYWORDS.some(k => fileName.includes(k))) {
            isMusicApp = true; detectionMethod = 'keyword-known'; confidence = 'High';
        }
        if (!isMusicApp && GENERIC_TERMS.some(t => fileName.includes(t))) {
            isMusicApp = true; detectionMethod = 'keyword-generic'; confidence = 'Medium';
        }

        if (isMusicApp) {
            // Manufacturer identification lookup map
            if (manufacturer === 'Unknown') {
                const MFR_LOOKUP = [
                    { name: 'Arturia', re: /arturia|analog lab|pigments|v collection|mcl|augmented|vocoder v|stage-73|b-3 v|farfisa|piano v|synthi v|mini v|modular v|prophet|oberheim|matrix-12|dx7|cz v|sq80|emulator|buchla|jup-8|cs-80|mellotron|solina|ms-20|jun-6|op-xa|cmi v|clavi v|wurlitzer|vox continental|sem v/i },
                    { name: 'Native Instruments', re: /native instruments| kontakt|massive|komplete|reaktor|maschine|traktor|guitar rig|battery|fm8|absynth/i },
                    { name: 'Output', re: /output |arcade|exhale|portal|thermal|movement|substance/i },
                    { name: 'Slate Digital', re: /slate digital|fresh air|virtual mix|meta/i },
                    { name: 'Cherry Audio', re: /cherry audio|voltage|ca2600|polymode|mercury|gx-80|dreamsynth|elka/i },
                    { name: 'Waves', re: /waves |central/i },
                    { name: 'FabFilter', re: /fabfilter|pro-q|pro-c|pro-r|pro-l|saturn|timeless|volcano/i },
                    { name: 'Spitfire Audio', re: /spitfire |labs/i },
                    { name: 'Valhalla DSP', re: /valhalla/i },
                    { name: 'Neural DSP', re: /neural dsp|tone king|archetype|cory wong|gojira|abasi|nolly/i },
                    { name: 'u-he', re: /u-he|diva|zebra|hive|repro|bazille/i },
                    { name: 'Spectrasonics', re: /spectrasonics|omnisphere|keyscape|trilian/i },
                    { name: 'Xfer Records', re: /xfer|serum|ott/i },
                    { name: 'Vital Audio', re: /vital/i },
                    { name: 'iZotope', re: /izotope|ozone|neutron|rx |nectar/i },
                    { name: 'Ableton', re: /ableton/i },
                    { name: 'Apple', re: /logic|garageband|mainstage/i },
                    { name: 'Steinberg', re: /steinberg|cubase|nuendo|wavelab|dorico/i },
                    { name: 'Avid', re: /avid|pro tools|sibelius/i },
                    { name: 'PreSonus', re: /presonus|studio one/i },
                    { name: 'Image-Line', re: /fl studio|fruity/i },
                    { name: 'Bitwig', re: /bitwig/i },
                    { name: 'Reason Studios', re: /reason/i },
                    { name: 'Cockos', re: /reaper/i },
                ];
                const match = MFR_LOOKUP.find(m => m.re.test(fileName) || m.re.test(bundleId));
                if (match) manufacturer = match.name;
            }

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
                                iconDataUrl = 'data:image/png;base64,' + fs.readFileSync(tmpPng).toString('base64');
                                fs.unlinkSync(tmpPng);
                            }
                        }
                    }
                } catch (e) { }
            }

            scannedApps.push({
                name: appName, path: filePath, manufacturer, suggestedCategory: suggestCategory(fileName, bundleId, manufacturer),
                icon: iconDataUrl || '🎵', detectionMethod, confidence, bundleId
            });
        }
    };

    appsDirs.forEach(dir => scanAppsDirectory(dir));
    return scannedApps;
});

ipcMain.handle('extract-app-icon', async (event, appPath) => {
    try {
        const plistPath = path.join(appPath, 'Contents', 'Info.plist');
        const plist = readPlist(plistPath);
        if (plist) {
            let iconFile = plist.CFBundleIconFile || plist.CFBundleIconName || '';
            if (iconFile && !iconFile.endsWith('.icns')) iconFile += '.icns';
            const icnsPath = path.join(appPath, 'Contents', 'Resources', iconFile);
            if (fs.existsSync(icnsPath)) {
                const tmpPng = path.join(os.tmpdir(), `icon_${Date.now()}.png`);
                execSyncSafe(`sips -s format png -z 64 64 "${icnsPath}" --out "${tmpPng}"`);
                const data = 'data:image/png;base64,' + fs.readFileSync(tmpPng).toString('base64');
                fs.unlinkSync(tmpPng);
                return data;
            }
        }
    } catch (e) { }
    return null;
});
