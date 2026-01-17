# AppViewr - Music App & Plugin Manager

> **Phase 1: Proof of Concept** - A visual dashboard for launching music production apps and cataloging audio plugins.

![AppViewr](https://img.shields.io/badge/version-1.0.0--poc-blue)
![Platform](https://img.shields.io/badge/platform-web-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🎵 Overview

AppViewr is a cross-platform desktop application designed for music producers to organize and launch their music production apps and catalog their audio plugin inventory. This Phase 1 proof of concept demonstrates the core UI/UX and functionality using web technologies.

### Key Features

✨ **App Launcher Dashboard**
- Grid layout with categorized sections (DAWs, Synths, Guitar Tools, etc.)
- Visual app cards with icons and paths
- Click-to-launch functionality (simulated in Phase 1)
- Real-time search and filtering

🔌 **Plugin Inventory**
- Comprehensive plugin catalog with VST/AU/VST3 support
- Filter by type (instrument/effect), format, and manufacturer
- User-editable notes for each plugin
- Full path visibility for troubleshooting

🎨 **Premium UI/UX**
- Dark theme optimized for music production environments
- Glassmorphism effects and smooth animations
- Responsive design that adapts to any window size
- Professional aesthetic suitable for screenshots and demos

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- No build tools required for Phase 1

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd appviewr
   ```

2. **Open in browser**
   - Simply open `index.html` in your web browser
   - Or use a local server (recommended):
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server -p 8000
   ```
   
3. **Access the app**
   - Navigate to `http://localhost:8000` in your browser

## 📁 Project Structure

```
appviewr/
├── index.html          # Main HTML file
├── styles.css          # Complete styling with dark theme
├── app.js              # Application logic and interactivity
├── package.json        # Project metadata
├── config/
│   └── apps-config.json # Configuration file for apps and plugins
└── README.md           # This file
```

## ⚙️ Configuration

### Editing Apps and Plugins

The configuration is stored in `config/apps-config.json`. You can edit this file directly in any text editor to add, remove, or modify apps and plugins.

#### Adding a New App

```json
{
  "name": "Your App Name",
  "path": "/Applications/YourApp.app",
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

#### Creating a New Category

```json
{
  "name": "Your Category",
  "apps": [
    {
      "name": "App 1",
      "path": "/path/to/app",
      "icon": "🎛️"
    }
  ]
}
```

### Emoji Icons

Use emoji for app icons. Here are some suggestions:
- 🎹 Keyboards/Synths
- 🎸 Guitar tools
- 🎤 Vocal processors
- 🎚️ Mixing tools
- 🎛️ Controllers
- 🔊 Amplifiers
- 📊 Analyzers
- 🎼 DAWs
- ⚡ Effects
- 🌌 Atmospheric/Pads

## 🎯 Features in Detail

### App Dashboard

- **Categorized Layout**: Apps are organized into logical categories
- **Quick Launch**: Click any app card to launch (Phase 2 will enable actual launching)
- **Search**: Real-time search across all app names
- **Visual Feedback**: Smooth hover effects and animations

### Plugin Inventory

- **Comprehensive View**: See all your plugins in one place
- **Smart Filtering**: Filter by type, format, or manufacturer
- **Search**: Find plugins quickly by name or manufacturer
- **Notes**: Add personal notes to remember plugin characteristics

### Keyboard Shortcuts

- `Cmd/Ctrl + F`: Focus search bar (browser default)
- `Escape`: Clear search (when focused)

## 🔮 Roadmap

### Phase 2: Electron Wrapper (Next)
- [ ] Convert to Electron application
- [ ] Implement actual app launching via Node.js
- [ ] Extract app icons from .app bundles
- [ ] Store config in user data directory
- [ ] Add system tray integration

### Phase 3: Plugin Scanner
- [ ] Auto-scan common plugin directories
- [ ] Parse plugin metadata
- [ ] Detect newly installed plugins
- [ ] Manual add with file picker

### Phase 4: Advanced Features
- [ ] Drag-and-drop app reordering
- [ ] In-app configuration editor
- [ ] Export/import configurations
- [ ] Auto-updates
- [ ] Installer creation (DMG for macOS, MSI for Windows)
- [ ] Custom app icons upload
- [ ] Plugin favorites/ratings

## 🛠️ Technical Details

### Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Data**: JSON configuration file
- **Future**: Electron, Node.js

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Performance

- Lightweight: < 100KB total size
- Fast loading: < 100ms initial render
- Smooth animations: 60fps

## 🎨 Design Philosophy

AppViewr follows modern music production software aesthetics:

- **Dark Theme**: Reduces eye strain during long sessions
- **Glassmorphism**: Modern, premium feel
- **Smooth Animations**: Enhances user experience without being distracting
- **Clear Typography**: Inter font for excellent readability
- **Vibrant Accents**: Purple/indigo gradient for visual interest

## 📝 License

MIT License - feel free to use and modify for your own projects.

## 🤝 Contributing

This is currently a proof of concept. Feedback from music producers is highly valued! Please share:

- Screenshots of your setup
- Feature requests
- UI/UX suggestions
- Bug reports

## 💡 Tips for Music Producers

1. **Organize by Workflow**: Create categories that match your production workflow
2. **Use Descriptive Notes**: Add notes about plugin CPU usage, best use cases, etc.
3. **Keep Paths Updated**: When you update software, remember to update the paths
4. **Backup Your Config**: Save a copy of `apps-config.json` before major changes

## 🎵 Example Use Cases

- **Quick Session Start**: Launch your entire production chain with clicks
- **Plugin Discovery**: Remember what plugins you have before buying duplicates
- **Workflow Optimization**: See your entire toolkit at a glance
- **Teaching**: Show students your production setup
- **Documentation**: Screenshot your plugin inventory for insurance/backup

## 📧 Support

For questions or issues, please open an issue on GitHub or contact the maintainer.

---

**Built with ❤️ for music producers by music producers**
