import { loadMessages, localizeElement, getMessage } from '../js/localization.js';

document.addEventListener('DOMContentLoaded', async () => {

    // --- Éléments du DOM ---
    const modalTitle = document.getElementById('modal-title');
    const snippetForm = document.getElementById('snippet-form');
    const snippetIdInput = document.getElementById('snippet-id');
    const snippetTitleInput = document.getElementById('snippet-title');
    const snippetContentInput = document.getElementById('snippet-content');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-btn');
    const rteToolbar = document.querySelector('.rte-toolbar');
    const charCounter = document.getElementById('char-counter');
    const copyTextBtn = document.getElementById('copy-text-btn');

    let settings = { theme: 'light', language: 'auto' };
    let currentSnippetId = null;

    // --- Fonctions utilitaires ---
    const showToaster = (messageKey) => {
        // Dans l'iframe, on ne peut pas afficher de toaster, on log dans la console
        console.log(getMessage(messageKey));
        // Idéalement, envoie msg au content-script pour qu'il l'affiche
    };

    const updateCharCount = () => {
        const count = snippetContentInput.textContent.length;
        charCounter.textContent = `${count} ${getMessage('charCount')}`;
    };

    // --- Initialisation ---
    const init = async () => {
        // 1. Charger les messages
        await loadMessages();
        
        // 2. Charger les settings (thème, langue)
        const data = await chrome.storage.local.get('settings');
        settings = { ...settings, ...data.settings };
        document.body.classList.toggle('dark-mode', settings.theme === 'dark');
        localizeElement(document.body, settings.language);

        // 3. Parser l'URL pour un ID
        const urlParams = new URLSearchParams(window.location.search);
        currentSnippetId = urlParams.get('id');

        if (currentSnippetId) {
            // Mode Édition
            modalTitle.textContent = getMessage('editSnippet');
            const { snippets } = await chrome.storage.local.get('snippets');
            const snippet = (snippets || []).find(s => s.id === currentSnippetId);
            if (snippet) {
                snippetIdInput.value = snippet.id;
                snippetTitleInput.value = snippet.title;
                snippetContentInput.innerHTML = snippet.content;
            }
        } else {
            // Mode Ajout
            modalTitle.textContent = getMessage('addSnippet');
        }
        updateCharCount();

        // 4. Attacher les écouteurs
        snippetForm.addEventListener('submit', handleFormSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        rteToolbar.addEventListener('click', handleRteClick);
        snippetContentInput.addEventListener('input', updateCharCount);
        copyTextBtn.addEventListener('click', handleModalCopyClick);
    };

    // --- Fonctions de l'éditeur ---

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const title = snippetTitleInput.value.trim();
        const content = snippetContentInput.innerHTML.trim();

        if (!title || !content || snippetContentInput.textContent.trim().length === 0) {
            alert(getMessage('snippetError'));
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = getMessage('saving');

        try {
            const { snippets: oldSnippets = [] } = await chrome.storage.local.get('snippets');
            
            if (currentSnippetId) {
                // Modification
                const index = oldSnippets.findIndex(s => s.id === currentSnippetId);
                if (index > -1) {
                    oldSnippets[index] = { ...oldSnippets[index], title, content };
                }
            } else {
                // Ajout
                const newSnippet = {
                    id: Date.now().toString(),
                    title,
                    content
                };
                oldSnippets.push(newSnippet);
            }
            
            await chrome.storage.local.set({ snippets: oldSnippets });
            handleCancel(); // Ferme le modal après la sauvegarde

        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            alert(getMessage('snippetError'));
            saveBtn.disabled = false;
            saveBtn.textContent = getMessage('save');
        }
    };

    const handleCancel = () => {
        // Envoie un message au parent (content.js) pour lui dire de se fermer
        window.parent.postMessage({ type: "QUICKPASTE_CLOSE" }, "*");
    };

    const handleRteClick = (e) => {
        const btn = e.target.closest('.rte-btn');
        if (!btn) return;
        const command = btn.dataset.command;
        let value = btn.dataset.value || null;

        if (command === 'backColor' && value === 'yellow') {
            if (document.queryCommandValue('backColor') === 'rgb(255, 255, 0)') {
                document.execCommand('backColor', false, 'transparent');
            } else {
                document.execCommand('backColor', false, value);
            }
        } else if (command) {
            document.execCommand(command, false, value);
        }
        snippetContentInput.focus();
    };

    const handleModalCopyClick = () => {
        const plainText = snippetContentInput.textContent || '';
        if (plainText) {
            navigator.clipboard.writeText(plainText).then(() => {
                alert(getMessage('copiedToClipboard'));
            });
        }
    };

    init();
});