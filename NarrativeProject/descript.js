document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id') || 'tut-character';

  let narraProjects = JSON.parse(localStorage.getItem('narra_projects') || '[]');
  let projectIndex = narraProjects.findIndex(p => p.id === projectId);

  // Fallback if opened directly without dashboard initialization
  if (projectIndex === -1) {
    const fallbackProject = {
      id: projectId,
      title: projectId === 'tut-character' ? 'Character Tutorial' : 'Unnamed Character Sheet',
      type: 'character',
      lastModified: new Date().toISOString(),
      data: { characters: [] }
    };
    narraProjects.push(fallbackProject);
    projectIndex = narraProjects.length - 1;
  }

  let thisProject = narraProjects[projectIndex];

  // Update Top Header Title
  const fileTitleDisplay = document.getElementById('file-title-display');
  if (fileTitleDisplay && thisProject.title) {
    fileTitleDisplay.textContent = thisProject.title;
  }

  // Helper to create a blank 4-part character data structure
  function createBlankCharacter(name = 'New Character') {
    return {
      id: 'char-item-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: name,
      // Part 1: Character Map
      negExp: '',
      coreBelief: '',
      statedLie: '',
      mapGoalsTitle: '',
      mapRelationshipsTitle: '',
      mapLifestyleTitle: '',
      mapPresentationTitle: '',
      mapDialogueTitle: '',
      mapGoals: '',
      mapRelationships: '',
      mapLifestyle: '',
      mapPresentation: '',
      mapDialogue: '',
      // Part 2: More Attributes
      mood: '',
      hobbies: '',
      skills: '',
      habits: '',
      tastes: '',
      weaknesses: '',
      // Part 3: Character Arc
      arcReinforces: '',
      arcChallenges: '',
      overcomeVerdict: '', // 'yes' | 'no' | 'worse'
      arcGoalsTitle: '',
      arcRelationshipsTitle: '',
      arcLifestyleTitle: '',
      arcPresentationTitle: '',
      arcDialogueTitle: '',
      arcGoals: '',
      arcRelationships: '',
      arcLifestyle: '',
      arcPresentation: '',
      arcDialogue: '',
      arcOutcomes: '',
      // Part 4: Perspectives
      sharedNegExp: '',
      perspectives: Array.from({ length: 5 }, () => ({
        character: '',
        copingStrategy: '',
        relationship: ''
      }))
    };
  }

  // --- SEED TUTORIAL DATA IF OPENING 'tut-character' ---
  if (projectId === 'tut-character' && (!thisProject.data.characters || thisProject.data.characters.length === 0)) {
    const kaelen = createBlankCharacter('Kaelen');
    kaelen.id = 'char-tut-1';
    kaelen.negExp = 'Abandoned by his commanding officer during the Siege of Oakhaven when holding the line became politically inconvenient.';
    kaelen.coreBelief = 'To prevent betrayal from destroying me again, I must never rely on anyone else or commit to a cause larger than my own survival.';
    kaelen.statedLie = 'Loyalties are just contracts waiting to expire. Looking out for yourself is the only honest way to live.';
    
    // Part 1
    kaelen.mapGoalsTitle = 'Escape to the Outer Isles';
    kaelen.mapGoals = '<ul><li>Save enough coin as a freelance drifter.</li><li>Avoid standing armies or guild registrations.</li></ul>';
    kaelen.mapRelationshipsTitle = 'Transactional Alliances';
    kaelen.mapRelationships = 'Keeps allies at arm\'s length; uses transactional humor to deflect genuine closeness.';
    kaelen.mapLifestyleTitle = 'Nomadic Vagabond';
    kaelen.mapLifestyle = 'Nomadic, sleeps light, never stays in one tavern or city for more than a week.';
    kaelen.mapPresentationTitle = 'Stripped Insignias';
    kaelen.mapPresentation = 'Wears weathered, unmarked armor stripped of old military insignia.';
    kaelen.mapDialogueTitle = 'Defensive Sarcasm';
    kaelen.mapDialogue = 'Clipped, sarcastic, and pragmatic; changes the subject whenever the past is mentioned.';
    
    // Part 2
    kaelen.mood = 'Vigilant, dry-witted, quietly simmering when cornered.';
    kaelen.hobbies = 'Carving driftwood, maintaining his twin-blades, eavesdropping on merchant gossip.';
    kaelen.skills = '<ul><li>Close-quarters twin-blade combat</li><li>Tactical reconnaissance</li><li>Lockpicking</li></ul>';
    kaelen.habits = 'Always sits facing the door; checks exit routes before sitting down.';
    kaelen.tastes = 'Bitter black tea, quiet rain, simple campfires over crowded inns.';
    kaelen.weaknesses = 'Cannot walk away from rookies or civilians being used as pawns by superiors.';
    
    // Part 3
    kaelen.arcReinforces = 'A local rebel cell hires him for a smuggling run and immediately tries to use him as a decoy, proving his cynicism right.';
    kaelen.arcChallenges = 'When Kaelen is wounded in an ambush, a young courier risks capture to drag him to safety with zero personal gain.';
    kaelen.overcomeVerdict = 'yes';
    
    kaelen.arcGoalsTitle = 'Dismantle the Decree';
    kaelen.arcGoals = 'Shifts from fleeing the realm to actively dismantling the Chancellor\'s false decree.';
    kaelen.arcRelationshipsTitle = 'Mentorship & Trust';
    kaelen.arcRelationships = 'Allows himself to trust the rebellion\'s core squad and mentor younger fighters.';
    kaelen.arcLifestyleTitle = 'Sanctuary Base';
    kaelen.arcLifestyle = 'Establishes a permanent base of operations at the hidden sanctuary.';
    kaelen.arcPresentationTitle = 'Fallen Crest';
    kaelen.arcPresentation = 'Repairs and openly wears the crest of Oakhaven\'s fallen defenders.';
    kaelen.arcDialogueTitle = 'Sincere Conviction';
    kaelen.arcDialogue = 'Speaks directly about what he values instead of hiding behind irony.';
    
    kaelen.arcOutcomes = 'His willingness to stand and fight inspires the fractured rebel cells to unite during the final siege.';
    kaelen.sharedNegExp = 'Surviving the fall of Oakhaven and the High Council\'s subsequent cover-up.';
    
    // Part 4
    kaelen.perspectives[0] = {
      character: 'The Chancellor',
      copingStrategy: 'Total authoritarian control — believes ruthless order is the only way to prevent chaos.',
      relationship: 'Primary Antagonist / Former architect of the Oakhaven cover-up.'
    };
    kaelen.perspectives[1] = {
      character: 'Lyra (The Courier)',
      copingStrategy: 'Radical idealism — throws herself into dangerous missions to prove the world can still be saved.',
      relationship: 'Moral foil who challenges Kaelen\'s cynicism.'
    };

    thisProject.data.characters = [kaelen];
    localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
  } else if (!thisProject.data.characters) {
    thisProject.data.characters = [];
  }

  let activeCharacterId = null;

  // DOM Elements
  const charListEl = document.getElementById('character-list');
  const activeDossierEl = document.getElementById('active-dossier');
  const emptyStateEl = document.getElementById('empty-state');
  const searchInput = document.getElementById('char-search');
  const saveIndicator = document.getElementById('save-indicator');
  const perspectivesGrid = document.getElementById('perspectives-grid');

  // Map of standard input IDs to character object keys
  const fieldMap = {
    'char-name': 'name',
    'char-neg-exp': 'negExp',
    'char-core-belief': 'coreBelief',
    'char-stated-lie': 'statedLie',
    'map-goals-title': 'mapGoalsTitle',
    'map-relationships-title': 'mapRelationshipsTitle',
    'map-lifestyle-title': 'mapLifestyleTitle',
    'map-presentation-title': 'mapPresentationTitle',
    'map-dialogue-title': 'mapDialogueTitle',
    'map-goals': 'mapGoals',
    'map-relationships': 'mapRelationships',
    'map-lifestyle': 'mapLifestyle',
    'map-presentation': 'mapPresentation',
    'map-dialogue': 'mapDialogue',
    'attr-mood': 'mood',
    'attr-hobbies': 'hobbies',
    'attr-skills': 'skills',
    'attr-habits': 'habits',
    'attr-tastes': 'tastes',
    'attr-weaknesses': 'weaknesses',
    'arc-reinforces': 'arcReinforces',
    'arc-challenges': 'arcChallenges',
    'arc-goals-title': 'arcGoalsTitle',
    'arc-relationships-title': 'arcRelationshipsTitle',
    'arc-lifestyle-title': 'arcLifestyleTitle',
    'arc-presentation-title': 'arcPresentationTitle',
    'arc-dialogue-title': 'arcDialogueTitle',
    'arc-goals': 'arcGoals',
    'arc-relationships': 'arcRelationships',
    'arc-lifestyle': 'arcLifestyle',
    'arc-presentation': 'arcPresentation',
    'arc-dialogue': 'arcDialogue',
    'arc-outcomes': 'arcOutcomes',
    'persp-shared-exp': 'sharedNegExp'
  };

  // --- DYNAMIC PERSPECTIVES PAGINATION ENGINE ---
  let currentPerspPage = 0;
  const ITEMS_PER_PAGE = 6;

  function renderPerspectivePage() {
    if (!activeCharacterId) return;
    const char = thisProject.data.characters.find(c => c.id === activeCharacterId);
    if (!char) return;

    // Ensure array exists
    if (!char.perspectives) {
      char.perspectives = Array.from({ length: 5 }, () => ({ character: '', copingStrategy: '', relationship: '' }));
    }

    const grid = document.getElementById('perspectives-grid');
    grid.innerHTML = '';

    const startIndex = currentPerspPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    // Render up to 6 slots per page
    for (let i = startIndex; i < endIndex; i++) {
      if (i < char.perspectives.length) {
        // 1. Render Existing Foil Card
        const p = char.perspectives[i];
        const card = document.createElement('div');
        card.className = 'perspective-node-card';
        card.innerHTML = `
          <div class="perspective-node-header">
            <span>Perspective Foil #${i + 1}</span>
            <button class="delete-foil-btn" data-idx="${i}" title="Delete Foil">×</button>
          </div>
          <div class="persp-input-group">
            <label>Character</label>
            <input type="text" class="persp-text-input persp-bind" data-persp-idx="${i}" data-persp-key="character" placeholder="Character name..." value="${p.character || ''}" />
          </div>
          <div class="persp-input-group">
            <label>Coping Strategy</label>
            <div class="sheet-textarea compact persp-bind" data-persp-idx="${i}" data-persp-key="copingStrategy" contenteditable="true" data-placeholder="How do they cope with the shared negative experience?">${p.copingStrategy || ''}</div>
          </div>
          <div class="persp-input-group">
            <label>Relationship to Main Sheet Character</label>
            <input type="text" class="persp-text-input persp-bind" data-persp-idx="${i}" data-persp-key="relationship" placeholder="Ally, rival, mirror, mentor..." value="${p.relationship || ''}" />
          </div>
        `;
        grid.appendChild(card);
      } else if (i === char.perspectives.length) {
        // 2. Render "+ Add Foil" button in the immediate next empty slot
        const addCard = document.createElement('div');
        addCard.className = 'add-foil-card';
        addCard.innerHTML = `+ Add Perspective Foil`;
        addCard.addEventListener('click', () => {
          char.perspectives.push({ character: '', copingStrategy: '', relationship: '' });
          saveCurrentCharacter();
          renderPerspectivePage();
        });
        grid.appendChild(addCard);
      }
    }

    // Re-apply rich text modal expanders to the newly generated divs
    bindRichTextModals();

    // Bind inputs to auto-save directly to the object array
    grid.querySelectorAll('.persp-bind').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.perspIdx, 10);
        const key = e.target.dataset.perspKey;
        char.perspectives[idx][key] = (e.target.tagName === 'DIV') ? e.target.innerHTML : e.target.value;
        saveCurrentCharacter(false); 
      });
    });

    // Bind Delete buttons
    grid.querySelectorAll('.delete-foil-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        char.perspectives.splice(idx, 1);
        
        // Push back a page if we delete the last item on the current page
        if (currentPerspPage > 0 && char.perspectives.length <= currentPerspPage * ITEMS_PER_PAGE) {
          currentPerspPage--;
        }
        saveCurrentCharacter();
        renderPerspectivePage();
      });
    });

    // Update Translucent Arrows
    const prevBtn = document.getElementById('persp-prev-btn');
    const nextBtn = document.getElementById('persp-next-btn');
    const pageInd = document.getElementById('persp-page-indicator');

    if (prevBtn) prevBtn.disabled = currentPerspPage === 0;
    if (nextBtn) nextBtn.disabled = char.perspectives.length < endIndex; // Turns solid if 6 slots are filled
    if (pageInd) pageInd.textContent = `Page ${currentPerspPage + 1}`;
  }

  // Pagination Event Listeners
  document.getElementById('persp-prev-btn')?.addEventListener('click', () => {
    if (currentPerspPage > 0) { currentPerspPage--; renderPerspectivePage(); }
  });
  document.getElementById('persp-next-btn')?.addEventListener('click', () => {
    currentPerspPage++; renderPerspectivePage();
  });
  
  // --- RENDER ROSTER DIRECTORY ---
  function renderDirectory(searchQuery = '') {
    charListEl.innerHTML = '';
    const filteredChars = thisProject.data.characters.filter(char =>
      (char.name || 'Unnamed').toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredChars.forEach(char => {
      const li = document.createElement('li');
      li.className = `char-list-item ${char.id === activeCharacterId ? 'active' : ''}`;
      // Clean HTML out of preview snippet if lists were used
      let cleanPreview = (char.coreBelief || 'No core belief defined yet...').replace(/<[^>]*>?/gm, '');
      li.innerHTML = `
        <span class="item-name">${char.name || 'Unnamed Character'}</span>
        <span class="item-preview">${cleanPreview}</span>
      `;
      li.addEventListener('click', () => loadCharacter(char.id));
      charListEl.appendChild(li);
    });
  }

 function saveCurrentCharacter(reRender = true) {
    if (!activeCharacterId) return;
    const char = thisProject.data.characters.find(c => c.id === activeCharacterId);
    if (!char) return;

    // Save standard fields
    Object.entries(fieldMap).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el) {
        char[key] = (el.tagName === 'DIV') ? el.innerHTML : el.value;
      }
    });

    thisProject.lastModified = new Date().toISOString();
    
    // --- THE RACE CONDITION FIX ---
    // 1. Fetch the absolute latest database right before saving
    let freshProjects = JSON.parse(localStorage.getItem('narra_projects') || '[]');
    let currentIdx = freshProjects.findIndex(p => p.id === thisProject.id);
    
    // 2. Inject this character's updates into the fresh database
    if (currentIdx !== -1) {
      freshProjects[currentIdx] = thisProject;
    } else {
      freshProjects.push(thisProject);
    }

    // 3. Save safely without wiping out the Timeline
    localStorage.setItem('narra_projects', JSON.stringify(freshProjects));

    if (saveIndicator) {
      saveIndicator.textContent = 'Saved just now';
    }
    
    if (reRender) {
      renderDirectory(searchInput.value);
    }
  }
