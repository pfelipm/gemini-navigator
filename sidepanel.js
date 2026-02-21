// Lógica para el panel lateral (sidepanel.js) con la nueva arquitectura

const turnList = document.getElementById('turn-list');
const loadingMessage = document.getElementById('loading-message');
const refreshButton = document.getElementById('refresh-button');
const delaySelector = document.getElementById('delay-selector');

/**
 * Esta es la función que se inyectará y ejecutará en la página de Gemini.
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
                        const turnId = existingId || `gemini-helper-turn-${Date.now()}-${index}`;

                        if (!existingId) {
                           turnContainer.id = turnId;
                           turnContainer.dataset.geminiHelperId = turnId;
                        }

                        const clone = queryElement.cloneNode(true);
                        clone.querySelectorAll('.cdk-visually-hidden').forEach(el => el.remove());
                        const fullText = clone.textContent || '';
                        const title = fullText.trim();

                        if (title) {
                            turns.push({ id: turnId, title: title });
                        }
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
 * Función para activar la actualización automática y sincronización de tema.
 */
function setupAutoRefresh() {
    if (window.geminiNavigatorObserverActive) return;

    // Detectar tema inicial
    const isDark = document.body.classList.contains('dark-theme');
    chrome.runtime.sendMessage({ action: 'theme-changed', theme: isDark ? 'dark' : 'light' });

    const observer = new MutationObserver((mutations) => {
        let newTurnDetected = false;
        let themeChanged = false;
        
        for (const mutation of mutations) {
            // Detección de nuevos mensajes
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.tagName && node.tagName.toLowerCase() === 'user-query') {
                            newTurnDetected = true;
                        } else if (node.querySelector && node.querySelector('user-query')) {
                            newTurnDetected = true;
                        }
                    }
                });
            }
            
            // Detección de cambio de tema (clase en el body)
            if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target === document.body) {
                themeChanged = true;
            }
        }

        if (newTurnDetected) {
            if (!window.geminiRefreshTimeout) {
                window.geminiRefreshTimeout = setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'new-turn-detected' });
                    window.geminiRefreshTimeout = null;
                }, 1000);
            }
        }

        if (themeChanged) {
            const isDarkNow = document.body.classList.contains('dark-theme');
            chrome.runtime.sendMessage({ action: 'theme-changed', theme: isDarkNow ? 'dark' : 'light' });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    
    window.geminiNavigatorObserverActive = true;
    console.log('Gemini Navigator: Observer activado (mensajes + tema).');
}

/**
 * Esta función se inyecta para hacer scroll y resaltar el turno.
 */
function scrollToTurnAndHighlight(turnId) {
    const element = document.getElementById(turnId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('gemini-helper-highlight');

        const animation = element.animate([
            { backgroundColor: 'rgba(177, 151, 252, 0)', boxShadow: '-10px 0 0 0 transparent, 0 0 0 0 transparent', clipPath: 'inset(0 0 0 -20px)' },
            { backgroundColor: 'rgba(177, 151, 252, 0.15)', boxShadow: '-10px 0 0 0 #B197FC, 0 0 0 2px rgba(177, 151, 252, 0.2)', clipPath: 'inset(0 0 4px -20px)', offset: 0.1 },
            { backgroundColor: 'rgba(177, 151, 252, 0.12)', boxShadow: '-10px 0 0 0 #B197FC, 0 0 0 2px rgba(177, 151, 252, 0.2)', clipPath: 'inset(0 0 4px -20px)', offset: 0.8 },
            { backgroundColor: 'rgba(177, 151, 252, 0)', boxShadow: '-10px 0 0 0 transparent, 0 0 0 0 transparent', clipPath: 'inset(0 0 0 -20px)' }
        ], {
            duration: 3000,
            easing: 'ease-in-out',
            fill: 'forwards'
        });

        setTimeout(() => {
            element.classList.remove('gemini-helper-highlight');
        }, 3100);
    }
}

/**
 * Construye el índice utilizando la API de scripting.
 */
