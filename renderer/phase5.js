// ============================================
// PHASE 5: UX Enhancement Features
// Drag-drop reordering, Fuzzy search, Custom icon upload
// ============================================

// Global state for Phase 5
let draggedElement = null;
let draggedAppData = null;
let searchHistory = [];
const MAX_SEARCH_HISTORY = 10;
let p5SearchTimeout = null;

// ============================================
// ENTRY POINT — called from app.js after DOMContentLoaded
// ============================================

function initializePhase5() {
    console.log('Phase 5: Initializing...');

    _p5_setupDragAndDrop();
    _p5_setupAdvancedSearch();
    _p5_setupCustomIconUpload();
    _p5_loadSearchHistory();

    // Expose enableDragAndDropForCards so Phase 4's renderAppsPhase4 can call it
    window.enableDragAndDropForCards = _p5_enableDragAndDropForCards;
    window.setupDragDropAfterRender  = _p5_setupDragDropAfterRender;

    console.log('Phase 5: Ready.');
}

// ============================================
// 1. DRAG AND DROP REORDERING
// ============================================

function _p5_setupDragAndDrop() {
    // Nothing to pre-initialise — cards are attached after each render
}

// Called after renderAppsPhase4 renders cards (already called in phase4.js if this is available)
function _p5_setupDragDropAfterRender() {
    if (typeof editMode !== 'undefined' && editMode) {
        _p5_enableDragAndDropForCards();
    }
}

function _p5_enableDragAndDropForCards() {
    document.querySelectorAll('.app-card').forEach(card => {
        card.setAttribute('draggable', 'true');
        // Remove stale listeners by cloning (avoids duplicate event handlers on re-render)
        const clone = card.cloneNode(true);
        card.parentNode.replaceChild(clone, card);
    });

    // Re-query after clone
    document.querySelectorAll('.app-card').forEach(card => {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart',  _p5_handleDragStart);
        card.addEventListener('dragend',    _p5_handleDragEnd);
        card.addEventListener('dragover',   _p5_handleDragOver);
        card.addEventListener('drop',       _p5_handleDrop);
        card.addEventListener('dragleave',  _p5_handleDragLeave);
        // Re-attach click handler (lost when cloned)
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn') && !editMode) {
                launchAppPhase4(card.dataset.path, card.dataset.name);
            }
        });
        // Re-attach favorite handler
        const favBtn = card.querySelector('.favorite-btn');
        if (favBtn) {
            favBtn.addEventListener('click', (e) => {
                toggleAppFavorite(e, card.dataset.path);
            });
        }
    });
}

function _p5_handleDragStart(e) {
    draggedElement = e.currentTarget;
    draggedAppData = {
        path:         draggedElement.dataset.path,
        name:         draggedElement.dataset.name,
        manufacturer: draggedElement.dataset.manufacturer
    };
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedElement.dataset.path);
}

function _p5_handleDragEnd(e) {
    if (draggedElement) draggedElement.classList.remove('dragging');
    document.querySelectorAll('.app-card').forEach(card => {
        card.classList.remove('drag-over-left', 'drag-over-right');
    });
    draggedElement = null;
    draggedAppData = null;
}

function _p5_handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const card = e.currentTarget;
    if (card === draggedElement) return;

    const rect     = card.getBoundingClientRect();
    const isLeft   = e.clientX < rect.left + rect.width / 2;

    document.querySelectorAll('.app-card').forEach(c => {
        c.classList.remove('drag-over-left', 'drag-over-right');
    });

    card.classList.add(isLeft ? 'drag-over-left' : 'drag-over-right');
}

function _p5_handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
}

async function _p5_handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropTarget = e.currentTarget;
    if (!draggedAppData || dropTarget === draggedElement) return;

    const rect   = dropTarget.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;

    await _p5_reorderApp(draggedAppData.path, dropTarget.dataset.path, isLeft);
}

async function _p5_reorderApp(draggedPath, targetPath, insertBefore) {
    let draggedCategory = null, draggedIndex = -1;
    let targetCategory  = null, targetIndex  = -1;

    appData.categories.forEach(cat => {
        const dIdx = cat.apps.findIndex(a => a.path === draggedPath);
        if (dIdx !== -1) { draggedCategory = cat; draggedIndex = dIdx; }

        const tIdx = cat.apps.findIndex(a => a.path === targetPath);
        if (tIdx !== -1) { targetCategory = cat;  targetIndex  = tIdx; }
    });

    if (!draggedCategory || !targetCategory) return;

    // Remove dragged app
    const [movedApp] = draggedCategory.apps.splice(draggedIndex, 1);

    // Adjust index if same category and dragged was before target
    if (draggedCategory === targetCategory && draggedIndex < targetIndex) {
        targetIndex--;
    }

    const insertIdx = insertBefore ? targetIndex : targetIndex + 1;
    targetCategory.apps.splice(insertIdx, 0, movedApp);

    if (typeof isElectron !== 'undefined' && isElectron) {
        await window.electronAPI.saveConfig(appData);
    }

    renderAppsPhase4();
    showNotification('✅ Reordered', `Moved ${movedApp.name}`);
}

// ============================================
// 2. ADVANCED FUZZY SEARCH
// ============================================

function _p5_loadSearchHistory() {
    try {
        const saved = localStorage.getItem('appviewr-search-history');
        if (saved) searchHistory = JSON.parse(saved);
    } catch (e) {
        searchHistory = [];
    }
}

