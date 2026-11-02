document.addEventListener('DOMContentLoaded', () => {
  const fileGrid = document.getElementById('file-grid');
  const dynamicBreadcrumb = document.getElementById('dynamic-breadcrumb');
  const optionsMenu = document.getElementById('file-options-menu');
  let activeElementId = null;

  // MODAL ELEMENTS
  const modal = document.getElementById('folder-modal');
  const btnOpenModal = document.getElementById('open-folder-modal');
  const btnCloseModal = document.getElementById('close-modal');
  const btnCancel = document.getElementById('cancel-folder');
  const btnSave = document.getElementById('save-folder');
  const folderInput = document.getElementById('new-folder-input');
  const modalDraftList = document.getElementById('modal-draft-list');

  // STATE: 'root' means viewing folders. An ID means viewing inside a folder.
  let currentFolderId = 'root';

  const folderSvgPath = '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>';

  function renderFiles() {
    if (!fileGrid) return;
    fileGrid.innerHTML = '';
    
    let projects = JSON.parse(localStorage.getItem('narra_projects') || '[]');
    
    // Update Header Breadcrumb based on State
    if (currentFolderId === 'root') {
      dynamicBreadcrumb.innerHTML = `<strong class="active-project">Projects</strong>`;
    } else {
      const activeFolder = projects.find(p => p.id === currentFolderId);
      dynamicBreadcrumb.innerHTML = `
        <span class="breadcrumb-link" id="back-to-projects">Projects</span> 
        &nbsp;/&nbsp; 
        <strong class="active-project">${activeFolder ? activeFolder.title : 'Folder'}</strong>
      `;
      document.getElementById('back-to-projects').addEventListener('click', () => {
        currentFolderId = 'root';
        renderFiles();
      });
    }

    // Determine what to display (Folders in root, Files when inside a folder)
    let displayItems = [];
    if (currentFolderId === 'root') {
      displayItems = projects.filter(p => p.type === 'folder');
    } else {
      displayItems = projects.filter(p => p.parentProjectId === currentFolderId && p.type !== 'folder');
    }

    if (displayItems.length === 0) {
      const msg = currentFolderId === 'root' ? 'No folders found. Create one to organize your drafts.' : 'This folder is empty.';
      fileGrid.innerHTML = `<div style="grid-column: 1 / -1; color: #94a3b8; font-size: 14px;">${msg}</div>`;
      return;
    }

    displayItems.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    displayItems.forEach(file => {
      let iconClass = 'bg-blue';
      let iconSvg = folderSvgPath;
      let thumbnailLines = '<div class="line w-80"></div><div class="line w-100"></div><div class="line w-60"></div>';
      
      // Inherit visual styles based on file type
      if (file.type === 'folder') {
        iconClass = 'bg-blue';
        thumbnailLines = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#dadce0;"><svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></div>';
      } else if (file.type === 'character') {
        iconClass = 'bg-purple';
        iconSvg = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>';
        thumbnailLines = '<div class="circle-avatar"></div><div class="line w-100 mt-2"></div><div class="line w-80"></div>';
      } else if (file.type === 'timeline') {
        iconSvg = '<path d="M4 12H20M8 8v8M16 8v8M4 12a4 4 0 0 1 4-4M16 8a4 4 0 0 1 4 4"></path>';
      }

      const dateObj = new Date(file.lastModified || Date.now());
      const dateStr = dateObj.toLocaleDateString();
      const safeTitle = file.title || 'Untitled';

      const cardHTML = `
        <div class="file-card" style="text-decoration: none; display: flex; flex-direction: column; color: inherit; cursor: pointer;">
          <div class="file-thumbnail">
            <div class="mock-doc-lines" style="width:100%; height:100%;">${thumbnailLines}</div>
          </div>
          <div class="file-details">
            <input type="text" class="file-title-input" value="${safeTitle}" data-id="${file.id}" readonly onclick="event.preventDefault();" />
            <div class="file-footer-row">
              <div class="type-icon-small ${iconClass}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>
              </div>
              <span class="file-meta">${dateStr}</span>
              <button class="more-opts-btn" data-id="${file.id}" title="More options" onclick="event.preventDefault();">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Create DOM element to attach specific listeners
      const cardEl = document.createElement('div');
      cardEl.innerHTML = cardHTML;
      const card = cardEl.firstElementChild;

      // Handle Click into Folder or File
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        
        if (file.type === 'folder') {
          currentFolderId = file.id;
          renderFiles();
        } else if (file.type === 'timeline') {
          window.location.href = `narra-timeline.html?id=${file.id}`;
        } else if (file.type === 'character') {
          const charId = file.data?.characters?.[0]?.id || '';
          window.location.href = `character-sheet.html?id=${file.id}&charId=${charId}`;
        }
      });

      fileGrid.appendChild(card);
    });

    attachFileListeners();
  }

  function attachFileListeners() {
    // Save Rename on Input Change
    document.querySelectorAll('.file-title-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const db = JSON.parse(localStorage.getItem('narra_projects') || '[]');
        const fileIndex = db.findIndex(p => p.id === id);
        if (fileIndex > -1) {
          db[fileIndex].title = e.target.value.trim() || 'Untitled';
          db[fileIndex].lastModified = new Date().toISOString();
          localStorage.setItem('narra_projects', JSON.stringify(db));
        }
      });
    });

    // Open Popover Menu
    document.querySelectorAll('.more-opts-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeElementId = btn.getAttribute('data-id');
        
        if (optionsMenu) {
          const rect = btn.getBoundingClientRect();
          optionsMenu.style.display = 'block';
          optionsMenu.style.top = `${rect.bottom + 8}px`;
          optionsMenu.style.left = `${rect.left - 120}px`;
        }
      });
    });
  }

  // --- MENU ACTIONS (Rename, Delete Folder/File) ---
  const renameOpt = document.querySelector('.rename-opt');
  if (renameOpt) {
    renameOpt.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (activeElementId) {
        const input = document.querySelector(`.file-title-input[data-id="${activeElementId}"]`);
        if (input) {
          input.removeAttribute('readonly');
          input.focus();
          input.select();
          
          const saveRename = () => {
            input.setAttribute('readonly', 'true');
            const db = JSON.parse(localStorage.getItem('narra_projects') || '[]');
            const file = db.find(p => p.id === activeElementId);
            if (file) {
              file.title = input.value.trim() || 'Untitled';
              file.lastModified = new Date().toISOString();
              localStorage.setItem('narra_projects', JSON.stringify(db));
              input.value = file.title; 
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

  const deleteOpt = document.querySelector('.delete-opt');
  if (deleteOpt) {
    deleteOpt.addEventListener('click', () => {
      if (activeElementId) {
        let db = JSON.parse(localStorage.getItem('narra_projects') || '[]');
        const target = db.find(p => p.id === activeElementId);
        
        if (target) {
          const isFolder = target.type === 'folder';
          const msg = isFolder 
            ? `Delete folder "${target.title}"? The drafts inside will be safely returned to the Drafts section.`
            : `Delete "${target.title}"?`;
            
          if (confirm(msg)) {
            // If deleting a folder, rescue its children by setting parent back to 'none'
            if (isFolder) {
              db = db.map(item => {
                if (item.parentProjectId === activeElementId) item.parentProjectId = 'none';
                return item;
              });
            }
            // Remove the target item itself
            db = db.filter(p => p.id !== activeElementId);
            localStorage.setItem('narra_projects', JSON.stringify(db));
            renderFiles();
          }
        }
      }
      if (optionsMenu) optionsMenu.style.display = 'none';
    });
  }

  document.addEventListener('click', () => {
    if (optionsMenu) optionsMenu.style.display = 'none';
  });

  // --- MODAL & FOLDER CREATION LOGIC ---
  function openModal() {
    modal.classList.remove('hidden');
    folderInput.value = 'Untitled';
    
    // Fetch unassigned drafts to show in the checklist
    const db = JSON.parse(localStorage.getItem('narra_projects') || '[]');
    const drafts = db.filter(p => p.type !== 'folder' && p.parentProjectId === 'none');
    
    if (drafts.length === 0) {
      modalDraftList.innerHTML = `<span style="font-size:13px; color:#94a3b8;">No unassigned drafts available.</span>`;
    } else {
      modalDraftList.innerHTML = drafts.map(d => `
        <label class="draft-checkbox-label">
          <input type="checkbox" value="${d.id}">
          <span style="display:flex; align-items:center; gap:6px;">
             ${d.type === 'timeline' ? '⏱️' : '👥'} ${d.title || 'Untitled'}
          </span>
        </label>
      `).join('');
    }

    setTimeout(() => { folderInput.focus(); folderInput.select(); }, 50);
  }

  function processNewFolder() {
    if (modal.classList.contains('hidden')) return;

    const title = folderInput.value.trim() || 'Untitled';
    const newFolderId = `folder-${Date.now()}`;
    const newFolder = {
      id: newFolderId,
      title: title,
      type: 'folder',
      parentProjectId: 'root',
      lastModified: new Date().toISOString(),
      data: {}
    };

    let db = JSON.parse(localStorage.getItem('narra_projects') || '[]');
    db.push(newFolder);

    // Grab all checked drafts and pack them into the new folder
    const checkedInputs = modalDraftList.querySelectorAll('input[type="checkbox"]:checked');
    checkedInputs.forEach(input => {
      const draftIndex = db.findIndex(p => p.id === input.value);
      if (draftIndex > -1) {
        db[draftIndex].parentProjectId = newFolderId;
        db[draftIndex].lastModified = new Date().toISOString();
      }
    });

    localStorage.setItem('narra_projects', JSON.stringify(db));
    modal.classList.add('hidden');
    
    // Auto-navigate into the newly created folder
    currentFolderId = newFolderId;
    renderFiles();
  }

  btnOpenModal?.addEventListener('click', openModal);
  btnCloseModal?.addEventListener('click', () => modal.classList.add('hidden'));
  btnCancel?.addEventListener('click', () => modal.classList.add('hidden'));
  btnSave?.addEventListener('click', processNewFolder);

  folderInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') processNewFolder();
    if (e.key === 'Escape') modal.classList.add('hidden');
  });

  // Initial Boot
  renderFiles();
});