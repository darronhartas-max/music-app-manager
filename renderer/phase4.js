// ============================================
// PHASE 4: Advanced Features Implementation
// ============================================

// Global state for Phase 4
let currentView = 'category'; // 'category' or 'manufacturer'
let currentAppFilter = 'all'; // 'all', 'favorites', 'recent'
let editMode = false;
let currentEditingPlugin = null;
let recentApps = [];

// Initialize Phase 4 features
function initializePhase4() {
    // Load recent apps from config
    if (appData.recentApps) {
        recentApps = appData.recentApps;
    }

    // View toggle buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setView(e.target.dataset.view);
        });
    });

    // Quick filter buttons
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setAppFilter(e.target.dataset.filter);
        });
    });

    // Add app button
    const addAppBtn = document.getElementById('addAppBtn');
    if (addAppBtn) {
        addAppBtn.addEventListener('click', openAddAppModal);
    }

    // Edit mode button
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) {
        editModeBtn.addEventListener('click', toggleEditMode);
    }

    // Keyboard shortcuts
    initializeKeyboardShortcuts();

    // Initialize drag and drop
    initializeDragAndDrop();
}

// Set view (category or manufacturer)
function setView(view) {
    currentView = view;

    // Update buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Re-render apps
    renderApps();
}

// Set app filter
function setAppFilter(filter) {
    currentAppFilter = filter;

    // Update buttons
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Re-render apps
    renderApps();
}

// Toggle edit mode
function toggleEditMode() {
    editMode = !editMode;
    const btn = document.getElementById('editModeBtn');
    const container = document.getElementById('appsContainer');

    if (editMode) {
        btn.classList.add('active');
        btn.innerHTML = '<span class="btn-icon">✅</span> Done';
        container.classList.add('edit-mode');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<span class="btn-icon">✏️</span> Edit Mode';
        container.classList.remove('edit-mode');
    }
}

