# AppViewr - Music App & Plugin Manager

> **Phase 2: Electron Desktop Application** - Cross-platform desktop app for launching music production apps and cataloging audio plugins.

![AppViewr](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🎵 Overview

AppViewr is a cross-platform desktop application built with Electron that helps music producers organize and launch their music production apps and catalog their audio plugin inventory. Phase 2 brings actual app launching capabilities and native desktop integration.

### Key Features

✨ **App Launcher Dashboard**
- Grid layout with categorized sections (DAWs, Synths, Guitar Tools, etc.)
- Visual app cards with icons and paths
- **✅ ACTUAL APP LAUNCHING** - Click to open applications
- Real-time search and filtering
- Works on macOS and Windows

🔌 **Plugin Inventory**
- Comprehensive plugin catalog with VST/AU/VST3 support
- Filter by type (instrument/effect), format, and manufacturer
- User-editable notes for each plugin
- Full path visibility for troubleshooting
- Plugin scanner (basic implementation)

🎨 **Premium UI/UX**
- Dark theme optimized for music production environments
- Glassmorphism effects and smooth animations
- Desktop-optimized layout with maximum space efficiency
- Compact header with integrated search
- Professional aesthetic

🖥️ **Desktop Integration**
- Native window with proper title bar
- Cross-platform app launching (macOS/Windows)
- Secure IPC communication
- Configuration persistence
- System integration

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ (includes npm)
- macOS 10.13+ or Windows 10+

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd appviewr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

   Or for development mode with DevTools:
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
appviewr/
├── main.js              # Electron main process
├── preload.js           # Security bridge (IPC)
├── package.json         # Project config & dependencies
├── renderer/            # Frontend files
│   ├── index.html       # Main UI
│   ├── styles.css       # Styling
│   └── app.js           # Application logic
├── config/
│   └── apps-config.json # Apps & plugins configuration
├── assets/              # Icons and resources
└── README.md
```

## ⚙️ Configuration

### Editing Apps and Plugins

The configuration is stored in `config/apps-config.json`. Edit this file to customize your setup.

#### Adding a New App

```json
{
  "name": "Your App Name",
  "path": "/Applications/YourApp.app",  // macOS
  // or "C:\\Program Files\\YourApp\\app.exe" for Windows
  "icon": "🎹"
}
```

#### Adding a New Plugin

```json
{
  "name": "Plugin Name",
  "path": "/Library/Audio/Plug-Ins/VST3/YourPlugin.vst3",
  "type": "effect",
  "format": "VST3",
  "manufacturer": "Company Name",
  "notes": "Your personal notes here"
}
```

### Platform-Specific Paths

**macOS:**
- Apps: `/Applications/AppName.app`
- VST3: `/Library/Audio/Plug-Ins/VST3/`
- AU: `/Library/Audio/Plug-Ins/Components/`

**Windows:**
- Apps: `C:\Program Files\AppName\app.exe`
- VST3: `C:\Program Files\Common Files\VST3\`

## 🎯 Features in Detail

### App Launching

- **macOS**: Uses `open -a` command to launch .app bundles
- **Windows**: Uses `start` command to launch executables
- **Error Handling**: Shows notifications for success/failure
- **Path Validation**: Checks if apps exist before launching

### Plugin Management

- **View All Plugins**: See your entire plugin collection
- **Smart Filtering**: Filter by type, format, or manufacturer
- **Search**: Find plugins quickly by name or manufacturer
- **Notes**: Add personal notes for each plugin
- **Scanner**: Auto-detect installed plugins (basic)

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

### 🚧 Phase 3: Plugin Scanner (Next)
- [ ] Auto-scan plugin directories
- [ ] Parse plugin metadata
- [ ] Detect newly installed plugins
- [ ] Manual add with file picker
- [ ] Icon extraction from apps

### 📋 Phase 4: Advanced Features
- [ ] Drag-and-drop app reordering
- [ ] In-app configuration editor
- [ ] Export/import configurations
- [ ] Auto-updates
- [ ] Custom app icons upload
- [ ] Plugin favorites/ratings
- [ ] System tray integration
- [ ] Keyboard shortcuts

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

**Phase 2 Complete** - Now with actual app launching! 🚀