function _p5_setupAdvancedSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const container = searchInput.parentElement;

    // --- History dropdown ---
    const historyDropdown = document.createElement('div');
    historyDropdown.id = 'searchHistoryDropdown';
    historyDropdown.className = 'search-history-dropdown';
    historyDropdown.style.display = 'none';
    container.appendChild(historyDropdown);

    // --- Clear (✕) button ---
    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-clear-btn';
    clearBtn.innerHTML = '✕';
    clearBtn.title = 'Clear search';
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        historyDropdown.style.display = 'none';
        renderApps();
    });
    container.appendChild(clearBtn);

    // --- Show/hide history on focus/blur ---
    searchInput.addEventListener('focus', () => {
        if (searchHistory.length > 0 && !searchInput.value) {
            _p5_renderHistoryDropdown(historyDropdown);
        }
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => { historyDropdown.style.display = 'none'; }, 200);
    });

    // --- Intercept the existing input event (added in app.js initializeEventListeners)
    //     by replacing the search handler with our enhanced version ---
    // We achieve this by overriding handleSearch globally.
    const _origHandleSearch = window.handleSearch || handleSearch;
    window.handleSearch = function(term) {
        if (currentTab === 'apps') {
            if (term && term.trim().length > 0) {
                _p5_performFuzzySearch(term.trim());
                _p5_addToHistory(term.trim());
            } else {
                renderApps();
            }
        } else {
            _origHandleSearch(term);
        }
    };

    // Track the clear button visibility
    searchInput.addEventListener('input', (e) => {
        clearBtn.style.display = e.target.value ? 'flex' : 'none';
        if (!e.target.value) historyDropdown.style.display = 'none';
    });
}

function _p5_fuzzyScore(query, text) {
    if (!text) return 0;
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    // Exact substring = highest score
    if (t.includes(q)) return 100 + (100 - t.indexOf(q)); // reward early matches

    // Character-sequence fuzzy
    let qi = 0, score = 0;
    for (let i = 0; i < t.length; i++) {
        if (t[i] === q[qi]) {
            qi++;
            score += 10;
            if (qi === q.length) return score;
        }
    }
    return 0;
}

function _p5_performFuzzySearch(query) {
    if (!appData || !appData.categories) return;

    const results = [];

    appData.categories.forEach(cat => {
        cat.apps.forEach(app => {
            const score =
                _p5_fuzzyScore(query, app.name)         * 3 +
                _p5_fuzzyScore(query, app.manufacturer)  * 2 +
                _p5_fuzzyScore(query, cat.name);

            if (score > 0) {
                results.push({ app: { ...app, category: cat.name }, score });
            }
        });
    });

    results.sort((a, b) => b.score - a.score);

    const container = document.getElementById('appsContainer');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No apps found for "<strong>${query}</strong>"</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="category">
            <div class="category-header">
                <h2 class="category-title">Search Results</h2>
                <span class="category-count">${results.length}</span>
            </div>
            <div class="app-grid">
                ${results.map(r => createAppCardPhase4(r.app)).join('')}
            </div>
        </div>`;

    attachAppCardHandlers();
    if (typeof editMode !== 'undefined' && editMode) {
        _p5_enableDragAndDropForCards();
    }
}

function _p5_addToHistory(query) {
    if (!query || searchHistory.includes(query)) return;
    searchHistory.unshift(query);
    if (searchHistory.length > MAX_SEARCH_HISTORY) {
        searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
    }
    try {
        localStorage.setItem('appviewr-search-history', JSON.stringify(searchHistory));
    } catch(e) {}
}

function _p5_renderHistoryDropdown(dropdown) {
    if (!searchHistory.length) return;

    dropdown.innerHTML = `
        <div class="search-history-header">
            <span>Recent Searches</span>
            <button class="search-history-clear-btn" onclick="p5ClearSearchHistory()">Clear</button>
        </div>
        ${searchHistory.map(q => `
            <div class="search-history-item" onclick="p5SelectHistory('${q.replace(/'/g, "\\'")}')">
                🔍 ${q}
            </div>
        `).join('')}`;

    dropdown.style.display = 'block';
}

// Exposed globally for inline onclick handlers
window.p5ClearSearchHistory = function() {
    searchHistory = [];
    try { localStorage.removeItem('appviewr-search-history'); } catch(e) {}
    const d = document.getElementById('searchHistoryDropdown');
    if (d) d.style.display = 'none';
    showNotification('🗑️ Cleared', 'Search history cleared');
};

window.p5SelectHistory = function(query) {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    input.focus();
};

// ============================================
// 3. CUSTOM ICON UPLOAD (for Add App modal)
// ============================================

function _p5_setupCustomIconUpload() {
    // The modal isn't in the DOM until opened — set up lazily by watching for the modal
    // We hook into openAddAppModal (defined in phase4.js)
    const _origOpenModal = window.openAddAppModal;
    if (typeof _origOpenModal === 'function') {
        window.openAddAppModal = function() {
            _origOpenModal();
            // Give DOM a tick to render, then inject upload button
            setTimeout(_p5_injectIconUpload, 50);
        };
    }
}

function _p5_injectIconUpload() {
    // Avoid adding twice
    if (document.getElementById('appIconFile')) return;

    const iconInput = document.getElementById('appIcon');
    if (!iconInput) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'appIconFile';

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'browse-btn';
    uploadBtn.style.marginLeft = '0.5rem';
    uploadBtn.textContent = '🖼️ Upload';
    uploadBtn.title = 'Upload a custom image icon';
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showError('Please select an image file');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            iconInput.value = ev.target.result; // store data URL as icon value
            iconInput.dataset.iconType = 'image';
            showNotification('✅ Icon Uploaded', 'Custom image icon will be used');
        };
        reader.readAsDataURL(file);
    });

    const parent = iconInput.parentElement;
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.gap = '0.5rem';
    parent.appendChild(uploadBtn);
    parent.appendChild(fileInput);
}

// ============================================
// EXPORT
// ============================================

window.initializePhase5 = initializePhase5;

console.log('Phase 5 module loaded — call initializePhase5() to activate');
