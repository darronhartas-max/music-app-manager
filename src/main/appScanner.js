// src/main/appScanner.js
// Asynchronous, non-blocking application scanner for macOS and Windows PC.

const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const {
    isKnownMusicBundleId,
    detectManufacturer,
    suggestCategory,
    KNOWN_KEYWORDS,
    GENERIC_TERMS
} = require('./knowledgeBase');

// Helper to run commands asynchronously with timeout
async function execFileSafe(cmd, args, timeout = 3000) {
    try {
        const { stdout } = await execFileAsync(cmd, args, { timeout, encoding: 'utf8' });
        return stdout.trim();
    } catch (e) {
        return null;
    }
}

// Read macOS plist asynchronously
async function readPlistAsync(plistPath) {
    try {
        if (!fs.existsSync(plistPath)) return null;
        const jsonStr = await execFileSafe('plutil', ['-convert', 'json', '-o', '-', plistPath]);
        return jsonStr ? JSON.parse(jsonStr) : null;
    } catch (e) {
        return null;
    }
}

// Detect binary architecture on macOS (arm64, x86_64, universal)
async function detectMacArchitecture(appPath, plist) {
    try {
        const execName = plist && (plist.CFBundleExecutable || plist.CFBundleName);
        if (!execName) return 'Universal';
        const binPath = path.join(appPath, 'Contents', 'MacOS', execName);
        if (!fs.existsSync(binPath)) return 'Universal';

        const lipoOut = await execFileSafe('lipo', ['-archs', binPath], 2000);
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

// Extract app icon: on macOS uses sips on .icns bundle resources; on Windows uses app.getFileIcon
async function extractAppIcon(targetPath, plist = null) {
    if (!targetPath || !fs.existsSync(targetPath)) return null;

    // 1. macOS .app bundle icon extraction via sips (100% reliable on macOS)
    if (process.platform === 'darwin' && targetPath.endsWith('.app')) {
        try {
            if (!plist) {
                plist = await readPlistAsync(path.join(targetPath, 'Contents', 'Info.plist'));
            }
            const resDir = path.join(targetPath, 'Contents', 'Resources');
            let icnsPath = null;

            if (plist) {
                const candidates = [plist.CFBundleIconFile, plist.CFBundleIconName].filter(Boolean);
                for (let iconName of candidates) {
                    const withExt = iconName.endsWith('.icns') ? iconName : `${iconName}.icns`;
                    const p1 = path.join(resDir, withExt);
                    const p2 = path.join(resDir, iconName);
                    if (fs.existsSync(p1)) { icnsPath = p1; break; }
                    if (fs.existsSync(p2) && p2.endsWith('.icns')) { icnsPath = p2; break; }
                }
            }

            // Fallback: find preferred .icns file inside Contents/Resources
            if (!icnsPath && fs.existsSync(resDir)) {
                const files = await fs.promises.readdir(resDir);
                const icnsFiles = files.filter(f => f.toLowerCase().endsWith('.icns'));
                const preferred = ['appicon.icns', 'icon.icns', 'app.icns'];
                const matchPref = icnsFiles.find(f => preferred.includes(f.toLowerCase()));
                if (matchPref) {
                    icnsPath = path.join(resDir, matchPref);
                } else if (icnsFiles.length > 0) {
                    icnsPath = path.join(resDir, icnsFiles[0]);
                }
            }

            if (icnsPath && fs.existsSync(icnsPath)) {
                const tmpPng = path.join(os.tmpdir(), `mam_icon_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
                await execFileSafe('sips', ['-s', 'format', 'png', '-z', '128', '128', icnsPath, '--out', tmpPng], 4000);
                if (fs.existsSync(tmpPng)) {
                    const buf = await fs.promises.readFile(tmpPng);
                    await fs.promises.unlink(tmpPng).catch(() => {});
                    if (buf && buf.length > 64) {
                        return 'data:image/png;base64,' + buf.toString('base64');
                    }
                }
            }
        } catch (e) { }
    }

    // 2. Windows (.exe) or fallback via Electron app.getFileIcon
    try {
        if (app && typeof app.getFileIcon === 'function') {
            const nativeImg = await app.getFileIcon(targetPath, { size: 'large' });
            if (nativeImg && !nativeImg.isEmpty()) {
                const dataUrl = nativeImg.toDataURL();
                if (dataUrl && dataUrl.length > 100) {
                    return dataUrl;
                }
            }
        }
    } catch (e) { }

    return null;
}

class AppScanner {
    getScanDirectories(customPaths = []) {
        const dirs = [];
        const platform = process.platform;

        if (platform === 'darwin') {
            dirs.push('/Applications');
            const userApps = path.join(os.homedir(), 'Applications');
            if (fs.existsSync(userApps)) dirs.push(userApps);
        } else if (platform === 'win32') {
            // Windows Start Menu paths (highest accuracy for installed software)
            const progData = process.env.ProgramData || 'C:\\ProgramData';
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

            const startMenuCommon = path.join(progData, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
            const startMenuUser = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs');

            if (fs.existsSync(startMenuCommon)) dirs.push({ path: startMenuCommon, type: 'startMenu' });
            if (fs.existsSync(startMenuUser)) dirs.push({ path: startMenuUser, type: 'startMenu' });

            // Program Files
            const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
            const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
            const localApps = path.join(os.homedir(), 'AppData', 'Local', 'Programs');

            if (fs.existsSync(progFiles)) dirs.push({ path: progFiles, type: 'programFiles' });
            if (fs.existsSync(progFilesX86)) dirs.push({ path: progFilesX86, type: 'programFiles' });
            if (fs.existsSync(localApps)) dirs.push({ path: localApps, type: 'programFiles' });
        }

        // Add user-defined custom paths
        if (Array.isArray(customPaths)) {
            for (const p of customPaths) {
                if (fs.existsSync(p) && !dirs.some(d => (typeof d === 'string' ? d : d.path) === p)) {
                    dirs.push(platform === 'win32' ? { path: p, type: 'programFiles' } : p);
                }
            }
        }

        return dirs;
    }

    async scan(options = {}) {
        const { customPaths = [], onProgress = null } = options;
        const platform = process.platform;
        const scanDirs = this.getScanDirectories(customPaths);
        const results = [];
        const seenPaths = new Set();

        if (platform === 'darwin') {
            for (const dir of scanDirs) {
                await this._scanMacDirectory(dir, results, seenPaths, onProgress);
            }
        } else if (platform === 'win32') {
            for (const item of scanDirs) {
                if (item.type === 'startMenu') {
                    await this._scanWindowsStartMenu(item.path, results, seenPaths, onProgress);
                } else {
                    await this._scanWindowsProgramFiles(item.path, results, seenPaths, onProgress);
                }
            }
        }

        return results;
    }

    // macOS Scanner
    async _scanMacDirectory(dirPath, results, seenPaths, onProgress, depth = 0, maxDepth = 2) {
        if (!fs.existsSync(dirPath) || depth > maxDepth) return;

        let entries;
        try {
            entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        } catch (e) {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.name.startsWith('.') || entry.name === 'Contents' || entry.name === 'Frameworks') continue;

            if (entry.name.endsWith('.app')) {
                if (seenPaths.has(fullPath)) continue;
                seenPaths.add(fullPath);

                const appItem = await this._processMacApp(fullPath, entry.name);
                if (appItem) {
                    results.push(appItem);
                    if (onProgress) onProgress({ count: results.length, current: appItem.name });
                }
            } else if (entry.isDirectory() && depth < maxDepth) {
                // Don't descend into apps or system folders
                const skipDirs = ['Utilities', 'System', 'Library', 'tmp'];
                await this._scanMacDirectory(fullPath, results, seenPaths, onProgress, depth + 1, maxDepth);
            }
        }
    }

    async extractIcon(appPath) {
        return await extractAppIcon(appPath);
    }

    async _processMacApp(appPath, appFileName) {
        const appName = appFileName.replace(/\.app$/i, '');
        const lowerName = appName.toLowerCase();

        // Never scan Music App Manager itself
        if (lowerName === 'music app manager' || lowerName === 'appviewr') return null;

        const plistPath = path.join(appPath, 'Contents', 'Info.plist');
        const plist = await readPlistAsync(plistPath);

        let bundleId = '';
        let appCat = '';
        let isMusicApp = false;
        let detectionMethod = '';
        let confidence = 'Low';
        let manufacturer = 'Unknown';
        let version = '';

        if (plist) {
            bundleId = (plist.CFBundleIdentifier || '').toLowerCase();
            if (bundleId === 'com.musicappmanager.app') return null;

            version = plist.CFBundleShortVersionString || plist.CFBundleVersion || '';
            appCat = (plist.LSApplicationCategoryType || '').toLowerCase();

            // 1. Explicit Apple Music/Audio category in Info.plist
            if (appCat.includes('music') || appCat.includes('audio')) {
                isMusicApp = true;
                detectionMethod = 'plist-category';
                confidence = 'High';
            }

            // 2. Known Music Publisher Bundle ID (Ableton, Arturia, Cherry Audio, GForce, NI, UA, etc.)
            if (!isMusicApp && isKnownMusicBundleId(bundleId)) {
                isMusicApp = true;
                detectionMethod = 'plist-bundleid';
                confidence = 'High';
            }
        }

        // If the app explicitly declares a non-music category (finance, productivity, social, etc.)
        // and isn't from a known music publisher, skip it so non-music apps aren't picked up.
        const NON_MUSIC_CATEGORIES = [
            'finance', 'business', 'social-networking', 'productivity', 'games',
            'photography', 'graphics-design', 'news', 'weather', 'medical', 'travel'
        ];
        const isExplicitNonMusic = NON_MUSIC_CATEGORIES.some(c => appCat.includes(c));

        if (!isMusicApp && !isExplicitNonMusic && KNOWN_KEYWORDS.some(k => lowerName.includes(k))) {
            isMusicApp = true;
            detectionMethod = 'keyword-known';
            confidence = 'High';
        }

        if (!isMusicApp && !isExplicitNonMusic && GENERIC_TERMS.some(t => lowerName.includes(t))) {
            isMusicApp = true;
            detectionMethod = 'keyword-generic';
            confidence = 'Medium';
        }

        if (!isMusicApp) return null;

        manufacturer = detectManufacturer(appPath + ' ' + appName, bundleId, true);

        // Architecture check (Apple Silicon native vs Intel Rosetta)
        const arch = await detectMacArchitecture(appPath, plist);

        // Icon extraction
        const iconDataUrl = await extractAppIcon(appPath, plist);
        const sizeBytes = await this.calculatePathSize(appPath);

        return {
            name: appName,
            path: appPath,
            manufacturer: manufacturer || 'Unknown',
            suggestedCategory: suggestCategory(appName, bundleId, manufacturer),
            icon: iconDataUrl || '🎵',
            version: version || '1.0',
            arch: arch,
            sizeBytes: sizeBytes,
            bundleId: bundleId,
            detectionMethod: detectionMethod,
            confidence: confidence,
            favorite: false
        };
    }

    async calculatePathSize(targetPath, depth = 0) {
        if (!targetPath || depth > 6) return 0;
        try {
            const st = await fs.promises.lstat(targetPath);
            if (st.isSymbolicLink()) return 0;
            if (st.isFile()) return st.size || 0;
            if (st.isDirectory()) {
                const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
                let total = 0;
                for (const entry of entries) {
                    if (entry.isSymbolicLink()) continue;
                    const childPath = path.join(targetPath, entry.name);
                    if (entry.isFile()) {
                        try {
                            const cst = await fs.promises.stat(childPath);
                            total += cst.size || 0;
                        } catch (e) { }
                    } else if (entry.isDirectory()) {
                        total += await this.calculatePathSize(childPath, depth + 1);
                    }
                }
                return total;
            }
        } catch (e) { }
        return 0;
    }

    // Windows Start Menu Scanner (.lnk shortcuts)
    async _scanWindowsStartMenu(startMenuPath, results, seenPaths, onProgress) {
        if (!fs.existsSync(startMenuPath)) return;

        const scanRecursive = async (currDir, depth = 0) => {
            if (depth > 4) return;
            let entries;
            try {
                entries = await fs.promises.readdir(currDir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(currDir, entry.name);
                if (entry.isDirectory()) {
                    await scanRecursive(fullPath, depth + 1);
                } else if (entry.name.endsWith('.lnk')) {
                    try {
                        const targetInfo = shell.readShortcutLink(fullPath);
                        const targetExe = targetInfo.target;
                        if (!targetExe || !targetExe.endsWith('.exe') || seenPaths.has(targetExe.toLowerCase())) continue;

                        const baseName = path.basename(targetExe, '.exe').toLowerCase();
                        if (/unins|uninstall|update|setup|helper|crash|vcredist/i.test(baseName)) continue;

                        const lowerShortcut = entry.name.toLowerCase();
                        const isMusic = KNOWN_KEYWORDS.some(k => lowerShortcut.includes(k) || baseName.includes(k)) ||
                                        GENERIC_TERMS.some(t => lowerShortcut.includes(t) || baseName.includes(t));

                        if (isMusic) {
                            seenPaths.add(targetExe.toLowerCase());
                            const appName = entry.name.replace(/\.lnk$/i, '');
                            const manufacturer = detectManufacturer(appName + ' ' + targetExe);
                            const iconUrl = await extractAppIcon(targetExe);

                            const appObj = {
                                name: appName,
                                path: targetExe,
                                manufacturer: manufacturer,
                                suggestedCategory: suggestCategory(appName, '', manufacturer),
                                icon: iconUrl || '🎵',
                                version: '',
                                arch: 'x64',
                                bundleId: '',
                                detectionMethod: 'windows-shortcut',
                                confidence: 'High',
                                favorite: false
                            };
                            results.push(appObj);
                            if (onProgress) onProgress({ count: results.length, current: appName });
                        }
                    } catch (e) { }
                }
            }
        };

        await scanRecursive(startMenuPath);
    }

    // Windows Program Files Scanner (Fallback)
    async _scanWindowsProgramFiles(dirPath, results, seenPaths, onProgress) {
        if (!fs.existsSync(dirPath)) return;

        const scanRecursive = async (currDir, depth = 0) => {
            if (depth > 2) return;
            let entries;
            try {
                entries = await fs.promises.readdir(currDir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(currDir, entry.name);
                if (entry.isDirectory()) {
                    const lowerDir = entry.name.toLowerCase();
                    // Check if directory matches a known music publisher or tool
                    if (depth === 0) {
                        await scanRecursive(fullPath, depth + 1);
                    } else if (depth === 1) {
                        const isKnownMusic = KNOWN_KEYWORDS.some(k => lowerDir.includes(k)) ||
                                            GENERIC_TERMS.some(t => lowerDir.includes(t));
                        if (isKnownMusic) {
                            await scanRecursive(fullPath, depth + 1);
                        }
                    }
                } else if (entry.name.endsWith('.exe')) {
                    const lowerExe = entry.name.toLowerCase();
                    if (/unins|uninstall|update|setup|helper|crash|vcredist|daemon|service/i.test(lowerExe)) continue;
                    if (seenPaths.has(fullPath.toLowerCase())) continue;

                    const appName = entry.name.replace(/\.exe$/i, '');
                    const isMusic = KNOWN_KEYWORDS.some(k => lowerExe.includes(k) || currDir.toLowerCase().includes(k));

                    if (isMusic) {
                        seenPaths.add(fullPath.toLowerCase());
                        const manufacturer = detectManufacturer(currDir + ' ' + appName);
                        const iconUrl = await extractAppIcon(fullPath);

                        const appObj = {
                            name: appName,
                            path: fullPath,
                            manufacturer: manufacturer,
                            suggestedCategory: suggestCategory(appName, '', manufacturer),
                            icon: iconUrl || '🎵',
                            version: '',
                            arch: 'x64',
                            bundleId: '',
                            detectionMethod: 'program-files',
                            confidence: 'Medium',
                            favorite: false
                        };
                        results.push(appObj);
                        if (onProgress) onProgress({ count: results.length, current: appName });
                    }
                }
            }
        };

        await scanRecursive(dirPath);
    }
}

module.exports = new AppScanner();
