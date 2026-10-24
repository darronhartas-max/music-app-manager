# Music App Manager (AppViewr v2.0)

![Version](https://img.shields.io/badge/version-2.0.0-purple)
![Platform](https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon%20%26%20Intel)%20%7C%20Windows%20PC-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🎵 Overview

**Music App Manager** (`AppViewr v2.0`) is a cross-platform desktop application built with Electron for music producers to organize and launch their music production software and catalog their entire audio plugin inventory across **macOS (Apple Silicon M-series & Intel)** and **Windows PC**.

### Key Features in v2.0

✨ **App Launcher Dashboard**
- **Category & Manufacturer Views**: Group your toolkit by workflow category (`DAWs`, `Synths`, `Guitar & Bass`, `Audio Tools`, `Utilities`) or by software publisher (`Arturia`, `Native Instruments`, `FabFilter`, etc.).
- **Cross-Platform App Scanner**: Automatically discovers installed music software in `/Applications` & `~/Applications` on macOS and via Start Menu shortcuts (`.lnk`) & `Program Files` on Windows PC.
- **Native High-Res Icons**: Extracts real application icons via Electron's native icon API with `.icns` fallback.
- **Full App Lifecycle**: Add, Edit, Reorder (Drag-and-Drop in Edit Mode), Favorite, Reveal in Finder/Explorer (via Right-Click Context Menu), or Remove apps.

🔌 **Multi-Format Plugin Catalog & Inspector**
- **5 Plugin Formats Supported**: Scans `VST3`, `AU` (Audio Units), `CLAP`, `AAX` (Pro Tools), and `VST2`.
- **Grouped vs. Flat View**: Deduplicates identical plugins installed in multiple formats into a single row with format badges (`[VST3]` `[AU]` `[CLAP]` `[AAX]`), or switch to Flat List view to inspect every file individually.
- **Version & CPU Architecture Detection**: Displays installed plugin versions and binary architectures (`Apple Silicon`, `Universal`, `Intel (Rosetta)`, `x64`), plus a dedicated **⚠️ Intel Only** filter to spot Rosetta plugins on M-series Macs.
- **Ratings, Notes & CSV Export**: Rate plugins (1–5 stars), store personal mix/preset notes, and export your catalog to CSV.

⚙️ **Tools & Library Management**
- **Library Statistics Dashboard**: Real-time counts for Applications, Unique Plugins, Total Plugin Files, and Categories.
- **Category Manager**: Add, rename, reorder (`⬆️`/`⬇️`), or delete custom categories.
- **Custom Scan Folders**: Add custom VST or App directories on secondary drives.
- **Missing Software Cleanup**: Detect and clean up uninstalled applications or plugin files with one click.
- **Crash-Safe Atomic Storage**: Stores configuration in `app.getPath('userData')` using atomic temp-file-and-rename writes.

---

## 🛠️ Development & Packaging

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build installers for macOS (arm64 + x64 DMG/ZIP)
npm run build:mac

# Build installers for Windows PC (x64 NSIS + Portable)
npm run build:win
```
