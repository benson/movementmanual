// Movement Manual App

let data = null;
let selectedContras = new Set();
let searchQuery = '';
let selectedSpringColors = new Set();
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

function switchToFilter(filterType, value) {
  document.getElementById('filter-goals').value = '';
  document.getElementById('filter-muscles').value = '';
  document.getElementById('filter-position').value = '';
  document.getElementById('filter-orientation').value = '';
  document.getElementById('filter-spring-combo').value = '';
  document.getElementById('exercise-search').value = '';
  searchQuery = '';
  selectedSpringColors.clear();
  document.querySelectorAll('.spring-toggle').forEach(b => b.classList.remove('active'));

  const filterMap = {
    'goals': 'filter-goals',
    'muscleGroups': 'filter-muscles',
    'startingPositions': 'filter-position',
    'orientation': 'filter-orientation'
  };

  const selectId = filterMap[filterType];
  if (selectId) {
    document.getElementById(selectId).value = value;
  }

  hideModal();
  applyFilters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ Mode Toggle ============

function setupModeToggle() {
  const btns = document.querySelectorAll('.mode-btn');

  // Set initial state from localStorage
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
  // Reset state
  selectedContras.clear();
  selectedSpringColors.clear();
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
  const goalsSelect = document.getElementById('filter-goals');
  const musclesSelect = document.getElementById('filter-muscles');
  const positionSelect = document.getElementById('filter-position');
  const contraOptions = document.getElementById('contra-options');

  // Clear existing options (keep first "all" option)
  [goalsSelect, musclesSelect, positionSelect].forEach(select => {
    while (select.options.length > 1) select.remove(1);
    select.value = '';
  });
  contraOptions.innerHTML = '';

  // Repopulate
  Object.entries(data.tags.goals).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name.toLowerCase();
    goalsSelect.appendChild(option);
  });

  Object.entries(data.tags.muscleGroups).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name.toLowerCase();
    musclesSelect.appendChild(option);
  });

  Object.entries(data.tags.startingPositions).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name.toLowerCase();
    positionSelect.appendChild(option);
  });

  // Rebuild contra dropdown
  setupContraDropdown();

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

    const comboSelect = document.getElementById('filter-spring-combo');
    while (comboSelect.options.length > 1) comboSelect.remove(1);
    comboSelect.value = '';
    data._springCombos.forEach(combo => {
      const option = document.createElement('option');
      option.value = combo;
      option.textContent = combo.toLowerCase();
      comboSelect.appendChild(option);
    });
    setupSpringColorToggles();
  }
}

