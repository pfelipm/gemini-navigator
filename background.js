// Este script gestiona la apertura del panel lateral al hacer clic en el icono de la extensión.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
