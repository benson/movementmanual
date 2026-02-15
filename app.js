// Movement Manual App

let data = null;
let selectedGoals = new Set();
let selectedMuscles = new Set();
let selectedContras = new Set();
let searchQuery = '';
let selectedSpringColors = new Set();
let selectedSpringCombos = new Set();
let currentMode = localStorage.getItem('mode') || 'mat';

// ============ Theme ============

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (theme === 'dark') {
    btn.innerHTML = '<span class="theme-icon">☼</span> light';
  } else {
    btn.innerHTML = '<span class="theme-icon">☽</span> dark';
  }
}

// ============ Data Loading ============

async function loadData() {
  const file = currentMode === 'reformer' ? './data/reformer-exercises.json' : './data/exercises.json';
  const response = await fetch(file);
  data = await response.json();
  return data;
}

function getImagePath(filename) {
  return currentMode === 'reformer' ? `./reformer-images/${filename}` : `./images/${filename}`;
}

function getTagName(category, id) {
  return data.tags[category]?.[id] || id;
}

function parseSpringTension(tension) {
  if (!tension) return { colors: new Set(), combo: '' };
  if (tension.toLowerCase().includes('all springs')) {
    return { colors: new Set(['R', 'Y', 'B']), combo: 'all springs' };
  }
  let combo = tension;
  const pipe = tension.indexOf('|');
  if (pipe !== -1) combo = tension.substring(pipe + 1).trim();
  combo = combo
    .replace(/,?\s*(foundation|beginner)\s+springs?:?\s*.*/gi, '')
    .replace(/\|.*$/i, '')
    .replace(/^High:\s*/i, '')
    .trim();
  const colors = new Set();
  if (/R/.test(combo)) colors.add('R');
  if (/Y/.test(combo)) colors.add('Y');
  if (/B/.test(combo)) colors.add('B');
  return { colors, combo };
}

const SERIES_ORIENTATION = {
  'footwork': 'supine', 'bridges': 'supine', 'feet-in-straps': 'supine',
  'hands-in-straps': 'supine', 'supine-abdominal-series': 'supine',
  'side-lying': 'side-lying',
  'well-facing-arms': 'well-facing', 'reverse-abdominals': 'well-facing',
  'roll-down-with-straps': 'well-facing',
  'forward-facing-arms': 'forward-facing',
  'side-facing-arms': 'side-facing',
  'planks': 'plank',
  'standing-series': 'standing', 'lunge-series': 'standing',
  'short-box': 'short-box', 'long-box': 'long-box',
  'stretches': 'stretches', 'jumpboard': 'jumpboard'
};

const ORIENTATION_NAMES = {
  'supine': 'Supine', 'side-lying': 'Side Lying',
  'well-facing': 'Well Facing', 'forward-facing': 'Forward Facing',
  'side-facing': 'Side Facing', 'plank': 'Plank',
  'standing': 'Standing', 'short-box': 'Short Box',
  'long-box': 'Long Box', 'stretches': 'Stretches', 'jumpboard': 'Jumpboard'
};

function prepareReformerData() {
  if (currentMode !== 'reformer') return;
  data.exercises.forEach(ex => {
    ex._springs = parseSpringTension(ex.springTension);
    ex._orientation = SERIES_ORIENTATION[ex.series] || 'other';
  });
  const combos = new Set();
  const orientations = new Set();
  data.exercises.forEach(ex => {
    if (ex._springs.combo) combos.add(ex._springs.combo);
    orientations.add(ex._orientation);
  });
  data._springCombos = [...combos].sort();
  data._orientations = [...orientations].sort((a, b) =>
    (ORIENTATION_NAMES[a] || a).localeCompare(ORIENTATION_NAMES[b] || b)
  );
}

// ============ Multi-Select Dropdowns ============

const multiSelects = {};

