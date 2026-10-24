// src/main/pluginScanner.js
// Asynchronous, multi-format audio plugin scanner (VST3, AU, VST2, CLAP, AAX).

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const {
    detectManufacturer,
    detectPluginType,
    manufacturerFromBundleId
} = require('./knowledgeBase');

async function execFileSafe(cmd, args, timeout = 2500) {
    try {
        const { stdout } = await execFileAsync(cmd, args, { timeout, encoding: 'utf8' });
        return stdout.trim();
    } catch (e) {
        return null;
    }
}

async function readPlistAsync(plistPath) {
    try {
        if (!fs.existsSync(plistPath)) return null;
        const jsonStr = await execFileSafe('plutil', ['-convert', 'json', '-o', '-', plistPath]);
        return jsonStr ? JSON.parse(jsonStr) : null;
    } catch (e) {
        return null;
    }
}

async function detectMacBinaryArch(bundlePath, plist) {
    try {
        const execName = plist && (plist.CFBundleExecutable || plist.CFBundleName);
        if (!execName) return 'Universal';
        const binPath = path.join(bundlePath, 'Contents', 'MacOS', execName);
        if (!fs.existsSync(binPath)) return 'Universal';

        const lipoOut = await execFileSafe('lipo', ['-archs', binPath], 1500);
        if (lipoOut) {
            const archs = lipoOut.toLowerCase().split(/\s+/);
            if (archs.includes('arm64') && archs.includes('x86_64')) return 'Universal';
            if (archs.includes('arm64')) return 'Apple Silicon';
            if (archs.includes('x86_64')) return 'Intel (Rosetta)';
            return lipoOut;
        }
    } catch (e) { }
    return 'Universal';
}

class PluginScanner {
    getDefaultScanDirectories() {
        const platform = process.platform;
        const dirs = [];

        if (platform === 'darwin') {
            dirs.push(
                '/Library/Audio/Plug-Ins/VST3',
                '/Library/Audio/Plug-Ins/Components',
                '/Library/Audio/Plug-Ins/VST',
                '/Library/Audio/Plug-Ins/CLAP',
                '/Library/Application Support/Avid/Audio/Plug-Ins',
                path.join(os.homedir(), 'Library/Audio/Plug-Ins/VST3'),
                path.join(os.homedir(), 'Library/Audio/Plug-Ins/Components'),
                path.join(os.homedir(), 'Library/Audio/Plug-Ins/VST'),
                path.join(os.homedir(), 'Library/Audio/Plug-Ins/CLAP'),
                path.join(os.homedir(), 'Library/Application Support/Avid/Audio/Plug-Ins')
            );
        } else if (platform === 'win32') {
            const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
            const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

            dirs.push(
                path.join(progFiles, 'Common Files', 'VST3'),
                path.join(progFiles, 'Common Files', 'CLAP'),
                path.join(progFiles, 'Common Files', 'Avid', 'Audio', 'Plug-Ins'),
                path.join(progFiles, 'Steinberg', 'VSTPlugins'),
                path.join(progFiles, 'Common Files', 'VST2'),
                path.join(progFilesX86, 'Common Files', 'VST3'),
                path.join(progFilesX86, 'Steinberg', 'VSTPlugins'),
                path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Common', 'VST3')
            );
        }

        return dirs.filter(d => fs.existsSync(d));
    }

    async scan(options = {}) {
        const { customPaths = [], onProgress = null } = options;
        const defaultDirs = this.getDefaultScanDirectories();
        const allDirs = [...defaultDirs];

        if (Array.isArray(customPaths)) {
            for (const p of customPaths) {
                if (fs.existsSync(p) && !allDirs.includes(p)) {
                    allDirs.push(p);
                }
            }
        }

        const plugins = [];
        const seenPaths = new Set();
        let scannedCount = 0;

        for (const dir of allDirs) {
            await this._scanDir(dir, 0, 5, plugins, seenPaths, (item) => {
                scannedCount++;
                if (onProgress && scannedCount % 5 === 0) {
                    onProgress({ count: scannedCount, current: item.name });
                }
            });
        }

        return {
            plugins: plugins,
            count: plugins.length,
            scannedPaths: allDirs
        };
    }

