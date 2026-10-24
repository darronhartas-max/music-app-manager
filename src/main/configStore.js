// src/main/configStore.js
// Robust atomic configuration store and schema migration.

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_CONFIG = {
    categories: [
        { name: 'DAWs', apps: [] },
        { name: 'Synths', apps: [] },
        { name: 'Guitar & Bass', apps: [] },
        { name: 'Audio Tools', apps: [] },
        { name: 'Utilities', apps: [] }
    ],
    plugins: [],
    recentApps: [],
    sessions: [],
    settings: {
        defaultView: 'category', // 'category' | 'manufacturer'
        pluginViewMode: 'grouped', // 'grouped' | 'flat'
        showRecentApps: true,
        maxRecentApps: 10,
        customPluginPaths: [],
        customAppPaths: []
    }
};

class ConfigStore {
    constructor() {
        this.userDataPath = app.getPath('userData');
        this.configDir = path.join(this.userDataPath, 'config');
        this.configFile = path.join(this.configDir, 'apps-config.json');
        this.windowStateFile = path.join(this.configDir, 'window-state.json');
        this.iconsDir = path.join(this.userDataPath, 'icons');

        this._ensureDirectories();
        this._migrateIfNecessary();
    }

    _ensureDirectories() {
        try {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }
            if (!fs.existsSync(this.iconsDir)) {
                fs.mkdirSync(this.iconsDir, { recursive: true });
            }
        } catch (err) {
            console.error('[ConfigStore] Failed to ensure directories:', err);
        }
    }

    _migrateIfNecessary() {
        if (!fs.existsSync(this.configFile)) {
            // Check project config template
            const templatePath = path.join(__dirname, '..', '..', 'config', 'apps-config.json');
            if (fs.existsSync(templatePath)) {
                try {
                    const content = fs.readFileSync(templatePath, 'utf8');
                    fs.writeFileSync(this.configFile, content, 'utf8');
                    console.log('[ConfigStore] Seeded user config from project template.');
                } catch (e) {
                    console.warn('[ConfigStore] Error copying seed config, writing default:', e);
                    this.save(DEFAULT_CONFIG);
                }
            } else {
                this.save(DEFAULT_CONFIG);
            }
        }
    }

    getConfigPath() {
        return this.configFile;
    }

    getIconsDir() {
        return this.iconsDir;
    }

    load() {
        try {
            if (!fs.existsSync(this.configFile)) {
                return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            }
            const raw = fs.readFileSync(this.configFile, 'utf8');
            if (!raw.trim()) {
                return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            }
            const data = JSON.parse(raw);

            // Schema normalization & backward compatibility
            if (!Array.isArray(data.categories)) data.categories = DEFAULT_CONFIG.categories;
            if (!Array.isArray(data.plugins)) data.plugins = [];
            if (!Array.isArray(data.recentApps)) data.recentApps = [];
            if (!Array.isArray(data.sessions)) data.sessions = [];
            data.settings = Object.assign({}, DEFAULT_CONFIG.settings, data.settings || {});

            if (!Array.isArray(data.settings.customPluginPaths)) data.settings.customPluginPaths = [];
            if (!Array.isArray(data.settings.customAppPaths)) data.settings.customAppPaths = [];

            return data;
        } catch (err) {
            console.error('[ConfigStore] Error loading configuration:', err);
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    save(data) {
        try {
            this._ensureDirectories();
            const tempFile = this.configFile + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
            fs.renameSync(tempFile, this.configFile);
            return { success: true };
        } catch (err) {
            console.error('[ConfigStore] Error saving configuration atomically:', err);
            throw err;
        }
    }

    loadWindowState() {
        const defaultState = { width: 1440, height: 920 };
        try {
            if (!fs.existsSync(this.windowStateFile)) {
                return defaultState;
            }
            const raw = fs.readFileSync(this.windowStateFile, 'utf8');
            if (!raw.trim()) return defaultState;
            const parsed = JSON.parse(raw);
            return {
                width: Number.isFinite(parsed.width) && parsed.width >= 1040 ? parsed.width : 1440,
                height: Number.isFinite(parsed.height) && parsed.height >= 640 ? parsed.height : 920,
                x: Number.isFinite(parsed.x) ? parsed.x : undefined,
                y: Number.isFinite(parsed.y) ? parsed.y : undefined,
                isMaximized: Boolean(parsed.isMaximized),
                isFullScreen: Boolean(parsed.isFullScreen)
            };
        } catch (err) {
            console.warn('[ConfigStore] Error loading window state, using default:', err);
            return defaultState;
        }
    }

    saveWindowState(state) {
        try {
            this._ensureDirectories();
            const tempFile = this.windowStateFile + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
            fs.renameSync(tempFile, this.windowStateFile);
        } catch (err) {
            console.warn('[ConfigStore] Error saving window state:', err);
        }
    }
}

module.exports = new ConfigStore();
