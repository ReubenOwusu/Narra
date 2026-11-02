document.addEventListener('DOMContentLoaded', () => {
  // --- 1. DOM ELEMENTS ---
  const inspectorPanel = document.querySelector('.inspector-panel');
  const inspectorHeaderTitle = document.querySelector('.inspector-header h3');
  const inspectorBody = document.querySelector('.inspector-body');
  const closeInspectorBtn = document.querySelector('.close-inspector-btn');
  const timelineWorkspace = document.querySelector('.timeline-workspace');
  const timelineBoard = document.querySelector('.timeline-board');
  const inspectorTitle = document.querySelector('#inspector-title');
  const inspectorSummary = document.querySelector('#inspector-summary');
  const inspectorTagsContainer = document.querySelector('.inspector-tags-container');
  const inspectorTagInput = document.querySelector('.tag-input');
  const inspectorPlotlineSelect = document.querySelector('.inspector-select');
  const ideaTray = document.querySelector('.idea-tray');
  const trayHeader = document.querySelector('.tray-header');
  const trayContent = document.querySelector('.tray-content');
  const minimapContainer = document.querySelector('.minimap-container');
  const minimapBoard = document.querySelector('.minimap-board');
  const searchInput = document.querySelector('.search-input');
  const saveIndicator = document.getElementById('save-indicator');
  const manualSaveBtn = document.getElementById('save-timeline-btn');

  let activeCard = null;
  let pendingTargetContainer = null;
  let currentInspectorTags = [];
  let draggedCard = null;
  let draggedRow = null;
  let resizingRow = null;
  let activeTagFilter = null;

  // --- 2. PROJECT INITIALIZATION & CHARACTER EXTRACTION ---
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id') || 'tut-timeline';
  let narraProjects = JSON.parse(localStorage.getItem('narra_projects') || '[]');
  let projectIndex = narraProjects.findIndex(p => p.id === projectId);

  if (projectIndex === -1) {
    const fallbackProject = {
      id: projectId,
      title: projectId === 'tut-timeline' ? 'Timeline Tutorial' : 'Unnamed Timeline',
      type: 'timeline',
      lastModified: new Date().toISOString(),
      data: {} 
    };
    narraProjects.push(fallbackProject);
    projectIndex = narraProjects.length - 1;
  }
  let thisProject = narraProjects[projectIndex];

  // Build the Global Roster Dictionary for @ Mentions
  const globalCharacterRoster = {};
  narraProjects
    .filter(p => p.type === 'character' && p.data && Array.isArray(p.data.characters))
    .forEach(charFile => {
      charFile.data.characters.forEach(char => {
        if (char.name) {
          const cleanKey = char.name.toLowerCase().trim();
          globalCharacterRoster[cleanKey] = { ...char };
        }
      });
    });

  console.log('Loaded Global Character Roster:', globalCharacterRoster);


 // --- 3. LOAD SAVED TIMELINE HTML (PERSISTENCE) ---
  // Target either .timeline-board or .timeline-grid so it never fails
  const boardContainer = document.querySelector('.timeline-board') || document.querySelector('.timeline-grid');
  
  if (thisProject && thisProject.data && thisProject.data.boardHTML) {
    // 1. Restore Saved Workspace & Tray
    if (boardContainer) boardContainer.innerHTML = thisProject.data.boardHTML;
    if (trayContent && thisProject.data.trayHTML) trayContent.innerHTML = thisProject.data.trayHTML;

    // 2. CRITICAL: Strip old listener flags from saved HTML so cards & buttons wake up!
    document.querySelectorAll('[data-listeners-bound]').forEach(el => delete el.dataset.listenersBound);
    document.querySelectorAll('[data-drop-bound]').forEach(el => delete el.dataset.dropBound);
    document.querySelectorAll('[data-swap-bound]').forEach(el => delete el.dataset.swapBound);
    document.querySelectorAll('[data-focus-bound]').forEach(el => delete el.dataset.focusBound);
    document.querySelectorAll('[data-bound]').forEach(el => delete el.dataset.bound);
  } else if (projectId !== 'tut-timeline') {
    // Blank Slate for brand-new timelines
    document.querySelectorAll('.header-row .chapter-cell').forEach((c, i) => { if (i > 0) c.remove(); });
    document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').forEach(r => r.remove());
    document.querySelectorAll('.tray-content .scene-card').forEach(c => c.remove());
    const addPlotBtn = document.querySelector('.add-plotline-btn');
    if (addPlotBtn) addPlotBtn.click(); 
  }

  // UPDATE TITLE DISPLAY
  const titleDisplay = document.querySelector('.project-title-display');
  if (titleDisplay && thisProject.title) titleDisplay.innerText = thisProject.title;


  // --- 4. THE MASTER SAVE ENGINE ---
  function saveTimelineState() {
    if (!boardContainer || !trayContent) return;

    // 1. Sync typed <input> text into HTML attributes before taking the innerHTML snapshot!
    boardContainer.querySelectorAll('input').forEach(input => {
      input.setAttribute('value', input.value);
    });

    // 2. Clean up temporary UI highlight classes before saving
    boardContainer.querySelectorAll('.active-card').forEach(c => c.classList.remove('active-card'));
    boardContainer.querySelectorAll('.pending-target-cell').forEach(c => c.classList.remove('pending-target-cell'));
    
    // 3. Fetch latest narra_projects so we don't overwrite character sheets
    let freshProjects = JSON.parse(localStorage.getItem('narra_projects') || '[]');
    let fIdx = freshProjects.findIndex(p => p.id === projectId);
    
    thisProject.data = {
      boardHTML: boardContainer.innerHTML,
      trayHTML: trayContent.innerHTML
    };
    thisProject.lastModified = new Date().toISOString();

    if (fIdx !== -1) {
      freshProjects[fIdx] = thisProject;
    } else {
      freshProjects.push(thisProject);
    }
    
    localStorage.setItem('narra_projects', JSON.stringify(freshProjects));
    
    if (saveIndicator) saveIndicator.textContent = 'All changes saved locally';
  }

  // Auto-save whenever any input changes on the board
  document.addEventListener('input', (e) => {
    if (e.target.closest('.timeline-workspace, .timeline-board')) {
      if (saveIndicator) saveIndicator.textContent = 'Saving...';
      saveTimelineState();
    }
  });

  // Bind to ALL possible Save buttons in your header (.sync-status, .btn-action, #save-timeline-btn)
  const saveButtons = document.querySelectorAll('#save-timeline-btn, .sync-status, .btn-action');
  saveButtons.forEach(btn => {
    // Make sure we don't accidentally bind to the Share or Export button if they share .btn-action
    if (btn.classList.contains('share-btn') || btn.id === 'export-project-btn') return;
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      saveTimelineState();
      showToast('All changes saved locally');
    });
  });


  // --- 5. @ TAGGING & HOVER DOSSIER SYSTEM ---
  function parseCharacterTags(text) {
    let parsedText = text;
    // Checks every character in the roster and replaces their name if it starts with @
    Object.keys(globalCharacterRoster).forEach(charKey => {
      const charData = globalCharacterRoster[charKey];
      const regex = new RegExp(`@${charData.name}\\b`, 'gi');
      parsedText = parsedText.replace(regex, `<span class="char-tag" data-char-id="${charData.id}" style="color:#1a73e8; font-weight:600; cursor:pointer; background:#e8f0fe; padding:2px 4px; border-radius:4px;">@${charData.name}</span>`);
    });
    return parsedText;
  }

  // Create the floating Mini-Dossier Box
  const dossierPopup = document.createElement('div');
  dossierPopup.className = 'mini-dossier-popup';
  dossierPopup.style.cssText = 'position:fixed; display:none; background:#fff; border:1px solid #dadce0; padding:12px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:9999; max-width:250px; font-size:13px; color:#202124; pointer-events:none;';
  document.body.appendChild(dossierPopup);

  document.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('char-tag')) {
      const charName = e.target.textContent.replace('@', '').toLowerCase().trim();
      const char = globalCharacterRoster[charName];
      if (char) {
        dossierPopup.innerHTML = `
          <strong style="display:block; font-size:14px; margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:4px;">${char.name}</strong>
          <div><b>Core Belief:</b> ${char.coreBelief || 'Unset'}</div>
          <div style="margin-top:4px;"><b>Weakness:</b> ${char.weaknesses || 'Unset'}</div>
        `;
        const rect = e.target.getBoundingClientRect();
        dossierPopup.style.left = `${rect.left}px`;
        dossierPopup.style.top = `${rect.bottom + 8}px`;
        dossierPopup.style.display = 'block';
      }
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('char-tag')) {
      dossierPopup.style.display = 'none';
    }
  });


  // --- 6. TOAST NOTIFICATION HELPER ---
  const toastEl = document.createElement('div');
  toastEl.className = 'narra-toast';
  document.body.appendChild(toastEl);
  let toastTimeout = null;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  // --- 7. FLOATING UI STATE SYNC (MINIMAP DOCKING & TOGGLE) ---
  function syncFloatingPositions() {
    if (!minimapContainer) return;
    const isTrayCollapsed = ideaTray && ideaTray.classList.contains('collapsed');
    const isInspectorOpen = inspectorPanel && inspectorPanel.classList.contains('active');

    document.body.classList.toggle('tray-is-collapsed', Boolean(isTrayCollapsed));
    document.body.classList.toggle('inspector-is-open', Boolean(isInspectorOpen));

    const inspectorWidth = isInspectorOpen ? (inspectorPanel.offsetWidth || 320) : 0;
    const rightOffset = inspectorWidth + 12;

    let bottomOffset = 228;
    if (ideaTray) {
      if (isTrayCollapsed) {
        const headerEl = ideaTray.querySelector('.tray-header');
        bottomOffset = (headerEl ? headerEl.offsetHeight : 40) + 12;
      } else {
        bottomOffset = (ideaTray.offsetHeight || 216) + 12;
      }
    }

    minimapContainer.style.setProperty('position', 'fixed', 'important');
    minimapContainer.style.setProperty('left', 'auto', 'important');
    minimapContainer.style.setProperty('top', 'auto', 'important');
    minimapContainer.style.setProperty('right', `${rightOffset}px`, 'important');
    minimapContainer.style.setProperty('bottom', `${bottomOffset}px`, 'important');
  }

  const mapBtn = document.querySelector('#minimap-toggle-btn') || document.querySelector('button[title="Toggle Minimap"]');
  if (mapBtn && minimapContainer) {
    mapBtn.classList.toggle('active', !minimapContainer.classList.contains('hidden'));
    mapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isNowHidden = minimapContainer.classList.toggle('hidden');
      mapBtn.classList.toggle('active', !isNowHidden);
    });
  }

  // --- 8. INSPECTOR PANEL (AND CARD SAVING) ---
  const inspectorFooter = document.createElement('div');
  inspectorFooter.className = 'inspector-footer';
  inspectorFooter.innerHTML = `
    <button type="button" class="btn-danger-ghost" id="inspector-delete-btn">Delete</button>
    <div class="inspector-footer-right">
      <button type="button" class="btn-secondary" id="inspector-cancel-btn">Cancel</button>
      <button type="button" class="btn-primary" id="inspector-save-btn">Save Scene</button>
    </div>
  `;
  if (inspectorBody) inspectorBody.appendChild(inspectorFooter);

  const inspectorSaveBtn = document.querySelector('#inspector-save-btn');
  const inspectorCancelBtn = document.querySelector('#inspector-cancel-btn');
  const inspectorDeleteBtn = document.querySelector('#inspector-delete-btn');

  function syncInspectorPlotlineOptions(selectedPlotlineName = '') {
    if (!inspectorPlotlineSelect) return;
    inspectorPlotlineSelect.innerHTML = '';

    const plotRows = document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)');
    plotRows.forEach((row, idx) => {
      const nameInput = row.querySelector('.plotline-name-input');
      const name = nameInput ? nameInput.value.trim() : `Plotline ${idx + 1}`;
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = name;
      if (name === selectedPlotlineName) option.selected = true;
      inspectorPlotlineSelect.appendChild(option);
    });

    const trayOption = document.createElement('option');
    trayOption.value = 'tray';
    trayOption.textContent = 'Idea Tray (Unplaced)';
    if (selectedPlotlineName === 'tray') trayOption.selected = true;
    inspectorPlotlineSelect.appendChild(trayOption);
  }

  function renderInspectorTags() {
    if (!inspectorTagsContainer || !inspectorTagInput) return;
    inspectorTagsContainer.querySelectorAll('.tag').forEach(t => t.remove());

    currentInspectorTags.forEach((tagText, index) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerHTML = `${tagText} <button type="button" class="remove-tag-btn" title="Remove Tag">×</button>`;
      span.querySelector('.remove-tag-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        currentInspectorTags.splice(index, 1);
        renderInspectorTags();
      });
      inspectorTagsContainer.insertBefore(span, inspectorTagInput);
    });
  }

  if (inspectorTagInput) {
    inspectorTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        let raw = inspectorTagInput.value.trim().replace(/,/g, '');
        if (!raw) return;
        if (!raw.startsWith('#') && !raw.startsWith('@')) raw = '#' + raw;
        if (!currentInspectorTags.includes(raw)) {
          currentInspectorTags.push(raw);
          renderInspectorTags();
        }
        inspectorTagInput.value = '';
      } else if (e.key === 'Backspace' && inspectorTagInput.value === '' && currentInspectorTags.length > 0) {
        currentInspectorTags.pop();
        renderInspectorTags();
      }
    });
  }

  function clearPendingTargetHighlight() {
    document.querySelectorAll('.pending-target-cell').forEach(c => c.classList.remove('pending-target-cell'));
  }

  function openInspectorForCard(card) {
    clearPendingTargetHighlight();
    pendingTargetContainer = null;
    if (activeCard) activeCard.classList.remove('active-card');
    
    activeCard = card;
    activeCard.classList.add('active-card');

    if (inspectorHeaderTitle) inspectorHeaderTitle.textContent = 'Scene Details';
    if (inspectorSaveBtn) inspectorSaveBtn.textContent = 'Save Changes';
    if (inspectorDeleteBtn) inspectorDeleteBtn.style.display = 'inline-flex';

    const titleEl = card.querySelector('.scene-title');
    const summaryEl = card.querySelector('.scene-summary');
    if (inspectorTitle) inspectorTitle.value = titleEl ? titleEl.innerText : '';
    // Extracts plain text, ignoring the spans so the user can easily edit it
    if (inspectorSummary) inspectorSummary.value = summaryEl ? summaryEl.innerText : ''; 

    currentInspectorTags = Array.from(card.querySelectorAll('.scene-tags .tag')).map(t => t.innerText.trim());
    renderInspectorTags();

    const parentRow = card.closest('.timeline-row');
    if (parentRow) {
      const nameInput = parentRow.querySelector('.plotline-name-input');
      syncInspectorPlotlineOptions(nameInput ? nameInput.value.trim() : '');
    } else {
      syncInspectorPlotlineOptions('tray');
    }

    if (inspectorPanel) inspectorPanel.classList.add('active');
    syncFloatingPositions();
  }

  function openInspectorForNewScene(targetContainer) {
    if (activeCard) {
      activeCard.classList.remove('active-card');
      activeCard = null;
    }
    clearPendingTargetHighlight();
    pendingTargetContainer = targetContainer;

    if (targetContainer && targetContainer.classList.contains('track-cell')) {
      targetContainer.classList.add('pending-target-cell');
    }

    if (inspectorHeaderTitle) inspectorHeaderTitle.textContent = 'New Scene';
    if (inspectorSaveBtn) inspectorSaveBtn.textContent = 'Create Scene';
    if (inspectorDeleteBtn) inspectorDeleteBtn.style.display = 'none';

    if (inspectorTitle) inspectorTitle.value = '';
    if (inspectorSummary) inspectorSummary.value = '';
    currentInspectorTags = [];
    renderInspectorTags();

    const parentRow = targetContainer ? targetContainer.closest('.timeline-row') : null;
    if (parentRow) {
      const nameInput = parentRow.querySelector('.plotline-name-input');
      syncInspectorPlotlineOptions(nameInput ? nameInput.value.trim() : '');
    } else {
      syncInspectorPlotlineOptions('tray');
    }

    if (inspectorPanel) inspectorPanel.classList.add('active');
    syncFloatingPositions();
    setTimeout(() => { if (inspectorTitle) inspectorTitle.focus(); }, 50);
  }

  function closeInspector() {
    if (inspectorPanel) inspectorPanel.classList.remove('active');
    if (activeCard) {
      activeCard.classList.remove('active-card');
      activeCard = null;
    }
    clearPendingTargetHighlight();
    pendingTargetContainer = null;
    syncFloatingPositions();
  }

  function buildSceneCardElement(title, summaryHtml, tags) {
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.setAttribute('draggable', 'true');

    const h4 = document.createElement('h4');
    h4.className = 'scene-title';
    h4.textContent = title || 'Untitled Scene';
    card.appendChild(h4);

    const p = document.createElement('p');
    p.className = 'scene-summary';
    p.innerHTML = summaryHtml || '';
    card.appendChild(p);

    if (tags && tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'scene-tags';
      tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tagsDiv.appendChild(span);
      });
      card.appendChild(tagsDiv);
    }

    attachCardListeners(card);
    return card;
  }

  if (inspectorSaveBtn) {
    inspectorSaveBtn.addEventListener('click', () => {
      if (inspectorTagInput && inspectorTagInput.value.trim() !== '') {
        let raw = inspectorTagInput.value.trim().replace(/,/g, '');
        if (!raw.startsWith('#') && !raw.startsWith('@')) raw = '#' + raw;
        if (!currentInspectorTags.includes(raw)) currentInspectorTags.push(raw);
        inspectorTagInput.value = '';
      }

      const titleVal = inspectorTitle ? inspectorTitle.value.trim() || 'Untitled Scene' : 'Untitled Scene';
      
      // Applies the @ Mentions logic before saving!
      const rawSummary = inspectorSummary ? inspectorSummary.value.trim() : '';
      const summaryHtml = parseCharacterTags(rawSummary);

      const selectedPlotlineVal = inspectorPlotlineSelect ? inspectorPlotlineSelect.value : '0';

      if (activeCard) {
        // Update Existing Card
        let titleEl = activeCard.querySelector('.scene-title');
        if (!titleEl) {
          titleEl = document.createElement('h4');
          titleEl.className = 'scene-title';
          activeCard.prepend(titleEl);
        }
        titleEl.textContent = titleVal;

        let summaryEl = activeCard.querySelector('.scene-summary');
        if (!summaryEl) {
          summaryEl = document.createElement('p');
          summaryEl.className = 'scene-summary';
          titleEl.after(summaryEl);
        }
        summaryEl.innerHTML = summaryHtml;

        let tagsDiv = activeCard.querySelector('.scene-tags');
        if (currentInspectorTags.length > 0) {
          if (!tagsDiv) {
            tagsDiv = document.createElement('div');
            tagsDiv.className = 'scene-tags';
            activeCard.appendChild(tagsDiv);
          }
          tagsDiv.innerHTML = '';
          currentInspectorTags.forEach(t => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = t;
            tagsDiv.appendChild(span);
          });
        } else if (tagsDiv) {
          tagsDiv.remove();
        }

        // Handle Plotline Move
        const currentParentRow = activeCard.closest('.timeline-row');
        const plotRows = Array.from(document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)'));
        if (selectedPlotlineVal === 'tray' && currentParentRow) {
          activeCard.classList.add('unplaced-card');
          trayContent.appendChild(activeCard);
        } else if (selectedPlotlineVal !== 'tray') {
          const targetRowIndex = parseInt(selectedPlotlineVal, 10);
          const targetRow = plotRows[targetRowIndex];
          if (targetRow && targetRow !== currentParentRow) {
            let chapterIdx = 0;
            if (currentParentRow) {
              const oldCells = Array.from(currentParentRow.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)'));
              chapterIdx = Math.max(0, oldCells.indexOf(activeCard.closest('.track-cell')));
            }
            const newCells = targetRow.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)');
            if (newCells[chapterIdx]) {
              activeCard.classList.remove('unplaced-card');
              newCells[chapterIdx].appendChild(activeCard);
            }
          }
        }
        showToast('Scene updated');
      } else {
        // Create Brand-New Card
        const newCard = buildSceneCardElement(titleVal, summaryHtml, currentInspectorTags);
        let destination = pendingTargetContainer || trayContent;

        const plotRows = Array.from(document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)'));
        if (selectedPlotlineVal === 'tray') {
          destination = trayContent;
        } else if (destination && destination.classList.contains('track-cell')) {
          const originRow = destination.closest('.timeline-row');
          const originCells = Array.from(originRow.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)'));
          const chapterIdx = Math.max(0, originCells.indexOf(destination));
          const chosenRow = plotRows[parseInt(selectedPlotlineVal, 10)];
          if (chosenRow) {
            const chosenCells = chosenRow.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)');
            if (chosenCells[chapterIdx]) destination = chosenCells[chapterIdx];
          }
        }

        if (destination === trayContent) {
          newCard.classList.add('unplaced-card');
          trayContent.appendChild(newCard);
        } else if (destination) {
          newCard.classList.remove('unplaced-card');
          destination.appendChild(newCard);
        }
        showToast('New scene added to timeline');
      }

      saveTimelineState(); // FORCE SAVE TO STORAGE
      refreshAllTrackCells();
      applySearchAndFilter();
      renderMinimap();
      closeInspector();
    });
  }

  if (inspectorCancelBtn) inspectorCancelBtn.addEventListener('click', closeInspector);

  if (inspectorDeleteBtn) {
    inspectorDeleteBtn.addEventListener('click', () => {
      if (activeCard) {
        activeCard.remove();
        saveTimelineState(); // FORCE SAVE TO STORAGE
        refreshAllTrackCells();
        renderMinimap();
        showToast('Scene deleted');
        closeInspector();
      }
    });
  }

  if (closeInspectorBtn) closeInspectorBtn.addEventListener('click', closeInspector);
  if (timelineWorkspace) {
    timelineWorkspace.addEventListener('click', (e) => {
      if (e.target.classList.contains('track-cell') || e.target.classList.contains('timeline-workspace')) {
        closeInspector();
      }
    });
  }


  // --- 9. EVENT BINDING ENGINE ---
  function ensureCellHoverPrompt(cell) {
    if (cell.classList.contains('add-chapter-placeholder') || cell.classList.contains('add-chapter-cell')) return;
    
    // 1. Destroy any dead button loaded from the HTML save
    let existingBtn = cell.querySelector('.cell-new-scene-prompt');
    if (existingBtn) {
      existingBtn.remove();
    }

    // 2. Create a fresh, clickable button
    let promptBtn = document.createElement('button');
    promptBtn.type = 'button';
    promptBtn.className = 'cell-new-scene-prompt';
    promptBtn.innerHTML = `<span>+</span>New Scene`;
    
    promptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInspectorForNewScene(cell);
    });
    
    cell.appendChild(promptBtn);
    cell.classList.toggle('has-cards', cell.querySelector('.scene-card') !== null);
  }

  function refreshAllTrackCells() {
    document.querySelectorAll('.track-cell').forEach(ensureCellHoverPrompt);
  }

  function attachCardListeners(card) {
    if (card.dataset.listenersBound === 'true') return;
    card.dataset.listenersBound = 'true';

    card.addEventListener('click', (e) => {
      // Don't open inspector if they clicked a tag
      if (e.target.classList.contains('char-tag')) return;
      e.stopPropagation();
      openInspectorForCard(card);
    });

    card.addEventListener('dragstart', function(e) {
      e.stopPropagation();
      draggedCard = this;
      const ghost = this.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = '-1000px';
      ghost.style.width = this.offsetWidth + 'px';
      ghost.style.opacity = '1';
      ghost.style.backgroundColor = '#ffffff';
      ghost.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
      ghost.style.transform = 'rotate(2deg)';
      document.body.appendChild(ghost);
      const rect = this.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
      setTimeout(() => {
        document.body.removeChild(ghost);
        this.classList.add('is-dragging');
      }, 0);
    });

    card.addEventListener('dragend', function(e) {
      e.stopPropagation();
      this.classList.remove('is-dragging');
      draggedCard = null;
      saveTimelineState(); // Trigger save on drop
      refreshAllTrackCells();
      renderMinimap();
    });
  }

  function attachDropZoneListeners(zone) {
    if (zone.dataset.dropBound === 'true') return;
    zone.dataset.dropBound = 'true';

    zone.addEventListener('dragover', function(e) {
      if (!draggedCard) return;
      e.preventDefault();
      this.classList.add('drag-hover');
    });

    zone.addEventListener('dragleave', function() {
      this.classList.remove('drag-hover');
    });

    zone.addEventListener('drop', function(e) {
      if (!draggedCard) return;
      e.preventDefault();
      this.classList.remove('drag-hover');

      if (this.classList.contains('tray-content')) {
        draggedCard.classList.add('unplaced-card');
      } else {
        draggedCard.classList.remove('unplaced-card');
      }

      this.appendChild(draggedCard);

      const parentRow = this.closest('.timeline-row');
      if (parentRow && this.classList.contains('inactive-track')) {
        const validCells = Array.from(parentRow.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)'));
        const droppedIndex = validCells.indexOf(this) + 1;
        parentRow.dataset.endChapter = droppedIndex;
        updateSingleRowEndpoint(parentRow);
      }
      refreshAllTrackCells();
      renderMinimap();
    });
  }

  function attachFocusModeListeners() {
    const plotRows = document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)');
    plotRows.forEach(row => {
      const focusBtn = row.querySelector('.focus-btn');
      if (!focusBtn || focusBtn.dataset.focusBound === 'true') return;
      focusBtn.dataset.focusBound = 'true';

      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isAlreadyFocused = row.classList.contains('focused-row');
        document.querySelectorAll('.timeline-row').forEach(r => r.classList.remove('focused-row'));
        document.querySelectorAll('.focus-btn').forEach(b => b.classList.remove('active'));

        if (isAlreadyFocused) {
          timelineBoard.classList.remove('focus-mode-active');
          showToast('Focus mode off');
        } else {
          timelineBoard.classList.add('focus-mode-active');
          row.classList.add('focused-row');
          focusBtn.classList.add('active');
          const plotName = row.querySelector('.plotline-name-input')?.value || 'Plotline';
          showToast(`Focusing on ${plotName}`);
        }
      });
    });
  }


  // --- 10. PLOTLINE SWAPPING & ENDPOINTS ---
  function attachRowSwapListeners(row) {
    const handle = row.querySelector('.drag-handle');
    if (!handle || row.dataset.swapBound === 'true') return;
    row.dataset.swapBound = 'true';

    handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));
    handle.addEventListener('mouseup', () => row.setAttribute('draggable', 'false'));

    row.addEventListener('dragstart', (e) => {
      if (draggedCard) return;
      draggedRow = row;
      row.classList.add('row-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', (e) => {
      if (!draggedRow || draggedRow === row) return;
      e.preventDefault();
      row.classList.add('row-drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('row-drag-over'));
    row.addEventListener('drop', (e) => {
      if (!draggedRow || draggedRow === row) return;
      e.preventDefault();
      row.classList.remove('row-drag-over');

      const nextA = draggedRow.nextSibling;
      const nextB = row.nextSibling;
      const parent = row.parentNode;
      if (nextA === row) { parent.insertBefore(row, draggedRow); } 
      else if (nextB === draggedRow) { parent.insertBefore(draggedRow, row); } 
      else { parent.insertBefore(draggedRow, nextB); parent.insertBefore(row, nextA); }
      renderMinimap();
    });
    row.addEventListener('dragend', () => {
      row.setAttribute('draggable', 'false');
      row.classList.remove('row-dragging');
      document.querySelectorAll('.row-drag-over').forEach(r => r.classList.remove('row-drag-over'));
      draggedRow = null;
      saveTimelineState();
      renderMinimap();
    });
  }

  function updateSingleRowEndpoint(row) {
    row.querySelectorAll('.is-endpoint').forEach(cell => cell.classList.remove('is-endpoint'));
    row.querySelectorAll('.endpoint-handle').forEach(handle => handle.remove());

    const colorDot = row.querySelector('.plotline-color');
    if (colorDot) {
      const computedColor = window.getComputedStyle(colorDot).backgroundColor;
      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
        row.style.setProperty('--handle-color', computedColor);
      }
    }

    const chapterCells = Array.from(row.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)'));
    if (chapterCells.length === 0) return;

    let endChapter = parseInt(row.dataset.endChapter, 10);
    if (isNaN(endChapter) || endChapter > chapterCells.length || endChapter < 1) {
      endChapter = chapterCells.length;
      row.dataset.endChapter = endChapter;
    }

    let evacuatedTitles = [];
    chapterCells.forEach((cell, idx) => {
      if (idx < endChapter) {
        cell.classList.remove('inactive-track');
      } else {
        cell.classList.add('inactive-track');
        const cards = cell.querySelectorAll('.scene-card');
        if (cards.length > 0) {
          cards.forEach(card => {
            const title = card.querySelector('.scene-title')?.innerText || 'Untitled Scene';
            evacuatedTitles.push(title);
            card.classList.add('unplaced-card');
            trayContent.appendChild(card);
          });
          cell.classList.remove('has-cards'); 
        }
      }
    });

    if (evacuatedTitles.length > 0) {
      showToast(evacuatedTitles.length === 1 ? `"${evacuatedTitles[0]}" moved to Idea Tray` : `${evacuatedTitles.length} scenes moved to Idea Tray`);
      refreshAllTrackCells();
      renderMinimap(); 
    }

    const targetCell = chapterCells[endChapter - 1];
    if (targetCell) {
      targetCell.classList.add('is-endpoint');
      const handle = document.createElement('div');
      handle.className = 'endpoint-handle';
      handle.title = 'Drag left or right to adjust plotline length';

      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); e.preventDefault();
        resizingRow = row;
        handle.classList.add('is-resizing');
        document.body.style.cursor = 'ew-resize';
      });
      targetCell.appendChild(handle);
    }
  }

  function updateTimelineEndpoints() {
    document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').forEach(row => updateSingleRowEndpoint(row));
  }

  document.addEventListener('mousemove', (e) => {
    if (!resizingRow) return;
    const chapterCells = Array.from(resizingRow.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)'));
    chapterCells.forEach((cell, idx) => {
      const rect = cell.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        const newEnd = idx + 1;
        if (parseInt(resizingRow.dataset.endChapter, 10) !== newEnd) {
          resizingRow.dataset.endChapter = newEnd;
          updateSingleRowEndpoint(resizingRow);
        }
      }
    });
  });

  document.addEventListener('mouseup', () => {
    if (resizingRow) {
      resizingRow = null;
      document.body.style.cursor = '';
      document.querySelectorAll('.endpoint-handle.is-resizing').forEach(h => h.classList.remove('is-resizing'));
      saveTimelineState();
    }
  });


  // --- 11. CHAPTER & PLOTLINE ADD/DELETE ACTIONS ---
  const addChapterBtn = document.querySelector('.add-chapter-btn') || document.querySelector('.add-chapter-cell .ghost-btn');
  if (addChapterBtn) {
    addChapterBtn.addEventListener('click', () => {
      const headerRow = document.querySelector('.header-row');
      const addChapterCell = headerRow.querySelector('.add-chapter-cell');
      const existingChapters = headerRow.querySelectorAll('.chapter-cell').length;
      const newChapterNum = existingChapters + 1;

      const newHeaderCell = document.createElement('div');
      newHeaderCell.className = 'grid-cell chapter-cell';
      newHeaderCell.innerHTML = `
        <input type="text" class="chapter-label-input" value="Chapter ${newChapterNum}" />
        <button class="add-scene-btn" title="Add Scene">+</button>
      `;
      headerRow.insertBefore(newHeaderCell, addChapterCell);

      const plotRows = document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)');
      plotRows.forEach(row => {
        const prevTotalChapters = existingChapters;
        const currentEnd = parseInt(row.dataset.endChapter, 10) || prevTotalChapters;
        const newTrackCell = document.createElement('div');
        newTrackCell.className = 'grid-cell track-cell drop-zone';

        const placeholder = row.querySelector('.add-chapter-placeholder, .add-chapter-cell');
        if (placeholder) row.insertBefore(newTrackCell, placeholder);
        else row.appendChild(newTrackCell);

        attachDropZoneListeners(newTrackCell);
        if (currentEnd === prevTotalChapters) row.dataset.endChapter = newChapterNum;
      });

      syncGridColumns();
      injectDeleteButtons();
      attachChapterAddSceneButtons();
      updateTimelineEndpoints();
      refreshAllTrackCells();
      renderMinimap();
      if (timelineWorkspace) timelineWorkspace.scrollTo({ left: timelineWorkspace.scrollWidth, behavior: 'smooth' });
    });
  }

  const addPlotlineBtn = document.querySelector('.add-plotline-btn') || document.querySelector('.add-plotline-header .ghost-btn');
  const plotlinePalette = [
    { hex: '#10b981', light: 'rgba(16, 185, 129, 0.35)' },
    { hex: '#f59e0b', light: 'rgba(245, 158, 11, 0.35)' },
    { hex: '#ef4444', light: 'rgba(239, 68, 68, 0.35)' },
    { hex: '#06b6d4', light: 'rgba(6, 182, 212, 0.35)' },
    { hex: '#ec4899', light: 'rgba(236, 72, 153, 0.35)' }
  ];

  if (addPlotlineBtn) {
    addPlotlineBtn.addEventListener('click', () => {
      const plotRows = document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)');
      const colorObj = plotlinePalette[plotRows.length % plotlinePalette.length];
      const chapterCount = document.querySelectorAll('.header-row .chapter-cell').length;

      const newRow = document.createElement('div');
      newRow.className = 'timeline-row';
      newRow.style.setProperty('--row-color', colorObj.light);
      newRow.style.setProperty('--handle-color', colorObj.hex);
      newRow.dataset.endChapter = chapterCount;

      const headerCell = document.createElement('div');
      headerCell.className = 'grid-cell plotline-header';
      headerCell.innerHTML = `
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="plotline-color" style="background-color: ${colorObj.hex};"></div>
        <input type="text" class="plotline-name-input" value="New Plotline" />
        <button class="focus-btn" title="Focus Mode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
      `;
      newRow.appendChild(headerCell);

      for (let i = 0; i < chapterCount; i++) {
        const trackCell = document.createElement('div');
        trackCell.className = 'grid-cell track-cell drop-zone';
        newRow.appendChild(trackCell);
        attachDropZoneListeners(trackCell);
      }
      const placeholderCell = document.createElement('div');
      placeholderCell.className = 'grid-cell track-cell add-chapter-placeholder';
      newRow.appendChild(placeholderCell);

      const addPlotlineRow = addPlotlineBtn.closest('.timeline-row');
      timelineBoard.insertBefore(newRow, addPlotlineRow);

      attachRowSwapListeners(newRow);
      attachFocusModeListeners();
      syncGridColumns();
      injectDeleteButtons();
      updateTimelineEndpoints();
      refreshAllTrackCells();
      renderMinimap();
    });
  }

  function moveCardsToIdeaTray(cardsNodeList) {
    if (!trayContent) return;
    cardsNodeList.forEach(card => {
      if (card === activeCard) closeInspector();
      card.classList.add('unplaced-card');
      trayContent.appendChild(card);
    });
  }

  function renumberChapters() {
    document.querySelectorAll('.header-row .chapter-cell').forEach((cell, idx) => {
      const input = cell.querySelector('.chapter-label-input');
      if (input && /^Chapter \d+$/i.test(input.value.trim())) input.value = `Chapter ${idx + 1}`;
    });
  }

  function injectDeleteButtons() {
    document.querySelectorAll('.header-row .chapter-cell').forEach((cell) => {
      if (cell.querySelector('.delete-chapter-btn')) return;
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-item-btn delete-chapter-btn';
      delBtn.title = 'Remove Chapter';
      delBtn.innerHTML = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const allChapters = Array.from(document.querySelectorAll('.header-row .chapter-cell'));
        if (allChapters.length <= 1) return;
        const chapterIndex = allChapters.indexOf(cell);
        
        document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').forEach(row => {
          const trackCells = row.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)');
          if (trackCells[chapterIndex]) {
            moveCardsToIdeaTray(trackCells[chapterIndex].querySelectorAll('.scene-card'));
            trackCells[chapterIndex].remove();
          }
          if ((parseInt(row.dataset.endChapter, 10) || allChapters.length) > allChapters.length - 1) {
            row.dataset.endChapter = allChapters.length - 1;
          }
        });
        cell.remove();
        renumberChapters();
        syncGridColumns();
        updateTimelineEndpoints();
        refreshAllTrackCells();
        renderMinimap();
      });
      cell.appendChild(delBtn);
    });

    document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').forEach(row => {
      const header = row.querySelector('.plotline-header');
      if (!header || header.querySelector('.delete-plotline-btn')) return;
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-item-btn delete-plotline-btn';
      delBtn.innerHTML = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').length <= 1) return;
        moveCardsToIdeaTray(row.querySelectorAll('.scene-card'));
        row.remove();
        renderMinimap();
      });
      header.appendChild(delBtn);
    });
  }

  function attachChapterAddSceneButtons() {
    document.querySelectorAll('.header-row .chapter-cell').forEach((chapterCell, chapterIdx) => {
      const addBtn = chapterCell.querySelector('.add-scene-btn');
      if (!addBtn || addBtn.dataset.bound === 'true') return;
      addBtn.dataset.bound = 'true';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plotRows = Array.from(document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)'));
        let targetCell = null;
        for (const row of plotRows) {
          const candidate = row.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)')[chapterIdx];
          if (candidate && !candidate.classList.contains('inactive-track') && !candidate.querySelector('.scene-card')) {
            targetCell = candidate; break;
          }
        }
        if (!targetCell && plotRows[0]) targetCell = plotRows[0].querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)')[chapterIdx];
        if (targetCell) openInspectorForNewScene(targetCell);
      });
    });
  }

  const addUnplacedBtn = document.querySelector('.add-unplaced-btn');
  if (addUnplacedBtn) {
    addUnplacedBtn.addEventListener('click', (e) => { e.stopPropagation(); openInspectorForNewScene(trayContent); });
  }

  if (trayHeader && ideaTray) {
    trayHeader.addEventListener('click', () => {
      ideaTray.classList.toggle('collapsed');
      syncFloatingPositions();
      setTimeout(updateMinimapViewport, 310);
    });
  }

  function syncGridColumns() {
    const chapterCount = document.querySelectorAll('.header-row .chapter-cell').length;
    document.querySelectorAll('.timeline-row').forEach(row => {
      if (row.classList.contains('add-plotline-row')) return;
      row.style.gridTemplateColumns = `200px repeat(${chapterCount}, 280px) 180px`;
    });
  }


  // --- 12. MINIMAP LOGIC ---
  let isPanningMinimap = false;
  function renderMinimap() {
    if (!minimapBoard) return;
    const viewport = minimapBoard.querySelector('.minimap-viewport') || document.createElement('div');
    viewport.className = 'minimap-viewport';
    minimapBoard.innerHTML = '';
    const totalChapters = Math.max(1, document.querySelectorAll('.header-row .chapter-cell').length);

    document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').forEach(row => {
      const miniRow = document.createElement('div');
      miniRow.className = 'minimap-row';
      const colorDot = row.querySelector('.plotline-color');
      const dotColor = colorDot ? window.getComputedStyle(colorDot).backgroundColor : '#4A90E2';

      row.querySelectorAll('.track-cell:not(.add-chapter-placeholder):not(.add-chapter-cell)').forEach((cell, idx) => {
        if (cell.querySelector('.scene-card')) {
          const miniCard = document.createElement('div');
          miniCard.className = 'minimap-card';
          miniCard.style.backgroundColor = dotColor;
          miniCard.style.left = `${(idx / totalChapters) * 90 + 4}%`;
          miniCard.style.width = `${Math.max(8, (1 / totalChapters) * 80)}%`;
          miniRow.appendChild(miniCard);
        }
      });
      minimapBoard.appendChild(miniRow);
    });
    minimapBoard.appendChild(viewport);
    updateMinimapViewport();
  }

  function updateMinimapViewport() {
    if (!minimapBoard || !timelineWorkspace) return;
    const viewport = minimapBoard.querySelector('.minimap-viewport');
    if (!viewport) return;
    const scrollWidth = Math.max(1, timelineWorkspace.scrollWidth);
    const scrollHeight = Math.max(1, timelineWorkspace.scrollHeight);
    viewport.style.width = `${Math.max(18, (timelineWorkspace.clientWidth / scrollWidth) * 100)}%`;
    viewport.style.height = `${Math.max(20, (timelineWorkspace.clientHeight / scrollHeight) * 100)}%`;
    viewport.style.left = `${(timelineWorkspace.scrollLeft / scrollWidth) * 100}%`;
    viewport.style.top = `${(timelineWorkspace.scrollTop / scrollHeight) * 100}%`;
  }

  function panWorkspaceFromMinimap(e) {
    if (!minimapBoard || !timelineWorkspace) return;
    const rect = minimapBoard.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    timelineWorkspace.scrollLeft = clickX * timelineWorkspace.scrollWidth - (timelineWorkspace.clientWidth / 2);
    timelineWorkspace.scrollTop = clickY * timelineWorkspace.scrollHeight - (timelineWorkspace.clientHeight / 2);
  }

  if (minimapBoard && minimapContainer) {
    minimapBoard.addEventListener('mousedown', (e) => {
      isPanningMinimap = true; minimapContainer.classList.add('is-using'); panWorkspaceFromMinimap(e);
    });
  }
  document.addEventListener('mousemove', (e) => { if (isPanningMinimap) panWorkspaceFromMinimap(e); });
  document.addEventListener('mouseup', () => {
    if (isPanningMinimap) { isPanningMinimap = false; if (minimapContainer) minimapContainer.classList.remove('is-using'); }
  });
  if (timelineWorkspace) timelineWorkspace.addEventListener('scroll', updateMinimapViewport);
  window.addEventListener('resize', () => { syncFloatingPositions(); updateMinimapViewport(); });


  // --- 13. SPACEBAR PANNING LOGIC ---
  let isSpacePressed = false, isWorkspacePanning = false, panStartX, panStartY, initialScrollLeft, initialScrollTop;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
      if (!isSpacePressed) { e.preventDefault(); isSpacePressed = true; timelineWorkspace.classList.add('is-panning-ready'); }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { isSpacePressed = false; isWorkspacePanning = false; timelineWorkspace.classList.remove('is-panning-ready', 'is-panning-active'); }
  });
  if (timelineWorkspace) {
    timelineWorkspace.addEventListener('mousedown', (e) => {
      if (isSpacePressed) {
        isWorkspacePanning = true; timelineWorkspace.classList.add('is-panning-active');
        panStartX = e.pageX - timelineWorkspace.offsetLeft; panStartY = e.pageY - timelineWorkspace.offsetTop;
        initialScrollLeft = timelineWorkspace.scrollLeft; initialScrollTop = timelineWorkspace.scrollTop;
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!isWorkspacePanning) return;
      e.preventDefault();
      timelineWorkspace.scrollLeft = initialScrollLeft - ((e.pageX - timelineWorkspace.offsetLeft - panStartX) * 1.5);
      timelineWorkspace.scrollTop = initialScrollTop - ((e.pageY - timelineWorkspace.offsetTop - panStartY) * 1.5);
    });
    window.addEventListener('mouseup', () => {
      if (isWorkspacePanning) { isWorkspacePanning = false; timelineWorkspace.classList.remove('is-panning-active'); }
    });
  }


  // --- 14. SEARCH AND FILTER POPOVERS ---
  function applySearchAndFilter() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    document.querySelectorAll('.scene-card').forEach(card => {
      const title = (card.querySelector('.scene-title')?.innerText || '').toLowerCase();
      const summary = (card.querySelector('.scene-summary')?.innerText || '').toLowerCase();
      const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.innerText.trim().toLowerCase());
      const matchesSearch = !query || title.includes(query) || summary.includes(query) || tags.some(t => t.includes(query));
      const matchesTag = !activeTagFilter || tags.includes(activeTagFilter.toLowerCase());
      card.classList.toggle('filtered-out', !(matchesSearch && matchesTag));
    });
  }

  if (searchInput) searchInput.addEventListener('input', applySearchAndFilter);


  // ==========================================
  // FINAL BINDING SEQUENCE ON LOAD
  // ==========================================
  document.querySelectorAll('.scene-card').forEach(attachCardListeners);
  document.querySelectorAll('.drop-zone, .tray-content').forEach(attachDropZoneListeners);
  document.querySelectorAll('.timeline-row:not(.header-row):not(.add-plotline-row)').forEach(attachRowSwapListeners);
  
  attachFocusModeListeners();
  attachChapterAddSceneButtons();
  syncGridColumns();
  injectDeleteButtons();
  updateTimelineEndpoints();
  refreshAllTrackCells();
  syncFloatingPositions();
  renderMinimap();

 // --- 15. LIVE @ MENTION AUTO-COMPLETE FOR SUMMARY SECTION ---
  const mentionDropdown = document.createElement('div');
  mentionDropdown.className = 'mention-dropdown';
  document.body.appendChild(mentionDropdown);

  let activeMentionState = null;
  let selectedMentionIndex = -1; // Tracks keyboard navigation

  if (inspectorSummary) {
    // 1. Listen for typing to trigger the dropdown
    inspectorSummary.addEventListener('input', (e) => {
      const cursorPos = inspectorSummary.selectionStart;
      const textToCursor = inspectorSummary.value.substring(0, cursorPos);
      const lastAtIdx = textToCursor.lastIndexOf('@');
      
      if (lastAtIdx !== -1 && (lastAtIdx === 0 || /[\s\n]/.test(textToCursor[lastAtIdx - 1]))) {
        const query = textToCursor.substring(lastAtIdx + 1);
        if (!query.includes(' ')) {
          activeMentionState = { startIdx: lastAtIdx, query: query.toLowerCase() };
          renderMentionDropdown();
          return;
        }
      }
      closeMentionDropdown();
    });

    // 2. Intercept Keyboard Navigation (Tab, Arrows, Enter)
    inspectorSummary.addEventListener('keydown', (e) => {
      if (!activeMentionState || mentionDropdown.style.display === 'none') return;

      const items = mentionDropdown.querySelectorAll('.mention-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault(); // Prevents cursor from moving or tabbing to next element
        selectedMentionIndex = (selectedMentionIndex + 1) % items.length;
        updateMentionFocus(items);
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        selectedMentionIndex = (selectedMentionIndex - 1 + items.length) % items.length;
        updateMentionFocus(items);
      } else if (e.key === 'Enter') {
        e.preventDefault(); // Prevents adding a new line in the summary
        // Default to the first item if they hit enter without navigating
        const targetIndex = selectedMentionIndex > -1 ? selectedMentionIndex : 0;
        if (items[targetIndex]) items[targetIndex].click(); 
      } else if (e.key === 'Escape') {
        closeMentionDropdown();
      }
    });
  }

  function updateMentionFocus(items) {
    items.forEach((item, idx) => {
      if (idx === selectedMentionIndex) {
        item.classList.add('focused');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('focused');
      }
    });
  }

  function renderMentionDropdown() {
    if (!activeMentionState || !inspectorSummary) return closeMentionDropdown();
    
    const matches = Object.values(globalCharacterRoster).filter(char => 
      char.name.toLowerCase().startsWith(activeMentionState.query)
    );
    
    if (matches.length === 0) return closeMentionDropdown();
    
    mentionDropdown.innerHTML = '';
    selectedMentionIndex = -1; // Reset focus on fresh render

    matches.forEach((char, idx) => {
      const item = document.createElement('div');
      item.className = 'mention-item';
      
      const snippet = char.coreBelief || char.weaknesses || 'Character Profile';
      item.innerHTML = `
        <span class="mention-name">@${char.name}</span>
        <span class="mention-desc">${snippet}</span>
      `;
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        insertMention(char.name);
      });
      mentionDropdown.appendChild(item);
    });
    
    const rect = inspectorSummary.getBoundingClientRect();
    mentionDropdown.style.top = `${rect.bottom + 4}px`;
    mentionDropdown.style.left = `${rect.left}px`;
    mentionDropdown.style.width = `${rect.width}px`;
    mentionDropdown.style.display = 'block';
  }

  function insertMention(name) {
    if (!activeMentionState || !inspectorSummary) return;
    
    const text = inspectorSummary.value;
    const before = text.substring(0, activeMentionState.startIdx);
    const after = text.substring(inspectorSummary.selectionStart);
    
    inspectorSummary.value = `${before}@${name} ${after}`;
    inspectorSummary.focus();
    
    const newCursorPos = activeMentionState.startIdx + name.length + 2; 
    inspectorSummary.setSelectionRange(newCursorPos, newCursorPos);
    
    closeMentionDropdown();
    saveTimelineState(); 
  }

  function closeMentionDropdown() {
    mentionDropdown.style.display = 'none';
    activeMentionState = null;
    selectedMentionIndex = -1;
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mention-dropdown') && e.target !== inspectorSummary) {
      closeMentionDropdown();
    }
  });
});