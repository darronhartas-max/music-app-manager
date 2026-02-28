// Music App Manager
// Phase 5: Full Feature Set

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

  // Show first-run welcome modal if library is empty and never shown before
  _checkFirstRun();
});

// Show welcome modal when the library is completely empty on first launch
function _checkFirstRun() {
  const hasSeenWelcome = localStorage.getItem('mam-welcome-shown');
  if (hasSeenWelcome) return;

  const totalApps = (appData && appData.categories)
    ? appData.categories.reduce((n, c) => n + c.apps.length, 0)
    : 0;
  const totalPlugins = (appData && appData.plugins) ? appData.plugins.length : 0;

  if (totalApps === 0 && totalPlugins === 0) {
    setTimeout(() => _showWelcomeModal(), 600); // small delay so the app renders first
  }
}

function _showWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (!modal) return;
  modal.style.display = 'flex';

  document.getElementById('welcomeStartBtn').onclick = () => {
    _hideWelcomeModal();
    switchTab('settings');
    // Scroll to App Scanner section
    setTimeout(() => {
      const scanAppsBtn = document.getElementById('scanAppsBtn');
      if (scanAppsBtn) scanAppsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  document.getElementById('welcomeDismissBtn').onclick = () => _hideWelcomeModal();

  // Click backdrop to dismiss
  modal.addEventListener('click', (e) => {
    if (e.target === modal) _hideWelcomeModal();
  });
}

function _hideWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.style.display = 'none';
  localStorage.setItem('mam-welcome-shown', '1');
}

// Refresh icons for all apps already in the config by re-extracting from their bundles
async function handleRefreshIcons() {
  const btn = document.getElementById('refreshIconsBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Refreshing...'; }

  if (!appData || !appData.categories) return;

  let updated = 0;
  for (const cat of appData.categories) {
    for (const app of cat.apps) {
      if (!app.path || !app.path.endsWith('.app')) continue;
      try {
        const dataUrl = await window.electronAPI.extractAppIcon(app.path);
        if (dataUrl) {
          app.icon = dataUrl;
          updated++;
        }
      } catch (e) { /* skip */ }
    }
  }

  if (updated > 0) {
    await window.electronAPI.saveConfig(appData);
    renderApps();
    showNotification('🖼️ Icons Refreshed', `Updated ${updated} app icon${updated !== 1 ? 's' : ''}`);
  } else {
    showNotification('ℹ️ No Updates', 'All icons are already up to date');
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">🖼️</span> Refresh App Icons'; }
}

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
  } else if (tabName === 'settings') {
    // Render category manager when settings tab is opened
    if (typeof renderCategoryManager === 'function') {
      setTimeout(() => renderCategoryManager(), 100);
    }
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

  // Add category button
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    // Guard against double-binding (called every time settings tab opens)
    if (!addCategoryBtn.dataset.bound) {
      addCategoryBtn.dataset.bound = 'true';
      addCategoryBtn.addEventListener('click', () => {
        const name = prompt('Enter category name:');
        if (name && name.trim()) {
          addCategory(name.trim()).then(() => {
            if (typeof renderCategoryManager === 'function') renderCategoryManager();
          });
        }
      });
    }
  }

  // Scan apps button
  const scanAppsBtn = document.getElementById('scanAppsBtn');
  if (scanAppsBtn) {
    scanAppsBtn.addEventListener('click', handleAppScan);
  }

  // Cleanup apps button
  const cleanupAppsBtn = document.getElementById('cleanupAppsBtn');
  if (cleanupAppsBtn) {
    cleanupAppsBtn.addEventListener('click', handleCleanupApps);
  }

  // Refresh Icons button
  const refreshIconsBtn = document.getElementById('refreshIconsBtn');
  if (refreshIconsBtn) {
    if (!refreshIconsBtn.dataset.bound) {
      refreshIconsBtn.dataset.bound = 'true';
      refreshIconsBtn.addEventListener('click', handleRefreshIcons);
    }
  }

  // Open User Guide button
  const openUserGuideBtn = document.getElementById('openUserGuideBtn');
  if (openUserGuideBtn && !openUserGuideBtn.dataset.bound) {
    openUserGuideBtn.dataset.bound = 'true';
    openUserGuideBtn.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.openUserGuide) {
        window.electronAPI.openUserGuide();
      }
    });
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

    // Reload config with fresh data
    await loadConfig();
    updateStatistics();

    // Reset filter to 'all' so newly-added plugins (which may have type='unknown')
    // are not hidden by a previously-active filter
    currentPluginFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });

    // Switch to plugins tab and explicitly render with fresh data
    switchTab('plugins');
    renderPlugins();

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

// ============================================
// CATEGORY REORDERING
// ============================================

