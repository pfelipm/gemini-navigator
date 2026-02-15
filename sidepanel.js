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
            const turnContainers = document.querySelectorAll('div[class*="conversation-container"]');

            if (turnContainers.length > 0) {
                turnContainers.forEach((turnContainer, index) => {
                    const queryElement = turnContainer.querySelector('user-query .query-text');
                    if (queryElement) {
                        const existingId = turnContainer.dataset.geminiHelperId;
                        const turnId = existingId || `gemini-helper-turn-${Date.now()}-${index}`;

                        if (!existingId) {
                           turnContainer.id = turnId;
                           turnContainer.dataset.geminiHelperId = turnId;
                        }

                        // Fix: Clonar y limpiar elementos ocultos (como "You said") antes de extraer texto
                        const clone = queryElement.cloneNode(true);
                        clone.querySelectorAll('.cdk-visually-hidden').forEach(el => el.remove());
                        const fullText = clone.textContent || '';
                        
                        const title = fullText.split(/\s+/).slice(0, 30).join(' ') + (fullText.split(/\s+/).length > 30 ? '...' : '');

                        turns.push({ id: turnId, title: title.trim() });
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
 * Esta función se inyecta para hacer scroll y resaltar el turno.
 */
function scrollToTurnAndHighlight(turnId) {
    const element = document.getElementById(turnId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });

        element.classList.add('gemini-helper-highlight');
        setTimeout(() => {
            element.classList.remove('gemini-helper-highlight');
        }, 2000);
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

    turnList.innerHTML = '';

    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

        if (!tab || !tab.id) {
            throw new Error("No se pudo encontrar una pestaña activa.");
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getTurnsFromPageWithRetry
        });

        const turns = results[0].result;

        if (turns && turns.length > 0) {
            turns.reverse();
            turns.forEach((turn, index) => {
                const li = document.createElement('li');
                li.textContent = turn.title;
                li.title = `Saltar a: "${turn.title}"`;
                li.dataset.turnId = turn.id;

                if (existingTurnIds.size > 0 && !existingTurnIds.has(turn.id)) {
                    li.classList.add('new-turn-highlight');
                }

                // CAMBIO CLAVE: Activamos la recarga para los 2 últimos elementos.
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
    buildIndex();
});
refreshButton.addEventListener('click', () => buildIndex());
