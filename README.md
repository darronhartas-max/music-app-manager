# AppViewr - Music App & Plugin Manager

> **Phase 3: Enhanced Plugin Scanner** - Cross-platform desktop app with intelligent plugin detection and management tools.

![AppViewr](https://img.shields.io/badge/version-1.0.0--phase3-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🎵 Overview

AppViewr is a cross-platform desktop application built with Electron that helps music producers organize and launch their music production apps and catalog their audio plugin inventory. **Phase 3 brings intelligent plugin scanning, automatic type detection, and a comprehensive settings panel.**

### Key Features

✨ **App Launcher Dashboard**
- Grid layout with categorized sections (DAWs, Synths, Guitar Tools, etc.)
- Visual app cards with icons and paths
- **✅ ACTUAL APP LAUNCHING** - Click to open applications
- Real-time search and filtering
- Works on macOS and Windows

🔌 **Plugin Inventory & Scanner**
- Comprehensive plugin catalog with VST/AU/VST3 support
- **✅ INTELLIGENT PLUGIN SCANNER** - Auto-detect installed plugins
- **✅ AUTOMATIC TYPE DETECTION** - Identifies instruments vs effects
- **✅ MANUFACTURER EXTRACTION** - Parses vendor info from paths
- Filter by type (instrument/effect), format, and manufacturer
- User-editable notes for each plugin
- Full path visibility for troubleshooting
- Duplicate prevention when merging scans
- Real-time scan progress reporting

⚙️ **Settings & Tools Panel**
- One-click plugin scanning with progress bar
- Statistics dashboard (apps, plugins, categories)
- Configuration export/reload
- Platform information display
- Scan results with detailed breakdown

🎨 **Premium UI/UX**
- Dark theme optimized for music production environments
- Glassmorphism effects and smooth animations
- Desktop-optimized layout with maximum space efficiency
- Compact header with integrated search
- Professional aesthetic
- Action buttons with hover effects
- Progress bars with animations

🖥️ **Desktop Integration**
- Native window with proper title bar
- Cross-platform app launching (macOS/Windows)
- Secure IPC communication
- Configuration persistence
- System integration
- File dialogs for manual selection

### Desktop Optimization

- **Compact Header**: Single-row header with logo, search, and tabs
- **Full Screen Usage**: Maximizes viewport height and width
- **High Density**: Fits more apps per screen
- **Quick Navigation**: All controls accessible without scrolling

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This opens the app with DevTools enabled for debugging.

### Building for Distribution

Build for your current platform:
```bash
npm run build
```

Build for specific platforms:
```bash
npm run build:mac    # macOS only
npm run build:win    # Windows only
npm run build:all    # Both platforms
```

Installers will be created in the `dist/` directory.

## 🔮 Roadmap

### ✅ Phase 1: Proof of Concept (Complete)
- [x] Basic HTML/CSS/JS dashboard
- [x] JSON configuration
- [x] Search and filtering
- [x] Desktop-optimized UI

### ✅ Phase 2: Electron Wrapper (Complete)
- [x] Convert to Electron app
- [x] Actual app launching
- [x] IPC communication
- [x] Config persistence
- [x] Cross-platform support

### ✅ Phase 3: Enhanced Plugin Scanner (Complete)
- [x] Auto-scan plugin directories
- [x] Intelligent type detection
- [x] Settings/Tools panel
- [x] Statistics dashboard

### ✅ Phase 4: Advanced Features (Complete)
- [x] In-app configuration editor (Add/Edit Apps)
- [x] Manufacturer grouping view
- [x] Plugin favorites and ratings
- [x] Recent apps tracking
- [x] Global keyboard shortcuts (Ctrl/Cmd+K)
- [x] Quick filters (Favorites, Recent)

### ✅ Phase 5: Tools & Automation (Complete)
- [x] **App Scanner**: Auto-scan /Applications for music apps
- [x] **Multi-Strategy Detection**: Keywords, generic terms, formats
- [x] **Smart Filtering**: New apps only, avoid duplicates
- [x] **Category Manager**: Reorder, Add, Rename, Delete categories
- [x] **App Cleanup**: Detect and remove missing apps
- [x] **Interactive Results**: Edit app details before adding

### 📋 Phase 6: Core User Experience (Planned)
- [ ] Drag-and-drop app reordering
- [ ] Custom app icons upload
- [ ] Advanced search (fuzzy matching)
- [ ] System tray integration
- [ ] Cloud sync/backup

## 🛠️ Technical Details

### Technology Stack

- **Electron** 28.0+ (Desktop wrapper)
- **Node.js** (Backend/IPC)
- **HTML5/CSS3** (UI)
- **Vanilla JavaScript** (Logic)
- **JSON** (Configuration)

### Security

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Preload Script**: Secure IPC bridge
- **No Remote Module**: Modern Electron best practices

### Performance

- Lightweight: ~150MB installed
- Fast startup: < 2 seconds
- Smooth animations: 60fps
- Low memory usage

## 📝 License

MIT License - feel free to use and modify for your own projects.

## 🤝 Contributing

Feedback from music producers is highly valued! Please share:

- Screenshots of your setup
- Feature requests
- UI/UX suggestions
- Bug reports

## 💡 Tips for Music Producers

1. **Organize by Workflow**: Create categories that match your production workflow
2. **Use Descriptive Notes**: Add notes about plugin CPU usage, best use cases, etc.
3. **Keep Paths Updated**: When you update software, remember to update the paths
4. **Backup Your Config**: Save a copy of `apps-config.json` before major changes
5. **Quick Launch**: Use AppViewr as your music production hub

## 🎵 Example Use Cases

- **Quick Session Start**: Launch your entire production chain with clicks
- **Plugin Discovery**: Remember what plugins you have before buying duplicates
- **Workflow Optimization**: See your entire toolkit at a glance
- **Teaching**: Show students your production setup
- **Documentation**: Screenshot your plugin inventory for insurance/backup

## 🐛 Troubleshooting

### App won't launch
- Check the path in `apps-config.json` is correct
- Ensure the app is installed on your system
- Check console for error messages

### Config not loading
- Verify `config/apps-config.json` exists
- Check JSON syntax is valid
- Look for errors in DevTools console

### Plugin scanner not finding plugins
- Check plugin directories exist
- Ensure you have plugins installed
- Try manual configuration

## 📧 Support

For questions or issues, please open an issue on GitHub.

---

**Built with ❤️ for music producers by music producers**

**Phase 3 Complete** - Now with intelligent plugin scanning and management tools! 🚀