async function buildIndex(scrollToTurnId = null, existingTurnIds = new Set()) {
    refreshButton.disabled = true;
    refreshButton.classList.add('loading-in-progress');
    refreshButton.title = 'Cargando peticiones...';
    loadingMessage.style.display = 'none';

    const searchInput = document.getElementById('search-input');
    const listHeaderContainer = document.getElementById('list-header-container');

    turnList.innerHTML = '';
    listHeaderContainer.innerHTML = '';

    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

        if (!tab || !tab.id) {
            throw new Error("No se pudo encontrar una pestaña activa.");
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: setupAutoRefresh
        });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getTurnsFromPageWithRetry
        });

        const turns = results[0].result;

        if (turns && turns.length > 0) {
            const header = document.createElement('div');
            header.className = 'list-header';
            header.textContent = 'Recientes';
            listHeaderContainer.appendChild(header);

            turns.reverse();
            turns.forEach((turn, index) => {
                const li = document.createElement('li');
                li.textContent = turn.title;
                li.title = turn.title;
                li.dataset.turnId = turn.id;

                if (existingTurnIds.size > 0 && !existingTurnIds.has(turn.id)) {
                    li.classList.add('new-turn-highlight');
                }

                if (index >= turns.length - 2 && turns.length > 1) {
                    li.addEventListener('click', async () => {
                        const selectedDelay = parseInt(delaySelector.querySelector('.active').dataset.delay, 10);
                        if (selectedDelay === 0) {
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                function: scrollToTurnAndHighlight,
                                args: [turn.id]
                            });
                            return;
                        }

                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            function: scrollToTurnAndHighlight,
                            args: [turn.id]
                        });

                        refreshButton.disabled = true;
                        refreshButton.classList.add('loading-in-progress');
                        refreshButton.title = 'Cargando peticiones más antiguas...';

                        await new Promise(resolve => setTimeout(resolve, selectedDelay));

                        const currentTurnIds = new Set(Array.from(turnList.querySelectorAll('li')).map(item => item.dataset.turnId));
                        buildIndex(turn.id, currentTurnIds);
                    });
                } else {
                    li.addEventListener('click', () => {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            function: scrollToTurnAndHighlight,
                            args: [turn.id]
                        });
                    });
                }

                turnList.appendChild(li);
            });

            if (searchInput && searchInput.value) {
                searchInput.dispatchEvent(new Event('input'));
            }

            if (scrollToTurnId) {
                setTimeout(() => {
                    const targetLi = turnList.querySelector(`li[data-turn-id='${scrollToTurnId}']`);
                    if (targetLi) {
                        targetLi.scrollIntoView({ behavior: 'auto', block: 'start' });
                    }
                }, 100);
            }

        } else {
            loadingMessage.textContent = 'No se encontraron peticiones en la conversación.';
            loadingMessage.style.display = 'block';
        }
    } catch (error) {
        console.error("Gemini Helper: Error detallado al construir el índice.", error);
        loadingMessage.textContent = 'Error: No se pudo analizar la página. Asegúrate de estar en gemini.google.com.';
        loadingMessage.style.display = 'block';
    } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove('loading-in-progress');
        refreshButton.title = 'Recargar índice';
    }
}

// Listener para mensajes desde el script de contenido (Observer)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'new-turn-detected') {
        const currentTurnIds = new Set(Array.from(document.querySelectorAll('#turn-list li')).map(item => item.dataset.turnId));
        buildIndex(null, currentTurnIds);
    } else if (message.action === 'theme-changed') {
        if (message.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }
});

// Lógica de filtrado
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearButton = document.getElementById('clear-search');
    const listHeaderContainer = document.getElementById('list-header-container');
    
    function updateList(searchTerm) {
        const items = turnList.querySelectorAll('li');
        let visibleCount = 0;

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        if (listHeaderContainer.firstChild) {
            listHeaderContainer.firstChild.style.display = (visibleCount > 0) ? '' : 'none';
        }
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (e.target.value.length > 0) {
            clearButton.style.display = 'flex';
        } else {
            clearButton.style.display = 'none';
        }

        updateList(searchTerm);
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        clearButton.style.display = 'none';
        updateList('');
    });
}

// Lógica para gestionar el control segmentado y el almacenamiento
function setupDelaySelector() {
    chrome.storage.local.get(['selectedDelay'], (result) => {
        const savedDelay = result.selectedDelay || '0';
        delaySelector.querySelectorAll('button').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.delay === savedDelay) {
                button.classList.add('active');
            }
        });
    });

    delaySelector.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const selectedDelay = event.target.dataset.delay;
            chrome.storage.local.set({ selectedDelay: selectedDelay });
            delaySelector.querySelectorAll('button').forEach(button => button.classList.remove('active'));
            event.target.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupDelaySelector();
    setupSearch(); 
    buildIndex();
});
refreshButton.addEventListener('click', () => buildIndex());
