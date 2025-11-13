let iframe = null;
let overlay = null;

// Écoute les messages venant du popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SHOW_EDITOR") {
        showEditor(request.snippetId); // 'snippetId' = undefined pour un "ajout"
    }
    return true;
});

// Écoute les messages venant de l'iframe (editor.js)
window.addEventListener("message", (event) => {
    // Nous n'acceptons que les messages de notre l'extension
    if (event.source !== iframe.contentWindow) {
        return;
    }

    if (event.data.type === "QUICKPASTE_CLOSE") {
        closeEditor();
    }
}, false);


function showEditor(snippetId) {
    // Empêche les doublons
    if (document.getElementById("quickpaste-overlay")) {
        return;
    }

    // 1. Crée l'overlay (fond grisé)
    overlay = document.createElement('div');
    overlay.id = "quickpaste-overlay";
    document.body.appendChild(overlay);

    // 2. Crée l'iframe
    iframe = document.createElement('iframe');
    iframe.id = "quickpaste-editor-iframe";

    iframe.allow = "clipboard-write";
    
    // Construit l'URL de l'éditeur, en passant l'ID si on modifie
    let editorUrl = chrome.runtime.getURL('editor/editor.html');
    if (snippetId) {
        editorUrl += `?id=${snippetId}`;
    }
    iframe.src = editorUrl;
    
    document.body.appendChild(iframe);

    // Bloque le scroll de la page principale
    document.body.style.overflow = "hidden";
}

function closeEditor() {
    if (iframe) {
        document.body.removeChild(iframe);
        iframe = null;
    }
    if (overlay) {
        document.body.removeChild(overlay);
        overlay = null;
    }
    // Restaure le scroll
    document.body.style.overflow = "auto";
}