// Render apps with Phase 4 enhancements
function renderAppsPhase4(searchTerm = '') {
    const container = document.getElementById('appsContainer');

    if (!appData || !appData.categories) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>No configuration data available</p></div>';
        return;
    }

    let html = '';
    let hasResults = false;

    // Get all apps
    let allApps = [];
    appData.categories.forEach(category => {
        category.apps.forEach(app => {
            allApps.push({ ...app, category: category.name });
        });
    });

    // Filter apps
    allApps = allApps.filter(app => {
        // Search filter
        if (searchTerm && !app.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }

        // Quick filter
        if (currentAppFilter === 'favorites' && !app.favorite) {
            return false;
        }
        if (currentAppFilter === 'recent' && !recentApps.includes(app.path)) {
            return false;
        }

        return true;
    });

    if (allApps.length === 0) {
        html = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>No apps found</p>
      </div>
    `;
        container.innerHTML = html;
        return;
    }

    // Group apps
    let groups = {};

    if (currentView === 'manufacturer') {
        // Group by manufacturer
        allApps.forEach(app => {
            const manufacturer = app.manufacturer || 'Unknown';
            if (!groups[manufacturer]) groups[manufacturer] = [];
            groups[manufacturer].push(app);
        });
    } else {
        // Group by category
        allApps.forEach(app => {
            const category = app.category || 'Uncategorized';
            if (!groups[category]) groups[category] = [];
            groups[category].push(app);
        });
    }

    // Render groups
    if (currentView === 'category') {
        // Iterate through categories in defined order
        appData.categories.forEach(category => {
            if (groups[category.name] && groups[category.name].length > 0) {
                const groupName = category.name;
                const apps = groups[groupName];
                hasResults = true;

                html += `
              <div class="category">
                <div class="category-header">
                  <h2 class="category-title">${groupName}</h2>
                  <span class="category-count">${apps.length}</span>
                </div>
                <div class="app-grid">
                  ${apps.map(app => createAppCardPhase4(app)).join('')}
                </div>
              </div>
            `;
            }
        });

        // Also render any uncategorized apps or categories not in appData
        Object.keys(groups).forEach(groupName => {
            // content not found search? The problem is I want to find keys in groups that are NOT in appData.categories
            const isKnownCategory = appData.categories.some(c => c.name === groupName);
            if (!isKnownCategory) {
                const apps = groups[groupName];
                hasResults = true;

                html += `
              <div class="category">
                <div class="category-header">
                  <h2 class="category-title">${groupName}</h2>
                  <span class="category-count">${apps.length}</span>
                </div>
                <div class="app-grid">
                  ${apps.map(app => createAppCardPhase4(app)).join('')}
                </div>
              </div>
            `;
            }
        })

    } else {
        // For manufacturer view, alphabetical sort is fine
        Object.keys(groups).sort().forEach(groupName => {
            const apps = groups[groupName];
            hasResults = true;

            html += `
          <div class="category">
            <div class="category-header">
              <h2 class="category-title">${groupName}</h2>
              <span class="category-count">${apps.length}</span>
            </div>
            <div class="app-grid">
              ${apps.map(app => createAppCardPhase4(app)).join('')}
            </div>
          </div>
        `;
        });
    }

    container.innerHTML = html;

    // Add click handlers
    attachAppCardHandlers();

    // Setup drag-drop if Phase 5 is loaded
    if (typeof setupDragDropAfterRender === 'function') {
        setupDragDropAfterRender();
    }
}

// Create app card with Phase 4 features
function createAppCardPhase4(app) {
    const isRecent = recentApps.includes(app.path);
    const isFavorite = app.favorite || false;

    // Real app icon (data URL from bundle) or emoji fallback
    const iconHtml = app.icon && app.icon.startsWith('data:')
        ? `<img src="${app.icon}" class="app-icon-img" alt="${app.name}" title="${app.name}">`
        : `<div class="app-icon">${app.icon || '🎵'}</div>`;

    return `
    <div class="app-card ${isRecent ? 'recent' : ''}" 
         data-path="${app.path}" 
         data-name="${app.name}"
         data-manufacturer="${app.manufacturer || ''}"
         draggable="${editMode}">
      <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
              onclick="toggleAppFavorite(event, '${app.path}')">
        ${isFavorite ? '⭐' : '☆'}
      </button>
      ${iconHtml}
      <div class="app-name">${app.name}</div>
      <div class="app-path">${app.manufacturer || app.path}</div>
    </div>
  `;
}

// Attach handlers to app cards
function attachAppCardHandlers() {
    document.querySelectorAll('.app-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn') && !editMode) {
                const path = card.dataset.path;
                const name = card.dataset.name;
                launchAppPhase4(path, name);
            }
        });

        if (editMode) {
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // Could add context menu for edit/delete
            });
        }
    });
}

// Launch app with recent tracking
async function launchAppPhase4(path, name) {
    // Add to recent apps
    if (!recentApps.includes(path)) {
        recentApps.unshift(path);
        if (recentApps.length > 10) {
            recentApps = recentApps.slice(0, 10);
        }

        // Save to config
        appData.recentApps = recentApps;
        if (isElectron) {
            await window.electronAPI.saveConfig(appData);
        }
    }

    // Launch the app
    await launchApp(path, name);
}

// Toggle app favorite
async function toggleAppFavorite(event, appPath) {
    event.stopPropagation();

    // Find and toggle favorite
    let found = false;
    appData.categories.forEach(category => {
        category.apps.forEach(app => {
            if (app.path === appPath) {
                app.favorite = !app.favorite;
                found = true;
            }
        });
    });

    if (found && isElectron) {
        await window.electronAPI.saveConfig(appData);
        renderAppsPhase4();
    }
}

// Modal functions
function openAddAppModal() {
    const modal = document.getElementById('appModal');
    document.getElementById('appModalTitle').textContent = 'Add App';
    document.getElementById('appName').value = '';
    document.getElementById('appManufacturer').value = '';
    document.getElementById('appPath').value = '';
    document.getElementById('appCategory').value = 'DAWs';
    document.getElementById('appIcon').value = '🎹';
    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function browseForApp() {
    if (!isElectron) {
        showNotification('Not Available', 'File browser only available in Electron app');
        return;
    }

    const filePath = await window.electronAPI.selectAppFile();
    if (filePath) {
        document.getElementById('appPath').value = filePath;

        // Try to extract app name
        const fileName = filePath.split('/').pop().replace('.app', '').replace('.exe', '');
        if (!document.getElementById('appName').value) {
            document.getElementById('appName').value = fileName;
        }
    }
}

async function saveApp() {
    const name = document.getElementById('appName').value.trim();
    const manufacturer = document.getElementById('appManufacturer').value.trim();
    const path = document.getElementById('appPath').value.trim();
    const category = document.getElementById('appCategory').value;
    const icon = document.getElementById('appIcon').value.trim() || '🎹';

    if (!name || !path) {
        showError('Please fill in required fields (Name and Path)');
        return;
    }

    // Find category
    let categoryObj = appData.categories.find(c => c.name === category);
    if (!categoryObj) {
        categoryObj = { name: category, apps: [] };
        appData.categories.push(categoryObj);
    }

    // Add app
    categoryObj.apps.push({
        name,
        manufacturer: manufacturer || 'Unknown',
        path,
        icon,
        favorite: false
    });

    // Save config
    if (isElectron) {
        await window.electronAPI.saveConfig(appData);
    }

    closeModal('appModal');
    renderAppsPhase4();
    updateStatistics();
    showNotification('✅ App Added', `${name} has been added to ${category}`);
}

// Plugin editing
function openPluginModal(plugin) {
    currentEditingPlugin = plugin;
    const modal = document.getElementById('pluginModal');

    document.getElementById('pluginName').value = plugin.name;
    document.getElementById('pluginNotes').value = plugin.notes || '';
    document.getElementById('pluginFavorite').checked = plugin.favorite || false;
    document.getElementById('pluginRating').value = plugin.rating || 0;

    // Set rating stars
    updateRatingStars(plugin.rating || 0);

    modal.classList.add('active');
}

function updateRatingStars(rating) {
    document.querySelectorAll('.rating-input .star').forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.classList.add('active');
        } else {
            star.textContent = '☆';
            star.classList.remove('active');
        }
    });
}

// Initialize rating input
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.rating-input .star').forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            document.getElementById('pluginRating').value = rating;
            updateRatingStars(rating);
        });
    });
});

async function savePlugin() {
    if (!currentEditingPlugin) return;

    const notes = document.getElementById('pluginNotes').value;
    const favorite = document.getElementById('pluginFavorite').checked;
    const rating = parseInt(document.getElementById('pluginRating').value);

    // Update plugin
    appData.plugins.forEach(plugin => {
        if (plugin.path === currentEditingPlugin.path) {
            plugin.notes = notes;
            plugin.favorite = favorite;
            plugin.rating = rating;
        }
    });

    // Save config
    if (isElectron) {
        await window.electronAPI.saveConfig(appData);
    }

    closeModal('pluginModal');
    renderPlugins();
    showNotification('✅ Plugin Updated', 'Changes saved successfully');
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifier = isMac ? e.metaKey : e.ctrlKey;

        if (modifier) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    switchTab('apps');
                    break;
                case '2':
                    e.preventDefault();
                    switchTab('plugins');
                    break;
                case '3':
                    e.preventDefault();
                    switchTab('settings');
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                    break;
                case 'n':
                case 'N':
                    e.preventDefault();
                    if (currentTab === 'apps') openAddAppModal();
                    break;
                case 'e':
                case 'E':
                    e.preventDefault();
                    if (currentTab === 'apps') toggleEditMode();
                    break;
                case '?':
                    e.preventDefault();
                    showShortcuts();
                    break;
            }
        }

        if (e.key === 'Escape') {
            closeModal('appModal');
            closeModal('pluginModal');
            closeShortcuts();
        }
    });
}

function showShortcuts() {
    document.getElementById('shortcutsOverlay').style.display = 'flex';
}

function closeShortcuts() {
    document.getElementById('shortcutsOverlay').style.display = 'none';
}

// Drag and drop for reordering
function initializeDragAndDrop() {
    // Will be initialized when edit mode is enabled
}

// Export Phase 4 functions to global scope
window.setView = setView;
window.setAppFilter = setAppFilter;
window.toggleAppFavorite = toggleAppFavorite;
window.closeModal = closeModal;
window.browseForApp = browseForApp;
window.saveApp = saveApp;
window.savePlugin = savePlugin;
window.closeShortcuts = closeShortcuts;
window.openPluginModal = openPluginModal;