function setupMultiSelect({ key, toggleId, dropdownId, optionsId, labelId, selectedSet, entries, nameMap }) {
  const toggle = document.getElementById(toggleId);
  const dropdown = document.getElementById(dropdownId);
  const options = document.getElementById(optionsId);
  const label = document.getElementById(labelId);

  selectedSet.clear();
  options.innerHTML = '';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'multi-select-clear';
  clearBtn.textContent = 'clear all';
  clearBtn.addEventListener('click', () => {
    selectedSet.clear();
    options.querySelectorAll('input').forEach(cb => cb.checked = false);
    updateMultiSelectDisplay(key);
    applyFilters();
  });
  options.appendChild(clearBtn);

  entries.forEach(([id, name]) => {
    const option = document.createElement('label');
    option.className = 'multi-select-option';
    option.innerHTML = `
      <input type="checkbox" value="${id}">
      ${name.toLowerCase()}
    `;
    options.appendChild(option);

    option.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedSet.add(id);
      } else {
        selectedSet.delete(id);
      }
      updateMultiSelectDisplay(key);
      applyFilters();
    });
  });

  if (!toggle._bound) {
    toggle.addEventListener('click', () => {
      dropdown.classList.toggle('hidden');
    });
    toggle._bound = true;
  }

  label.textContent = 'none selected';

  multiSelects[key] = { toggle, dropdown, label, selectedSet, nameMap };
}

function updateMultiSelectDisplay(key) {
  const ms = multiSelects[key];
  if (!ms) return;
  const { label, selectedSet, nameMap } = ms;
  if (selectedSet.size === 0) {
    label.textContent = 'none selected';
  } else if (selectedSet.size <= 2) {
    label.textContent = [...selectedSet].map(id => nameMap(id)).join(', ');
  } else {
    label.textContent = `${selectedSet.size} selected`;
  }
}

// Single document click listener to close all open multi-select dropdowns
document.addEventListener('click', (e) => {
  Object.values(multiSelects).forEach(({ toggle, dropdown }) => {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
  // Also close search autocomplete
  if (!e.target.closest('.autocomplete-wrapper')) {
    const sd = document.getElementById('search-dropdown');
    if (sd) sd.classList.add('hidden');
  }
});

function switchToFilter(filterType, value) {
  selectedGoals.clear();
  selectedMuscles.clear();
  document.getElementById('filter-position').value = '';
  if (currentMode === 'reformer') {
    document.getElementById('filter-orientation').value = '';
  }
  document.getElementById('exercise-search').value = '';
  searchQuery = '';
  selectedSpringColors.clear();
  selectedSpringCombos.clear();

  // Uncheck all multi-select checkboxes
  Object.keys(multiSelects).forEach(k => {
    const opts = document.getElementById(multiSelects[k].toggle.id.replace('-toggle', '-options'));
    if (opts) opts.querySelectorAll('input').forEach(cb => cb.checked = false);
    updateMultiSelectDisplay(k);
  });
  document.querySelectorAll('.spring-toggle').forEach(b => b.classList.remove('active'));

  if (filterType === 'goals') {
    selectedGoals.add(value);
    const cb = document.querySelector(`#goals-options input[value="${value}"]`);
    if (cb) cb.checked = true;
    updateMultiSelectDisplay('goals');
  } else if (filterType === 'muscleGroups') {
    selectedMuscles.add(value);
    const cb = document.querySelector(`#muscles-options input[value="${value}"]`);
    if (cb) cb.checked = true;
    updateMultiSelectDisplay('muscles');
  } else if (filterType === 'startingPositions') {
    document.getElementById('filter-position').value = value;
  } else if (filterType === 'orientation') {
    document.getElementById('filter-orientation').value = value;
  }

  hideModal();
  applyFilters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ Mode Toggle ============

function setupModeToggle() {
  const btns = document.querySelectorAll('.mode-btn');

  btns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });

  btns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.mode === currentMode) return;

      currentMode = btn.dataset.mode;
      localStorage.setItem('mode', currentMode);

      btns.forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));

      await switchMode();
    });
  });
}

