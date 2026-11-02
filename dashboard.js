document.addEventListener('DOMContentLoaded', () => {
  const projectGrid = document.getElementById('project-grid');
  const optionsMenu = document.getElementById('file-options-menu');
  let activeProjectId = null;

  // 1. Initial Tutorial Data
  const defaultProjects = [
    {
      id: 'tut-timeline', title: 'Timeline Tutorial', type: 'timeline',
      parentProjectId: 'none', lastModified: new Date().toISOString(), data: { chapters: [], plotlines: [] } 
    },
    {
      id: 'tut-character', title: 'Character Tutorial', type: 'character',
      parentProjectId: 'none', lastModified: new Date().toISOString(), data: { characters: [] }
    },
    {
      id: 'tut-story', title: 'Story Tutorial', type: 'story',
      parentProjectId: 'none', lastModified: new Date().toISOString(), data: {}
    }
  ];

  let narraProjects = [];
  try {
    narraProjects = JSON.parse(localStorage.getItem('narra_projects')) || [];
  } catch (e) {
    narraProjects = [];
  }
  
  if (narraProjects.length === 0) {
    narraProjects = defaultProjects;
    localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
  }

  // --- 3. SEARCH & RENDER LOGIC ---
  const searchInput = document.querySelector('.search-bar input');

  if (searchInput) {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });
    searchInput.addEventListener('input', renderDashboard);
  }

  function renderDashboard() {
    if (!projectGrid) return;
    projectGrid.innerHTML = ''; 

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Filter to show ONLY unassigned drafts (not folders, and not inside folders)
    const filteredProjects = narraProjects.filter(proj => {
      const isUnassignedDraft = proj.type !== 'folder' && (!proj.parentProjectId || proj.parentProjectId === 'none');
      const matchesSearch = (proj.title || 'Unnamed File').toLowerCase().includes(query);
      return isUnassignedDraft && matchesSearch;
    });

    if (filteredProjects.length === 0) {
      projectGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #5f6368; padding: 40px; font-size: 15px;">
          No unassigned drafts found. Click "+ New Timeline" or "+ New Character" above to start.
        </div>
      `;
      return;
    }

    filteredProjects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    filteredProjects.forEach(proj => {
      let iconClass = 'bg-blue';
      let iconSvg = '<path d="M4 12H20M8 8v8M16 8v8M4 12a4 4 0 0 1 4-4M16 8a4 4 0 0 1 4 4"></path>';
      let thumbnailLines = '<div class="line w-80"></div><div class="line w-100"></div><div class="line w-60"></div><div class="line w-90 mt-2"></div><div class="line w-100"></div>';
      let fileRoute = 'narra-timeline.html'; 
      let isStory = false;

      if (proj.type === 'character') {
        iconClass = 'bg-purple';
        iconSvg = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>';
        thumbnailLines = '<div class="circle-avatar"></div><div class="line w-100 mt-2"></div><div class="line w-80"></div><div class="line w-60"></div>';
        fileRoute = 'character-sheet.html'; 
      } else if (proj.type === 'story') {
        iconClass = 'bg-green'; 
        iconSvg = '<path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle>';
        thumbnailLines = '<div class="line w-100 title-line"></div><div class="line w-100 mt-2"></div><div class="line w-100"></div><div class="line w-90"></div><div class="line w-100"></div><div class="line w-40"></div>';
        isStory = true;
      }

      const dateObj = new Date(proj.lastModified || Date.now());
      const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const safeTitle = proj.title || 'Unnamed File';

      const cardWrapperClass = isStory ? 'file-card disabled-card' : 'file-card';
      const linkHref = isStory ? '#' : `${fileRoute}?id=${proj.id}`;
      const badgeHTML = isStory ? '<span class="coming-soon-badge">Coming Soon</span>' : '';

      const cardHTML = `
        <a href="${linkHref}" class="${cardWrapperClass}" style="text-decoration: none; display: block; color: inherit;" ${isStory ? 'onclick="event.preventDefault();"' : ''}>
          <div class="file-thumbnail">
            <div class="mock-doc-lines">${thumbnailLines}</div>
          </div>
          <div class="file-details">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <input type="text" class="file-title-input" value="${safeTitle}" data-id="${proj.id}" readonly onclick="event.preventDefault();" />
              ${badgeHTML}
            </div>
            <div class="file-footer-row" style="margin-top: 10px;">
              <div class="type-icon-small ${iconClass}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>
              </div>
              <span class="file-meta">${dateStr}</span>
              <button class="more-opts-btn" data-id="${proj.id}" title="More options" onclick="event.preventDefault();" style="${isStory ? 'display: none;' : ''}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
              </button>
            </div>
          </div>
        </a>
      `;
      projectGrid.insertAdjacentHTML('beforeend', cardHTML);
    });

    attachDashboardListeners();
  }

  function attachDashboardListeners() {
    document.querySelectorAll('.file-title-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const proj = narraProjects.find(p => p.id === id);
        if (proj && proj.type !== 'story') {
          proj.title = e.target.value.trim() || 'Unnamed File';
          proj.lastModified = new Date().toISOString();
          localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
        }
      });
    });

    document.querySelectorAll('.more-opts-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeProjectId = btn.getAttribute('data-id');
        
        if (optionsMenu) {
          // Dynamically populate the folder select list in the popover
          const moveSelect = document.getElementById('popover-move-select');
          if (moveSelect) {
            const allFolders = narraProjects.filter(p => p.type === 'folder');
            moveSelect.innerHTML = `
              <option value="" disabled selected>Move to folder...</option>
              ${allFolders.map(f => `<option value="${f.id}">${f.title}</option>`).join('')}
            `;
          }

          const rect = btn.getBoundingClientRect();
          optionsMenu.style.display = 'block';
          optionsMenu.style.top = `${rect.bottom + 8}px`;
          optionsMenu.style.left = `${rect.left - 120}px`;
        }
      });
    });
  }

  // --- POP-OVER: MOVE TO FOLDER LOGIC ---
  const popoverMoveSelect = document.getElementById('popover-move-select');
  if (popoverMoveSelect) {
    popoverMoveSelect.addEventListener('change', (e) => {
      if (activeProjectId) {
        const folderId = e.target.value;
        const fileIndex = narraProjects.findIndex(p => p.id === activeProjectId);
        if (fileIndex > -1) {
          narraProjects[fileIndex].parentProjectId = folderId;
          narraProjects[fileIndex].lastModified = new Date().toISOString();
          localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
          renderDashboard(); // Draft vanishes immediately from root view
        }
      }
      if (optionsMenu) optionsMenu.style.display = 'none';
    });
  }

  // --- TOP ROW BUTTONS ---
  const topNewProjectBtn = document.getElementById('new-project-btn');
  if (topNewProjectBtn) {
    topNewProjectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const newId = 'proj-' + Date.now();
      const newProject = {
        id: newId, title: 'Unnamed Timeline', type: 'timeline',
        parentProjectId: 'none', lastModified: new Date().toISOString(), data: { chapters: [], plotlines: [] }
      };
      narraProjects.unshift(newProject);
      localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
      window.location.href = `narra-timeline.html?id=${newId}`; 
    });
  }

  document.addEventListener('click', (e) => {
    const addCharacterBtn = e.target.closest('#add-character-btn');
    if (addCharacterBtn) {
      e.preventDefault();
      const timestamp = Date.now();
      const newFileId = `proj-${timestamp}`;
      const newCharId = `char-${timestamp}`;

      const newCharacter = {
        id: newCharId, name: 'New Character', archetype: 'Unassigned',
        coreBelief: '', lie: '', weaknesses: '', strengths: '', arcOutcomes: '', overcomeVerdict: 'positive', perspectives: [] 
      };

      const newProjectFile = {
        id: newFileId, title: 'Untitled Character', type: 'character',
        parentProjectId: 'none', lastModified: new Date().toISOString(), data: { characters: [newCharacter] }
      };

      narraProjects.unshift(newProjectFile);
      localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
      window.location.href = `character-sheet.html?id=${newFileId}&charId=${newCharId}`;
    }
  });

  // --- MENU ACTIONS (Rename, Duplicate, Delete) ---
  const deleteOpt = document.querySelector('.delete-opt');
  if (deleteOpt) {
    deleteOpt.addEventListener('click', () => {
      if (activeProjectId) {
        if (confirm('Are you sure you want to delete this file?')) {
          narraProjects = narraProjects.filter(p => p.id !== activeProjectId);
          localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
          renderDashboard();
        }
      }
      if (optionsMenu) optionsMenu.style.display = 'none';
    });
  }

  const duplicateOpt = document.querySelector('.duplicate-opt');
  if (duplicateOpt) {
    duplicateOpt.addEventListener('click', () => {
      if (activeProjectId) {
        const original = narraProjects.find(p => p.id === activeProjectId);
        if (original) {
          const clone = JSON.parse(JSON.stringify(original));
          clone.id = 'proj-' + Date.now();
          clone.title = original.title + ' (Copy)';
          clone.lastModified = new Date().toISOString();
          narraProjects.unshift(clone);
          localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
          renderDashboard();
        }
      }
      if (optionsMenu) optionsMenu.style.display = 'none';
    });
  }

  const renameOpt = document.querySelector('.rename-opt');
  if (renameOpt) {
    renameOpt.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (activeProjectId) {
        const input = document.querySelector(`.file-title-input[data-id="${activeProjectId}"]`);
        if (input) {
          input.removeAttribute('readonly');
          input.focus();
          input.select();
          
          const saveRename = () => {
            input.setAttribute('readonly', 'true');
            const proj = narraProjects.find(p => p.id === activeProjectId);
            if (proj && proj.type !== 'story') {
              proj.title = input.value.trim() || 'Unnamed File';
              proj.lastModified = new Date().toISOString();
              localStorage.setItem('narra_projects', JSON.stringify(narraProjects));
              input.value = proj.title; 
            }
          };

          input.addEventListener('blur', saveRename, { once: true });
          input.addEventListener('keydown', function handleEnter(evt) {
            if (evt.key === 'Enter') {
              input.removeEventListener('keydown', handleEnter);
              input.blur();
            }
          });
        }
      }
      if (optionsMenu) optionsMenu.style.display = 'none';
    });
  }

  document.addEventListener('click', () => {
    if (optionsMenu) optionsMenu.style.display = 'none';
  });

  renderDashboard();
});