    async _scanDir(currDir, depth, maxDepth, plugins, seenPaths, notifyCallback) {
        if (depth > maxDepth || !fs.existsSync(currDir)) return;

        let entries;
        try {
            entries = await fs.promises.readdir(currDir, { withFileTypes: true });
        } catch (e) {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currDir, entry.name);
            const lowerName = entry.name.toLowerCase();

            let format = null;
            let isPlugin = false;

            if (lowerName.endsWith('.vst3')) {
                format = 'VST3';
                isPlugin = true;
            } else if (lowerName.endsWith('.component')) {
                format = 'AU';
                isPlugin = true;
            } else if (lowerName.endsWith('.clap')) {
                format = 'CLAP';
                isPlugin = true;
            } else if (lowerName.endsWith('.aaxplugin')) {
                format = 'AAX';
                isPlugin = true;
            } else if (lowerName.endsWith('.vst')) {
                format = 'VST';
                isPlugin = true;
            } else if (lowerName.endsWith('.dll') && (currDir.includes('VST') || currDir.includes('Steinberg'))) {
                format = 'VST';
                isPlugin = true;
            }

            if (isPlugin) {
                if (seenPaths.has(fullPath)) continue;
                seenPaths.add(fullPath);

                const pluginItem = await this._processPlugin(fullPath, entry.name, format);
                if (pluginItem) {
                    plugins.push(pluginItem);
                    if (notifyCallback) notifyCallback(pluginItem);
                }
            } else if (entry.isDirectory() && depth < maxDepth) {
                // Don't descend into resource bundles or hidden folders
                if (!entry.name.startsWith('.') && !entry.name.endsWith('.framework')) {
                    await this._scanDir(fullPath, depth + 1, maxDepth, plugins, seenPaths, notifyCallback);
                }
            }
        }
    }

    async _processPlugin(fullPath, fileName, format) {
        const pluginName = fileName.replace(/\.(vst3|component|clap|aaxplugin|vst|dll)$/i, '');
        let manufacturer = 'Unknown';
        let type = 'unknown';
        let version = '';
        let arch = process.platform === 'darwin' ? 'Universal' : 'x64';
        let plist = null;

        if (process.platform === 'darwin') {
            const plistPath = path.join(fullPath, 'Contents', 'Info.plist');
            plist = await readPlistAsync(plistPath);

            if (plist) {
                const bundleId = plist.CFBundleIdentifier || plist.CFBundleName;
                const mfr = manufacturerFromBundleId(bundleId);
                if (mfr) manufacturer = mfr;

                version = plist.CFBundleShortVersionString || plist.CFBundleVersion || '';

                // AU Native AudioComponents type inspection
                if (Array.isArray(plist.AudioComponents) && plist.AudioComponents.length > 0) {
                    const firstComp = plist.AudioComponents[0];
                    const compType = (firstComp.type || '').toLowerCase();
                    // 'aumu' = Music Device (Instrument), 'aufx' = Effect, 'aumf' = MIDI Effect, 'augn' = Generator
                    if (compType === 'aumu' || compType === 'aumf') {
                        type = 'instrument';
                    } else if (compType === 'aufx' || compType === 'auou') {
                        type = 'effect';
                    }
                }

                // Architecture inspection
                arch = await detectMacBinaryArch(fullPath, plist);
            }
        } else if (process.platform === 'win32' && format === 'VST3') {
            // Check moduleinfo.json in VST3 bundles
            const moduleInfoPath = path.join(fullPath, 'Contents', 'Resources', 'moduleinfo.json');
            if (fs.existsSync(moduleInfoPath)) {
                try {
                    const info = JSON.parse(await fs.promises.readFile(moduleInfoPath, 'utf8'));
                    if (info.Vendor) manufacturer = info.Vendor;
                    if (info.Version) version = info.Version;
                    if (Array.isArray(info.Classes)) {
                        const hasInstrument = info.Classes.some(c => (c.Category || '').toLowerCase().includes('instrument'));
                        const hasEffect = info.Classes.some(c => (c.Category || '').toLowerCase().includes('fx') || (c.Category || '').toLowerCase().includes('effect'));
                        if (hasInstrument) type = 'instrument';
                        else if (hasEffect) type = 'effect';
                    }
                } catch (e) { }
            }
        }

        // Manufacturer heuristic match
        if (manufacturer === 'Unknown') {
            manufacturer = detectManufacturer(fullPath + ' ' + pluginName);
        }

        // Folder name parent heuristic
        if (manufacturer === 'Unknown') {
            const pathParts = fullPath.split(path.sep);
            if (pathParts.length > 2) {
                const parentDir = pathParts[pathParts.length - 2];
                const skip = new Set(['vst3', 'vst', 'components', 'vstplugins', 'plugins', 'audio', 'library', 'plug-ins', 'common files', 'clap', 'avid']);
                if (!skip.has(parentDir.toLowerCase())) {
                    manufacturer = parentDir;
                }
            }
        }

        // Type heuristic fallback
        if (type === 'unknown') {
            const haystack = fullPath + ' ' + pluginName + (plist ? ' ' + JSON.stringify(plist) : '');
            type = detectPluginType(haystack);
        }

        return {
            name: pluginName,
            path: fullPath,
            format: format,
            type: type,
            manufacturer: manufacturer,
            version: version || '',
            arch: arch,
            rating: 0,
            favorite: false,
            notes: '',
            dateScanned: new Date().toISOString()
        };
    }
}

module.exports = new PluginScanner();