async function switchMode() {
  selectedGoals.clear();
  selectedMuscles.clear();
  selectedContras.clear();
  selectedSpringColors.clear();
  selectedSpringCombos.clear();
  searchQuery = '';
  document.getElementById('exercise-search').value = '';
  document.getElementById('mobile-search-input').value = '';

  await loadData();
  rebuildFilters();
  setupMobileSticky();
  applyFilters();
}

// ============ View Toggle ============

function setupViewToggle() {
  const toggleBtns = document.querySelectorAll('.view-toggle .toggle-btn');
  const grid = document.getElementById('browse-grid');
  const listHeader = document.getElementById('list-header');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;

      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      grid.classList.toggle('list-view', view === 'list');
      listHeader.classList.toggle('hidden', view !== 'list');
    });
  });
}

// ============ Browse Mode (Filter-First) ============

function rebuildFilters() {
  const positionSelect = document.getElementById('filter-position');

  while (positionSelect.options.length > 1) positionSelect.remove(1);
  positionSelect.value = '';

  Object.entries(data.tags.startingPositions).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name.toLowerCase();
    positionSelect.appendChild(option);
  });

  setupMultiSelect({
    key: 'goals', toggleId: 'goals-toggle', dropdownId: 'goals-dropdown',
    optionsId: 'goals-options', labelId: 'goals-label',
    selectedSet: selectedGoals,
    entries: Object.entries(data.tags.goals),
    nameMap: id => data.tags.goals[id].toLowerCase()
  });

  setupMultiSelect({
    key: 'muscles', toggleId: 'muscles-toggle', dropdownId: 'muscles-dropdown',
    optionsId: 'muscles-options', labelId: 'muscles-label',
    selectedSet: selectedMuscles,
    entries: Object.entries(data.tags.muscleGroups),
    nameMap: id => data.tags.muscleGroups[id].toLowerCase()
  });

  setupMultiSelect({
    key: 'contras', toggleId: 'contra-toggle', dropdownId: 'contra-dropdown',
    optionsId: 'contra-options', labelId: 'contra-label',
    selectedSet: selectedContras,
    entries: Object.entries(data.tags.contraindications),
    nameMap: id => data.tags.contraindications[id].toLowerCase().replace(/^acute /, '').split(' ')[0]
  });

  // Show/hide reformer-only filters
  document.querySelectorAll('.reformer-only').forEach(el => {
    el.classList.toggle('hidden', currentMode !== 'reformer');
  });

  if (currentMode === 'reformer') {
    prepareReformerData();

    const orientationSelect = document.getElementById('filter-orientation');
    while (orientationSelect.options.length > 1) orientationSelect.remove(1);
    orientationSelect.value = '';
    data._orientations.forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = (ORIENTATION_NAMES[id] || id).toLowerCase();
      orientationSelect.appendChild(option);
    });

    setupMultiSelect({
      key: 'springCombo', toggleId: 'spring-combo-toggle', dropdownId: 'spring-combo-dropdown',
      optionsId: 'spring-combo-options', labelId: 'spring-combo-label',
      selectedSet: selectedSpringCombos,
      entries: data._springCombos.map(c => [c, c]),
      nameMap: id => id.toLowerCase()
    });

    setupSpringColorToggles();
  }
}

