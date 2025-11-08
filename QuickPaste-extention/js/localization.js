// Ce module gère la logique de traduction manuelle
let allMessages = {};
let currentLang = 'en'; // Par défaut

/**
 * Charge les fichiers de messages (fr, en) en mémoire
 */
export async function loadMessages() {
    try {
        const [frMessages, enMessages] = await Promise.all([
            fetch(chrome.runtime.getURL('_locales/fr/messages.json')),
            fetch(chrome.runtime.getURL('_locales/en/messages.json'))
        ]);
        allMessages.fr = await frMessages.json();
        allMessages.en = await enMessages.json();
    } catch (e) {
        console.error("Failed to load localization files:", e);
    }
}

/**
 * Récupère le bon objet de messages en fonction de la langue choisie
 */
function getMessagesForLang(lang) {
    let langCode = lang;
    if (lang === 'auto' || !lang) {
        langCode = chrome.i18n.getUILanguage().split('-')[0];
    }
    currentLang = langCode;
    return allMessages[langCode] || allMessages.en; // 'en' par défaut
}

/**
 * Traduit tous les éléments de l'UI dans un conteneur donné (ex: document.body)
 */
export function localizeElement(element, lang) {
    const messages = getMessagesForLang(lang);
    if (!messages) return;

    // Traduit les textes
    element.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (messages[key]) {
            el.textContent = messages[key].message;
        } else {
            console.warn(`Missing i18n key: ${key}`);
        }
    });

    // Traduit les placeholders
    element.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (messages[key]) {
            el.placeholder = messages[key].message;
        } else {
            console.warn(`Missing i18n placeholder key: ${key}`);
        }
    });

    // Traduit les titres (infobulles)
    element.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        if (messages[key]) {
            el.title = messages[key].message;
        } else {
            console.warn(`Missing i18n title key: ${key}`);
        }
    });
}

/**
 * Récupère un seul message traduit (utilisé pour le JS)
 */
export function getMessage(key) {
    const messages = allMessages[currentLang] || allMessages.en;
    if (messages && messages[key]) {
        return messages[key].message;
    }
    console.warn(`Missing i18n key: ${key}`);
    return key;
}