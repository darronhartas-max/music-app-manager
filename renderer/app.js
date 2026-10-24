// Music App Manager v2.0 — Unified Renderer Controller
// Replaces legacy app.js, phase4.js, and phase5.js

const state = {
  appData: null,
  currentTab: 'apps',
  currentAppView: 'category', // 'category' | 'manufacturer'
  currentAppFilter: 'all',    // 'all' | 'favorites' | 'recent'
  editMode: false,
  currentPluginFilter: 'all',
  pluginViewMode: 'grouped',  // 'grouped' | 'flat'
  pluginSortField: 'name',
  pluginSortAsc: true,
  searchQuery: '',
  searchHistory: [],
  draggedAppPath: null,
  contextMenuAppPath: null,
  editingPluginGroup: null,
  isElectron: Boolean(window.electronAPI && window.electronAPI.isElectron),
  platformInfo: { platform: 'darwin', arch: 'arm64' }
};

const MAX_SEARCH_HISTORY = 10;

// Utility: HTML escaping to prevent broken attributes with Windows backslashes or quotes
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (state.isElectron) {
    try {
      state.platformInfo = await window.electronAPI.getPlatform();
      if (state.platformInfo.platform === 'win32') {
        document.body.classList.add('platform-win');
      }
    } catch (e) {
      console.error('Failed to get platform info:', e);
    }
  }

  loadSearchHistory();
  await loadConfig();
  bindAllEvents();
  renderAll();
  checkFirstRun();
});

async function loadConfig() {
  try {
    if (state.isElectron) {
      state.appData = await window.electronAPI.loadConfig();
    } else {
      const res = await fetch('../config/apps-config.json');
      state.appData = await res.json();
    }
  } catch (err) {
    console.error('Error loading config:', err);
    state.appData = { categories: [], plugins: [], recentApps: [], settings: {} };
  }

  if (!Array.isArray(state.appData.categories)) state.appData.categories = [];
  if (!Array.isArray(state.appData.plugins)) state.appData.plugins = [];
  if (!Array.isArray(state.appData.recentApps)) state.appData.recentApps = [];
  if (!state.appData.settings) state.appData.settings = {};
  if (!Array.isArray(state.appData.settings.customPluginPaths)) state.appData.settings.customPluginPaths = [];
  if (!Array.isArray(state.appData.settings.customAppPaths)) state.appData.settings.customAppPaths = [];

  if (state.appData.settings.pluginViewMode) {
    state.pluginViewMode = state.appData.settings.pluginViewMode;
  }
}

async function saveConfig() {
  if (state.isElectron && state.appData) {
    await window.electronAPI.saveConfig(state.appData);
  }
}

function renderAll() {
  renderApps();
  renderPlugins();
  updateStatistics();
  renderUpdateCentersBars();
  renderCategoryManager();
  renderCustomPaths();
  updatePlatformDisplay();
}

// Identify Vendor Update, Product, and License Managers
const UPDATE_CENTER_REGEX = /software center|cherry audio sync|ua connect|product manager|software pass|gforce installer|reason companion|muse hub|ilok license manager|native access|waves central|splice|avid link|download assistant|activation manager|pulse|roland cloud|spitfire audio|installation manager|installation center|softube central|output hub|xln online installer|slate digital connect/i;

function isUpdateOrLicenseCenter(app) {
  if (!app) return false;
  const hay = `${app.name || ''} ${app.path || ''}`;
  return UPDATE_CENTER_REGEX.test(hay);
}

