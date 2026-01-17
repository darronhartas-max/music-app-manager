// ============================================
// PHASE 5: Core UX Features Implementation
// Session 1: Drag-drop, Icons, Search, Categories
// ============================================

// Global state for Phase 5
let draggedElement = null;
let draggedAppData = null;
let dropIndicator = null;
let searchHistory = [];
let maxSearchHistory = 10;

// Initialize Phase 5 features
function initializePhase5() {
    console.log('Initializing Phase 5 features...');

    // Initialize drag and drop
    setupDragAndDrop();

    // Initialize advanced search
    setupAdvancedSearch();

    // Initialize category management
    setupCategoryManagement();

    // Initialize custom icon upload
    setupCustomIconUpload();
}

// ============================================
// 1. DRAG AND DROP REORDERING
// ============================================

function setupDragAndDrop() {
    // Create drop indicator element
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    dropIndicator.style.display = 'none';
    document.body.appendChild(dropIndicator);
}

// Enable drag and drop when rendering apps
function enableDragAndDropForCards() {
    if (!editMode) return;

    document.querySelectorAll('.app-card').forEach(card => {
        card.setAttribute('draggable', 'true');

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    draggedAppData = {
        path: draggedElement.dataset.path,
        name: draggedElement.dataset.name,
        manufacturer: draggedElement.dataset.manufacturer
    };

    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');

    // Remove all drag-over classes
    document.querySelectorAll('.app-card').forEach(card => {
        card.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
    });

    if (dropIndicator) {
        dropIndicator.style.display = 'none';
    }
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }

    e.dataTransfer.dropEffect = 'move';

    const card = e.currentTarget;
    if (card === draggedElement) return;

    // Determine drop position (left or right)
    const rect = card.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const isLeftSide = e.clientX < midpoint;

    // Remove previous indicators
    document.querySelectorAll('.app-card').forEach(c => {
        c.classList.remove('drag-over-left', 'drag-over-right');
    });

    // Add indicator
    if (isLeftSide) {
        card.classList.add('drag-over-left');
    } else {
        card.classList.add('drag-over-right');
    }

    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    const dropTarget = e.currentTarget;
    if (dropTarget === draggedElement) return false;

    // Determine drop position
    const rect = dropTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const isLeftSide = e.clientX < midpoint;

    // Reorder apps in config
    reorderApps(draggedAppData, dropTarget.dataset.path, isLeftSide);

    return false;
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
}

async function reorderApps(draggedApp, targetAppPath, insertBefore) {
    // Find the category and apps
    let draggedCategory = null;
    let draggedIndex = -1;
    let targetCategory = null;
    let targetIndex = -1;

    // Find dragged app
    appData.categories.forEach(category => {
        const index = category.apps.findIndex(app => app.path === draggedApp.path);
        if (index !== -1) {
            draggedCategory = category;
            draggedIndex = index;
        }
    });

    // Find target app
    appData.categories.forEach(category => {
        const index = category.apps.findIndex(app => app.path === targetAppPath);
        if (index !== -1) {
            targetCategory = category;
            targetIndex = index;
        }
    });

    if (!draggedCategory || !targetCategory) return;

    // Remove from original position
    const [movedApp] = draggedCategory.apps.splice(draggedIndex, 1);

    // If moving within same category, adjust target index
    if (draggedCategory === targetCategory && draggedIndex < targetIndex) {
        targetIndex--;
    }

    // Insert at new position
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
    targetCategory.apps.splice(insertIndex, 0, movedApp);

    // Save config
    if (isElectron) {
        await window.electronAPI.saveConfig(appData);
    }

    // Re-render
    renderAppsPhase4();
    showNotification('✅ Reordered', `Moved ${movedApp.name}`);
}

// ============================================
// 2. ADVANCED SEARCH
// ============================================

function setupAdvancedSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    // Add search history dropdown
    const searchContainer = searchInput.parentElement;
    const historyDropdown = document.createElement('div');
    historyDropdown.className = 'search-history-dropdown';
    historyDropdown.style.display = 'none';
    searchContainer.appendChild(historyDropdown);

    // Load search history from localStorage
    const saved = localStorage.getItem('appviewr-search-history');
    if (saved) {
        searchHistory = JSON.parse(saved);
    }

    // Show history on focus
    searchInput.addEventListener('focus', () => {
        if (searchHistory.length > 0 && !searchInput.value) {
            showSearchHistory(historyDropdown);
        }
    });

    // Hide history on blur (with delay for clicks)
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            historyDropdown.style.display = 'none';
        }, 200);
    });

    // Enhanced search with fuzzy matching
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.trim();
            if (query) {
                performAdvancedSearch(query);
                addToSearchHistory(query);
            } else {
                renderApps();
            }
        }, 300); // Debounce
    });

    // Clear search button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-clear-btn';
    clearBtn.innerHTML = '✕';
    clearBtn.style.display = 'none';
    clearBtn.onclick = () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        clearBtn.style.display = 'none';
    };
    searchContainer.appendChild(clearBtn);

    searchInput.addEventListener('input', (e) => {
        clearBtn.style.display = e.target.value ? 'block' : 'none';
    });
}