// Render category manager
function renderCategoryManager() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList || !appData || !appData.categories) return;

  categoryList.innerHTML = appData.categories.map((category, index) => `
    <div class="category-item">
      <div class="category-reorder-btns">
        <button class="reorder-btn" onclick="moveCategoryUp(${index})" ${index === 0 ? 'disabled' : ''}>⬆️</button>
        <button class="reorder-btn" onclick="moveCategoryDown(${index})" ${index === appData.categories.length - 1 ? 'disabled' : ''}>⬇️</button>
      </div>
      <input type="text" value="${category.name}" 
             onblur="handleCategoryRename(this, '${category.name}')"
             onkeypress="if(event.key==='Enter') this.blur()">
      <span style="color: var(--text-muted); font-size: 0.75rem;">${category.apps.length} apps</span>
      <button class="delete-btn" onclick="handleCategoryDelete('${category.name}')">🗑️</button>
    </div>
  `).join('');
}

// Move category up
async function moveCategoryUp(index) {
  if (index === 0) return;

  // Swap with previous
  const temp = appData.categories[index];
  appData.categories[index] = appData.categories[index - 1];
  appData.categories[index - 1] = temp;

  // Save and re-render
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  renderCategoryManager();
  renderApps();
  showNotification('✅ Reordered', `Moved ${temp.name} up`);
}

// Move category down
async function moveCategoryDown(index) {
  if (index === appData.categories.length - 1) return;

  // Swap with next
  const temp = appData.categories[index];
  appData.categories[index] = appData.categories[index + 1];
  appData.categories[index + 1] = temp;

  // Save and re-render
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  renderCategoryManager();
  renderApps();
  showNotification('✅ Reordered', `Moved ${temp.name} down`);
}

// Handle category rename
function handleCategoryRename(input, oldName) {
  const newName = input.value.trim();
  if (newName && newName !== oldName) {
    renameCategory(oldName, newName);
  } else {
    input.value = oldName;
  }
}

// Rename category
async function renameCategory(oldName, newName) {
  if (!newName || !newName.trim()) {
    showError('Category name is required');
    return;
  }

  const category = appData.categories.find(c => c.name === oldName);
  if (!category) return;

  category.name = newName.trim();

  // Save
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  renderCategoryManager();
  renderApps();
  showNotification('✅ Category Renamed', `${oldName} → ${newName}`);
}

// Handle category delete
async function handleCategoryDelete(name) {
  const category = appData.categories.find(c => c.name === name);
  if (!category) return;

  if (category.apps.length > 0) {
    const confirmed = confirm(`Delete "${name}" category? This will remove ${category.apps.length} apps.`);
    if (!confirmed) return;
  }

  // Remove category
  appData.categories = appData.categories.filter(c => c.name !== name);

  // Save
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  renderCategoryManager();
  renderApps();
  updateStatistics();
  showNotification('🗑️ Category Deleted', `${name} has been removed`);
}

// Add category
async function addCategory(name) {
  if (!name || !name.trim()) {
    showError('Category name is required');
    return;
  }

  // Check if exists
  if (appData.categories.find(c => c.name === name)) {
    showError('Category already exists');
    return;
  }

  // Add category
  appData.categories.push({
    name: name.trim(),
    apps: []
  });

  // Save
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  renderCategoryManager();
  renderApps();
  updateStatistics();
  showNotification('✅ Category Added', `${name} has been created`);
}

// Export functions
window.renderCategoryManager = renderCategoryManager;
window.moveCategoryUp = moveCategoryUp;
window.moveCategoryDown = moveCategoryDown;
window.handleCategoryRename = handleCategoryRename;
window.handleCategoryDelete = handleCategoryDelete;


// ============================================
// APP SCANNER
// ============================================

// Handle app scan
async function handleAppScan() {
  const scanBtn = document.getElementById('scanAppsBtn');
  const appScanResults = document.getElementById('appScanResults');

  try {
    // Disable button
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="btn-icon">⏳</span> Scanning...';
    appScanResults.style.display = 'none';

    // Scan for apps
    const scannedApps = await window.electronAPI.scanApps();

    // Re-enable button
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<span class="btn-icon">🎵</span> Scan for Music Apps';

    if (scannedApps.length === 0) {
      appScanResults.innerHTML = `
        <div class="scan-results-summary">
          <p>No music apps found in /Applications</p>
        </div>
      `;
      appScanResults.style.display = 'block';
      return;
    }

    // Filter out apps that are already in the library
    const existingAppPaths = [];
    appData.categories.forEach(category => {
      category.apps.forEach(app => {
        existingAppPaths.push(app.path);
      });
    });

    const totalScanned = scannedApps.length;
    const newApps = scannedApps.filter(app => !existingAppPaths.includes(app.path));
    const alreadyAdded = totalScanned - newApps.length;

    if (newApps.length === 0) {
      appScanResults.innerHTML = `
        <div class="scan-results-summary">
          <p><strong>Found ${totalScanned} music apps</strong></p>
          <p style="color: var(--accent-primary); margin-top: 0.5rem;">
            ✅ All ${totalScanned} apps are already in your library!
          </p>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">
            No new apps to add. Your existing apps remain unchanged.
          </p>
        </div>
      `;
      appScanResults.style.display = 'block';
      return;
    }

    // Show results with editable table (only new apps)
    displayAppScanResults(newApps, totalScanned, alreadyAdded);

  } catch (error) {
    console.error('Error scanning apps:', error);
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<span class="btn-icon">🎵</span> Scan for Music Apps';
    showError('Failed to scan apps: ' + error.message);
  }
}

