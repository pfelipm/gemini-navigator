// Este script gestiona la contextualización del panel lateral exclusivamente en gemini.google.com

const GEMINI_ORIGIN = 'https://gemini.google.com';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

/**
 * Notifica al panel sobre un cambio en la pestaña activa o su contenido.
 */
async function notifyTabChange(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('https://gemini.google.com')) {
      chrome.runtime.sendMessage({ action: 'clear-panel', windowId: tab.windowId }).catch(() => {});
      return;
    }

    const tabUrl = new URL(tab.url);
    if (tabUrl.origin === GEMINI_ORIGIN) {
      chrome.runtime.sendMessage({ 
        action: 'refresh-for-tab', 
        tabId: tabId, 
        windowId: tab.windowId 
      }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({ action: 'clear-panel', windowId: tab.windowId }).catch(() => {});
    }
  } catch (e) {
    // Si la pestaña no existe o hay error, intentamos limpiar la ventana actual
    chrome.windows.getCurrent((win) => {
      chrome.runtime.sendMessage({ action: 'clear-panel', windowId: win.id }).catch(() => {});
    });
  }
}

// Escuchar actualizaciones de navegación
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' || info.url) {
    notifyTabChange(tabId);
  }
});

// Escuchar cambios de pestaña activa
chrome.tabs.onActivated.addListener((activeInfo) => {
  notifyTabChange(activeInfo.tabId);
});

// Escuchar cuando una pestaña se mueve de ventana (Solución al edge case)
chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  notifyTabChange(tabId);
});
