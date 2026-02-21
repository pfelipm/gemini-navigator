// Lógica para el panel lateral (sidepanel.js) con la nueva arquitectura

const turnList = document.getElementById('turn-list');
const loadingMessage = document.getElementById('loading-message');
const refreshButton = document.getElementById('refresh-button');
const delaySelector = document.getElementById('delay-selector');

let isBuilding = false; // Semáforo para evitar reconstrucciones duplicadas simultáneas

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

    const observer = new MutationObserver((mutations) => {
        let newTurnDetected = false;
        let themeChanged = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                newTurnDetected = true;
            }
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
 * @param {number} targetIndexFromEnd - Índice visual del elemento a scrollear.
 */
async function buildIndex(targetIndexFromEnd = null, existingTurnIds = new Set()) {
    if (isBuilding && targetIndexFromEnd === null) return;
    isBuilding = true;

    refreshButton.disabled = true;
    refreshButton.classList.add('loading-in-progress');
    loadingMessage.style.display = 'none';

    const searchInput = document.getElementById('search-input');
    const listHeaderContainer = document.getElementById('list-header-container');

    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || !tab.id) throw new Error("Sin pestaña activa");

        await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: setupAutoRefresh });
        const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: getTurnsFromPageWithRetry });
        const turns = results[0].result;

        turnList.innerHTML = '';
        listHeaderContainer.innerHTML = '';

        if (turns && turns.length > 0) {
            const header = document.createElement('div');
            header.className = 'list-header';
            header.textContent = 'Recientes';
            listHeaderContainer.appendChild(header);

            const visualTurns = [...turns].reverse();
            visualTurns.forEach((turn, index) => {
                const li = document.createElement('li');
                li.textContent = turn.title;
                li.title = turn.title;
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

                if (index >= visualTurns.length - 2 && visualTurns.length > 1) {
                    li.addEventListener('click', async () => {
                        const clickedIndexFromEnd = index;
                        await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: scrollToTurnAndHighlight, args: [turn.id] });
                        
                        refreshButton.disabled = true;
                        refreshButton.classList.add('loading-in-progress');
                        
                        isBuilding = true; 
                        await new Promise(resolve => setTimeout(resolve, parseInt(delaySelector.querySelector('.active').dataset.delay, 10)));
                        
                        const currentTurnIds = new Set(Array.from(turnList.querySelectorAll('li')).map(item => item.dataset.turnId));
                        isBuilding = false; 
                        buildIndex(clickedIndexFromEnd, currentTurnIds);
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

            if (searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));

            if (targetIndexFromEnd !== null) {
                const targetLi = turnList.querySelector(`li[data-index-from-end="${targetIndexFromEnd}"]`);
                const container = document.getElementById('index-container');
                if (targetLi && container) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            container.scrollTop = targetLi.offsetTop - 8;
                        });
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error buildIndex:", error);
    } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove('loading-in-progress');
        setTimeout(() => { isBuilding = false; }, 500);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'new-turn-detected') {
        if (isBuilding) return;
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

function setupDelaySelector() {
    chrome.storage.local.get(['selectedDelay'], (result) => {
        const savedDelay = result.selectedDelay || '3000'; // 3s por defecto
        delaySelector.querySelectorAll('button').forEach(button => {
            button.classList.toggle('active', button.dataset.delay === savedDelay);
        });
    });

    delaySelector.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const selectedDelay = event.target.dataset.delay;
            chrome.storage.local.set({ selectedDelay: selectedDelay });
            delaySelector.querySelectorAll('button').forEach(button => button.classList.toggle('active', button === event.target));
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupDelaySelector();
    setupSearch(); 
    buildIndex();
});
refreshButton.addEventListener('click', () => buildIndex());