// --- ROBUST "NEW CHARACTER" BUTTON LOGIC (EVENT DELEGATION) ---
  document.addEventListener('click', (e) => {
    // This looks for clicks on the specific ID, OR the class, OR any element inside the card
    const newCharBtn = e.target.closest('#sidebar-new-char-btn, .new-character-card');
    
    if (newCharBtn) {
      e.preventDefault();
      
      // 1. Generate unique ID for the new character
      const newCharId = 'char-' + Date.now();

      // 2. Build the default blank character schema
      const newCharacter = {
        id: newCharId,
        name: 'New Character',
        archetype: 'Unassigned',
        coreBelief: '',
        lie: '',
        weaknesses: '',
        strengths: '',
        arcOutcomes: '',
        overcomeVerdict: 'positive',
        perspectives: [] 
      };

      // 3. Ensure the array exists, then push the new character
      if (!thisProject.data.characters) {
        thisProject.data.characters = [];
      }
      thisProject.data.characters.push(newCharacter);

      // 4. Save safely to localStorage to prevent race conditions
      thisProject.lastModified = new Date().toISOString();
      let freshProjects = JSON.parse(localStorage.getItem('narra_projects') || '[]');
      let currentIdx = freshProjects.findIndex(p => p.id === thisProject.id);
      
      if (currentIdx !== -1) {
        freshProjects[currentIdx] = thisProject;
      } else {
        freshProjects.push(thisProject);
      }
      localStorage.setItem('narra_projects', JSON.stringify(freshProjects));

      // 5. Re-render the sidebar to show the new card, then load it
      const searchBox = document.querySelector('.search-input');
      renderDirectory(searchBox ? searchBox.value : '');
      loadCharacter(newCharId);
      
      if (typeof showToast === 'function') {
        showToast('New character added to project');
      }
    }
  });

  function loadCharacter(charId) {
    activeCharacterId = charId;
    const char = thisProject.data.characters.find(c => c.id === charId);
    if (!char) return;

    emptyStateEl.style.display = 'none';
    activeDossierEl.style.display = 'flex';

    // Populate standard fields
    Object.entries(fieldMap).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el) {
        if (el.tagName === 'DIV') el.innerHTML = char[key] || '';
        else el.value = char[key] || '';
      }
    });

    // Populate Overcome Verdict Pills
    document.querySelectorAll('.overcome-pill').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.val === char.overcomeVerdict);
    });

    // Reset to Page 1 and generate dynamic grid for Perspectives
    currentPerspPage = 0;
    renderPerspectivePage();

    renderDirectory(searchInput.value);
  }

  // Bind standard inputs
  Object.keys(fieldMap).forEach(inputId => {
    const el = document.getElementById(inputId);
    if (el) el.addEventListener('input', saveCurrentCharacter);
  });

  // Bind Overcome Verdict Pills
  document.querySelectorAll('.overcome-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!activeCharacterId) return;
      const char = thisProject.data.characters.find(c => c.id === activeCharacterId);
      if (!char) return;

      const newVal = char.overcomeVerdict === btn.dataset.val ? '' : btn.dataset.val;
      char.overcomeVerdict = newVal;

      document.querySelectorAll('.overcome-pill').forEach(b => {
        b.classList.toggle('selected', b.dataset.val === newVal);
      });

      saveCurrentCharacter();
    });
  });

  // Add New Character Button
  document.getElementById('add-char-btn').addEventListener('click', () => {
    const newChar = createBlankCharacter('New Character');
    thisProject.data.characters.push(newChar);
    localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
    loadCharacter(newChar.id);
  });

  // Delete Character Button
  document.getElementById('delete-char-btn').addEventListener('click', () => {
    if (activeCharacterId && confirm('Are you sure you want to delete this character sheet?')) {
      thisProject.data.characters = thisProject.data.characters.filter(c => c.id !== activeCharacterId);
      localStorage.setItem('narra_projects', JSON.stringify(narraProjects));

      activeCharacterId = null;
      if (thisProject.data.characters.length > 0) {
        loadCharacter(thisProject.data.characters[0].id);
      } else {
        activeDossierEl.style.display = 'none';
        emptyStateEl.style.display = 'flex';
        renderDirectory(searchInput.value);
      }
    }
  });

  // Roster Search
  searchInput.addEventListener('input', (e) => {
    renderDirectory(e.target.value);
  });

  // Export File Button
  const exportBtn = document.getElementById('export-char-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      saveCurrentCharacter();
      const blob = new Blob([JSON.stringify(thisProject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (thisProject.title || 'character_sheet').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safeTitle}.narra`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Highlight active section in Jump Nav on click
  document.querySelectorAll('.jump-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.jump-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // --- RICH TEXT MODAL LOGIC ---
  const modalOverlay = document.getElementById('rich-text-modal');
  const modalEditor = document.getElementById('modal-editor');
  const modalFieldTitle = document.getElementById('modal-field-title');
  
  let currentTargetDiv = null;
  let initialModalContent = ""; // Tracks the original text to detect changes

  // Wrap contenteditable divs and inject expand buttons
  function bindRichTextModals() {
    document.querySelectorAll('.sheet-textarea[contenteditable="true"]').forEach(div => {
      if (div.parentElement.classList.contains('sheet-textarea-wrapper')) return;
      
      const wrapper = document.createElement('div');
      wrapper.className = 'sheet-textarea-wrapper';
      div.parentNode.insertBefore(wrapper, div);
      wrapper.appendChild(div);

      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-field-btn';
      expandBtn.title = 'Open in Editor';
      expandBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;
      
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(div);
      });
      wrapper.appendChild(expandBtn);
    });
  }

  function openModal(targetDiv) {
    currentTargetDiv = targetDiv;
    const label = targetDiv.parentElement.parentElement.querySelector('label, h4, .area-title-input');
    
    if (label) {
      modalFieldTitle.textContent = label.value || label.textContent || 'Edit Section';
    } else {
      modalFieldTitle.textContent = 'Edit Section';
    }

    modalEditor.innerHTML = targetDiv.innerHTML;
    initialModalContent = targetDiv.innerHTML; // Take a snapshot of the original text
    
    modalOverlay.style.display = 'flex';
    modalEditor.focus();
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    currentTargetDiv = null;
    initialModalContent = "";
  }

  // Check for unsaved changes before closing
  function attemptCloseModal(e) {
    if (e) e.preventDefault();
    
    if (modalEditor.innerHTML !== initialModalContent) {
      const discard = confirm("You have unsaved changes. Are you sure you want to discard them?");
      if (!discard) {
        return; // User clicked Cancel, keep the modal open
      }
    }
    closeModal(); // User clicked OK (Discard), close it safely
  }

  // Save changes directly and close
  document.getElementById('modal-save-btn')?.addEventListener('click', () => {
    if (currentTargetDiv) {
      currentTargetDiv.innerHTML = modalEditor.innerHTML;
      saveCurrentCharacter();
    }
    closeModal(); // Skips the warning because changes were saved
  });

  // Bind the Warning Check to both the Cancel and 'X' buttons
  document.getElementById('modal-cancel-btn')?.addEventListener('click', attemptCloseModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', attemptCloseModal);

  // Formatting Toolbar Buttons
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
      modalEditor.focus();
    });
  });

  // Initialize View
  bindRichTextModals();
  renderDirectory();
  if (thisProject.data.characters.length > 0) {
    loadCharacter(thisProject.data.characters[0].id);
  }
}); // End of DOMContentLoaded