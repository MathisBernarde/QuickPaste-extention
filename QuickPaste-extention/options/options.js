import { loadMessages, localizeElement } from '../js/localization.js';

document.addEventListener('DOMContentLoaded', async () => {

    // --- Éléments du DOM ---
    const themeLight = document.getElementById('theme-light');
    const themeDark = document.getElementById('theme-dark');
    const languageSelect = document.getElementById('language-select');

    let settings = { theme: 'light', language: 'auto' };

    /** Sauvegarde les settings */
    const saveSettings = async (newSettings) => {
        settings = { ...settings, ...newSettings };
        await chrome.storage.local.set({ settings });
    };

    /** Charge et applique les settings */
    const loadSettings = async () => {
        const data = await chrome.storage.local.get('settings');
        settings = { ...settings, ...data.settings };

        // Applique le thème
        if (settings.theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeDark.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            themeLight.checked = true;
        }
        
        // Applique la langue
        languageSelect.value = settings.language;
    };

    // --- Écouteurs ---

    /** Gère le changement de thème */
    const handleThemeChange = async (e) => {
        const newTheme = e.target.value;
        document.body.classList.toggle('dark-mode', newTheme === 'dark');
        await saveSettings({ theme: newTheme });
    };

    /** Gère le changement de langue */
    const handleLanguageChange = async (e) => {
        const newLang = e.target.value;
        await saveSettings({ language: newLang });
        // Retraduit l'UI instantanément
        localizeElement(document.body, newLang);
    };

    // --- Initialisation ---
    // 1. Charger les traductions d'abord
    await loadMessages();
    // 2. Charger les paramètres
    await loadSettings();
    // 3. Traduire l'UI avec la langue chargée
    localizeElement(document.body, settings.language);

    // Attache les écouteurs après initialisation
    themeLight.addEventListener('change', handleThemeChange);
    themeDark.addEventListener('change', handleThemeChange);
    languageSelect.addEventListener('change', handleLanguageChange);
});