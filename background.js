// Este script gestiona la apertura del panel lateral exclusivamente en gemini.google.com

const GEMINI_ORIGIN = 'https://gemini.google.com';

// Configuramos el comportamiento para que el panel se abra al hacer clic en el icono de la extensión.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Vigilamos las pestañas para activar el panel lateral solo cuando el usuario navegue a Gemini.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  
  try {
    const url = new URL(tab.url);
    // Verificamos si la URL empieza por nuestro origen de Gemini
    if (url.origin === GEMINI_ORIGIN) {
      // Habilitamos el panel lateral para esta pestaña específica.
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true
      });
    } else {
      // Desactivamos el panel lateral para cualquier otro sitio.
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: false
      });
    }
  } catch (e) {
    // Para URLs internas de Chrome (como chrome://), desactivamos el panel.
    chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    }).catch(() => {});
  }
});
