// Lógica para el panel lateral (sidepanel.js) con la nueva arquitectura

const turnList = document.getElementById('turn-list');
const loadingMessage = document.getElementById('loading-message');
const refreshButton = document.getElementById('refresh-button');
const delaySelector = document.getElementById('delay-selector');

let isBuilding = false; 
let panelWindowId = null; 

/**
 * Función inyectada: Extraer turnos.
 */
function getTurnsFromPageWithRetry() {
    return new Promise((resolve) => {
        const maxRetries = 5;
        const retryDelay = 400;
        let attempt = 0;

        function findTurns() {
            attempt++;
            const turns = [];
            const turnContainers = document.querySelectorAll('user-query');

            if (turnContainers.length > 0) {
                turnContainers.forEach((turnContainer, index) => {
                    const queryElement = turnContainer.querySelector('.query-text');
                    if (queryElement) {
                        const existingId = turnContainer.dataset.geminiHelperId;
                        const turnId = existingId || `gn-turn-${Date.now()}-${index}`;
                        if (!existingId) {
                           turnContainer.id = turnId;
                           turnContainer.dataset.geminiHelperId = turnId;
                        }
                        const clone = queryElement.cloneNode(true);
                        clone.querySelectorAll('.cdk-visually-hidden').forEach(el => el.remove());
                        const fullText = clone.textContent || '';
                        const title = fullText.trim();
                        if (title) turns.push({ id: turnId, title: title });
                    }
                });
                resolve(turns);
            } else if (attempt < maxRetries) {
                setTimeout(findTurns, retryDelay);
            } else {
                resolve([]);
            }
        }
        findTurns();
    });
}

/**
 * Función inyectada: Detectar tema.
 */
function getGeminiTheme() {
    return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
}

/**
 * Función inyectada: Observer de cambios.
 */
function setupAutoRefresh() {
    if (window.geminiNavigatorObserverActive) return;

    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    chrome.runtime.sendMessage({ action: 'theme-changed', theme: currentTheme }).catch(() => {});

    const observer = new MutationObserver((mutations) => {
        let newTurnDetected = false;
        let themeChanged = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) newTurnDetected = true;
            if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target === document.body) themeChanged = true;
        }

        if (newTurnDetected) {
            if (!window.geminiRefreshTimeout) {
                window.geminiRefreshTimeout = setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'new-turn-detected' }).catch(() => {});
                    window.geminiRefreshTimeout = null;
                }, 1000);
            }
        }

        if (themeChanged) {
            const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
            chrome.runtime.sendMessage({ action: 'theme-changed', theme: theme }).catch(() => {});
        }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.geminiNavigatorObserverActive = true;
}

/**
 * Esta función se inyecta para hacer scroll y resaltar el turno.
 */
function scrollToTurnAndHighlight(turnId) {
    const element = document.getElementById(turnId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('gemini-helper-highlight');
        element.animate([
            { backgroundColor: 'rgba(177, 151, 252, 0)', boxShadow: '-10px 0 0 0 transparent, 0 0 0 0 transparent', clipPath: 'inset(0 0 0 -20px)' },
            { backgroundColor: 'rgba(177, 151, 252, 0.15)', boxShadow: '-10px 0 0 0 #B197FC, 0 0 0 2px rgba(177, 151, 252, 0.2)', clipPath: 'inset(0 0 4px -20px)', offset: 0.1 },
            { backgroundColor: 'rgba(177, 151, 252, 0.12)', boxShadow: '-10px 0 0 0 #B197FC, 0 0 0 2px rgba(177, 151, 252, 0.2)', clipPath: 'inset(0 0 4px -20px)', offset: 0.8 },
            { backgroundColor: 'rgba(177, 151, 252, 0)', boxShadow: '-10px 0 0 0 transparent, 0 0 0 0 transparent', clipPath: 'inset(0 0 0 -20px)' }
        ], { duration: 3000, easing: 'ease-in-out', fill: 'forwards' });
        setTimeout(() => element.classList.remove('gemini-helper-highlight'), 3100);
    }
}

/**
 * Aplica el tema visual al panel lateral.
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme-forced');
    } else if (theme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme-forced');
    } else {
        document.body.classList.remove('dark-theme', 'light-theme-forced');
    }
}

/**
 * Construye el índice.
 */