function getDetectedUpdateCenters() {
  if (!state.appData || !Array.isArray(state.appData.categories)) return [];
  const centers = [];
  const seen = new Set();
  state.appData.categories.forEach(cat => {
    (cat.apps || []).forEach(app => {
      if (isUpdateOrLicenseCenter(app) && !seen.has(app.path)) {
        seen.add(app.path);
        centers.push(app);
      }
    });
  });
  return centers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function createUpdateCenterPillHtml(app) {
  const iconVal = app.icon || '🔄';
  const iconHtml = isValidImageIcon(iconVal)
    ? `<img src="${escapeHtml(iconVal)}" alt="${escapeHtml(app.name)}">`
    : `<span class="pill-emoji">${escapeHtml(iconVal.startsWith('data:') ? '🔄' : iconVal)}</span>`;

  return `
    <button type="button" class="update-center-pill" data-action="launch-updater" data-path="${escapeHtml(app.path)}" data-name="${escapeHtml(app.name)}" title="Launch ${escapeHtml(app.name)}">
      ${iconHtml}
      <span>${escapeHtml(app.name)}</span>
    </button>`;
}

function renderUpdateCentersBars() {
  const centers = getDetectedUpdateCenters();

  // Settings Tab Quick-Launch Hub
  const settingsBar = document.getElementById('settingsUpdateCentersBar');
  if (settingsBar) {
    if (centers.length === 0) {
      settingsBar.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No vendor update or license managers detected in your library yet.</div>`;
    } else {
      settingsBar.innerHTML = centers.map(createUpdateCenterPillHtml).join('');
    }
  }
}

// ============================================
// FIRST-RUN WELCOME MODAL
// ============================================

function checkFirstRun() {
  if (localStorage.getItem('mam-welcome-shown')) return;
  const totalApps = state.appData.categories.reduce((acc, c) => acc + (c.apps ? c.apps.length : 0), 0);
  const totalPlugins = state.appData.plugins.length;

  if (totalApps === 0 && totalPlugins === 0) {
    const modal = document.getElementById('welcomeModal');
    if (modal) modal.style.display = 'flex';
  }
}

function hideWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.style.display = 'none';
  localStorage.setItem('mam-welcome-shown', '1');
}

// ============================================
// APPS DASHBOARD & FUZZY SEARCH
// ============================================

function fuzzyScore(query, text) {
  if (!text || !query) return 0;
  const q = query.toLowerCase();
  const t = String(text).toLowerCase();
  if (t.includes(q)) return 100 + Math.max(0, 100 - t.indexOf(q));
  let qi = 0;
  let score = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === q[qi]) {
      qi++;
      score += 10;
      if (qi === q.length) return score;
    }
  }
  return 0;
}

function findAppByPath(appPath) {
  for (const cat of state.appData.categories) {
    const idx = cat.apps.findIndex(a => a.path === appPath);
    if (idx !== -1) {
      return { app: cat.apps[idx], category: cat, index: idx };
    }
  }
  return null;
}

function renderApps() {
  const container = document.getElementById('appsContainer');
  if (!container) return;

  container.classList.toggle('edit-mode', state.editMode);

  const query = state.searchQuery.trim();
  const recentPaths = state.appData.recentApps || [];

  // Flatten all apps with category reference
  let allApps = [];
  state.appData.categories.forEach(cat => {
    (cat.apps || []).forEach(app => {
      allApps.push({ ...app, categoryName: cat.name });
    });
  });

  // Apply quick filters
  if (state.currentAppFilter === 'favorites') {
    allApps = allApps.filter(a => a.favorite);
  } else if (state.currentAppFilter === 'recent') {
    allApps = allApps
      .filter(a => recentPaths.includes(a.path))
      .sort((a, b) => recentPaths.indexOf(a.path) - recentPaths.indexOf(b.path));
  }

  renderUpdateCentersBars();

  // Apply search query (with fuzzy scoring)
  if (query) {
    const scored = [];
    allApps.forEach(app => {
      const score =
        fuzzyScore(query, app.name) * 3 +
        fuzzyScore(query, app.manufacturer) * 2 +
        fuzzyScore(query, app.categoryName);
      if (score > 0) scored.push({ app, score });
    });
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <p>No applications found matching "<strong>${escapeHtml(query)}</strong>"</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="category">
        <div class="category-header">
          <h2 class="category-title">Search Results</h2>
          <span class="category-count">${scored.length}</span>
        </div>
        <div class="app-grid">
          ${scored.map(s => createAppCardHtml(s.app)).join('')}
        </div>
      </div>`;
    return;
  }

  if (allApps.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎵</div>
        <p>No apps in this view yet. Go to <strong>⚙️ Tools → Scan for Music Apps</strong> or click <strong>➕ Add App</strong>.</p>
      </div>`;
    return;
  }

  let html = '';

  if (state.currentAppView === 'manufacturer') {
    const byMfr = {};
    allApps.forEach(app => {
      const mfr = app.manufacturer || 'Unknown';
      if (!byMfr[mfr]) byMfr[mfr] = [];
      byMfr[mfr].push(app);
    });

    Object.keys(byMfr).sort().forEach(mfr => {
      const list = byMfr[mfr];
      html += `
        <div class="category" data-group="${escapeHtml(mfr)}">
          <div class="category-header">
            <h2 class="category-title">${escapeHtml(mfr)}</h2>
            <span class="category-count">${list.length}</span>
          </div>
          <div class="app-grid">
            ${list.map(app => createAppCardHtml(app)).join('')}
          </div>
        </div>`;
    });
  } else {
    state.appData.categories.forEach((cat, catIdx) => {
      const list = allApps.filter(a => a.categoryName === cat.name);
      // Show empty categories when in Edit Mode so users can drag apps into them or reorder them
      if (list.length === 0 && !state.editMode) return;
      const totalCatCount = state.appData.categories.length;
      html += `
        <div class="category" data-category="${escapeHtml(cat.name)}" data-cat-index="${catIdx}" draggable="true">
          <div class="category-header" title="Drag category header to reorder categories">
            <span class="category-drag-handle" title="Drag to move category">⠿</span>
            <h2 class="category-title">${escapeHtml(cat.name)}</h2>
            <span class="category-count">${list.length}</span>
            <div class="category-header-controls">
              <button type="button" class="reorder-btn" data-action="dash-cat-up" data-cat-index="${catIdx}" ${catIdx === 0 ? 'disabled' : ''} title="Move Category Up">⬆️</button>
              <button type="button" class="reorder-btn" data-action="dash-cat-down" data-cat-index="${catIdx}" ${catIdx === totalCatCount - 1 ? 'disabled' : ''} title="Move Category Down">⬇️</button>
            </div>
          </div>
          <div class="app-grid">
            ${list.length > 0
              ? list.map(app => createAppCardHtml(app)).join('')
              : `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">Empty category — drag apps here or add apps</div>`}
          </div>
        </div>`;
    });
  }

  container.innerHTML = html;
}

function isValidImageIcon(iconVal) {
  if (!iconVal || typeof iconVal !== 'string') return false;
  if (iconVal.startsWith('http://') || iconVal.startsWith('https://')) return true;
  // A valid base64 image data URL must be longer than the 22-char "data:image/png;base64," prefix
  return iconVal.startsWith('data:image/') && iconVal.length > 100;
}

function createAppCardHtml(app) {
  const isRecent = (state.appData.recentApps || []).includes(app.path);
  const isFav = Boolean(app.favorite);
  const iconVal = app.icon || '🎵';
  const iconHtml = isValidImageIcon(iconVal)
    ? `<img src="${escapeHtml(iconVal)}" class="app-icon-img" alt="${escapeHtml(app.name)}">`
    : `<div class="app-icon">${escapeHtml(iconVal.startsWith('data:') ? '🎵' : iconVal)}</div>`;

  const editBadge = state.editMode
    ? `<button type="button" class="app-card-edit-action-btn" data-action="edit-app" title="Edit App">✏️ Edit</button>`
    : '';

  const subtitle = app.manufacturer && app.manufacturer !== 'Unknown'
    ? app.manufacturer
    : app.path;

  const hasLicenseVault = Boolean(app.serialKey || app.licenseType || app.licenseAccount);
  const licenseBadgeHtml = hasLicenseVault
    ? `<span class="app-card-key-badge" title="License / Serial saved in Vault (${escapeHtml(app.licenseType || 'Saved')})">🔑</span>`
    : '';

  return `
    <div class="app-card ${isRecent ? 'recent' : ''}"
         data-path="${escapeHtml(app.path)}"
         data-name="${escapeHtml(app.name)}"
         draggable="${state.editMode ? 'true' : 'false'}">
      ${editBadge}
      ${licenseBadgeHtml}
      <button type="button" class="favorite-btn ${isFav ? 'active' : ''}" data-action="favorite-app" title="Toggle Favorite">
        ${isFav ? '⭐' : '☆'}
      </button>
      ${iconHtml}
      <div class="app-name">${escapeHtml(app.name)}</div>
      <div class="app-path">${escapeHtml(subtitle)}</div>
    </div>`;
}

async function launchApp(appPath, appName) {
  if (!appPath) return;

  // Track recent apps
  const recent = state.appData.recentApps || [];
  const filtered = recent.filter(p => p !== appPath);
  filtered.unshift(appPath);
  state.appData.recentApps = filtered.slice(0, state.appData.settings.maxRecentApps || 10);
  await saveConfig();

  if (state.isElectron) {
    const res = await window.electronAPI.launchApp(appPath, appName);
    if (res && res.success) {
      showNotification(`🚀 Launched ${appName}`, 'Application opened successfully');
    } else {
      showError(`Failed to launch ${appName}: ${(res && res.error) || 'Unknown error'}`);
    }
  } else {
    showNotification(`🚀 ${appName}`, 'Run in Electron to launch desktop applications');
  }
}

async function toggleAppFavorite(appPath) {
  const found = findAppByPath(appPath);
  if (!found) return;
  found.app.favorite = !found.app.favorite;
  await saveConfig();
  renderApps();
}

function toggleEditMode() {
  state.editMode = !state.editMode;
  const btn = document.getElementById('editModeBtn');
  if (btn) {
    btn.classList.toggle('active', state.editMode);
    btn.innerHTML = state.editMode
      ? '<span class="btn-icon">✅</span> Done Editing'
      : '<span class="btn-icon">✏️</span> Edit / Reorder';
  }
  const banner = document.getElementById('editModeBanner');
  if (banner) {
    banner.style.display = state.editMode ? 'flex' : 'none';
  }
  renderApps();
}

async function reorderCategory(draggedCategoryName, targetCategoryName, insertBefore) {
  if (!draggedCategoryName || !targetCategoryName || draggedCategoryName === targetCategoryName) return;
  const cats = state.appData.categories;
  const fromIdx = cats.findIndex(c => c.name === draggedCategoryName);
  const toIdx = cats.findIndex(c => c.name === targetCategoryName);
  if (fromIdx === -1 || toIdx === -1) return;

  const [movedCat] = cats.splice(fromIdx, 1);
  let newTargetIdx = cats.findIndex(c => c.name === targetCategoryName);
  if (newTargetIdx === -1) newTargetIdx = cats.length;

  const insertIdx = insertBefore ? newTargetIdx : newTargetIdx + 1;
  cats.splice(insertIdx, 0, movedCat);

  await saveConfig();
  renderAll();
  showNotification('📂 Category Reordered', `Moved "${movedCat.name}"`);
}

async function reorderApp(draggedPath, targetPath, insertBefore) {
  if (!draggedPath || !targetPath || draggedPath === targetPath) return;
  const source = findAppByPath(draggedPath);
  const dest = findAppByPath(targetPath);
  if (!source || !dest) return;

  const [movedApp] = source.category.apps.splice(source.index, 1);
  let targetIdx = dest.category.apps.findIndex(a => a.path === targetPath);
  if (targetIdx === -1) targetIdx = dest.category.apps.length;

  const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
  dest.category.apps.splice(insertIdx, 0, movedApp);

  await saveConfig();
  renderApps();
  showNotification('✅ Reordered', `Moved ${movedApp.name}`);
}

// ============================================
// ADD / EDIT APP MODAL
// ============================================

function populateCategorySelect(selectedCategory = 'DAWs') {
  const select = document.getElementById('appCategory');
  if (!select) return;
  const cats = state.appData.categories.map(c => c.name);
  if (cats.length === 0) cats.push('DAWs', 'Synths', 'Guitar & Bass', 'Audio Tools', 'Utilities');

  select.innerHTML = cats.map(c =>
    `<option value="${escapeHtml(c)}" ${c === selectedCategory ? 'selected' : ''}>${escapeHtml(c)}</option>`
  ).join('');
}

function updateIconPreview(iconVal) {
  const preview = document.getElementById('appIconPreview');
  if (!preview) return;
  const val = (iconVal || '🎵').trim();
  if (val.startsWith('data:') || val.startsWith('http')) {
    preview.innerHTML = `<img src="${escapeHtml(val)}" alt="App Icon">`;
  } else {
    preview.textContent = val || '🎵';
  }
}

function openAddAppModal() {
  populateCategorySelect('DAWs');
  document.getElementById('appModalTitle').textContent = 'Add Application';
  document.getElementById('appOriginalPath').value = '';
  document.getElementById('appName').value = '';
  document.getElementById('appManufacturer').value = '';
  document.getElementById('appPath').value = '';
  document.getElementById('appIcon').value = '🎹';
  updateIconPreview('🎹');
  const licTypeEl = document.getElementById('appLicenseType');
  const licAcctEl = document.getElementById('appLicenseAccount');
  const serialEl = document.getElementById('appSerialKey');
  if (licTypeEl) licTypeEl.value = '';
  if (licAcctEl) licAcctEl.value = '';
  if (serialEl) serialEl.value = '';
  document.getElementById('deleteAppModalBtn').style.display = 'none';
  document.getElementById('appModal').classList.add('active');
}

function openEditAppModal(appPath) {
  const found = findAppByPath(appPath);
  if (!found) return;
  const { app, category } = found;

  populateCategorySelect(category.name);
  document.getElementById('appModalTitle').textContent = 'Edit Application';
  document.getElementById('appOriginalPath').value = app.path;
  document.getElementById('appName').value = app.name || '';
  document.getElementById('appManufacturer').value = app.manufacturer || '';
  document.getElementById('appPath').value = app.path || '';
  document.getElementById('appIcon').value = app.icon || '🎵';
  updateIconPreview(app.icon || '🎵');
  const licTypeEl = document.getElementById('appLicenseType');
  const licAcctEl = document.getElementById('appLicenseAccount');
  const serialEl = document.getElementById('appSerialKey');
  if (licTypeEl) licTypeEl.value = app.licenseType || '';
  if (licAcctEl) licAcctEl.value = app.licenseAccount || '';
  if (serialEl) serialEl.value = app.serialKey || '';
  document.getElementById('deleteAppModalBtn').style.display = 'inline-block';
  document.getElementById('appModal').classList.add('active');
}

async function saveAppFromModal() {
  const origPath = document.getElementById('appOriginalPath').value;
  const name = document.getElementById('appName').value.trim();
  const manufacturer = document.getElementById('appManufacturer').value.trim() || 'Unknown';
  const appPath = document.getElementById('appPath').value.trim();
  const categoryName = document.getElementById('appCategory').value || 'Utilities';
  const icon = document.getElementById('appIcon').value.trim() || '🎹';
  const licenseType = (document.getElementById('appLicenseType')?.value || '').trim();
  const licenseAccount = (document.getElementById('appLicenseAccount')?.value || '').trim();
  const serialKey = (document.getElementById('appSerialKey')?.value || '').trim();

  if (!name || !appPath) {
    showError('Please fill in both App Name and App Path.');
    return;
  }

  let favorite = false;
  let version = '';
  let arch = 'Universal';
  if (origPath) {
    const existing = findAppByPath(origPath);
    if (existing) {
      favorite = Boolean(existing.app.favorite);
      version = existing.app.version || '';
      arch = existing.app.arch || 'Universal';
      existing.category.apps.splice(existing.index, 1);
    }
  }

  let targetCat = state.appData.categories.find(c => c.name === categoryName);
  if (!targetCat) {
    targetCat = { name: categoryName, apps: [] };
    state.appData.categories.push(targetCat);
  }

  targetCat.apps.push({
    name,
    manufacturer,
    path: appPath,
    icon,
    version,
    arch,
    favorite,
    licenseType,
    licenseAccount,
    serialKey
  });

  await saveConfig();
  closeModal('appModal');
  renderAll();
  showNotification('✅ Saved', `${name} saved in ${categoryName}`);
}

async function deleteAppByPath(appPath) {
  const found = findAppByPath(appPath);
  if (!found) return;
  if (!confirm(`Remove "${found.app.name}" from your Music App Manager library?`)) return;

  found.category.apps.splice(found.index, 1);
  await saveConfig();
  closeModal('appModal');
  renderAll();
  showNotification('🗑️ Removed', `${found.app.name} removed from library`);
}

// ============================================
// PLUGINS CATALOG (GROUPED & FLAT VIEWS)
// ============================================

function getFormatBadgeHtml(fmt) {
  const f = (fmt || 'VST').toUpperCase();
  const cls = f === 'VST3' ? 'vst3'
    : f === 'AU' ? 'au'
    : f === 'CLAP' ? 'clap'
    : f === 'AAX' ? 'aax' : 'vst';
  return `<span class="badge-format badge-format-${cls}">${escapeHtml(f)}</span>`;
}

function getArchBadgeHtml(arch) {
  const a = (arch || 'Universal').toLowerCase();
  if (a.includes('apple') || a.includes('arm64')) {
    return `<span class="badge-arch badge-arch-apple">Apple Silicon</span>`;
  }
  if (a.includes('intel') || a.includes('rosetta')) {
    return `<span class="badge-arch badge-arch-intel">Intel (Rosetta)</span>`;
  }
  if (a.includes('x64') || a.includes('win')) {
    return `<span class="badge-arch badge-arch-x64">x64</span>`;
  }
  return `<span class="badge-arch badge-arch-universal">Universal</span>`;
}

function normalizeVersionString(v) {
  return String(v || '').trim().replace(/^v/i, '');
}

function getPluginGroupKey(p) {
  return `${(p.name || '').toLowerCase().trim()}::${(p.manufacturer || 'unknown').toLowerCase().trim()}`;
}

function buildPluginDiagnosticsMap(rawPlugins) {
  const byKey = new Map();
  rawPlugins.forEach(p => {
    const key = getPluginGroupKey(p);
    if (!byKey.has(key)) {
      byKey.set(key, { formats: new Set(), versionsByFormat: [], distinctVersions: new Set() });
    }
    const entry = byKey.get(key);
    const fmt = (p.format || 'VST').toUpperCase();
    entry.formats.add(fmt);
    const ver = normalizeVersionString(p.version);
    if (ver && ver !== '-') {
      entry.distinctVersions.add(ver);
      entry.versionsByFormat.push(`${fmt}: v${ver}`);
    }
  });

  const diagMap = new Map();
  byKey.forEach((entry, key) => {
    const hasMismatch = entry.distinctVersions.size > 1;
    const hasRedundantVst2 = entry.formats.has('VST') && entry.formats.has('VST3');
    diagMap.set(key, {
      hasVersionMismatch: hasMismatch,
      hasRedundantVst2,
      versionBreakdown: entry.versionsByFormat.join(' • ')
    });
  });
  return diagMap;
}

function buildDisplayPlugins() {
  const rawPlugins = state.appData.plugins || [];
  const query = state.searchQuery.trim().toLowerCase();
  const diagMap = buildPluginDiagnosticsMap(rawPlugins);

  // Update counts on diagnostic filter pills if present
  let mismatchGroupCount = 0;
  let redundantVst2GroupCount = 0;
  diagMap.forEach(d => {
    if (d.hasVersionMismatch) mismatchGroupCount++;
    if (d.hasRedundantVst2) redundantVst2GroupCount++;
  });
  const mismatchBtn = document.querySelector('.filter-btn[data-filter="mismatch"]');
  if (mismatchBtn) {
    mismatchBtn.textContent = mismatchGroupCount > 0 ? `🔀 Version Mismatch (${mismatchGroupCount})` : '🔀 Version Mismatch';
  }
  const redundantBtn = document.querySelector('.filter-btn[data-filter="redundant-vst2"]');
  if (redundantBtn) {
    redundantBtn.textContent = redundantVst2GroupCount > 0 ? `📦 Redundant VST2 (${redundantVst2GroupCount})` : '📦 Redundant VST2';
  }

  // Filter raw plugins first
  const filteredRaw = rawPlugins.filter(p => {
    const name = (p.name || '').toLowerCase();
    const mfr = (p.manufacturer || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    const type = (p.type || 'unknown').toLowerCase();
    const format = (p.format || '').toUpperCase();
    const arch = (p.arch || '').toLowerCase();
    const diag = diagMap.get(getPluginGroupKey(p)) || { hasVersionMismatch: false, hasRedundantVst2: false };

    if (query && !name.includes(query) && !mfr.includes(query) && !notes.includes(query)) {
      return false;
    }

    const f = state.currentPluginFilter;
    if (f === 'favorites') return Boolean(p.favorite);
    if (f === 'instrument' || f === 'effect') return type === f;
    if (f === 'rosetta') return arch.includes('intel') || arch.includes('rosetta');
    if (f === 'mismatch') return diag.hasVersionMismatch;
    if (f === 'redundant-vst2') {
      return state.pluginViewMode === 'flat'
        ? (diag.hasRedundantVst2 && format === 'VST')
        : diag.hasRedundantVst2;
    }
    if (f !== 'all') return format === f.toUpperCase();
    return true;
  });

  if (state.pluginViewMode === 'flat') {
    return filteredRaw.map(p => {
      const diag = diagMap.get(getPluginGroupKey(p)) || {};
      return {
        key: p.path,
        name: p.name || 'Unknown',
        type: p.type || 'unknown',
        formats: [p.format || 'VST'],
        manufacturer: p.manufacturer || 'Unknown',
        version: p.version || '-',
        arch: p.arch || (state.platformInfo.platform === 'win32' ? 'x64' : 'Universal'),
        rating: p.rating || 0,
        favorite: Boolean(p.favorite),
        notes: p.notes || '',
        licenseType: p.licenseType || '',
        licenseAccount: p.licenseAccount || '',
        serialKey: p.serialKey || '',
        paths: [p.path],
        primaryPath: p.path,
        hasVersionMismatch: Boolean(diag.hasVersionMismatch),
        hasRedundantVst2: Boolean(diag.hasRedundantVst2 && (p.format || '').toUpperCase() === 'VST'),
        versionBreakdown: diag.versionBreakdown || ''
      };
    });
  }

  // Grouped mode: merge identical plugin name + manufacturer across formats
  const groups = new Map();
  filteredRaw.forEach(p => {
    const groupKey = getPluginGroupKey(p);
    const diag = diagMap.get(groupKey) || {};
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        name: p.name || 'Unknown',
        type: p.type || 'unknown',
        formats: [],
        manufacturer: p.manufacturer || 'Unknown',
        version: p.version || '',
        arch: p.arch || (state.platformInfo.platform === 'win32' ? 'x64' : 'Universal'),
        rating: p.rating || 0,
        favorite: Boolean(p.favorite),
        notes: p.notes || '',
        licenseType: p.licenseType || '',
        licenseAccount: p.licenseAccount || '',
        serialKey: p.serialKey || '',
        paths: [],
        primaryPath: p.path,
        hasVersionMismatch: Boolean(diag.hasVersionMismatch),
        hasRedundantVst2: Boolean(diag.hasRedundantVst2),
        versionBreakdown: diag.versionBreakdown || ''
      });
    }
    const g = groups.get(groupKey);
    const fmt = p.format || 'VST';
    if (!g.formats.includes(fmt)) g.formats.push(fmt);
    if (!g.paths.includes(p.path)) g.paths.push(p.path);
    if (p.type && p.type !== 'unknown' && g.type === 'unknown') g.type = p.type;
    if (p.version && !g.version) g.version = p.version;
    if (p.favorite) g.favorite = true;
    if ((p.rating || 0) > g.rating) g.rating = p.rating;
    if (p.notes && !g.notes) g.notes = p.notes;
    if (p.licenseType && !g.licenseType) g.licenseType = p.licenseType;
    if (p.licenseAccount && !g.licenseAccount) g.licenseAccount = p.licenseAccount;
    if (p.serialKey && !g.serialKey) g.serialKey = p.serialKey;
    if ((p.arch || '').toLowerCase().includes('intel')) g.arch = p.arch;
  });

  return Array.from(groups.values());
}

function findVendorUpdaterForManufacturer(manufacturer) {
  if (!manufacturer || manufacturer === 'Unknown') return null;
  const mfrLow = manufacturer.toLowerCase();
  const centers = getDetectedUpdateCenters();

  for (const c of centers) {
    const cName = (c.name || '').toLowerCase();
    const cMfr = (c.manufacturer || '').toLowerCase();
    if (cMfr && cMfr !== 'unknown' && (cMfr.includes(mfrLow) || mfrLow.includes(cMfr))) {
      return c;
    }
    if ((mfrLow.includes('arturia') && cName.includes('arturia')) ||
        (mfrLow.includes('cherry') && cName.includes('cherry')) ||
        (mfrLow.includes('universal audio') && cName.includes('ua connect')) ||
        (mfrLow.includes('ik multimedia') && cName.includes('product manager')) ||
        (mfrLow.includes('korg') && cName.includes('korg')) ||
        (mfrLow.includes('gforce') && cName.includes('gforce')) ||
        (mfrLow.includes('reason') && cName.includes('reason')) ||
        (mfrLow.includes('native instruments') && cName.includes('native access')) ||
        (mfrLow.includes('waves') && cName.includes('waves')) ||
        (mfrLow.includes('softube') && cName.includes('softube')) ||
        (mfrLow.includes('spitfire') && cName.includes('spitfire')) ||
        (mfrLow.includes('roland') && cName.includes('roland')) ||
        (mfrLow.includes('steinberg') && cName.includes('steinberg')) ||
        (mfrLow.includes('avid') && cName.includes('avid')) ||
        (mfrLow.includes('slate') && cName.includes('slate')) ||
        (mfrLow.includes('xln') && cName.includes('xln')) ||
        (mfrLow.includes('output') && cName.includes('output'))) {
      return c;
    }
  }
  return null;
}

function renderPluginDiagnosticsBanner(items) {
  const banner = document.getElementById('pluginDiagnosticsBanner');
  if (!banner) return;

  const f = state.currentPluginFilter;
  const mismatchItems = items.filter(i => i.hasVersionMismatch);

  if (f === 'mismatch') {
    if (state.hidePluginDiagBannerForFilter === 'mismatch') {
      banner.style.display = 'none';
      return;
    }
    const centers = getDetectedUpdateCenters();
    const pillsHtml = centers.length > 0
      ? `<div class="diag-banner-pills">
           <span class="diag-banner-pills-label">Quick-Launch Vendor Updaters:</span>
           ${centers.map(createUpdateCenterPillHtml).join('')}
         </div>`
      : '';
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="diag-banner-header">
        <div class="diag-banner-title">🔀 What does "Version Mismatch" mean &amp; how do I resolve it?</div>
        <button type="button" class="diag-banner-close-btn" data-action="close-diag-banner" title="Dismiss Guide">✕</button>
      </div>
      <div class="diag-banner-body">
        <p><strong>Don't panic — nothing is broken!</strong> A Version Mismatch simply means two formats of the same plugin on your computer (for example, the <strong>AU</strong> version used by Logic Pro and the <strong>VST3</strong> version used by Ableton/Cubase) have slightly different version numbers on disk.</p>
        <ul>
          <li><strong>Why it happens:</strong> Sometimes an installer updates only the VST3 or AU component, or two formats report slightly different internal build numbers in their metadata.</li>
          <li><strong>How to resolve it:</strong> Click any plugin row below to see which format is on an older version. If you use both formats across different DAWs, launch that manufacturer's <strong>Update Center</strong> below and run the latest update—or click <strong>📂 Reveal</strong> inside the plugin details to remove a leftover older file. After updating, click <strong>🔄 Rescan Plugins</strong>.</li>
        </ul>
        ${pillsHtml}
      </div>`;
    return;
  }

  if (f === 'redundant-vst2') {
    if (state.hidePluginDiagBannerForFilter === 'redundant-vst2') {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="diag-banner-header">
        <div class="diag-banner-title">📦 What does "Redundant VST2" mean &amp; should I remove them?</div>
        <button type="button" class="diag-banner-close-btn" data-action="close-diag-banner" title="Dismiss Guide">✕</button>
      </div>
      <div class="diag-banner-body">
        <p>These plugins have <strong>both</strong> the legacy <strong>VST (VST2)</strong> format and the modern <strong>VST3</strong> format installed on your hard drive.</p>
        <ul>
          <li><strong>How to resolve it:</strong> If all of your current DAWs use <strong>VST3</strong> or <strong>AU</strong> (and you don't need the old VST2 version for opening vintage projects), you can click any plugin below, click <strong>📂 Reveal</strong> next to its <strong>VST</strong> row, and move the old <code>.vst</code> file to the Trash to speed up DAW startup and save disk space.</li>
        </ul>
      </div>`;
    return;
  }

  if (f === 'rosetta') {
    if (state.hidePluginDiagBannerForFilter === 'rosetta') {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="diag-banner-header">
        <div class="diag-banner-title">⚠️ What does "Intel Only (Rosetta)" mean on Apple Silicon?</div>
        <button type="button" class="diag-banner-close-btn" data-action="close-diag-banner" title="Dismiss Guide">✕</button>
      </div>
      <div class="diag-banner-body">
        <p>These plugins contain <strong>Intel (x86_64)</strong> code only and require macOS Rosetta translation on Apple Silicon (M1–M5) Macs.</p>
        <ul>
          <li><strong>How to resolve it:</strong> Check the manufacturer's <strong>Update Center</strong> or website to see if a modern <strong>Apple Silicon / Universal</strong> update is available, then click <strong>🔄 Rescan Plugins</strong>.</li>
        </ul>
      </div>`;
    return;
  }

  // In "All" or other views, show a subtle one-line summary helper if any mismatches exist and the user hasn't dismissed it
  if (mismatchItems.length > 0 && localStorage.getItem('mam-hide-mismatch-hint') !== '1') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="diag-banner-compact">
        <span>💡 <strong>Tip:</strong> Seeing a <span class="plugin-diag-badge mismatch">🔀 Mismatch</span> badge? It just means two formats (e.g. AU vs VST3) of that plugin report different version numbers. Click the <strong>🔀 Version Mismatch</strong> filter button above or click any flagged plugin row for easy step-by-step resolution advice.</span>
        <button type="button" class="category-save-btn" data-action="dismiss-mismatch-hint">Got it</button>
      </div>`;
    return;
  }

  banner.style.display = 'none';
  banner.innerHTML = '';
}

function renderPlugins() {
  const tbody = document.getElementById('pluginTableBody');
  if (!tbody) return;

  // Update view mode buttons
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === state.pluginViewMode);
  });

  const items = buildDisplayPlugins();
  renderPluginDiagnosticsBanner(items);

  // Sort items across ANY column header (default: Name A–Z)
  const field = state.pluginSortField || 'name';
  const dir = state.pluginSortAsc ? 1 : -1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  items.sort((a, b) => {
    let cmp = 0;
    if (field === 'rating') {
      cmp = (a.rating || 0) - (b.rating || 0);
    } else if (field === 'favorite') {
      cmp = (a.favorite === b.favorite) ? 0 : (a.favorite ? -1 : 1);
    } else if (field === 'format') {
      const fmtA = (a.formats || []).slice().sort().join(', ');
      const fmtB = (b.formats || []).slice().sort().join(', ');
      cmp = collator.compare(fmtA, fmtB);
    } else {
      const valA = String(a[field] || '').trim();
      const valB = String(b[field] || '').trim();
      cmp = collator.compare(valA, valB);
    }
    // Secondary tie-breaker: alphabetical by name A–Z
    if (cmp === 0 && field !== 'name') {
      return collator.compare(String(a.name || ''), String(b.name || ''));
    }
    return cmp * dir;
  });

  // Update sort header indicators
  document.querySelectorAll('th.sortable').forEach(th => {
    const isCurrent = th.dataset.sort === field;
    th.classList.toggle('asc', isCurrent && state.pluginSortAsc);
    th.classList.toggle('desc', isCurrent && !state.pluginSortAsc);
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = isCurrent ? (state.pluginSortAsc ? '▲' : '▼') : '';
  });

  state.currentDisplayedPlugins = items;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          No plugins match the current filter. Go to <strong>⚙️ Tools → Scan for Plugins</strong> to populate your catalog.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const stars = item.rating ? '★'.repeat(item.rating) : '-';
    const redundantBadge = item.hasRedundantVst2
      ? `<span class="plugin-diag-badge redundant" title="Legacy VST2 is installed alongside modern VST3">📦 VST2+VST3</span>`
      : '';
    const formatsHtml = `<div class="format-badges-container">${item.formats.map(getFormatBadgeHtml).join('')}${redundantBadge}</div>`;
    const archHtml = getArchBadgeHtml(item.arch);
    const mismatchBadge = item.hasVersionMismatch
      ? `<span class="plugin-diag-badge mismatch" title="Version mismatch across formats: ${escapeHtml(item.versionBreakdown)}">🔀 Mismatch</span>`
      : '';
    const hasLicense = Boolean(item.serialKey || item.licenseType || item.licenseAccount);
    const licenseBadge = hasLicense
      ? `<span class="plugin-diag-badge license" title="License: ${escapeHtml(item.licenseType || 'Saved')}${item.licenseAccount ? ' (' + escapeHtml(item.licenseAccount) + ')' : ''}">🔑 ${escapeHtml(item.licenseType || 'Key')}</span>`
      : '';

    return `
      <tr class="plugin-row ${item.favorite ? 'favorite' : ''}" data-idx="${idx}">
        <td class="favorite-cell ${item.favorite ? 'active' : ''}" data-action="toggle-plugin-fav" style="text-align: center; cursor: pointer;">
          ${item.favorite ? '⭐' : '☆'}
        </td>
        <td><strong>${escapeHtml(item.name)}</strong> ${licenseBadge}</td>
        <td><span class="plugin-type ${escapeHtml(item.type)}">${escapeHtml(item.type)}</span></td>
        <td>${formatsHtml}</td>
        <td>${escapeHtml(item.manufacturer)}</td>
        <td style="font-size: 0.8125rem; color: var(--text-secondary);">
          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span>${escapeHtml(item.version || '-')}</span>
            ${mismatchBadge}
          </div>
        </td>
        <td>${archHtml}</td>
        <td class="rating-cell" style="text-align: center;">${stars}</td>
        <td class="plugin-notes">${escapeHtml(item.notes || '-')}</td>
        <td style="text-align: center;">
          <button type="button" class="reorder-btn" data-action="reveal-plugin" title="Show in Finder / Explorer">📂</button>
        </td>
      </tr>`;
  }).join('');
}

function openPluginModal(item) {
  if (!item) return;
  state.editingPluginGroup = item;
  document.getElementById('pluginName').value = item.name;
  const baseMeta = `${item.manufacturer} • Formats: ${item.formats.join(', ')} • ${item.paths.length} file(s)`;

  let diagHtml = '';
  const matchedUpdater = findVendorUpdaterForManufacturer(item.manufacturer);
  const updaterBtnHtml = matchedUpdater
    ? `<button type="button" class="category-save-btn" data-action="modal-launch-updater" data-path="${escapeHtml(matchedUpdater.path)}" data-name="${escapeHtml(matchedUpdater.name)}" style="margin-top: 0.45rem;">🔄 Open ${escapeHtml(matchedUpdater.name)} to Update</button>`
    : '';

  if (item.hasVersionMismatch) {
    diagHtml += `
      <div class="plugin-modal-diag-alert">
        <div><strong>🔀 Format Version Mismatch (${escapeHtml(item.versionBreakdown)})</strong></div>
        <div style="margin-top: 0.25rem; color: var(--text-secondary); font-weight: 400;">
          Your installed formats for this plugin have different version numbers. To bring them in sync, run the latest installer in the manufacturer's update app (or click <strong>📂 Reveal</strong> below to remove an outdated copy), then click <strong>🔄 Rescan Plugins</strong>.
        </div>
        ${updaterBtnHtml}
      </div>`;
  }
  if (item.hasRedundantVst2) {
    diagHtml += `
      <div class="plugin-modal-diag-alert redundant">
        <div><strong>📦 Legacy VST2 + Modern VST3 Both Installed</strong></div>
        <div style="margin-top: 0.25rem; color: var(--text-secondary); font-weight: 400;">
          You already have the modern <strong>VST3</strong> format installed. If your DAWs don't require the legacy <strong>VST</strong> format for older projects, click <strong>📂 Reveal</strong> next to the <strong>VST</strong> entry below to remove it.
        </div>
      </div>`;
  }

  document.getElementById('pluginMetaInfo').innerHTML = `${escapeHtml(baseMeta)}${diagHtml}`;

  const pathsListEl = document.getElementById('pluginFormatPathsList');
  if (pathsListEl) {
    const pathSet = new Set(item.paths || []);
    const matchedFiles = (state.appData.plugins || []).filter(p => pathSet.has(p.path));
    const entries = matchedFiles.length > 0
      ? matchedFiles
      : (item.paths || []).map((p, i) => ({ format: item.formats[i] || item.formats[0] || 'VST', path: p, version: item.version || '' }));

    pathsListEl.innerHTML = entries.map(entry => `
      <div class="plugin-format-path-row">
        ${getFormatBadgeHtml(entry.format || 'VST')}
        <span class="plugin-format-path-text" title="${escapeHtml(entry.path)}">${escapeHtml(entry.path)}</span>
        ${entry.version ? `<span class="plugin-format-path-ver">v${escapeHtml(String(entry.version).replace(/^v/i, ''))}</span>` : ''}
        <button type="button" class="reorder-btn" data-action="modal-reveal-plugin-path" data-path="${escapeHtml(entry.path)}" title="Reveal in Finder / Explorer">📂 Reveal</button>
      </div>
    `).join('');
  }

  document.getElementById('pluginNotes').value = item.notes || '';
  document.getElementById('pluginFavorite').checked = Boolean(item.favorite);
  document.getElementById('pluginRating').value = item.rating || 0;
  const pLicType = document.getElementById('pluginLicenseType');
  const pLicAcct = document.getElementById('pluginLicenseAccount');
  const pSerial = document.getElementById('pluginSerialKey');
  if (pLicType) pLicType.value = item.licenseType || '';
  if (pLicAcct) pLicAcct.value = item.licenseAccount || '';
  if (pSerial) pSerial.value = item.serialKey || '';
  updateRatingStars(item.rating || 0);
  document.getElementById('pluginModal').classList.add('active');
}

function updateRatingStars(rating) {
  document.querySelectorAll('#pluginRatingStars .star').forEach((star, i) => {
    const active = i < rating;
    star.textContent = active ? '★' : '☆';
    star.classList.toggle('active', active);
  });
}

async function savePluginFromModal() {
  const group = state.editingPluginGroup;
  if (!group) return;

  const notes = document.getElementById('pluginNotes').value.trim();
  const favorite = document.getElementById('pluginFavorite').checked;
  const rating = parseInt(document.getElementById('pluginRating').value, 10) || 0;
  const licenseType = (document.getElementById('pluginLicenseType')?.value || '').trim();
  const licenseAccount = (document.getElementById('pluginLicenseAccount')?.value || '').trim();
  const serialKey = (document.getElementById('pluginSerialKey')?.value || '').trim();
  const pathSet = new Set(group.paths);

  state.appData.plugins.forEach(p => {
    if (pathSet.has(p.path)) {
      p.notes = notes;
      p.favorite = favorite;
      p.rating = rating;
      p.licenseType = licenseType;
      p.licenseAccount = licenseAccount;
      p.serialKey = serialKey;
    }
  });

  await saveConfig();
  closeModal('pluginModal');
  renderPlugins();
  showNotification('✅ Plugin Updated', `Saved details for ${group.name}`);
}

function exportPluginsCsv() {
  const items = buildDisplayPlugins();
  if (items.length === 0) {
    showError('No plugins to export.');
    return;
  }

  const headers = ['Name', 'Manufacturer', 'Type', 'Formats', 'Version', 'Architecture', 'Rating', 'Favorite', 'Notes', 'Primary Path'];
  const csvRows = [headers.join(',')];

  const csvEscape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

  items.forEach(item => {
    csvRows.push([
      csvEscape(item.name),
      csvEscape(item.manufacturer),
      csvEscape(item.type),
      csvEscape(item.formats.join(' | ')),
      csvEscape(item.version),
      csvEscape(item.arch),
      item.rating || 0,
      item.favorite ? 'Yes' : 'No',
      csvEscape(item.notes),
      csvEscape(item.primaryPath)
    ].join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plugin-inventory-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('📄 CSV Exported', `Exported ${items.length} plugins to CSV`);
}

// ============================================
// TOOLS / SETTINGS TAB
// ============================================

function updateStatistics() {
  if (!state.appData) return;

  const totalApps = state.appData.categories.reduce((acc, c) => acc + (c.apps ? c.apps.length : 0), 0);
  const totalPluginFiles = state.appData.plugins.length;

  // Unique plugins count (by name + manufacturer)
  const uniqueKeys = new Set(
    state.appData.plugins.map(p => `${(p.name || '').toLowerCase()}::${(p.manufacturer || '').toLowerCase()}`)
  );
  const totalCategories = state.appData.categories.length;

  const elApps = document.getElementById('statApps');
  const elUniquePlugins = document.getElementById('statPlugins');
  const elPluginFiles = document.getElementById('statTotalPluginFiles');
  const elCats = document.getElementById('statCategories');

  if (elApps) elApps.textContent = totalApps;
  if (elUniquePlugins) elUniquePlugins.textContent = uniqueKeys.size;
  if (elPluginFiles) elPluginFiles.textContent = totalPluginFiles;
  if (elCats) elCats.textContent = totalCategories;
}

function updatePlatformDisplay() {
  const el = document.getElementById('platformInfo');
  if (el) {
    const p = state.platformInfo.platform === 'darwin' ? 'macOS'
      : state.platformInfo.platform === 'win32' ? 'Windows PC'
      : state.platformInfo.platform;
    el.textContent = `Platform: ${p} (${state.platformInfo.arch})`;
  }
  const verEl = document.getElementById('appVersionInfo');
  if (verEl) {
    const ver = state.platformInfo.appVersion || '2.0.1';
    verEl.innerHTML = `Version: <strong>${escapeHtml(ver)}</strong>`;
  }
}

// --- Category Manager ---
function renderCategoryManager() {
  const listEl = document.getElementById('categoryList');
  if (!listEl || !state.appData) return;

  const cats = state.appData.categories;
  if (cats.length === 0) {
    listEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.875rem;">No categories configured. Add one above!</div>`;
    return;
  }

  listEl.innerHTML = cats.map((cat, idx) => `
    <div class="category-item" data-cat-index="${idx}">
      <div class="category-reorder-btns">
        <button type="button" class="reorder-btn" data-action="cat-up" ${idx === 0 ? 'disabled' : ''} title="Move Category Up">⬆️</button>
        <button type="button" class="reorder-btn" data-action="cat-down" ${idx === cats.length - 1 ? 'disabled' : ''} title="Move Category Down">⬇️</button>
      </div>
      <input type="text" class="category-name-input" value="${escapeHtml(cat.name)}" data-orig="${escapeHtml(cat.name)}" title="Edit category name and click Save Name or press Enter">
      <button type="button" class="category-save-btn" data-action="cat-save" title="Save amended category name">💾 Save Name</button>
      <span style="color: var(--text-muted); font-size: 0.75rem; min-width: 60px; text-align: right;">${(cat.apps || []).length} apps</span>
      <button type="button" class="delete-btn" data-action="cat-delete" title="Delete Category">🗑️</button>
    </div>
  `).join('');
}

async function addNewCategoryFromInput() {
  const input = document.getElementById('newCategoryNameInput');
  if (!input) return;
  const trimmed = input.value.trim();
  if (!trimmed) {
    showError('Please enter a category name first.');
    input.focus();
    return;
  }
  if (state.appData.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
    showError(`Category "${trimmed}" already exists.`);
    return;
  }
  state.appData.categories.push({ name: trimmed, apps: [] });
  input.value = '';
  await saveConfig();
  renderAll();
  showNotification('✅ Category Added', `Created category "${trimmed}"`);
}

async function amendCategoryName(idx, newNameRaw) {
  const cats = state.appData.categories;
  const cat = cats[idx];
  if (!cat) return;
  const next = (newNameRaw || '').trim();
  const orig = cat.name;
  if (!next) {
    showError('Category name cannot be empty.');
    renderCategoryManager();
    return;
  }
  if (next === orig) return;
  if (cats.some((c, i) => i !== idx && c.name.toLowerCase() === next.toLowerCase())) {
    showError(`A category named "${next}" already exists.`);
    renderCategoryManager();
    return;
  }
  cat.name = next;
  await saveConfig();
  renderAll();
  showNotification('✏️ Category Renamed', `Renamed "${orig}" → "${next}"`);
}

// --- Custom Scan Paths ---
function renderCustomPaths() {
  const listEl = document.getElementById('customPathsList');
  if (!listEl || !state.appData) return;

  const pluginPaths = (state.appData.settings.customPluginPaths || []).map(p => ({ path: p, kind: 'plugin' }));
  const appPaths = (state.appData.settings.customAppPaths || []).map(p => ({ path: p, kind: 'app' }));
  const all = [...pluginPaths, ...appPaths];

  if (all.length === 0) {
    listEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">Using system default scan folders. Click below to add custom VST or App directories.</div>`;
    return;
  }

  listEl.innerHTML = all.map((item, idx) => `
    <div class="custom-path-item" data-path="${escapeHtml(item.path)}" data-kind="${item.kind}">
      <span class="badge-format ${item.kind === 'plugin' ? 'badge-format-vst3' : 'badge-format-au'}">${item.kind === 'plugin' ? 'Plugin Folder' : 'App Folder'}</span>
      <span style="flex: 1; font-size: 0.85rem; color: var(--text-secondary); word-break: break-all;">${escapeHtml(item.path)}</span>
      <button type="button" class="delete-btn" data-action="remove-custom-path" title="Remove Folder">🗑️</button>
    </div>
  `).join('');
}

// --- App Scanner ---
async function handleAppScan() {
  if (!state.isElectron) return;
  const btn = document.getElementById('scanAppsBtn');
  const resultsEl = document.getElementById('appScanResults');
  if (!btn || !resultsEl) return;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Scanning System Apps...';
    resultsEl.style.display = 'none';

    const scannedApps = await window.electronAPI.scanApps();

    const existingPaths = new Set();
    state.appData.categories.forEach(c => (c.apps || []).forEach(a => existingPaths.add(a.path)));

    const newApps = scannedApps.filter(a => !existingPaths.has(a.path));
    const alreadyCount = scannedApps.length - newApps.length;

    if (scannedApps.length === 0) {
      resultsEl.innerHTML = `<div class="scan-results-summary"><p>No music applications detected.</p></div>`;
      resultsEl.style.display = 'block';
      return;
    }

    if (newApps.length === 0) {
      resultsEl.innerHTML = `
        <div class="scan-results-summary">
          <p><strong>Found ${scannedApps.length} music applications</strong></p>
          <p style="color: var(--accent-primary); margin-top: 0.5rem;">✅ All ${scannedApps.length} apps are already in your library!</p>
        </div>`;
      resultsEl.style.display = 'block';
      return;
    }

    state.lastScannedApps = newApps;
    const categories = state.appData.categories.map(c => c.name);

    resultsEl.innerHTML = `
      <div class="scan-results-summary">
        <p><strong>Found ${scannedApps.length} music apps</strong> (${alreadyCount} already in library • 🆕 <strong>${newApps.length} new</strong>)</p>
      </div>
      <div class="app-scan-table-container">
        <table class="app-scan-table">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="selectAllScannedApps" checked></th>
              <th>App Name</th>
              <th>Manufacturer</th>
              <th>Category</th>
              <th>Arch</th>
              <th>Icon</th>
            </tr>
          </thead>
          <tbody>
            ${newApps.map((app, i) => `
              <tr data-scan-idx="${i}">
                <td><input type="checkbox" class="app-select-checkbox" checked data-scan-idx="${i}"></td>
                <td><input type="text" class="app-name-input" value="${escapeHtml(app.name)}"></td>
                <td><input type="text" class="app-manufacturer-input" value="${escapeHtml(app.manufacturer || 'Unknown')}"></td>
                <td>
                  <select class="app-category-select">
                    ${categories.map(c => `<option value="${escapeHtml(c)}" ${c === app.suggestedCategory ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                  </select>
                </td>
                <td>${getArchBadgeHtml(app.arch)}</td>
                <td style="text-align: center;">
                  ${app.icon && app.icon.startsWith('data:')
                    ? `<img src="${escapeHtml(app.icon)}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;">`
                    : `<span style="font-size:1.3rem;">${escapeHtml(app.icon || '🎵')}</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="scan-results-actions">
        <button type="button" id="confirmAddScannedAppsBtn" class="action-btn primary">
          <span class="btn-icon">📥</span> Add Selected Apps
        </button>
        <button type="button" id="cancelScannedAppsBtn" class="action-btn">Cancel</button>
      </div>`;

    resultsEl.style.display = 'block';
  } catch (err) {
    showError('Failed to scan apps: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🎵</span> Scan for Music Apps';
  }
}

async function confirmAddScannedApps() {
  const scanned = state.lastScannedApps || [];
  const resultsEl = document.getElementById('appScanResults');
  let added = 0;

  document.querySelectorAll('#appScanResults .app-select-checkbox:checked').forEach(cb => {
    const idx = parseInt(cb.dataset.scanIdx, 10);
    const raw = scanned[idx];
    if (!raw) return;
    const row = cb.closest('tr');
    const name = row.querySelector('.app-name-input').value.trim();
    const manufacturer = row.querySelector('.app-manufacturer-input').value.trim() || 'Unknown';
    const categoryName = row.querySelector('.app-category-select').value;

    let catObj = state.appData.categories.find(c => c.name === categoryName);
    if (!catObj) {
      catObj = { name: categoryName, apps: [] };
      state.appData.categories.push(catObj);
    }

    if (!catObj.apps.some(a => a.path === raw.path)) {
      catObj.apps.push({
        name: name || raw.name,
        manufacturer,
        path: raw.path,
        icon: raw.icon || '🎵',
        version: raw.version || '',
        arch: raw.arch || 'Universal',
        favorite: false
      });
      added++;
    }
  });

  if (added > 0) {
    await saveConfig();
    if (resultsEl) resultsEl.style.display = 'none';
    renderAll();
    showNotification('✅ Apps Imported', `Added ${added} applications to your library`);
  } else {
    showError('No applications selected.');
  }
}

// --- Plugin Scanner ---
async function handlePluginScan() {
  if (!state.isElectron) return;
  const btn = document.getElementById('scanPluginsBtn');
  const progressEl = document.getElementById('scanProgress');
  const resultsEl = document.getElementById('scanResults');

  try {
    btn.disabled = true;
    progressEl.style.display = 'flex';
    resultsEl.style.display = 'none';

    const result = await window.electronAPI.scanPlugins();
    progressEl.style.display = 'none';
    state.lastScannedPlugins = result.plugins || [];

    const existingMap = new Map(state.appData.plugins.map(p => [p.path, p]));
    const newCount = state.lastScannedPlugins.filter(p => !existingMap.has(p.path)).length;

    resultsEl.innerHTML = `
      <div class="scan-results-summary">
        <h3>✅ Plugin Scan Complete</h3>
        <p style="margin-top: 0.35rem;">Found <strong>${result.count}</strong> plugin files across ${result.scannedPaths.length} directories (${newCount} new, ${result.count - newCount} existing to update).</p>
      </div>
      <div class="scan-results-actions" style="margin-top: 1rem;">
        <button type="button" id="mergeScannedPluginsBtn" class="action-btn primary">
          <span class="btn-icon">📥</span> Sync ${result.count} Plugins to Catalog
        </button>
      </div>`;
    resultsEl.style.display = 'block';
  } catch (err) {
    progressEl.style.display = 'none';
    showError('Plugin scan failed: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function mergeScannedPlugins() {
  const scanned = state.lastScannedPlugins || [];
  if (scanned.length === 0) return;

  const existingByPath = new Map(state.appData.plugins.map(p => [p.path, p]));
  let added = 0;
  let updated = 0;

  scanned.forEach(sp => {
    if (existingByPath.has(sp.path)) {
      const ex = existingByPath.get(sp.path);
      ex.version = sp.version || ex.version || '';
      ex.arch = sp.arch || ex.arch || 'Universal';
      if ((!ex.manufacturer || ex.manufacturer === 'Unknown') && sp.manufacturer !== 'Unknown') {
        ex.manufacturer = sp.manufacturer;
      }
      if ((!ex.type || ex.type === 'unknown') && sp.type !== 'unknown') {
        ex.type = sp.type;
      }
      updated++;
    } else {
      state.appData.plugins.push(sp);
      added++;
    }
  });

  await saveConfig();
  const scanResultsEl = document.getElementById('scanResults');
  if (scanResultsEl) scanResultsEl.style.display = 'none';
  renderAll();
  switchTab('plugins');
  showNotification('✅ Catalog Synced', `Added ${added} new plugins and updated metadata for ${updated} existing plugins.`);
}

async function handleQuickRescanPlugins() {
  if (!state.isElectron) return;
  const btn = document.getElementById('quickRescanPluginsBtn');
  if (!btn) return;
  const origHtml = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Scanning...';
    const result = await window.electronAPI.scanPlugins();
    state.lastScannedPlugins = result.plugins || [];
    await mergeScannedPlugins();
  } catch (err) {
    showError('Plugin rescan failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}


// --- Maintenance: Refresh Icons, Cleanup Missing Apps & Plugins, Reset ---
async function handleRefreshIcons() {
  if (!state.isElectron) return;
  const btn = document.getElementById('refreshIconsBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Refreshing...';
  }

  let updated = 0;
  for (const cat of state.appData.categories) {
    for (const app of (cat.apps || [])) {
      if (!app.path) continue;
      try {
        const iconUrl = await window.electronAPI.extractAppIcon(app.path);
        if (iconUrl) {
          app.icon = iconUrl;
          updated++;
        }
      } catch (e) { }
    }
  }

  if (updated > 0) {
    await saveConfig();
    renderApps();
    showNotification('🖼️ Icons Refreshed', `Updated ${updated} application icon(s)`);
  } else {
    showNotification('ℹ️ Icons Up to Date', 'All application icons are current');
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🖼️</span> Refresh App Icons';
  }
}

async function handleCleanupApps() {
  if (!state.isElectron) return;
  const btn = document.getElementById('cleanupAppsBtn');
  const resultsEl = document.getElementById('cleanupResults');
  if (!btn || !resultsEl) return;

  btn.disabled = true;
  const missing = [];
  let total = 0;

  for (const cat of state.appData.categories) {
    for (const app of (cat.apps || [])) {
      total++;
      const exists = await window.electronAPI.checkAppExists(app.path);
      if (!exists) missing.push({ app, categoryName: cat.name });
    }
  }
  btn.disabled = false;

  if (missing.length === 0) {
    resultsEl.innerHTML = `
      <div class="scan-results-summary">
        <p style="color: var(--accent-primary);">✅ All ${total} applications are installed and accessible on disk!</p>
      </div>`;
    resultsEl.style.display = 'block';
    return;
  }

  state.missingAppsToClean = missing;
  resultsEl.innerHTML = `
    <div class="scan-results-summary">
      <p><strong>Found ${missing.length} missing application(s)</strong> no longer on disk:</p>
    </div>
    <div class="missing-apps-list">
      ${missing.map(m => `
        <div class="missing-app-item">
          <div>
            <strong>${escapeHtml(m.app.name)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(m.categoryName)} • ${escapeHtml(m.app.path)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="scan-results-actions">
      <button type="button" id="confirmRemoveMissingAppsBtn" class="action-btn primary">
        <span class="btn-icon">🗑️</span> Remove ${missing.length} Missing Apps
      </button>
      <button type="button" id="cancelCleanupBtn" class="action-btn">Cancel</button>
    </div>`;
  resultsEl.style.display = 'block';
}

async function handleCleanupPlugins() {
  if (!state.isElectron) return;
  const btn = document.getElementById('cleanupPluginsBtn');
  const resultsEl = document.getElementById('cleanupResults');
  if (!btn || !resultsEl) return;

  btn.disabled = true;
  const missing = [];
  const total = state.appData.plugins.length;

  for (const p of state.appData.plugins) {
    const exists = await window.electronAPI.checkAppExists(p.path);
    if (!exists) missing.push(p);
  }
  btn.disabled = false;

  if (missing.length === 0) {
    resultsEl.innerHTML = `
      <div class="scan-results-summary">
        <p style="color: var(--accent-primary);">✅ All ${total} plugin files exist on disk!</p>
      </div>`;
    resultsEl.style.display = 'block';
    return;
  }

  state.missingPluginsToClean = missing;
  resultsEl.innerHTML = `
    <div class="scan-results-summary">
      <p><strong>Found ${missing.length} uninstalled plugin file(s)</strong>:</p>
    </div>
    <div class="missing-apps-list">
      ${missing.slice(0, 25).map(p => `
        <div class="missing-app-item">
          <div>
            <strong>${escapeHtml(p.name)} (${escapeHtml(p.format)})</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(p.path)}</div>
          </div>
        </div>
      `).join('')}
      ${missing.length > 25 ? `<div style="padding: 0.5rem; color: var(--text-muted); font-size: 0.8rem;">+ ${missing.length - 25} more...</div>` : ''}
    </div>
    <div class="scan-results-actions">
      <button type="button" id="confirmRemoveMissingPluginsBtn" class="action-btn primary">
        <span class="btn-icon">🗑️</span> Remove ${missing.length} Missing Plugins
      </button>
      <button type="button" id="cancelCleanupBtn" class="action-btn">Cancel</button>
    </div>`;
  resultsEl.style.display = 'block';
}

async function handleExportConfig() {
  const json = JSON.stringify(state.appData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `music-app-manager-config-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('📤 Config Exported', 'Configuration JSON downloaded');
}

async function handleImportConfigFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.categories)) {
      showError('Invalid configuration file: missing categories list.');
      return;
    }

    const appCount = parsed.categories.reduce((sum, c) => sum + ((c.apps || []).length), 0);
    const pluginCount = Array.isArray(parsed.plugins) ? parsed.plugins.length : 0;

    if (!confirm(`Import configuration from "${file.name}"?\n\n• ${parsed.categories.length} categories (${appCount} apps)\n• ${pluginCount} plugin files\n\nThis will replace your current active library with the imported backup.`)) {
      return;
    }

    state.appData = normalizeConfig(parsed);
    await saveConfig();
    renderAll();
    showNotification('📥 Config Imported', `Restored ${appCount} apps and ${pluginCount} plugins from backup`);
  } catch (err) {
    showError('Failed to import configuration JSON: ' + err.message);
  }
}

// ============================================
// SEARCH HISTORY & NOTIFICATIONS
// ============================================

function loadSearchHistory() {
  try {
    const saved = localStorage.getItem('appviewr-search-history');
    if (saved) state.searchHistory = JSON.parse(saved);
  } catch (e) {
    state.searchHistory = [];
  }
}

function addToSearchHistory(query) {
  if (!query || query.length < 2) return;
  state.searchHistory = [query, ...state.searchHistory.filter(q => q !== query)].slice(0, MAX_SEARCH_HISTORY);
  try {
    localStorage.setItem('appviewr-search-history', JSON.stringify(state.searchHistory));
  } catch (e) { }
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
}

function switchTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  if (tabName === 'apps') renderApps();
  else if (tabName === 'plugins') renderPlugins();
  else if (tabName === 'settings') {
    updateStatistics();
    renderCategoryManager();
    renderCustomPaths();
  }
}

function showNotification(title, message) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; top: 2rem; right: 2rem;
    background: var(--bg-glass); backdrop-filter: blur(20px);
    border: 1px solid var(--border-color); border-radius: var(--radius-md);
    padding: 1.15rem 1.5rem; max-width: 380px; box-shadow: var(--shadow-lg);
    z-index: 3000; animation: slideIn 0.25s ease;
  `;
  el.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.3rem;">${escapeHtml(title)}</div>
    <div style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(message)}</div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showError(message) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; top: 2rem; right: 2rem;
    background: rgba(239, 68, 68, 0.22); backdrop-filter: blur(20px);
    border: 1px solid rgba(239, 68, 68, 0.5); border-radius: var(--radius-md);
    padding: 1.15rem 1.5rem; max-width: 400px; box-shadow: var(--shadow-lg);
    z-index: 3000; color: #fca5a5;
  `;
  el.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.3rem;">⚠️ Error</div>
    <div style="font-size: 0.85rem;">${escapeHtml(message)}</div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}


// ============================================
// UNIFIED EVENT DELEGATION & BINDINGS
// ============================================

function bindAllEvents() {
  // 1. Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 2. Search Input + Clear Button
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-clear-btn';
    clearBtn.innerHTML = '✕';
    clearBtn.style.display = 'none';
    searchInput.parentElement.appendChild(clearBtn);

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      clearBtn.style.display = 'none';
      if (state.currentTab === 'apps') renderApps();
      else if (state.currentTab === 'plugins') renderPlugins();
    });

    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      clearBtn.style.display = state.searchQuery ? 'flex' : 'none';
      if (state.currentTab === 'apps') renderApps();
      else if (state.currentTab === 'plugins') renderPlugins();
    });

    searchInput.addEventListener('change', (e) => {
      addToSearchHistory(e.target.value.trim());
    });
  }

  // 3. Apps Toolbar (Quick Filters, View Toggle, Add App, Edit Mode)
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentAppFilter = btn.dataset.filter;
      document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderApps();
    });
  });

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentAppView = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderApps();
    });
  });

  document.getElementById('addAppBtn')?.addEventListener('click', openAddAppModal);
  document.getElementById('editModeBtn')?.addEventListener('click', toggleEditMode);

  // Update & License Centers Quick-Launch Hub delegation on Settings tab
  document.getElementById('settingsUpdateCentersBar')?.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-action="launch-updater"]');
    if (pill) {
      launchApp(pill.dataset.path, pill.dataset.name);
    }
  });

  // 4. Apps Container Event Delegation (Click, Category & Card Drag-and-Drop, Right-Click Context Menu)
  const appsContainer = document.getElementById('appsContainer');
  if (appsContainer) {
    appsContainer.addEventListener('click', async (e) => {
      // Category Up/Down buttons on the Apps dashboard
      const catUpBtn = e.target.closest('[data-action="dash-cat-up"]');
      const catDownBtn = e.target.closest('[data-action="dash-cat-down"]');
      if (catUpBtn || catDownBtn) {
        e.stopPropagation();
        const idx = parseInt((catUpBtn || catDownBtn).dataset.catIndex, 10);
        const cats = state.appData.categories;
        if (catUpBtn && idx > 0) {
          [cats[idx - 1], cats[idx]] = [cats[idx], cats[idx - 1]];
          await saveConfig();
          renderAll();
          showNotification('📂 Category Moved', `Moved "${cats[idx - 1].name}" up`);
        } else if (catDownBtn && idx < cats.length - 1) {
          [cats[idx + 1], cats[idx]] = [cats[idx], cats[idx + 1]];
          await saveConfig();
          renderAll();
          showNotification('📂 Category Moved', `Moved "${cats[idx + 1].name}" down`);
        }
        return;
      }

      const card = e.target.closest('.app-card');
      if (!card) return;
      const appPath = card.dataset.path;
      const appName = card.dataset.name;

      if (e.target.closest('[data-action="favorite-app"]')) {
        e.stopPropagation();
        toggleAppFavorite(appPath);
        return;
      }

      if (e.target.closest('[data-action="edit-app"]') || state.editMode) {
        e.stopPropagation();
        openEditAppModal(appPath);
        return;
      }

      launchApp(appPath, appName);
    });

    // Context menu on app cards
    appsContainer.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.app-card');
      if (!card) return;
      e.preventDefault();
      state.contextMenuAppPath = card.dataset.path;
      const menu = document.getElementById('appContextMenu');
      if (menu) {
        menu.style.display = 'block';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 210)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 220)}px`;
      }
    });

    // HTML5 Drag & Drop for BOTH App Cards and Category Sections
    appsContainer.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.app-card');
      if (card) {
        if (!state.editMode) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        state.draggedAppPath = card.dataset.path;
        state.draggedCategoryName = null;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        return;
      }

      const catSection = e.target.closest('.category[data-category]');
      if (catSection && state.currentAppView === 'category') {
        state.draggedCategoryName = catSection.dataset.category;
        state.draggedAppPath = null;
        catSection.classList.add('category-dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    appsContainer.addEventListener('dragend', () => {
      document.querySelectorAll('.app-card').forEach(c => {
        c.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
      });
      document.querySelectorAll('.category').forEach(cat => {
        cat.classList.remove('category-dragging', 'category-drag-over-top', 'category-drag-over-bottom');
      });
      state.draggedAppPath = null;
      state.draggedCategoryName = null;
    });

    appsContainer.addEventListener('dragover', (e) => {
      // Case 1: Dragging a Category section
      if (state.draggedCategoryName) {
        const targetCat = e.target.closest('.category[data-category]');
        if (!targetCat || targetCat.dataset.category === state.draggedCategoryName) return;
        e.preventDefault();
        const rect = targetCat.getBoundingClientRect();
        const isTop = e.clientY < rect.top + rect.height / 2;
        document.querySelectorAll('.category').forEach(c => {
          c.classList.remove('category-drag-over-top', 'category-drag-over-bottom');
        });
        targetCat.classList.add(isTop ? 'category-drag-over-top' : 'category-drag-over-bottom');
        return;
      }

      // Case 2: Dragging an App Card (in Edit Mode)
      if (state.editMode && state.draggedAppPath) {
        const card = e.target.closest('.app-card');
        if (card && card.dataset.path !== state.draggedAppPath) {
          e.preventDefault();
          const rect = card.getBoundingClientRect();
          const isLeft = e.clientX < rect.left + rect.width / 2;
          document.querySelectorAll('.app-card').forEach(c => c.classList.remove('drag-over-left', 'drag-over-right'));
          card.classList.add(isLeft ? 'drag-over-left' : 'drag-over-right');
          return;
        }
        const catSection = e.target.closest('.category[data-category]');
        if (catSection) {
          e.preventDefault();
        }
      }
    });

    appsContainer.addEventListener('drop', async (e) => {
      // Case 1: Dropping a Category section
      if (state.draggedCategoryName) {
        const targetCat = e.target.closest('.category[data-category]');
        if (!targetCat || targetCat.dataset.category === state.draggedCategoryName) return;
        e.preventDefault();
        const rect = targetCat.getBoundingClientRect();
        const isTop = e.clientY < rect.top + rect.height / 2;
        await reorderCategory(state.draggedCategoryName, targetCat.dataset.category, isTop);
        return;
      }

      // Case 2: Dropping an App Card
      if (state.editMode && state.draggedAppPath) {
        const card = e.target.closest('.app-card');
        if (card && card.dataset.path !== state.draggedAppPath) {
          e.preventDefault();
          const rect = card.getBoundingClientRect();
          const isLeft = e.clientX < rect.left + rect.width / 2;
          await reorderApp(state.draggedAppPath, card.dataset.path, isLeft);
          return;
        }
        // Dropping onto a Category section (moves app to that category)
        const catSection = e.target.closest('.category[data-category]');
        if (catSection) {
          e.preventDefault();
          const targetCatName = catSection.dataset.category;
          const source = findAppByPath(state.draggedAppPath);
          const destCat = state.appData.categories.find(c => c.name === targetCatName);
          if (source && destCat && source.category.name !== targetCatName) {
            const [movedApp] = source.category.apps.splice(source.index, 1);
            destCat.apps.push(movedApp);
            await saveConfig();
            renderAll();
            showNotification('✅ Moved App', `Moved ${movedApp.name} to ${targetCatName}`);
          }
        }
      }
    });
  }

  // 5. Floating Context Menu Actions
  const ctxMenu = document.getElementById('appContextMenu');
  if (ctxMenu) {
    ctxMenu.addEventListener('click', async (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item || !state.contextMenuAppPath) return;
      const action = item.dataset.action;
      const appPath = state.contextMenuAppPath;
      const found = findAppByPath(appPath);
      ctxMenu.style.display = 'none';

      if (action === 'launch' && found) launchApp(appPath, found.app.name);
      else if (action === 'favorite') toggleAppFavorite(appPath);
      else if (action === 'edit') openEditAppModal(appPath);
      else if (action === 'reveal' && state.isElectron) {
        await window.electronAPI.showItemInFolder(appPath);
      } else if (action === 'delete') deleteAppByPath(appPath);
    });

    document.addEventListener('click', () => {
      ctxMenu.style.display = 'none';
    });
  }

  // 6. Plugins Toolbar, Sorting & Table Delegation
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPluginFilter = btn.dataset.filter;
      state.hidePluginDiagBannerForFilter = null;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderPlugins();
    });
  });

  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.pluginViewMode = btn.dataset.mode;
      state.appData.settings.pluginViewMode = state.pluginViewMode;
      await saveConfig();
      renderPlugins();
    });
  });

  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (state.pluginSortField === sortKey) {
        state.pluginSortAsc = !state.pluginSortAsc;
      } else {
        state.pluginSortField = sortKey;
        state.pluginSortAsc = true;
      }
      renderPlugins();
    });
  });

  document.getElementById('quickRescanPluginsBtn')?.addEventListener('click', handleQuickRescanPlugins);
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportPluginsCsv);

  document.getElementById('pluginDiagnosticsBanner')?.addEventListener('click', (e) => {
    const closeGuideBtn = e.target.closest('[data-action="close-diag-banner"]');
    if (closeGuideBtn) {
      state.hidePluginDiagBannerForFilter = state.currentPluginFilter;
      renderPlugins();
      return;
    }
    const dismissBtn = e.target.closest('[data-action="dismiss-mismatch-hint"]');
    if (dismissBtn) {
      localStorage.setItem('mam-hide-mismatch-hint', '1');
      renderPlugins();
      return;
    }
    const pill = e.target.closest('[data-action="launch-updater"]');
    if (pill) {
      launchApp(pill.dataset.path, pill.dataset.name);
    }
  });

  const pluginTbody = document.getElementById('pluginTableBody');
  if (pluginTbody) {
    pluginTbody.addEventListener('click', async (e) => {
      const row = e.target.closest('.plugin-row');
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      const item = (state.currentDisplayedPlugins || [])[idx];
      if (!item) return;

      if (e.target.closest('[data-action="reveal-plugin"]')) {
        e.stopPropagation();
        if (state.isElectron && item.primaryPath) {
          await window.electronAPI.showItemInFolder(item.primaryPath);
        }
        return;
      }

      if (e.target.closest('[data-action="toggle-plugin-fav"]')) {
        e.stopPropagation();
        const newFav = !item.favorite;
        const pathSet = new Set(item.paths);
        state.appData.plugins.forEach(p => {
          if (pathSet.has(p.path)) p.favorite = newFav;
        });
        await saveConfig();
        renderPlugins();
        return;
      }

      openPluginModal(item);
    });
  }

  // 7. Modals (Add/Edit App, Edit Plugin, Welcome)
  document.getElementById('appModalCloseBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal('appModal');
  });
  document.getElementById('appModalCancelBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal('appModal');
  });
  document.getElementById('appModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'appModal') closeModal('appModal');
  });
  document.getElementById('saveAppBtn')?.addEventListener('click', saveAppFromModal);
  document.getElementById('deleteAppModalBtn')?.addEventListener('click', () => {
    const orig = document.getElementById('appOriginalPath').value;
    if (orig) deleteAppByPath(orig);
  });
  document.getElementById('copyAppSerialBtn')?.addEventListener('click', async () => {
    const val = (document.getElementById('appSerialKey')?.value || '').trim();
    if (!val) {
      showError('No serial number entered to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(val);
      showNotification('📋 Copied', 'Serial key copied to clipboard');
    } catch (e) { }
  });

  document.getElementById('browseAppBtn')?.addEventListener('click', async () => {
    if (!state.isElectron) return;
    const selected = await window.electronAPI.selectAppFile();
    if (selected) {
      document.getElementById('appPath').value = selected;
      const base = selected.split(/[/\\]/).pop().replace(/\.(app|exe)$/i, '');
      if (!document.getElementById('appName').value) {
        document.getElementById('appName').value = base;
      }
      const iconData = await window.electronAPI.extractAppIcon(selected);
      if (iconData) {
        document.getElementById('appIcon').value = iconData;
        updateIconPreview(iconData);
      }
    }
  });

  document.getElementById('appIcon')?.addEventListener('input', (e) => {
    updateIconPreview(e.target.value);
  });

  document.getElementById('uploadIconBtn')?.addEventListener('click', () => {
    document.getElementById('appIconFileInput')?.click();
  });

  document.getElementById('appIconFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('appIcon').value = ev.target.result;
      updateIconPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  });

  // Plugin Modal
  document.getElementById('pluginModalCloseBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal('pluginModal');
  });
  document.getElementById('pluginModalCancelBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal('pluginModal');
  });
  document.getElementById('pluginModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'pluginModal') closeModal('pluginModal');
  });
  document.getElementById('savePluginBtn')?.addEventListener('click', savePluginFromModal);
  document.getElementById('copyPluginSerialBtn')?.addEventListener('click', async () => {
    const val = (document.getElementById('pluginSerialKey')?.value || '').trim();
    if (!val) {
      showError('No serial number entered to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(val);
      showNotification('📋 Copied', 'Serial key copied to clipboard');
    } catch (e) { }
  });
  document.getElementById('pluginMetaInfo')?.addEventListener('click', (e) => {
    const updaterBtn = e.target.closest('[data-action="modal-launch-updater"]');
    if (updaterBtn && updaterBtn.dataset.path) {
      launchApp(updaterBtn.dataset.path, updaterBtn.dataset.name);
    }
  });
  document.getElementById('pluginFormatPathsList')?.addEventListener('click', async (e) => {
    const revealBtn = e.target.closest('[data-action="modal-reveal-plugin-path"]');
    if (revealBtn && state.isElectron && revealBtn.dataset.path) {
      await window.electronAPI.showItemInFolder(revealBtn.dataset.path);
    }
  });

  document.querySelectorAll('#pluginRatingStars .star').forEach(star => {
    star.addEventListener('click', () => {
      const r = parseInt(star.dataset.rating, 10);
      document.getElementById('pluginRating').value = r;
      updateRatingStars(r);
    });
  });

  // Welcome Modal
  document.getElementById('welcomeStartBtn')?.addEventListener('click', () => {
    hideWelcomeModal();
    switchTab('settings');
  });
  document.getElementById('welcomeDismissBtn')?.addEventListener('click', hideWelcomeModal);

  // 8. Tools / Settings Tab Actions
  document.getElementById('scanAppsBtn')?.addEventListener('click', handleAppScan);
  document.getElementById('scanPluginsBtn')?.addEventListener('click', handlePluginScan);
  document.getElementById('refreshIconsBtn')?.addEventListener('click', handleRefreshIcons);
  document.getElementById('cleanupAppsBtn')?.addEventListener('click', handleCleanupApps);
  document.getElementById('cleanupPluginsBtn')?.addEventListener('click', handleCleanupPlugins);
  document.getElementById('exportConfigBtn')?.addEventListener('click', handleExportConfig);
  document.getElementById('importConfigBtn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('importConfigFileInput');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });
  document.getElementById('importConfigFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      await handleImportConfigFile(file);
    }
  });
  document.getElementById('openUserGuideBtn')?.addEventListener('click', async () => {
    if (state.isElectron && window.electronAPI.openUserGuide) {
      const res = await window.electronAPI.openUserGuide();
      if (res && res.success === false) {
        showError('Could not open User Guide: ' + (res.error || ''));
      }
    } else {
      window.open('../docs/user-guide.html', '_blank');
    }
  });

  // Delegated actions inside Tools tab (Scan Results, Category Manager, Custom Paths, Cleanup)
  const settingsTab = document.getElementById('settingsTab');
  if (settingsTab) {
    settingsTab.addEventListener('click', async (e) => {
      if (e.target.closest('#confirmAddScannedAppsBtn')) {
        await confirmAddScannedApps();
      } else if (e.target.closest('#cancelScannedAppsBtn')) {
        document.getElementById('appScanResults').style.display = 'none';
      } else if (e.target.closest('#mergeScannedPluginsBtn')) {
        await mergeScannedPlugins();
      } else if (e.target.closest('#confirmRemoveMissingAppsBtn')) {
        const missing = state.missingAppsToClean || [];
        const removeSet = new Set(missing.map(m => m.app.path));
        state.appData.categories.forEach(c => {
          c.apps = (c.apps || []).filter(a => !removeSet.has(a.path));
        });
        await saveConfig();
        document.getElementById('cleanupResults').style.display = 'none';
        renderAll();
        showNotification('🗑️ Cleaned Up', `Removed ${missing.length} missing application(s)`);
      } else if (e.target.closest('#confirmRemoveMissingPluginsBtn')) {
        const missing = state.missingPluginsToClean || [];
        const removeSet = new Set(missing.map(p => p.path));
        state.appData.plugins = state.appData.plugins.filter(p => !removeSet.has(p.path));
        await saveConfig();
        document.getElementById('cleanupResults').style.display = 'none';
        renderAll();
        showNotification('🗑️ Cleaned Up', `Removed ${missing.length} missing plugin file(s)`);
      } else if (e.target.closest('#cancelCleanupBtn')) {
        document.getElementById('cleanupResults').style.display = 'none';
      }

      // Category Manager buttons (Up, Down, Save Name, Delete)
      const catItem = e.target.closest('.category-item');
      if (catItem) {
        const idx = parseInt(catItem.dataset.catIndex, 10);
        const cats = state.appData.categories;
        if (e.target.closest('[data-action="cat-up"]') && idx > 0) {
          [cats[idx - 1], cats[idx]] = [cats[idx], cats[idx - 1]];
          await saveConfig();
          renderAll();
        } else if (e.target.closest('[data-action="cat-down"]') && idx < cats.length - 1) {
          [cats[idx + 1], cats[idx]] = [cats[idx], cats[idx + 1]];
          await saveConfig();
          renderAll();
        } else if (e.target.closest('[data-action="cat-save"]')) {
          const input = catItem.querySelector('.category-name-input');
          if (input) {
            await amendCategoryName(idx, input.value);
          }
        } else if (e.target.closest('[data-action="cat-delete"]')) {
          const cat = cats[idx];
          if (cat && confirm(`Delete category "${cat.name}" (${(cat.apps || []).length} apps)?`)) {
            cats.splice(idx, 1);
            await saveConfig();
            renderAll();
            showNotification('🗑️ Category Deleted', `Removed "${cat.name}"`);
          }
        }
      }

      // Custom path removal
      const pathItem = e.target.closest('.custom-path-item');
      if (pathItem && e.target.closest('[data-action="remove-custom-path"]')) {
        const p = pathItem.dataset.path;
        const kind = pathItem.dataset.kind;
        if (kind === 'plugin') {
          state.appData.settings.customPluginPaths = state.appData.settings.customPluginPaths.filter(x => x !== p);
        } else {
          state.appData.settings.customAppPaths = state.appData.settings.customAppPaths.filter(x => x !== p);
        }
        await saveConfig();
        renderCustomPaths();
      }
    });

    // Select all checkbox in App Scan results & Category rename on Enter/blur
    settingsTab.addEventListener('change', (e) => {
      if (e.target.id === 'selectAllScannedApps') {
        const checked = e.target.checked;
        document.querySelectorAll('#appScanResults .app-select-checkbox').forEach(cb => {
          cb.checked = checked;
        });
      } else if (e.target.classList.contains('category-name-input')) {
        const catItem = e.target.closest('.category-item');
        if (catItem) {
          const idx = parseInt(catItem.dataset.catIndex, 10);
          amendCategoryName(idx, e.target.value);
        }
      }
    });

    settingsTab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('category-name-input')) {
        e.preventDefault();
        e.target.blur();
      }
    });
  }

  // Add Category button & Enter key in #newCategoryNameInput
  document.getElementById('addCategoryBtn')?.addEventListener('click', addNewCategoryFromInput);
  document.getElementById('newCategoryNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewCategoryFromInput();
    }
  });

  // Add Custom Folders
  document.getElementById('addCustomPluginPathBtn')?.addEventListener('click', async () => {
    if (!state.isElectron) return;
    const dir = await window.electronAPI.selectDirectory();
    if (dir && !state.appData.settings.customPluginPaths.includes(dir)) {
      state.appData.settings.customPluginPaths.push(dir);
      await saveConfig();
      renderCustomPaths();
      showNotification('📁 Folder Added', `Added plugin scan folder: ${dir}`);
    }
  });

  document.getElementById('addCustomAppPathBtn')?.addEventListener('click', async () => {
    if (!state.isElectron) return;
    const dir = await window.electronAPI.selectDirectory();
    if (dir && !state.appData.settings.customAppPaths.includes(dir)) {
      state.appData.settings.customAppPaths.push(dir);
      await saveConfig();
      renderCustomPaths();
      showNotification('📁 Folder Added', `Added app scan folder: ${dir}`);
    }
  });

  // Scan progress listener
  if (state.isElectron && window.electronAPI.onScanProgress) {
    window.electronAPI.onScanProgress((data) => {
      const txt = document.querySelector('#scanProgress .progress-text');
      if (txt) txt.textContent = `Scanning... ${data.count} items found (${data.current || ''})`;
    });
  }

  // 9. Keyboard Shortcuts
  document.getElementById('closeShortcutsBtn')?.addEventListener('click', () => {
    document.getElementById('shortcutsOverlay').style.display = 'none';
  });

  document.addEventListener('keydown', (e) => {
    const isMac = state.platformInfo.platform === 'darwin';
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (mod) {
      if (e.key === '1') { e.preventDefault(); switchTab('apps'); }
      else if (e.key === '2') { e.preventDefault(); switchTab('plugins'); }
      else if (e.key === '3') { e.preventDefault(); switchTab('settings'); }
      else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
      } else if (e.key.toLowerCase() === 'n' && state.currentTab === 'apps') {
        e.preventDefault();
        openAddAppModal();
      } else if (e.key.toLowerCase() === 'e' && state.currentTab === 'apps') {
        e.preventDefault();
        toggleEditMode();
      } else if (e.key === '?') {
        e.preventDefault();
        document.getElementById('shortcutsOverlay').style.display = 'flex';
      }
    }

    if (e.key === 'Escape') {
      closeModal('appModal');
      closeModal('pluginModal');
      hideWelcomeModal();
      document.getElementById('shortcutsOverlay').style.display = 'none';
      const ctx = document.getElementById('appContextMenu');
      if (ctx) ctx.style.display = 'none';
    }
  });
}