// Display app scan results with editable fields
function displayAppScanResults(apps, totalScanned = apps.length, alreadyAdded = 0) {
  const appScanResults = document.getElementById('appScanResults');

  const categories = appData.categories.map(c => c.name);

  let summaryMessage = `<p><strong>Found ${totalScanned} music apps</strong></p>`;

  if (alreadyAdded > 0) {
    summaryMessage += `
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: 0.5rem;">
        ✅ ${alreadyAdded} already in library • 🆕 ${apps.length} new apps found
      </p>
      <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
        Showing only new apps below. Your existing apps remain unchanged.
      </p>
    `;
  } else {
    summaryMessage += `
      <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">
        Review and edit the details below, then click "Add Selected Apps"
      </p>
    `;
  }

  appScanResults.innerHTML = `
    <div class="scan-results-summary">
      ${summaryMessage}
    </div>
    
    <div class="app-scan-table-container">
      <table class="app-scan-table">
        <thead>
          <tr>
            <th style="width: 40px;">
              <input type="checkbox" id="selectAllApps" checked onchange="toggleAllAppSelections(this.checked)">
            </th>
            <th>App Name</th>
            <th>Manufacturer</th>
            <th>Category</th>
            <th>Icon</th>
          </tr>
        </thead>
        <tbody id="appScanTableBody">
          ${apps.map((app, index) => `
            <tr data-index="${index}" data-icon="${app.icon && app.icon.startsWith('data:') ? '' : app.icon || '🎵'}">
              <td>
                <input type="checkbox" class="app-select-checkbox" checked data-index="${index}">
              </td>
              <td>
                <input type="text" class="app-name-input" value="${app.name}" data-index="${index}">
              </td>
              <td>
                <input type="text" class="app-manufacturer-input" value="${app.manufacturer}" data-index="${index}">
              </td>
              <td>
                <select class="app-category-select" data-index="${index}">
                  ${categories.map(cat => `
                    <option value="${cat}" ${cat === app.suggestedCategory ? 'selected' : ''}>${cat}</option>
                  `).join('')}
                </select>
              </td>
              <td style="text-align:center;">
                ${app.icon && app.icon.startsWith('data:')
      ? `<img src="${app.icon}" style="width:36px;height:36px;object-fit:contain;border-radius:6px;" title="Real app icon">`
      : `<span style="font-size:1.5rem" title="Default icon">${app.icon || '🎵'}</span>`
    }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="scan-results-actions">
      <button class="action-btn primary" onclick="addSelectedApps(${JSON.stringify(apps).replace(/"/g, '&quot;')})">
        <span class="btn-icon">📥</span>
        Add Selected Apps
      </button>
      <button class="action-btn" onclick="document.getElementById('appScanResults').style.display='none'">
        Cancel
      </button>
    </div>
  `;

  appScanResults.style.display = 'block';
}

// Toggle all app selections
function toggleAllAppSelections(checked) {
  document.querySelectorAll('.app-select-checkbox').forEach(checkbox => {
    checkbox.checked = checked;
  });
}

// Add selected apps to library
async function addSelectedApps(scannedApps) {
  const selectedApps = [];

  document.querySelectorAll('.app-select-checkbox:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    const row = checkbox.closest('tr');

    const name = row.querySelector('.app-name-input').value.trim();
    const manufacturer = row.querySelector('.app-manufacturer-input').value.trim();
    const category = row.querySelector('.app-category-select').value;

    // Icon: use the full data URL stored on the scanned app (not the text field)
    const icon = scannedApps[index].icon || '🎵';

    if (name) {
      selectedApps.push({
        name,
        manufacturer: manufacturer || 'Unknown',
        path: scannedApps[index].path,
        category,
        icon,
        favorite: false
      });
    }
  });

  if (selectedApps.length === 0) {
    showError('No apps selected');
    return;
  }

  // Add apps to their categories
  selectedApps.forEach(app => {
    let categoryObj = appData.categories.find(c => c.name === app.category);
    if (!categoryObj) {
      categoryObj = { name: app.category, apps: [] };
      appData.categories.push(categoryObj);
    }

    // Check if app already exists
    const exists = categoryObj.apps.some(existingApp => existingApp.path === app.path);
    if (!exists) {
      categoryObj.apps.push({
        name: app.name,
        manufacturer: app.manufacturer,
        path: app.path,
        icon: app.icon,
        favorite: false
      });
    }
  });

  // Save config
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  // Hide results and update UI
  document.getElementById('appScanResults').style.display = 'none';
  renderApps();
  updateStatistics();

  // Re-render category manager to update app counts per category in Tools tab
  if (typeof renderCategoryManager === 'function') {
    renderCategoryManager();
  }

  showNotification('✅ Apps Added', `Added ${selectedApps.length} apps to library`);
}

// Export functions
window.handleAppScan = handleAppScan;
window.toggleAllAppSelections = toggleAllAppSelections;
window.addSelectedApps = addSelectedApps;


// ============================================
// CLEANUP MISSING APPS
// ============================================

// Handle cleanup of missing apps
async function handleCleanupApps() {
  const cleanupBtn = document.getElementById('cleanupAppsBtn');
  const cleanupResults = document.getElementById('cleanupResults');

  try {
    // Disable button
    cleanupBtn.disabled = true;
    cleanupBtn.innerHTML = '<span class="btn-icon">⏳</span> Checking...';
    cleanupResults.style.display = 'none';

    // Check all apps
    const missingApps = [];
    const totalApps = [];

    for (const category of appData.categories) {
      for (const app of category.apps) {
        totalApps.push({ app, category: category.name });

        // Check if app exists
        const exists = await window.electronAPI.checkAppExists(app.path);
        if (!exists) {
          missingApps.push({ app, category: category.name });
        }
      }
    }

    // Re-enable button
    cleanupBtn.disabled = false;
    cleanupBtn.innerHTML = '<span class="btn-icon">🧹</span> Clean Up Missing Apps';

    if (missingApps.length === 0) {
      cleanupResults.innerHTML = `
        <div class="scan-results-summary">
          <p style="color: var(--accent-primary);">
            ✅ All ${totalApps.length} apps are installed and accessible!
          </p>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">
            No cleanup needed.
          </p>
        </div>
      `;
      cleanupResults.style.display = 'block';
      return;
    }

    // Show missing apps
    cleanupResults.innerHTML = `
      <div class="scan-results-summary">
        <p><strong>Found ${missingApps.length} missing apps</strong></p>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">
          These apps are in your library but no longer exist on your system.
        </p>
      </div>
      
      <div class="missing-apps-list">
        ${missingApps.map(({ app, category }) => `
          <div class="missing-app-item">
            <div>
              <strong>${app.name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${category} • ${app.manufacturer || 'Unknown'}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                ${app.path}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="scan-results-actions">
        <button class="action-btn primary" onclick="removeMissingApps(${JSON.stringify(missingApps).replace(/"/g, '&quot;')})">
          <span class="btn-icon">🗑️</span>
          Remove ${missingApps.length} Missing Apps
        </button>
        <button class="action-btn" onclick="document.getElementById('cleanupResults').style.display='none'">
          Cancel
        </button>
      </div>
    `;

    cleanupResults.style.display = 'block';

  } catch (error) {
    console.error('Error checking apps:', error);
    cleanupBtn.disabled = false;
    cleanupBtn.innerHTML = '<span class="btn-icon">🧹</span> Clean Up Missing Apps';
    showError('Failed to check apps: ' + error.message);
  }
}

// Remove missing apps from library
async function removeMissingApps(missingApps) {
  const confirmed = confirm(
    `Remove ${missingApps.length} missing apps from your library?\n\n` +
    `This will not delete any files, only remove them from AppViewr.`
  );

  if (!confirmed) return;

  // Remove missing apps
  missingApps.forEach(({ app }) => {
    appData.categories.forEach(category => {
      category.apps = category.apps.filter(a => a.path !== app.path);
    });
  });

  // Save config
  if (isElectron) {
    await window.electronAPI.saveConfig(appData);
  }

  // Hide results and update UI
  document.getElementById('cleanupResults').style.display = 'none';
  renderApps();
  updateStatistics();

  showNotification('🗑️ Cleaned Up', `Removed ${missingApps.length} missing apps`);
}

// Export functions
window.handleCleanupApps = handleCleanupApps;
window.removeMissingApps = removeMissingApps;