function populateFilters() {
  rebuildFilters();

  ['filter-position', 'filter-orientation'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const positionFilter = document.getElementById('filter-position').value;

  let filtered = data.exercises;

  if (searchQuery) {
    filtered = filtered.filter(ex =>
      ex.name.toLowerCase().includes(searchQuery)
    );
  }

  if (selectedGoals.size > 0) {
    filtered = filtered.filter(ex => ex.goals.some(g => selectedGoals.has(g)));
  }

  if (selectedMuscles.size > 0) {
    filtered = filtered.filter(ex => ex.muscleGroups.some(m => selectedMuscles.has(m)));
  }

  if (positionFilter) {
    filtered = filtered.filter(ex => ex.startingPosition === positionFilter);
  }

  if (selectedContras.size > 0) {
    filtered = filtered.filter(ex =>
      !ex.contraindications.some(c => selectedContras.has(c))
    );
  }

  if (currentMode === 'reformer') {
    const orientationFilter = document.getElementById('filter-orientation').value;
    if (orientationFilter) {
      filtered = filtered.filter(ex => ex._orientation === orientationFilter);
    }
    if (selectedSpringColors.size > 0) {
      filtered = filtered.filter(ex =>
        ex._springs && [...selectedSpringColors].every(c => ex._springs.colors.has(c))
      );
    }
    if (selectedSpringCombos.size > 0) {
      filtered = filtered.filter(ex => ex._springs && selectedSpringCombos.has(ex._springs.combo));
    }
  }

  renderBrowseGrid(filtered);
}

function setupSpringColorToggles() {
  const group = document.getElementById('spring-color-group');
  if (!group) return;
  group.querySelectorAll('.spring-toggle').forEach(btn => {
    btn.classList.remove('active');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      const color = newBtn.dataset.color;
      if (selectedSpringColors.has(color)) {
        selectedSpringColors.delete(color);
        newBtn.classList.remove('active');
      } else {
        selectedSpringColors.add(color);
        newBtn.classList.add('active');
      }
      applyFilters();
    });
  });
}

function expandSprings(notation) {
  const result = [];
  let i = 0;
  while (i < notation.length) {
    let count = 1;
    if (/\d/.test(notation[i])) {
      count = parseInt(notation[i]);
      i++;
    }
    if (i < notation.length && /[RYB]/.test(notation[i])) {
      for (let j = 0; j < count; j++) result.push(notation[i]);
      i++;
    } else {
      i++;
    }
  }
  return result;
}

function springDotsHTML(combo) {
  if (!combo) return '';
  const colorClass = { R: 'red', Y: 'yellow', B: 'blue' };
  const makeDots = springs => springs.map(c => `<span class="s-dot ${colorClass[c]}"></span>`).join('');
  if (combo === 'all springs') {
    return `<div class="spring-dots-right">${makeDots(['R', 'B', 'Y'])}</div>`;
  }
  const parts = combo.split(' - ');
  const left = expandSprings(parts[0]);
  const right = parts[1] ? expandSprings(parts[1]) : [];
  let html = `<div class="spring-dots-left">${makeDots(left)}</div>`;
  if (right.length) {
    html += `<div class="spring-dots-right">${makeDots(right)}</div>`;
  }
  return html;
}

