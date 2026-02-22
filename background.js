// Este script gestiona la contextualización del panel lateral exclusivamente en gemini.google.com

const GEMINI_ORIGIN = 'https://gemini.google.com';

// Comportamiento del panel al hacer clic en el icono
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

/**
 * Función para notificar al panel lateral sobre el estado de la pestaña activa.
 */
async function notifyTabChange(tabId, url, windowId) {
  // Si no hay URL (pestaña nueva vacía) o no es Gemini, mandamos limpiar
  if (!url || !url.startsWith('https://gemini.google.com')) {
    chrome.runtime.sendMessage({ action: 'clear-panel', windowId: windowId }).catch(() => {});
    return;
  }
  
  try {
    const tabUrl = new URL(url);
    if (tabUrl.origin === GEMINI_ORIGIN) {
      chrome.runtime.sendMessage({ 
        action: 'refresh-for-tab', 
        tabId: tabId, 
        windowId: windowId 
      }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({ action: 'clear-panel', windowId: windowId }).catch(() => {});
    }
  } catch (e) {
    chrome.runtime.sendMessage({ action: 'clear-panel', windowId: windowId }).catch(() => {});
  }
}

// Escuchar actualizaciones de pestañas
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // Disparamos tanto al empezar como al terminar para máxima reactividad
  notifyTabChange(tabId, tab.url, tab.windowId);
});

// Escuchar cambios de pestaña activa
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    notifyTabChange(tab.id, tab.url, tab.windowId);
  } catch (e) {}
});
