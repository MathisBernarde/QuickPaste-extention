import { loadMessages, localizeElement, getMessage } from '../js/localization.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Éléments du DOM ---
    const snippetsListEl = document.getElementById('snippets-list');
    const searchBar = document.getElementById('search-bar');
    const addBtn = document.getElementById('add-btn');
    const importBtn = document.getElementById('import-btn');
    const exportBtn = document.getElementById('export-btn');
    const sortBtn = document.getElementById('sort-btn');
    const importFileInput = document.getElementById('import-file-input');
    const toaster = document.getElementById('toaster');

    // --- Le Modal et ses éléments ont été supprimés ---

    // --- État de l'application ---
    let snippets = [];
    let settings = { theme: 'light', sort: 'default', language: 'auto' };
    let fuse;

    // --- Fonctions utilitaires ---

    /** Affiche un message toaster */
    const showToaster = (messageKey, isError = false) => {
        const message = getMessage(messageKey) || messageKey;
        toaster.textContent = message;
        toaster.className = `toaster ${isError ? 'error' : 'success'}`;
        toaster.classList.add('show');
        setTimeout(() => {
            toaster.classList.remove('show');
        }, 3000);
    };

    /** Récupère la configuration (thème, langue) */
    const loadSettings = async () => {
        const data = await chrome.storage.local.get('settings');
        settings = { ...settings, ...data.settings };
        document.body.classList.toggle('dark-mode', settings.theme === 'dark');
        localizeElement(document.body, settings.language);
    };

    const initFuse = () => {
        fuse = new Fuse(snippets, {
            keys: ['title'],
            includeScore: true,
            threshold: 0.4
        });
    };

    // --- Fonctions de stockage ---

    const loadSnippets = async () => {
        const data = await chrome.storage.local.get('snippets');
        snippets = data.snippets || [];
        initFuse();
        renderSnippets(snippets);
    };

    const saveSnippets = async () => {
        await chrome.storage.local.set({ snippets });
        initFuse();
    };

    // --- Fonctions de Rendu ---

    const renderSnippets = (snippetsToRender) => {
        snippetsListEl.innerHTML = '';
        let displayList = [...snippetsToRender];

        if (settings.sort === 'alpha') {
            displayList.sort((a, b) => a.title.localeCompare(b.title));
        }

        if (displayList.length === 0) {
            const query = searchBar.value.trim();
            const messageKey = query ? 'noSnippetsFound' : 'noSnippets';
            snippetsListEl.innerHTML = `<div class="empty-state">${getMessage(messageKey)}</div>`;
            return;
        }

        displayList.forEach(snippet => {
            const item = document.createElement('div');
            item.className = 'snippet-item';
            item.dataset.id = snippet.id;
            
            // Affiche le titre en texte brut
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = snippet.title;
            const plainTitle = tempDiv.textContent || snippet.title;

            const title = document.createElement('span');
            title.className = 'title';
            title.textContent = plainTitle;
            item.appendChild(title);

            const actions = document.createElement('div');
            actions.className = 'snippet-actions';

            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.title = getMessage('edit');
            editBtn.classList.add('edit-btn');
            editBtn.dataset.id = snippet.id;
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = getMessage('delete');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.dataset.id = snippet.id;
            actions.appendChild(deleteBtn);

            item.appendChild(actions);
            snippetsListEl.appendChild(item);
        });
    };

    // --- Fonctions pour ouvrir l'éditeur externe ---
    const openEditor = (snippetId = null) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                // Envoie un message au content.js de l'onglet actif
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "SHOW_EDITOR",
                    snippetId: snippetId // Envoie l'ID (ou null si ajout)
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        // L'erreur se produit sur les pages chrome:// ou spéciales
                        console.warn("Ne peut pas injecter sur cette page.", chrome.runtime.lastError.message);
                        alert("QuickPaste ne peut pas s'ouvrir sur cette page (ex: chrome://). Essayez sur un site web.");
                    } else {
                        window.close(); // Ferme le popup si le message est bien parti
                    }
                });
            }
        });
    };

    // --- Fonctions d'Action ---

    const handleListClick = (e) => {
        const target = e.target;
        
        // Clic sur Éditer
        const editBtn = target.closest('.edit-btn');
        if (editBtn) {
            e.stopPropagation();
            openEditor(editBtn.dataset.id); // OUVRE L'EDITEUR EXTERNE
            return;
        }

        // Clic sur Supprimer
        const deleteBtn = target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            if (confirm(getMessage('confirmDelete'))) {
                const id = deleteBtn.dataset.id;
                snippets = snippets.filter(s => s.id !== id);
                saveSnippets().then(() => {
                    renderSnippets(snippets);
                    showToaster('snippetDeleted');
                });
            }
            return;
        }
        
        // Clic pour Coller
        const snippetItem = target.closest('.snippet-item');
        if (snippetItem) {
            handlePaste(snippetItem.dataset.id);
        }
    };

    const handleListDblClick = (e) => {
        const snippetItem = e.target.closest('.snippet-item');
        if (snippetItem) {
            handleCopy(snippetItem.dataset.id);
        }
    };

    const handlePaste = async (id) => {
        const snippet = snippets.find(s => s.id === id);
        if (!snippet) return;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = snippet.content;
        const plainText = tempDiv.textContent || '';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.id) throw new Error("No active tab");
            
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (htmlToPaste, textToPaste) => {
                    const activeEl = document.activeElement;
                    const isEditable = activeEl && (
                        activeEl.isContentEditable ||
                        activeEl.tagName === 'TEXTAREA' ||
                        (activeEl.tagName === 'INPUT' && /text|search|email|url|password|tel/.test(activeEl.type || ''))
                    );
                    if (!isEditable) return { success: false };
                    try {
                        if (activeEl.isContentEditable) {
                            document.execCommand('insertHTML', false, htmlToPaste);
                        } else {
                            const start = activeEl.selectionStart, end = activeEl.selectionEnd;
                            const value = activeEl.value;
                            activeEl.value = value.substring(0, start) + textToPaste + value.substring(end);
                            activeEl.selectionStart = activeEl.selectionEnd = start + textToPaste.length;
                            activeEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        }
                        return { success: true };
                    } catch (e) { return { success: false, error: e.message }; }
                },
                args: [snippet.content, plainText]
            });

            const [mainResult] = results;
            if (mainResult && mainResult.result && mainResult.result.success) {
                window.close();
            } else {
                showToaster('pasteErrorNoField', true);
            }
        } catch (error) {
            console.error(error);
            showToaster(getMessage('pasteErrorGeneric') + (error.message || ''), true);
        }
    };

    const handleCopy = (id) => {
        const snippet = snippets.find(s => s.id === id);
        if (snippet) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = snippet.content;
            const plainText = tempDiv.textContent || '';
            
            navigator.clipboard.writeText(plainText).then(() => {
                showToaster('copiedToClipboard');
                setTimeout(window.close, 1000);
            });
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value.trim();
        if (!query) {
            renderSnippets(snippets);
            return;
        }
        const results = fuse.search(query);
        const filteredSnippets = results.map(result => result.item);
        renderSnippets(filteredSnippets);
    };

    const handleSort = () => {
        settings.sort = settings.sort === 'alpha' ? 'default' : 'alpha';
        sortBtn.classList.toggle('active', settings.sort === 'alpha');
        chrome.storage.local.set({ settings }); 
        handleSearch({ target: searchBar });
    };

    const handleExport = () => {
        const data = JSON.stringify(snippets, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quickpaste_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToaster('exportSuccess');
    };

    const handleImport = () => {
        importFileInput.click();
    };

    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!Array.isArray(importedData) || importedData.some(item => !item.id || !item.title || item.content === undefined)) {
                    throw new Error('Invalid format');
                }
                const existingIds = new Set(snippets.map(s => s.id));
                const newSnippets = importedData.filter(s => !existingIds.has(s.id));
                snippets = [...snippets, ...newSnippets];
                await saveSnippets();
                renderSnippets(snippets);
                showToaster('importSuccess');
            } catch (error) {
                console.error(error);
                showToaster('importError', true);
            }
            importFileInput.value = '';
        };
        reader.readAsText(file);
    };

    // --- Initialisation et Écouteurs ---

    const init = async () => {
        await loadMessages();
        await loadSettings();
        await loadSnippets();

        // Clic sur "Ajouter"
        addBtn.addEventListener('click', () => openEditor());

        // Événements de la liste
        snippetsListEl.addEventListener('click', handleListClick);
        snippetsListEl.addEventListener('dblclick', handleListDblClick);

        // Événements des contrôles
        searchBar.addEventListener('input', handleSearch);
        sortBtn.addEventListener('click', handleSort);
        importBtn.addEventListener('click', handleImport);
        exportBtn.addEventListener('click', handleExport);
        importFileInput.addEventListener('change', handleImportFile);
    };

    init();
});