function renderBrowseGrid(exercises) {
  const grid = document.getElementById('browse-grid');
  const countEl = document.getElementById('browse-count');

  countEl.textContent = `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`;

  if (exercises.length === 0) {
    grid.innerHTML = '<p class="no-results">no exercises match your filters</p>';
    return;
  }

  grid.innerHTML = exercises.map(ex => {
    const imageSrc = ex.mainImage ? getImagePath(ex.mainImage) : '';
    const goalTags = ex.goals.map(g =>
      `<span class="tag">${getTagName('goals', g).toLowerCase()}</span>`
    ).join('');

    const dots = (currentMode === 'reformer' && ex._springs) ? springDotsHTML(ex._springs.combo) : '';

    return `
      <div class="exercise-card" data-id="${ex.id}">
        <div class="card-image-wrap">
          ${imageSrc ? `<img class="card-image" src="${imageSrc}" alt="${ex.name}" loading="lazy">` : '<div class="card-image"></div>'}
          ${dots}
        </div>
        <div class="card-info">
          <div class="card-name">${ex.name.toLowerCase()}</div>
          <div class="card-tags">${goalTags}</div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.exercise-card').forEach(card => {
    card.addEventListener('click', () => {
      const exercise = data.exercises.find(ex => ex.id === card.dataset.id);
      if (exercise) showModal(exercise);
    });
  });
}

// ============ Search ============

function setupSearch() {
  const input = document.getElementById('exercise-search');
  const dropdown = document.getElementById('search-dropdown');
  let highlightedIndex = -1;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    searchQuery = query;

    if (query.length >= 1) {
      const matches = data.exercises.filter(ex =>
        ex.name.toLowerCase().includes(query)
      ).slice(0, 8);

      if (matches.length > 0) {
        dropdown.innerHTML = matches.map((ex, i) => {
          return `
            <div class="option${i === highlightedIndex ? ' highlighted' : ''}" data-id="${ex.id}">
              ${ex.name.toLowerCase()}
            </div>
          `;
        }).join('');
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.option').forEach(option => {
          option.addEventListener('click', () => {
            const exercise = data.exercises.find(ex => ex.id === option.dataset.id);
            if (exercise) {
              input.value = exercise.name.toLowerCase();
              searchQuery = exercise.name.toLowerCase();
              dropdown.classList.add('hidden');
              applyFilters();
              showModal(exercise);
            }
          });
        });
      } else {
        dropdown.classList.add('hidden');
      }
    } else {
      dropdown.classList.add('hidden');
    }

    applyFilters();
  });

  input.addEventListener('keydown', (e) => {
    const options = dropdown.querySelectorAll('.option');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
      updateHighlight(options);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      updateHighlight(options);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && options[highlightedIndex]) {
        options[highlightedIndex].click();
      }
      dropdown.classList.add('hidden');
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      highlightedIndex = -1;
    }
  });

  function updateHighlight(options) {
    options.forEach((opt, i) => {
      opt.classList.toggle('highlighted', i === highlightedIndex);
    });
  }
}

// ============ Modal (for Browse mode) ============

function setupModal() {
  const modal = document.getElementById('exercise-modal');
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');

  backdrop.addEventListener('click', hideModal);
  closeBtn.addEventListener('click', hideModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      hideModal();
    }
  });
}

function showModal(ex) {
  const modal = document.getElementById('exercise-modal');
  const body = document.getElementById('modal-body');
  const isReformer = currentMode === 'reformer';

  const positionName = getTagName('startingPositions', ex.startingPosition);

  const images = (ex.images || []).map(img =>
    `<img class="detail-image" src="${getImagePath(img)}" alt="${ex.name}">`
  ).join('');

  const goalTags = ex.goals.map(g =>
    `<button class="detail-tag" data-filter="goals" data-value="${g}">${getTagName('goals', g).toLowerCase()}</button>`
  ).join('');

  const muscleTags = ex.muscleGroups.map(m =>
    `<button class="detail-tag" data-filter="muscleGroups" data-value="${m}">${getTagName('muscleGroups', m).toLowerCase()}</button>`
  ).join('');

  const contraTags = ex.contraindications.map(c =>
    `<span class="detail-tag">${getTagName('contraindications', c).toLowerCase()}</span>`
  ).join('');

  body.innerHTML = `
    <div class="detail-header">
      <h2 class="detail-name">${ex.name.toLowerCase()}</h2>
    </div>

    <div class="detail-meta">
      <div class="meta-row">
        <span class="meta-label">position</span>
        <div class="meta-tags"><button class="detail-tag" data-filter="startingPositions" data-value="${ex.startingPosition}">${positionName.toLowerCase()}</button></div>
      </div>
      ${isReformer && ex._orientation ? `
        <div class="meta-row">
          <span class="meta-label">orientation</span>
          <div class="meta-tags"><button class="detail-tag" data-filter="orientation" data-value="${ex._orientation}">${(ORIENTATION_NAMES[ex._orientation] || ex._orientation).toLowerCase()}</button></div>
        </div>
      ` : ''}
      <div class="meta-row">
        <span class="meta-label">goals</span>
        <div class="meta-tags">${goalTags || '<span class="detail-tag">none</span>'}</div>
      </div>
      <div class="meta-row">
        <span class="meta-label">muscles</span>
        <div class="meta-tags">${muscleTags || '<span class="detail-tag">none</span>'}</div>
      </div>
      ${contraTags ? `
        <div class="meta-row">
          <span class="meta-label">contras</span>
          <div class="meta-tags">${contraTags}</div>
        </div>
      ` : ''}
      ${isReformer && ex.springTension ? `
        <div class="meta-row">
          <span class="meta-label">springs</span>
          <div class="meta-tags"><span class="detail-tag">${ex.springTension.toLowerCase()}</span></div>
        </div>
      ` : ''}
      ${isReformer && ex.precautions ? `
        <div class="meta-row">
          <span class="meta-label">precautions</span>
          <div class="meta-tags"><span class="detail-tag">${ex.precautions.toLowerCase()}</span></div>
        </div>
      ` : ''}
    </div>

    ${images ? `<div class="detail-images">${images}</div>` : ''}

    ${ex.startingPositionDetails ? `
      <div class="detail-section">
        <h3>starting position details</h3>
        <p>${ex.startingPositionDetails}</p>
      </div>
    ` : ''}

    <div class="detail-section">
      <h3>breath & action</h3>
      ${Array.isArray(ex.breathAction) && ex.breathAction.length > 0 ? `
        <ul class="breath-steps">
          ${ex.breathAction.map(step => {
            const lower = step.toLowerCase();
            const formatted = lower
              .replace(/^(inhale):/, '<span class="breath-label">$1:</span>')
              .replace(/^(exhale):/, '<span class="breath-label">$1:</span>');
            return `<li>${formatted}</li>`;
          }).join('')}
        </ul>
      ` : '<p>n/a</p>'}
    </div>

    ${ex.watchPoints?.length ? `
      <div class="detail-section">
        <h3>watch points</h3>
        <ul>
          ${ex.watchPoints.map(w => `<li>${w.toLowerCase()}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${ex.modifications?.length ? `
      <div class="detail-section">
        <h3>modifications</h3>
        <ul>
          ${ex.modifications.map(m => `<li>${m.toLowerCase()}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${ex.variations?.length ? `
      <div class="detail-section">
        <h3>variations / props</h3>
        <ul>
          ${ex.variations.map(v => `<li>${v.toLowerCase()}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  body.querySelectorAll('.detail-tag[data-filter]').forEach(tag => {
    tag.addEventListener('click', () => {
      switchToFilter(tag.dataset.filter, tag.dataset.value);
    });
  });

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  modal.querySelector('.modal-content').scrollTop = 0;
}

function hideModal() {
  const modal = document.getElementById('exercise-modal');
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ============ Mobile Sticky Bar ============

function setupMobileSticky() {
  const sticky = document.getElementById('mobile-sticky');
  const filterToggle = document.getElementById('mobile-filter-toggle');
  const filtersExpanded = document.getElementById('mobile-filters-expanded');
  const mobileSearchInput = document.getElementById('mobile-search-input');
  const mainSearchInput = document.getElementById('exercise-search');
  const filterCountSpan = document.getElementById('mobile-filter-count');

  let filtersOpen = false;

  function isMobile() {
    return window.innerWidth <= 600;
  }

  function updateStickyPadding() {
    if (!isMobile()) {
      document.body.style.paddingTop = '';
      return;
    }
    if (filtersOpen) {
      requestAnimationFrame(() => {
        document.body.style.paddingTop = sticky.offsetHeight + 'px';
      });
    } else {
      document.body.style.paddingTop = '';
    }
  }

  function populateMobileFilters() {
    const filters = document.querySelector('.filters');
    const viewToggle = document.querySelector('.view-toggle');

    filtersExpanded.innerHTML = '';

    const chipRow = document.createElement('div');
    chipRow.className = 'mobile-chip-row';

    const panels = [];

    filters.querySelectorAll('.filter-group').forEach(group => {
      if (group.querySelector('#exercise-search')) return;
      if (group.classList.contains('hidden') && group.classList.contains('reformer-only')) return;

      const label = group.querySelector('label');
      const name = label ? label.textContent.trim() : 'filter';

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mobile-filter-chip';
      chip.textContent = name;

      const panel = document.createElement('div');
      panel.className = 'mobile-filter-panel hidden';

      const clone = group.cloneNode(true);
      clone.classList.remove('hidden', 'reformer-only');
      const cloneLabel = clone.querySelector('label');
      if (cloneLabel) cloneLabel.remove();
      clone.querySelectorAll('[id]').forEach(el => {
        el.id = 'mobile-' + el.id;
      });
      panel.appendChild(clone);
      panels.push({ chip, panel });

      chipRow.appendChild(chip);
    });

    // View toggle chip
    const viewChip = document.createElement('button');
    viewChip.type = 'button';
    viewChip.className = 'mobile-filter-chip';
    viewChip.textContent = 'view';

    const viewPanel = document.createElement('div');
    viewPanel.className = 'mobile-filter-panel hidden';
    const viewClone = viewToggle.cloneNode(true);
    const viewLabel = viewClone.querySelector('label');
    if (viewLabel) viewLabel.remove();
    viewClone.querySelectorAll('[id]').forEach(el => {
      el.id = 'mobile-' + el.id;
    });
    viewPanel.appendChild(viewClone);
    panels.push({ chip: viewChip, panel: viewPanel });
    chipRow.appendChild(viewChip);

    filtersExpanded.appendChild(chipRow);
    panels.forEach(p => filtersExpanded.appendChild(p.panel));

    panels.forEach(p => {
      p.chip.addEventListener('click', () => {
        const wasOpen = p.chip.classList.contains('active');
        panels.forEach(q => {
          q.chip.classList.remove('active');
          q.panel.classList.add('hidden');
        });
        if (!wasOpen) {
          p.chip.classList.add('active');
          p.panel.classList.remove('hidden');
        }
        updateStickyPadding();
      });
    });

    setupMobileFilterListeners();
  }

  function setupMobileFilterListeners() {
    const mobilePosition = document.getElementById('mobile-filter-position');

    // Multi-select checkbox sync (goals, muscles, contras, spring combo)
    const multiSelectMappings = [
      { optionsId: 'mobile-goals-options', mainOptionsId: 'goals-options' },
      { optionsId: 'mobile-muscles-options', mainOptionsId: 'muscles-options' },
      { optionsId: 'mobile-contra-options', mainOptionsId: 'contra-options' },
      { optionsId: 'mobile-spring-combo-options', mainOptionsId: 'spring-combo-options' },
    ];

    multiSelectMappings.forEach(({ optionsId, mainOptionsId }) => {
      const container = document.getElementById(optionsId);
      if (!container) return;
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const mainCb = document.querySelector(`#${mainOptionsId} input[value="${cb.value}"]`);
          if (mainCb) {
            mainCb.checked = cb.checked;
            mainCb.dispatchEvent(new Event('change'));
          }
          updateFilterCount();
        });
      });
    });

    if (mobilePosition) {
      mobilePosition.addEventListener('change', () => {
        document.getElementById('filter-position').value = mobilePosition.value;
        applyFilters();
        updateFilterCount();
      });
    }

    const mobileOrientation = document.getElementById('mobile-filter-orientation');
    if (mobileOrientation) {
      mobileOrientation.addEventListener('change', () => {
        document.getElementById('filter-orientation').value = mobileOrientation.value;
        applyFilters();
        updateFilterCount();
      });
    }

    const mobileViewBtns = filtersExpanded.querySelectorAll('.toggle-btn');
    mobileViewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        const grid = document.getElementById('browse-grid');
        const listHeader = document.getElementById('list-header');

        document.querySelectorAll('.toggle-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.view === view);
        });

        grid.classList.toggle('list-view', view === 'list');
        listHeader.classList.toggle('hidden', view !== 'list');
      });
    });

    // Spring color toggles
    filtersExpanded.querySelectorAll('.spring-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        const mainBtn = document.querySelector(`#spring-color-group .spring-toggle[data-color="${color}"]`);
        if (selectedSpringColors.has(color)) {
          selectedSpringColors.delete(color);
          btn.classList.remove('active');
          if (mainBtn) mainBtn.classList.remove('active');
        } else {
          selectedSpringColors.add(color);
          btn.classList.add('active');
          if (mainBtn) mainBtn.classList.add('active');
        }
        applyFilters();
        updateFilterCount();
      });
    });
  }

  function updateFilterCount() {
    const positionFilter = document.getElementById('filter-position').value;

    let count = 0;
    count += selectedGoals.size;
    count += selectedMuscles.size;
    if (positionFilter) count++;
    count += selectedContras.size;
    if (currentMode === 'reformer') {
      if (document.getElementById('filter-orientation').value) count++;
      count += selectedSpringCombos.size;
      count += selectedSpringColors.size;
    }

    if (count > 0) {
      filterCountSpan.textContent = `(${count})`;
      filterToggle.classList.add('has-filters');
    } else {
      filterCountSpan.textContent = '';
      filterToggle.classList.remove('has-filters');
    }
  }

  // Only bind these listeners once
  if (!sticky._bound) {
    mobileSearchInput.addEventListener('input', () => {
      mainSearchInput.value = mobileSearchInput.value;
      searchQuery = mobileSearchInput.value.toLowerCase().trim();
      applyFilters();
    });

    mainSearchInput.addEventListener('input', () => {
      mobileSearchInput.value = mainSearchInput.value;
    });

    filterToggle.addEventListener('click', () => {
      filtersOpen = !filtersOpen;
      filtersExpanded.classList.toggle('hidden', !filtersOpen);

      if (filtersOpen) {
        // Sync select values
        const mobilePosition = document.getElementById('mobile-filter-position');
        if (mobilePosition) mobilePosition.value = document.getElementById('filter-position').value;
        const mobileOrientation = document.getElementById('mobile-filter-orientation');
        if (mobileOrientation) mobileOrientation.value = document.getElementById('filter-orientation').value;

        // Sync multi-select checkboxes
        const syncMap = [
          { mobileOpts: 'mobile-goals-options', set: selectedGoals },
          { mobileOpts: 'mobile-muscles-options', set: selectedMuscles },
          { mobileOpts: 'mobile-contra-options', set: selectedContras },
          { mobileOpts: 'mobile-spring-combo-options', set: selectedSpringCombos },
        ];
        syncMap.forEach(({ mobileOpts, set }) => {
          filtersExpanded.querySelectorAll(`#${mobileOpts} input[type="checkbox"]`).forEach(cb => {
            cb.checked = set.has(cb.value);
          });
        });

        filtersExpanded.querySelectorAll('.spring-toggle').forEach(btn => {
          btn.classList.toggle('active', selectedSpringColors.has(btn.dataset.color));
        });
      }
      updateStickyPadding();
    });

    sticky._bound = true;
  }

  populateMobileFilters();
  updateFilterCount();

  ['filter-position', 'filter-orientation'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateFilterCount);
  });
}

// ============ Init ============

async function init() {
  initTheme();
  await loadData();

  setupModeToggle();
  setupViewToggle();
  populateFilters();
  setupSearch();
  setupModal();
  setupMobileSticky();

  applyFilters();
}

init();