function fuzzyMatch(search, text) {
    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match gets highest score
    if (textLower.includes(searchLower)) return 100;

    // Fuzzy match
    let searchIndex = 0;
    let score = 0;

    for (let i = 0; i < textLower.length; i++) {
        if (textLower[i] === searchLower[searchIndex]) {
            searchIndex++;
            score += 10;
            if (searchIndex === searchLower.length) return score;
        }
    }

    return searchIndex === searchLower.length ? score : 0;
}

function performAdvancedSearch(query) {
    // Get all apps with scores
    let results = [];

    appData.categories.forEach(category => {
        category.apps.forEach(app => {
            const nameScore = fuzzyMatch(query, app.name);
            const manufacturerScore = fuzzyMatch(query, app.manufacturer || '');
            const categoryScore = fuzzyMatch(query, category.name);

            const totalScore = nameScore * 3 + manufacturerScore * 2 + categoryScore;

            if (totalScore > 0) {
                results.push({
                    app: { ...app, category: category.name },
                    score: totalScore
                });
            }
        });
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Render results
    renderSearchResults(results.map(r => r.app));
}

function renderSearchResults(apps) {
    const container = document.getElementById('appsContainer');

    if (apps.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>No apps found</p>
      </div>
    `;
        return;
    }

    const html = `
    <div class="category">
      <div class="category-header">
        <h2 class="category-title">Search Results</h2>
        <span class="category-count">${apps.length}</span>
      </div>
      <div class="app-grid">
        ${apps.map(app => createAppCardPhase4(app)).join('')}
      </div>
    </div>
  `;

    container.innerHTML = html;
    attachAppCardHandlers();
    if (editMode) enableDragAndDropForCards();
}

function addToSearchHistory(query) {
    if (!query || searchHistory.includes(query)) return;

    searchHistory.unshift(query);
    if (searchHistory.length > maxSearchHistory) {
        searchHistory = searchHistory.slice(0, maxSearchHistory);
    }

    localStorage.setItem('appviewr-search-history', JSON.stringify(searchHistory));
}

function showSearchHistory(dropdown) {
    if (searchHistory.length === 0) return;

    dropdown.innerHTML = `
    <div class="search-history-header">
      <span>Recent Searches</span>
      <button onclick="clearSearchHistory()">Clear</button>
    </div>
    ${searchHistory.map(query => `
      <div class="search-history-item" onclick="selectSearchHistory('${query}')">
        🔍 ${query}
      </div>
    `).join('')}
  `;

    dropdown.style.display = 'block';
}

function selectSearchHistory(query) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = query;
    searchInput.dispatchEvent(new Event('input'));
    searchInput.focus();
}

function clearSearchHistory() {
    searchHistory = [];
    localStorage.removeItem('appviewr-search-history');
    document.querySelector('.search-history-dropdown').style.display = 'none';
    showNotification('🗑️ Cleared', 'Search history cleared');
}

// ============================================
// 3. CATEGORY MANAGEMENT
// ============================================

function setupCategoryManagement() {
    // Add category manager to Tools tab
    // This will be added to the settings tab HTML
}

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

    renderApps();
    updateStatistics();
    showNotification('✅ Category Added', `${name} has been created`);
}

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

    renderApps();
    showNotification('✅ Category Renamed', `${oldName} → ${newName}`);
}

async function deleteCategory(name) {
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

    renderApps();
    updateStatistics();
    showNotification('🗑️ Category Deleted', `${name} has been removed`);
}

// ============================================
// 4. CUSTOM ICON UPLOAD
// ============================================

function setupCustomIconUpload() {
    // Add icon upload to app modal
    const iconInput = document.getElementById('appIcon');
    if (!iconInput) return;

    // Add file input for custom icons
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'appIconFile';

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'browse-btn';
    uploadBtn.textContent = 'Upload Icon';
    uploadBtn.onclick = () => fileInput.click();

    iconInput.parentElement.appendChild(uploadBtn);
    iconInput.parentElement.appendChild(fileInput);

    fileInput.addEventListener('change', handleIconUpload);
}

async function handleIconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = async (event) => {
        const dataUrl = event.target.result;

        // Store in config (for now, we'll use data URLs)
        // In production, you'd save to assets folder via IPC
        document.getElementById('appIcon').value = dataUrl;
        document.getElementById('appIcon').dataset.iconType = 'image';

        showNotification('✅ Icon Uploaded', 'Custom icon will be used');
    };

    reader.readAsDataURL(file);
}

// ============================================
// ENHANCED RENDERING
// ============================================

// Override attachAppCardHandlers to include drag-drop
const originalAttachAppCardHandlers = window.attachAppCardHandlers || attachAppCardHandlers;

function attachAppCardHandlersPhase5() {
    originalAttachAppCardHandlers();

    if (editMode) {
        enableDragAndDropForCards();
    }
}

// Export Phase 5 functions
window.initializePhase5 = initializePhase5;
window.addCategory = addCategory;
window.renameCategory = renameCategory;
window.deleteCategory = deleteCategory;
window.clearSearchHistory = clearSearchHistory;
window.selectSearchHistory = selectSearchHistory;
window.attachAppCardHandlers = attachAppCardHandlersPhase5;
window.enableDragAndDropForCards = enableDragAndDropForCards;

console.log('Phase 5 module loaded');

// ============================================
// CATEGORY MANAGER UI
// ============================================

function renderCategoryManager() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList || !appData || !appData.categories) return;
  
  categoryList.innerHTML = appData.categories.map(category => `
    <div class="category-item">
      <span class="category-drag-handle">☰</span>
      <input type="text" value="${category.name}" 
             onblur="handleCategoryRename(this, '${category.name}')"
             onkeypress="if(event.key==='Enter') this.blur()">
      <span style="color: var(--text-muted); font-size: 0.75rem;">${category.apps.length} apps</span>
      <button class="delete-btn" onclick="handleCategoryDelete('${category.name}')">🗑️</button>
    </div>
  `).join('');
}

function handleCategoryRename(input, oldName) {
  const newName = input.value.trim();
  if (newName && newName !== oldName) {
    renameCategory(oldName, newName);
  } else {
    input.value = oldName;
  }
}

function handleCategoryDelete(name) {
  deleteCategory(name).then(() => {
    renderCategoryManager();
  });
}

// Add category button handler
document.addEventListener('DOMContentLoaded', () => {
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      const name = prompt('Enter category name:');
      if (name) {
        addCategory(name).then(() => {
          renderCategoryManager();
        });
      }
    });
  }
});

// Render category manager when settings tab is opened
const originalSwitchTab = window.switchTab;
if (originalSwitchTab) {
  window.switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'settings') {
      setTimeout(() => renderCategoryManager(), 100);
    }
  };
}

// Export functions
window.renderCategoryManager = renderCategoryManager;
window.handleCategoryRename = handleCategoryRename;
window.handleCategoryDelete = handleCategoryDelete;

