// AppViewr - Music App & Plugin Manager
// Phase 2: Electron Desktop Application

let appData = null;
let currentTab = 'apps';
let currentPluginFilter = 'all';
let isElectron = false;

// Initialize app on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check if running in Electron
  isElectron = window.electronAPI && window.electronAPI.isElectron;

  if (isElectron) {
    console.log('Running in Electron mode');
    const platform = await window.electronAPI.getPlatform();
    console.log('Platform:', platform);
  } else {
    console.log('Running in browser mode');
  }

  await loadConfig();
  initializeEventListeners();

  // Initialize Phase 4 features
  if (typeof initializePhase4 === 'function') {
    initializePhase4();
  }

  // Initialize Phase 5 features
  if (typeof initializePhase5 === 'function') {
    initializePhase5();
  }

  renderApps();
});

// Load configuration
async function loadConfig() {
  try {
    if (isElectron) {
      // Load via Electron IPC
      appData = await window.electronAPI.loadConfig();
      console.log('Configuration loaded via Electron:', appData);
    } else {
      // Load via fetch (browser mode)
      const response = await fetch('../config/apps-config.json');
      appData = await response.json();
      console.log('Configuration loaded via fetch:', appData);
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
    showError('Failed to load configuration file');
  }
}

// Initialize event listeners
function initializeEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Search functionality
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value);
  });

  // Plugin filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setPluginFilter(e.target.dataset.filter);
    });
  });
}

// Switch between tabs
function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Render appropriate content
  if (tabName === 'apps') {
    renderApps();
  } else if (tabName === 'plugins') {
    renderPlugins();
  }

  // Clear search
  document.getElementById('searchInput').value = '';
}

