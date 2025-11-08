// Importe le nouveau module de traduction
import { loadMessages, localizeElement, getMessage } from '../js/localization.js';
// (La ligne import Fuse... est bien supprimée)

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

    // Modal
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const snippetForm = document.getElementById('snippet-form');
    const snippetIdInput = document.getElementById('snippet-id');
    const snippetTitleInput = document.getElementById('snippet-title');
    const snippetContentInput = document.getElementById('snippet-content');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-btn');

    // --- État de l'application ---
    let snippets = [];
    let settings = { theme: 'light', sort: 'default', language: 'auto' };
    let fuse;
    // La variable originalSaveBtnText a été supprimée

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
        // Applique le thème
        document.body.classList.toggle('dark-mode', settings.theme === 'dark');
        // Applique la langue (le document.body entier)
        localizeElement(document.body, settings.language);
    };

    /** Initialise le moteur de recherche Fuse.js */
    const initFuse = () => {
        fuse = new Fuse(snippets, {
            keys: ['title'],
            includeScore: true,
            threshold: 0.4 // Tolérant aux fautes de frappe
        });
    };

    // --- Fonctions de stockage ---

    /** Charge les snippets depuis le stockage */
    const loadSnippets = async () => {
        const data = await chrome.storage.local.get('snippets');
        snippets = data.snippets || [];
        initFuse();
        renderSnippets(snippets);
    };

    /** Sauvegarde les snippets dans le stockage */
    const saveSnippets = async () => {
        await chrome.storage.local.set({ snippets });
        initFuse(); // Met à jour l'index de recherche
    };

    // --- Fonctions de Rendu ---

    /** Affiche la liste des snippets */
    const renderSnippets = (snippetsToRender) => {
        snippetsListEl.innerHTML = '';
        
        let displayList = [...snippetsToRender];

        // Gère le tri
        if (settings.sort === 'alpha') {
            displayList.sort((a, b) => a.title.localeCompare(b.title));
        }

        // --- GESTION DES ÉTATS VIDES ---
        if (displayList.length === 0) {
            const query = searchBar.value.trim();
            const messageKey = query ? 'noSnippetsFound' : 'noSnippets';
            snippetsListEl.innerHTML = `<div class="empty-state">${getMessage(messageKey)}</div>`;
            return; // Stop ici
        }

        displayList.forEach(snippet => {
            const item = document.createElement('div');
            item.className = 'snippet-item';
            item.dataset.id = snippet.id;

            const title = document.createElement('span');
            title.className = 'title';
            title.textContent = snippet.title;
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

    // --- Fonctions du Modal ---

    /** Affiche le modal (pour ajout ou édition) */
    const showModal = (snippet = null) => {
        if (snippet) {
            modalTitle.textContent = getMessage('editSnippet');
            snippetIdInput.value = snippet.id;
            snippetTitleInput.value = snippet.title;
            snippetContentInput.value = snippet.content;
        } else {
            modalTitle.textContent = getMessage('addSnippet');
            snippetForm.reset();
            snippetIdInput.value = '';
        }
        modal.classList.add('show'); // Utilise la classe CSS
        snippetTitleInput.focus();
    };

    /** Cache le modal */
    const hideModal = () => {
        modal.classList.remove('show'); // Utilise la classe CSS
        snippetForm.reset();
        // Réinitialise le bouton de sauvegarde
        saveBtn.disabled = false;
        saveBtn.textContent = getMessage('save'); // Utilise getMessage au lieu de la variable
    };

    /** Gère la soumission du formulaire (Sauvegarde) - Corrigé */
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const title = snippetTitleInput.value.trim();
        const content = snippetContentInput.value.trim();

        if (!title || !content) {
             // Affiche une erreur si les champs sont vides
            showToaster('snippetError', true);
            return;
        }

        // Désactive le bouton pour éviter le double-clic
        saveBtn.disabled = true;
        saveBtn.textContent = getMessage('saving');

        try {
            const id = snippetIdInput.value;
            if (id) {
                // Modification
                const index = snippets.findIndex(s => s.id === id);
                if (index > -1) {
                    snippets[index] = { ...snippets[index], title, content };
                }
                showToaster('snippetUpdated');
            } else {
                // Ajout
                const newSnippet = {
                    id: Date.now().toString(),
                    title,
                    content
                };
                snippets.push(newSnippet);
                showToaster('snippetAdded');
            }

            await saveSnippets();
            renderSnippets(snippets);
            hideModal(); // Se ferme seulement si succès

        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            showToaster('snippetError', true);
        } finally {
            // Réactive le bouton dans tous les cas (sauf si hideModal l'a déjà fait)
            if (modal.classList.contains('show')) { // Si le modal est toujours visible
                saveBtn.disabled = false;
                saveBtn.textContent = getMessage('save'); // Utilise getMessage au lieu de la variable
            }
        }
    };

    // --- Fonctions d'Action (CRUD et autres) ---

    /** Gère le clic sur la liste */
    const handleListClick = (e) => {
        const target = e.target;
        
        // Clic sur le bouton Éditer
        const editBtn = target.closest('.edit-btn');
        if (editBtn) {
            e.stopPropagation();
            const id = editBtn.dataset.id;
            const snippet = snippets.find(s => s.id === id);
            if (snippet) showModal(snippet);
            return;
        }

        // Clic sur le bouton Supprimer
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
        
        // Clic simple pour Coller (sur l'item lui-même)
        const snippetItem = target.closest('.snippet-item');
        if (snippetItem) {
            handlePaste(snippetItem.dataset.id);
        }
    };

    /** Gère le double-clic (Copier) */
    const handleListDblClick = (e) => {
        const snippetItem = e.target.closest('.snippet-item');
        if (snippetItem) {
            handleCopy(snippetItem.dataset.id);
        }
    };

    /** Colle le texte dans l'onglet actif */
    const handlePaste = async (id) => {
        const snippet = snippets.find(s => s.id === id);
        if (!snippet) return;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.id) throw new Error("No active tab");

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (textToPaste) => {
                    const activeEl = document.activeElement;
                    const isEditable = activeEl && (
                        activeEl.isContentEditable ||
                        activeEl.tagName === 'TEXTAREA' ||
                        (activeEl.tagName === 'INPUT' && /text|search|email|url|password|tel/.test(activeEl.type || ''))
                    );

                    if (!isEditable) return { success: false };

                    try {
                        if (activeEl.isContentEditable) {
                            document.execCommand('insertText', false, textToPaste);
                        } else {
                            const start = activeEl.selectionStart;
                            const end = activeEl.selectionEnd;
                            const value = activeEl.value;
                            
                            activeEl.value = value.substring(0, start) + textToPaste + value.substring(end);
                            activeEl.selectionStart = activeEl.selectionEnd = start + textToPaste.length;
                            activeEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        }
                        return { success: true };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                },
                args: [snippet.content]
            });

            const [mainResult] = results;
            if (mainResult && mainResult.result && mainResult.result.success) {
                window.close(); // Ferme le popup si succès
            } else {
                showToaster('pasteErrorNoField', true);
            }

        } catch (error) {
            console.error(error);
            const msg = getMessage('pasteErrorGeneric') + (error.message || '');
            showToaster(msg, true);
        }
    };

    /** Copie le texte dans le presse-papiers */
    const handleCopy = (id) => {
        const snippet = snippets.find(s => s.id === id);
        if (snippet) {
            navigator.clipboard.writeText(snippet.content).then(() => {
                showToaster('copiedToClipboard');
                setTimeout(window.close, 1000); // Ferme après 1s
            });
        }
    };

    /** Gère la recherche (filtrage) */
    const handleSearch = (e) => {
        const query = e.target.value.trim();
        if (!query) {
            renderSnippets(snippets); // Affiche tout si la recherche est vide
            return;
        }
        const results = fuse.search(query);
        const filteredSnippets = results.map(result => result.item);
        renderSnippets(filteredSnippets); // Affiche les résultats (gère l'état vide)
    };

    /** Gère le tri */
    const handleSort = () => {
        settings.sort = settings.sort === 'alpha' ? 'default' : 'alpha';
        sortBtn.classList.toggle('active', settings.sort === 'alpha');
        // Sauvegarde du réglage de tri
        chrome.storage.local.set({ settings }); 
        
        // Re-render avec la liste filtrée actuelle ou la liste complète
        handleSearch({ target: searchBar }); // Simule une recherche pour rafraîchir
    };

    // --- Fonctions d'Import / Export ---
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
        // 1. Charger les fichiers de traduction en premier
        await loadMessages();
        // 2. Charger les settings (qui applique la langue)
        await loadSettings();
        // 3. Charger les snippets et afficher l'UI
        await loadSnippets();

        // Événements du Modal
        addBtn.addEventListener('click', () => showModal());
        cancelBtn.addEventListener('click', hideModal);
        snippetForm.addEventListener('submit', handleFormSubmit);

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