function populateFilters() {
  rebuildFilters();

  // Add change listeners for selects
  ['filter-goals', 'filter-muscles', 'filter-position', 'filter-orientation', 'filter-spring-combo'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const goalFilter = document.getElementById('filter-goals').value;
  const muscleFilter = document.getElementById('filter-muscles').value;
  const positionFilter = document.getElementById('filter-position').value;

  let filtered = data.exercises;

  if (searchQuery) {
    filtered = filtered.filter(ex =>
      ex.name.toLowerCase().includes(searchQuery)
    );
  }

  if (goalFilter) {
    filtered = filtered.filter(ex => ex.goals.includes(goalFilter));
  }

  if (muscleFilter) {
    filtered = filtered.filter(ex => ex.muscleGroups.includes(muscleFilter));
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
    const comboFilter = document.getElementById('filter-spring-combo').value;
    if (selectedSpringColors.size > 0) {
      filtered = filtered.filter(ex =>
        ex._springs && [...selectedSpringColors].every(c => ex._springs.colors.has(c))
      );
    }
    if (comboFilter) {
      filtered = filtered.filter(ex => ex._springs?.combo === comboFilter);
    }
  }

  renderBrowseGrid(filtered);
}

function setupContraDropdown() {
  const toggle = document.getElementById('contra-toggle');
  const dropdown = document.getElementById('contra-dropdown');
  const options = document.getElementById('contra-options');
  const label = document.getElementById('contra-label');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'multi-select-clear';
  clearBtn.textContent = 'clear all';
  clearBtn.addEventListener('click', () => {
    selectedContras.clear();
    options.querySelectorAll('input').forEach(cb => cb.checked = false);
    updateContraDisplay();
    applyFilters();
  });
  options.appendChild(clearBtn);

  Object.entries(data.tags.contraindications).forEach(([id, name]) => {
    const option = document.createElement('label');
    option.className = 'multi-select-option';
    option.innerHTML = `
      <input type="checkbox" value="${id}">
      ${name.toLowerCase()}
    `;
    options.appendChild(option);

    option.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedContras.add(id);
      } else {
        selectedContras.delete(id);
      }
      updateContraDisplay();
      applyFilters();
    });
  });

  // Only add toggle listener once (on first call)
  if (!toggle._bound) {
    toggle.addEventListener('click', () => {
      dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.multi-select-wrapper')) {
        dropdown.classList.add('hidden');
      }
    });
    toggle._bound = true;
  }

  label.textContent = 'none selected';

  function updateContraDisplay() {
    if (selectedContras.size === 0) {
      label.textContent = 'none selected';
    } else if (selectedContras.size <= 2) {
      const names = Array.from(selectedContras).map(id =>
        data.tags.contraindications[id].toLowerCase().replace(/^acute /, '').split(' ')[0]
      );
      label.textContent = names.join(', ');
    } else {
      label.textContent = `${selectedContras.size} selected`;
    }
  }
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
  if (combo === 'all springs') {
    return '<div class="spring-dots"><span class="s-dot red"></span><span class="s-dot blue"></span><span class="s-dot yellow"></span></div>';
  }
  const parts = combo.split(' - ');
  const left = expandSprings(parts[0]);
  const right = parts[1] ? expandSprings(parts[1]) : [];
  let html = left.map(c => `<span class="s-dot ${colorClass[c]}"></span>`).join('');
  if (right.length) {
    html += '<span class="s-dot-sep">\u2013</span>';
    html += right.map(c => `<span class="s-dot ${colorClass[c]}"></span>`).join('');
  }
  return `<div class="spring-dots">${html}</div>`;
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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      dropdown.classList.add('hidden');
    }
  });
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

  let stickyThreshold = 0;
  let filtersOpen = false;

  function updateThreshold() {
    const header = document.querySelector('header');
    stickyThreshold = header.offsetTop + header.offsetHeight + 20;
  }

  function populateMobileFilters() {
    const filters = document.querySelector('.filters');
    const viewToggle = document.querySelector('.view-toggle');

    filtersExpanded.innerHTML = '';
    filters.querySelectorAll('.filter-group').forEach(group => {
      if (group.querySelector('#exercise-search')) return;

      const clone = group.cloneNode(true);
      clone.querySelectorAll('[id]').forEach(el => {
        el.id = 'mobile-' + el.id;
      });
      filtersExpanded.appendChild(clone);
    });

    const viewClone = viewToggle.cloneNode(true);
    viewClone.querySelectorAll('[id]').forEach(el => {
      el.id = 'mobile-' + el.id;
    });
    filtersExpanded.appendChild(viewClone);

    setupMobileFilterListeners();
  }

  function setupMobileFilterListeners() {
    const mobileGoals = document.getElementById('mobile-filter-goals');
    const mobileMusles = document.getElementById('mobile-filter-muscles');
    const mobilePosition = document.getElementById('mobile-filter-position');

    if (mobileGoals) {
      mobileGoals.addEventListener('change', () => {
        document.getElementById('filter-goals').value = mobileGoals.value;
        applyFilters();
        updateFilterCount();
      });
    }

    if (mobileMusles) {
      mobileMusles.addEventListener('change', () => {
        document.getElementById('filter-muscles').value = mobileMusles.value;
        applyFilters();
        updateFilterCount();
      });
    }

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

    const mobileContraToggle = document.getElementById('mobile-contra-toggle');
    const mobileContraDropdown = document.getElementById('mobile-contra-dropdown');

    if (mobileContraToggle && mobileContraDropdown) {
      mobileContraToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileContraDropdown.classList.toggle('hidden');
      });

      mobileContraDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const mainCb = document.querySelector(`#contra-options input[value="${cb.value}"]`);
          if (mainCb) {
            mainCb.checked = cb.checked;
            mainCb.dispatchEvent(new Event('change'));
          }
          updateFilterCount();
        });
      });
    }

    // Spring combo
    const mobileSpringCombo = document.getElementById('mobile-filter-spring-combo');
    if (mobileSpringCombo) {
      mobileSpringCombo.addEventListener('change', () => {
        document.getElementById('filter-spring-combo').value = mobileSpringCombo.value;
        applyFilters();
        updateFilterCount();
      });
    }

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
    const goalFilter = document.getElementById('filter-goals').value;
    const muscleFilter = document.getElementById('filter-muscles').value;
    const positionFilter = document.getElementById('filter-position').value;

    let count = 0;
    if (goalFilter) count++;
    if (muscleFilter) count++;
    if (positionFilter) count++;
    count += selectedContras.size;
    if (currentMode === 'reformer') {
      if (document.getElementById('filter-orientation').value) count++;
      if (document.getElementById('filter-spring-combo').value) count++;
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
      document.body.classList.toggle('filters-expanded', filtersOpen);

      if (filtersOpen) {
        const mobileGoals = document.getElementById('mobile-filter-goals');
        const mobileMuscles = document.getElementById('mobile-filter-muscles');
        const mobilePosition = document.getElementById('mobile-filter-position');

        if (mobileGoals) mobileGoals.value = document.getElementById('filter-goals').value;
        if (mobileMuscles) mobileMuscles.value = document.getElementById('filter-muscles').value;
        if (mobilePosition) mobilePosition.value = document.getElementById('filter-position').value;
        const mobileOrientation = document.getElementById('mobile-filter-orientation');
        if (mobileOrientation) mobileOrientation.value = document.getElementById('filter-orientation').value;
        const mobileSpringCombo = document.getElementById('mobile-filter-spring-combo');
        if (mobileSpringCombo) mobileSpringCombo.value = document.getElementById('filter-spring-combo').value;
        filtersExpanded.querySelectorAll('.spring-toggle').forEach(btn => {
          btn.classList.toggle('active', selectedSpringColors.has(btn.dataset.color));
        });
      }
    });

    function isMobile() {
      return window.innerWidth <= 600;
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!isMobile()) {
            sticky.classList.remove('visible');
            document.body.classList.remove('sticky-active');
            ticking = false;
            return;
          }

          const scrollY = window.scrollY;
          const shouldShow = scrollY > stickyThreshold;

          sticky.classList.toggle('visible', shouldShow);
          document.body.classList.toggle('sticky-active', shouldShow);

          if (!shouldShow && filtersOpen) {
            filtersOpen = false;
            filtersExpanded.classList.add('hidden');
            document.body.classList.remove('filters-expanded');
          }

          ticking = false;
        });
        ticking = true;
      }
    });

    sticky._bound = true;
  }

  updateThreshold();
  window.addEventListener('resize', updateThreshold);
  populateMobileFilters();
  updateFilterCount();

  ['filter-goals', 'filter-muscles', 'filter-position', 'filter-orientation', 'filter-spring-combo'].forEach(id => {
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
