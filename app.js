// AppViewr - Music App & Plugin Manager
// Phase 1: Proof of Concept

let appData = null;
let currentTab = 'apps';
let currentPluginFilter = 'all';

// Initialize app on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  initializeEventListeners();
  renderApps();
});

// Load configuration from JSON file
async function loadConfig() {
  try {
    const response = await fetch('config/apps-config.json');
    appData = await response.json();
    console.log('Configuration loaded:', appData);
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

// Launch application (Phase 1: just show alert)
function launchApp(path, name) {
  console.log(`Launching: ${name} at ${path}`);
  
  // Phase 1: Show notification (actual launching requires Electron)
  showNotification(`🚀 Launching ${name}`, `In Phase 2, this will open: ${path}`);
}

// Render plugins table
function renderPlugins(searchTerm = '') {
  const tbody = document.getElementById('pluginTableBody');
  
  if (!appData || !appData.plugins) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No plugin data available</td></tr>';
    return;
  }
  
  // Filter plugins
  let filteredPlugins = appData.plugins.filter(plugin => {
    const matchesSearch = searchTerm === '' || 
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = currentPluginFilter === 'all' ||
      plugin.type === currentPluginFilter ||
      plugin.format === currentPluginFilter;
    
    return matchesSearch && matchesFilter;
  });
  
  if (filteredPlugins.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          No plugins found
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filteredPlugins.map(plugin => `
    <tr>
      <td><strong>${plugin.name}</strong></td>
      <td><span class="plugin-type ${plugin.type}">${plugin.type}</span></td>
      <td><span class="plugin-format">${plugin.format}</span></td>
      <td>${plugin.manufacturer}</td>
      <td class="plugin-notes">${plugin.notes || '-'}</td>
      <td style="font-size: 0.75rem; color: var(--text-muted);">${plugin.path}</td>
    </tr>
  `).join('');
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