// Render apps dashboard
function renderApps(searchTerm = '') {
  // Use Phase 4 rendering if available
  if (typeof renderAppsPhase4 === 'function') {
    renderAppsPhase4(searchTerm);
    return;
  }

  // Fallback to original rendering
  const container = document.getElementById('appsContainer');

  if (!appData || !appData.categories) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>No configuration data available</p></div>';
    return;
  }

  let html = '';
  let hasResults = false;

  appData.categories.forEach(category => {
    // Filter apps based on search term
    const filteredApps = category.apps.filter(app =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredApps.length === 0 && searchTerm) return;

    hasResults = true;

    html += `
      <div class="category">
        <div class="category-header">
          <h2 class="category-title">${category.name}</h2>
          <span class="category-count">${filteredApps.length}</span>
        </div>
        <div class="app-grid">
          ${filteredApps.map(app => createAppCard(app)).join('')}
        </div>
      </div>
    `;
  });

  if (!hasResults) {
    html = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>No apps found matching "${searchTerm}"</p>
      </div>
    `;
  }

  container.innerHTML = html;

  // Add click handlers to app cards
  document.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
      launchApp(card.dataset.path, card.dataset.name);
    });
  });
}

// Create app card HTML
function createAppCard(app) {
  return `
    <div class="app-card" data-path="${app.path}" data-name="${app.name}">
      <div class="app-icon">${app.icon}</div>
      <div class="app-name">${app.name}</div>
      <div class="app-path">${app.path}</div>
    </div>
  `;
}

// Launch application
async function launchApp(path, name) {
  console.log(`Launching: ${name} at ${path}`);

  if (isElectron) {
    try {
      // Use Electron API to launch app
      const result = await window.electronAPI.launchApp(path, name);

      if (result.success) {
        showNotification(`🚀 Launched ${name}`, `Successfully opened the application`);
      } else {
        showError(`Failed to launch ${name}: ${result.error}`);
      }
    } catch (error) {
      console.error('Launch error:', error);
      showError(`Failed to launch ${name}: ${error.message || 'Unknown error'}`);
    }
  } else {
    // Browser mode - show info notification
    showNotification(`🚀 ${name}`, `Install the Electron app to launch applications`);
  }
}

// Render plugins table
function renderPlugins(searchTerm = '') {
  const tbody = document.getElementById('pluginTableBody');

  if (!appData || !appData.plugins) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No plugin data available</td></tr>';
    return;
  }

  // Filter plugins
  let filteredPlugins = appData.plugins.filter(plugin => {
    const matchesSearch = searchTerm === '' ||
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = currentPluginFilter === 'all';

    if (currentPluginFilter === 'favorites') {
      matchesFilter = plugin.favorite === true;
    } else if (currentPluginFilter !== 'all') {
      matchesFilter = plugin.type === currentPluginFilter || plugin.format === currentPluginFilter;
    }

    return matchesSearch && matchesFilter;
  });

  if (filteredPlugins.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          No plugins found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredPlugins.map(plugin => {
    const favorite = plugin.favorite ? '⭐' : '☆';
    const rating = plugin.rating ? '★'.repeat(plugin.rating) : '-';
    const rowClass = plugin.favorite ? 'favorite' : '';

    return `
      <tr class="${rowClass}" onclick="if(typeof openPluginModal === 'function') openPluginModal(${JSON.stringify(plugin).replace(/"/g, '&quot;')})">
        <td class="favorite-cell ${plugin.favorite ? 'active' : ''}">${favorite}</td>
        <td><strong>${plugin.name}</strong></td>
        <td><span class="plugin-type ${plugin.type}">${plugin.type}</span></td>
        <td><span class="plugin-format">${plugin.format}</span></td>
        <td>${plugin.manufacturer}</td>
        <td class="rating-cell">${rating}</td>
        <td class="plugin-notes">${plugin.notes || '-'}</td>
        <td style="font-size: 0.75rem; color: var(--text-muted);">${plugin.path}</td>
      </tr>
    `;
  }).join('');
}

// Set plugin filter
function setPluginFilter(filter) {
  currentPluginFilter = filter;

  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Re-render plugins
  const searchTerm = document.getElementById('searchInput').value;
  renderPlugins(searchTerm);
}

// Handle search
function handleSearch(searchTerm) {
  if (currentTab === 'apps') {
    renderApps(searchTerm);
  } else if (currentTab === 'plugins') {
    renderPlugins(searchTerm);
  }
}

// Show notification
function showNotification(title, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: var(--bg-glass);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;

  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.5rem;">${title}</div>
    <div style="color: var(--text-secondary); font-size: 0.875rem;">${message}</div>
  `;

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Show error
function showError(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: rgba(239, 68, 68, 0.2);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    color: #fca5a5;
  `;

  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.5rem;">⚠️ Error</div>
    <div style="font-size: 0.875rem;">${message}</div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 5000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ============================================
// PHASE 3: Settings Panel Functionality
// ============================================

// Initialize settings panel
function initializeSettings() {
  if (!isElectron) return;

  // Scan plugins button
  const scanBtn = document.getElementById('scanPluginsBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', handlePluginScan);
  }

  // Export config button
  const exportBtn = document.getElementById('exportConfigBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExportConfig);
  }

  // Reload config button
  const reloadBtn = document.getElementById('reloadConfigBtn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', handleReloadConfig);
  }

  // Update statistics
  updateStatistics();

  // Update platform info
  updatePlatformInfo();

  // Listen for scan progress
  if (window.electronAPI.onScanProgress) {
    window.electronAPI.onScanProgress((data) => {
      updateScanProgress(data);
    });
  }
}

// Handle plugin scan
async function handlePluginScan() {
  const scanBtn = document.getElementById('scanPluginsBtn');
  const scanProgress = document.getElementById('scanProgress');
  const scanResults = document.getElementById('scanResults');

  try {
    // Disable button and show progress
    scanBtn.disabled = true;
    scanProgress.style.display = 'flex';
    scanResults.style.display = 'none';

    // Start scan
    const result = await window.electronAPI.scanPlugins();

    // Hide progress
    scanProgress.style.display = 'none';

    // Show results
    scanResults.style.display = 'block';
    scanResults.innerHTML = `
      <h3>✅ Scan Complete!</h3>
      <p><strong>${result.count}</strong> plugins found</p>
      <p>Scanned paths: ${result.scannedPaths.length}</p>
      <div style="margin-top: var(--spacing-md);">
        <button id="mergePluginsBtn" class="action-btn primary">
          <span class="btn-icon">📥</span>
          Add ${result.count} Plugins to Library
        </button>
        <button id="viewScannedBtn" class="action-btn">
          <span class="btn-icon">👁️</span>
          View Details
        </button>
      </div>
    `;

    // Store scanned plugins temporarily
    window.scannedPlugins = result.plugins;

    // Add merge button handler
    document.getElementById('mergePluginsBtn').addEventListener('click', async () => {
      await handleMergePlugins(result.plugins);
    });

    // Add view button handler
    document.getElementById('viewScannedBtn').addEventListener('click', () => {
      showScannedPluginsDetails(result.plugins);
    });

  } catch (error) {
    console.error('Scan error:', error);
    scanProgress.style.display = 'none';
    scanResults.style.display = 'block';
    scanResults.innerHTML = `
      <h3>⚠️ Scan Error</h3>
      <p style="color: #fca5a5;">${error.message || 'Failed to scan plugins'}</p>
    `;
  } finally {
    scanBtn.disabled = false;
  }
}

// Update scan progress
function updateScanProgress(data) {
  const progressText = document.querySelector('.progress-text');
  if (progressText) {
    progressText.textContent = `Scanning... ${data.count} plugins found (${data.current})`;
  }
}

// Handle merge plugins
async function handleMergePlugins(plugins) {
  try {
    const result = await window.electronAPI.mergePlugins(plugins);

    showNotification(
      '✅ Plugins Added',
      `Added ${result.added} new plugins. Total: ${result.total}`
    );

    // Reload config
    await loadConfig();
    updateStatistics();

    // Switch to plugins tab
    switchTab('plugins');

  } catch (error) {
    showError(`Failed to merge plugins: ${error.message}`);
  }
}

// Show scanned plugins details
function showScannedPluginsDetails(plugins) {
  const scanResults = document.getElementById('scanResults');

  // Group by format
  const byFormat = {};
  plugins.forEach(p => {
    if (!byFormat[p.format]) byFormat[p.format] = [];
    byFormat[p.format].push(p);
  });

  let html = '<h3>📋 Scanned Plugins</h3>';

  Object.keys(byFormat).forEach(format => {
    html += `
      <div style="margin-top: var(--spacing-md);">
        <strong>${format}</strong>: ${byFormat[format].length} plugins
      </div>
    `;
  });

  html += `
    <div style="margin-top: var(--spacing-md);">
      <button id="backToScanBtn" class="action-btn">
        <span class="btn-icon">←</span>
        Back
      </button>
    </div>
  `;

  scanResults.innerHTML = html;

  document.getElementById('backToScanBtn').addEventListener('click', () => {
    handlePluginScan();
  });
}

// Handle export config
async function handleExportConfig() {
  try {
    const configJson = JSON.stringify(appData, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appviewr-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('📤 Config Exported', 'Configuration file downloaded');
  } catch (error) {
    showError(`Failed to export config: ${error.message}`);
  }
}

// Handle reload config
async function handleReloadConfig() {
  try {
    await loadConfig();
    updateStatistics();
    renderApps();
    renderPlugins();
    showNotification('🔄 Config Reloaded', 'Configuration refreshed successfully');
  } catch (error) {
    showError(`Failed to reload config: ${error.message}`);
  }
}

// Update statistics
function updateStatistics() {
  if (!appData) return;

  // Count apps
  let totalApps = 0;
  if (appData.categories) {
    appData.categories.forEach(cat => {
      totalApps += cat.apps.length;
    });
  }

  // Count plugins
  const totalPlugins = appData.plugins ? appData.plugins.length : 0;

  // Count categories
  const totalCategories = appData.categories ? appData.categories.length : 0;

  // Update UI
  const statApps = document.getElementById('statApps');
  const statPlugins = document.getElementById('statPlugins');
  const statCategories = document.getElementById('statCategories');

  if (statApps) statApps.textContent = totalApps;
  if (statPlugins) statPlugins.textContent = totalPlugins;
  if (statCategories) statCategories.textContent = totalCategories;
}

// Update platform info
async function updatePlatformInfo() {
  if (!isElectron) return;

  try {
    const platform = await window.electronAPI.getPlatform();
    const platformInfo = document.getElementById('platformInfo');

    if (platformInfo) {
      const platformName = platform.platform === 'darwin' ? 'macOS' :
        platform.platform === 'win32' ? 'Windows' :
          platform.platform;
      platformInfo.textContent = `Platform: ${platformName} (${platform.arch})`;
    }
  } catch (error) {
    console.error('Failed to get platform info:', error);
  }
}

// Call initialize settings when settings tab is opened
const originalSwitchTab = switchTab;
switchTab = function (tabName) {
  originalSwitchTab(tabName);

  if (tabName === 'settings' && isElectron) {
    initializeSettings();
  }
};
