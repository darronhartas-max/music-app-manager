# AppViewr - Music App & Plugin Manager

> **Phase 5: Tools & Automation** - Intelligent scan-to-library workflow with atomic data protection.

![AppViewr](https://img.shields.io/badge/version-1.0.7--phase5-purple)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🎵 Overview

AppViewr is a cross-platform desktop application built with Electron that helps music producers organize and launch their music production apps and catalog their audio plugin inventory. **Phase 5 introduces a robust App Scanner, Atomic Saving, and intelligent automatic categorization for your entire workspace.**

### Key Features

✨ **App Launcher Dashboard**
- Grid layout with categorized sections (DAWs, Synths, Guitar Tools, etc.)
- Visual app cards with high-fidelity icons automatically extracted from bundles
- **✅ ACTUAL APP LAUNCHING** - Click to open applications
- **✅ APP SCANNER** - Automatically finds your music apps in `/Applications`
- Real-time search across apps and plugins

🔌 **Plugin Inventory & Scanner**
- Comprehensive plugin catalog with VST/AU/VST3 support
- **✅ ATOMIC SAVING** - Prevents data loss with crash-proof file writing
- **✅ INTELLIGENT PLUGIN SCANNER** - Auto-detects manufacturer and format
- **✅ AUTOMATIC TYPE DETECTION** - Identifies instruments vs effects
- **✅ MANUFACTURER EXTRACTION** - Recognizes Arturia, NI, Waves, etc., and fallbacks to directory names
- Filter by type, format, favorites, and manufacturer

⚙️ **Settings & Tools Panel**
- **Category Manager**: Add, Rename, Reorder, or delete custom categories
- **App Cleanup**: Detect and remove orphan apps that no longer exist on disk
- **Statistics Dashboard**: Total counts for categories, apps, and plugins
- **Configuration Migration**: Automatically moves your database to system-safe locations

🎨 **Premium UI/UX**
- Dark theme optimized for studio environments
- Glassmorphism effects with macOS native window controls
- Action-oriented interface with hover micro-animations
- Search-first navigation

🖥️ **Desktop Integration**
- **MacOS Native**: Transparent title bar with drag-to-move support
- **Production-Ready Storage**: Uses `~/Library/Application Support/` for data persistence
- **Secure Architecture**: Context-isolated renderer with atomic write-back

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Distribution

Build for your current platform:
```bash
npm run build
```

Installers will be created in the `dist/` directory.

## 🔮 Roadmap

### ✅ Phase 1: Proof of Concept (Complete)
- [x] Basic HTML/CSS/JS dashboard
- [x] Search and filtering

### ✅ Phase 2: Electron Wrapper (Complete)
- [x] Actual app launching & IPC communication

### ✅ Phase 3: Enhanced Plugin Scanner (Complete)
- [x] Auto-scan plugin directories
- [x] Intelligent type detection

### ✅ Phase 4: Advanced Features (Complete)
- [x] In-app configuration editor
- [x] Manufacturer grouping view
- [x] Plugin favorites and ratings

### ✅ Phase 5: Tools & Automation (Complete)
- [x] **App Scanner**: Auto-scan /Applications for music apps
- [x] **Atomic Saving**: Safe, crash-proof configuration management
- [x] **Category Manager**: Full control over dashboard organization
- [x] **App Cleanup**: Remove missing/uninstalled applications
- [x] **Smart Identification**: Mapping for 100+ synths (Arturia V, Serum, etc.)

### 📋 Phase 6: Core User Experience (Planned)
- [ ] Drag-and-drop app reordering
- [ ] Custom app icon uploads
- [ ] Advanced fuzzy search
- [ ] System tray integration

## 🛠️ Technical Details

### Storage & Configuration

On macOS, your library and preferences are stored in the system data folder to ensure compatibility with packaged releases.

**Configuration Path:**
`~/Library/Application Support/music-app-manager/config/apps-config.json`

The app uses an **Atomic Rename** strategy: it writes a `.tmp` file and only swaps it with the main database once the write is successful. This prevents the "blank library" bug if your computer crashes during a save.

## 📝 License

MIT License - feel free to use and modify.

---

**Built with ❤️ for music producers by music producers**

**Phase 5 Complete** - Atomic protection and full automation suite! 🚀
