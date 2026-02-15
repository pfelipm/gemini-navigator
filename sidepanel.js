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
            // CAMBIO: Usamos el selector de etiqueta 'user-query', que es semántico y más estable que las clases CSS.
            // Este componente representa específicamente la entrada del usuario en la conversación.
            const turnContainers = document.querySelectorAll('user-query');

            if (turnContainers.length > 0) {
                turnContainers.forEach((turnContainer, index) => {
                    // Buscamos el texto dentro del componente. Mantenemos .query-text por ahora,
                    // pero al estar acotado dentro de <user-query> es mucho más seguro.
                    const queryElement = turnContainer.querySelector('.query-text');
                    
                    if (queryElement) {
                        // Usamos un atributo data propio para rastrear si ya lo hemos procesado
                        const existingId = turnContainer.dataset.geminiHelperId;
                        const turnId = existingId || `gemini-helper-turn-${Date.now()}-${index}`;

                        if (!existingId) {
                           // Asignamos el ID al componente <user-query> directamente
                           turnContainer.id = turnId;
                           turnContainer.dataset.geminiHelperId = turnId;
                        }

                        // Fix: Clonar y limpiar elementos ocultos (como "You said") antes de extraer texto
                        const clone = queryElement.cloneNode(true);
                        clone.querySelectorAll('.cdk-visually-hidden').forEach(el => el.remove());
                        const fullText = clone.textContent || '';
                        
                        // Ahora usamos el texto completo y dejamos que CSS haga el truncado visual con ellipsis
                        const title = fullText.trim();

                        if (title) { // Solo añadimos si hay texto
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
 * Función para activar la actualización automática mediante MutationObserver.
 * Vigila si se añaden nuevos elementos <user-query> al DOM.
 */
function setupAutoRefresh() {
    // Evitamos duplicar observers si ya está activo en esta pestaña
    if (window.geminiNavigatorObserverActive) return;

    const observer = new MutationObserver((mutations) => {
        let newTurnDetected = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // Verificamos si el nodo añadido es un user-query o contiene uno
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName && node.tagName.toLowerCase() === 'user-query') {
                            newTurnDetected = true;
                        } else if (node.querySelector && node.querySelector('user-query')) {
                            newTurnDetected = true;
                        }
                    }
                });
            }
        }

        if (newTurnDetected) {
            // Enviamos mensaje al panel lateral para que se actualice
            // Usamos un debounce simple para no saturar si hay muchos cambios rápidos
            if (!window.geminiRefreshTimeout) {
                window.geminiRefreshTimeout = setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'new-turn-detected' });
                    window.geminiRefreshTimeout = null;
                }, 1000); // Esperamos 1s para asegurar que el contenido del prompt se ha renderizado
            }
        }
    });

    // Observamos el body para detectar cambios en el árbol
    // subtree: true es necesario porque el user-query puede estar anidado
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.geminiNavigatorObserverActive = true;
    console.log('Gemini Navigator: Auto-refresh observer activado.');
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

    // Limpiamos el filtro al recargar para evitar confusiones
    const searchInput = document.getElementById('search-input');
    // Nota: Mantenemos el filtro si el usuario está buscando, para no interrumpir
    // if (searchInput) searchInput.value = ''; 

    turnList.innerHTML = '';

    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

        if (!tab || !tab.id) {
            throw new Error("No se pudo encontrar una pestaña activa.");
        }

        // 1. Inyectamos y activamos el Observer si no lo está ya
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: setupAutoRefresh
        });

        // 2. Obtenemos los turnos
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
                li.title = turn.title; // Tooltip con el texto completo
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

            // Si hay un filtro activo, lo reaplicamos
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
        // Obtenemos los IDs actuales para resaltar solo el nuevo
        const currentTurnIds = new Set(Array.from(document.querySelectorAll('#turn-list li')).map(item => item.dataset.turnId));
        buildIndex(null, currentTurnIds);
    }
});

// Lógica de filtrado
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearButton = document.getElementById('clear-search');
    
    function updateList(searchTerm) {
        const items = turnList.querySelectorAll('li');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        // Mostrar/ocultar botón 'X'
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
        updateList(''); // Restaurar lista completa
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
    setupSearch(); // Inicializamos el buscador
    buildIndex();
});
refreshButton.addEventListener('click', () => buildIndex());