async function buildIndex(targetIndexFromEnd = null, existingTurnIds = new Set()) {
    if (isBuilding && targetIndexFromEnd === null) return;
    isBuilding = true;

    refreshButton.disabled = true;
    refreshButton.classList.add('loading-in-progress');
    refreshButton.title = 'Cargando peticiones...';
    loadingMessage.style.display = 'none';

    try {
        const [tab] = await chrome.tabs.query({ active: true, windowId: panelWindowId });
        if (!tab || !tab.id || !tab.url || !tab.url.startsWith('https://gemini.google.com')) {
            throw new Error("No en Gemini");
        }

        // Sincronización de TEMA inicial forzada antes de pintar
        const themeResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getGeminiTheme
        }).catch(() => [{ result: 'light' }]);
        
        applyTheme(themeResult[0].result);

        await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: setupAutoRefresh }).catch(() => {});
        const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: getTurnsFromPageWithRetry }).catch(() => [{ result: [] }]);
        const turns = results[0].result;

        turnList.innerHTML = '';
        document.getElementById('list-header-container').innerHTML = '';

        if (turns && turns.length > 0) {
            const header = document.createElement('div');
            header.className = 'list-header';
            header.textContent = 'Recientes';
            document.getElementById('list-header-container').appendChild(header);

            const visualTurns = [...turns].reverse();
            visualTurns.forEach((turn, index) => {
                const li = document.createElement('li');
                li.textContent = turn.title;
                li.dataset.turnId = turn.id;
                li.dataset.indexFromEnd = index;

                if (existingTurnIds.size > 0 && !existingTurnIds.has(turn.id)) {
                    setTimeout(() => {
                        li.animate([
                            { backgroundColor: 'rgba(177, 151, 252, 0.25)', borderColor: '#B197FC' },
                            { backgroundColor: 'rgba(177, 151, 252, 0.25)', borderColor: '#B197FC', offset: 0.25 },
                            { backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }
                        ], { duration: 6000, easing: 'ease-out', fill: 'forwards' });
                    }, 200);
                }

                li.addEventListener('click', async () => {
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: scrollToTurnAndHighlight, args: [turn.id] }).catch(() => {});
                    const delay = parseInt(delaySelector.querySelector('.active').dataset.delay, 10);
                    if (delay > 0) {
                        refreshButton.disabled = true;
                        refreshButton.classList.add('loading-in-progress');
                        isBuilding = true;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        const currentTurnIds = new Set(Array.from(turnList.querySelectorAll('li')).map(item => item.dataset.turnId));
                        isBuilding = false;
                        buildIndex(index, currentTurnIds);
                    }
                });
                turnList.appendChild(li);
            });

            const searchInput = document.getElementById('search-input');
            if (searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));

            if (targetIndexFromEnd !== null) {
                const targetLi = turnList.querySelector(`li[data-index-from-end="${targetIndexFromEnd}"]`);
                if (targetLi) {
                    const container = document.getElementById('index-container');
                    requestAnimationFrame(() => requestAnimationFrame(() => { if (container) container.scrollTop = targetLi.offsetTop - 8; }));
                }
            }
        } else {
            loadingMessage.textContent = 'No se encontraron peticiones.';
            loadingMessage.style.display = 'block';
        }
    } catch (error) {
        turnList.innerHTML = '';
        document.getElementById('list-header-container').innerHTML = '';
        loadingMessage.textContent = 'Abre una conversación en Gemini para ver el índice.';
        loadingMessage.style.display = 'block';
        applyTheme('system');
    } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove('loading-in-progress');
        setTimeout(() => isBuilding = false, 500);
    }
}

// Listener para mensajes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Definimos una función interna asíncrona para manejar el filtrado
    const handleMessage = async () => {
        if (!panelWindowId) {
            const win = await chrome.windows.getCurrent();
            panelWindowId = win.id;
        }
        
        // Aislamiento de ventana
        if (message.windowId && message.windowId !== panelWindowId) return;

        // Aislamiento de pestaña activa (para MutationObserver)
        if (message.action === 'new-turn-detected' || message.action === 'theme-changed') {
            const tabs = await chrome.tabs.query({ active: true, windowId: panelWindowId });
            const activeTab = tabs[0];
            if (sender.tab && (!activeTab || sender.tab.id !== activeTab.id)) return;
        }

        if (message.action === 'new-turn-detected' || message.action === 'refresh-for-tab') {
            if (isBuilding) return;
            if (message.action === 'refresh-for-tab') await new Promise(r => setTimeout(r, 100));
            const currentTurnIds = new Set(Array.from(turnList.querySelectorAll('li')).map(item => item.dataset.turnId));
            buildIndex(null, currentTurnIds);
        } else if (message.action === 'clear-panel') {
            turnList.innerHTML = '';
            document.getElementById('list-header-container').innerHTML = '';
            loadingMessage.textContent = 'Abre una conversación en Gemini para ver el índice.';
            loadingMessage.style.display = 'block';
            applyTheme('system');
        } else if (message.action === 'theme-changed') {
            applyTheme(message.theme);
        }
    };

    handleMessage();
    return true; 
});

// Lógica de búsqueda y filtro
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearButton = document.getElementById('clear-search');
    const listHeaderContainer = document.getElementById('list-header-container');
    function updateList(searchTerm) {
        const items = turnList.querySelectorAll('li');
        let visibleCount = 0;
        items.forEach(item => {
            const match = item.textContent.toLowerCase().includes(searchTerm);
            item.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });
        if (listHeaderContainer.firstChild) listHeaderContainer.firstChild.style.display = visibleCount > 0 ? '' : 'none';
    }
    searchInput.addEventListener('input', (e) => {
        clearButton.style.display = e.target.value.length > 0 ? 'flex' : 'none';
        updateList(e.target.value.toLowerCase());
    });
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        clearButton.style.display = 'none';
        updateList('');
    });
}

// Lógica del selector de delay
function setupDelaySelector() {
    chrome.storage.local.get(['selectedDelay'], (result) => {
        const savedDelay = result.selectedDelay || '3000';
        delaySelector.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.delay === savedDelay));
    });
    delaySelector.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const delay = event.target.dataset.delay;
            chrome.storage.local.set({ selectedDelay: delay });
            delaySelector.querySelectorAll('button').forEach(button => button.classList.toggle('active', button === event.target));
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const win = await chrome.windows.getCurrent();
    panelWindowId = win.id;
    setupDelaySelector();
    setupSearch(); 
    buildIndex();
});
refreshButton.addEventListener('click', () => buildIndex());
