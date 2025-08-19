# Gemini™ Navigator

Una extensión de Chrome para generar un índice de la conversación y navegar rápidamente entre las peticiones en la interfaz de Gemini.

![Gemini Navigator](readme-archivos/gemini-navigator.png)

## Descripción

**Gemini™ Navigator** es una extensión para Google Chrome que mejora la experiencia de uso de Gemini añadiendo un panel lateral con un índice de todas las peticiones (prompts) de la conversación actual. Esto permite saltar directamente a cualquier punto de la conversación con un solo clic, facilitando la navegación en chats largos y complejos.

La extensión está diseñada para ser intuitiva y se integra de forma nativa en la interfaz de Gemini.

## ¿Cómo funciona?

Al hacer clic en el icono de la extensión, se abre un panel lateral (`Side Panel`) que muestra una lista cronológica inversa de todas las peticiones que has realizado en la conversación activa.

![Gemini Navigator GIF](readme-archivos/gemini-navigator.gif)

- **Navegación Rápida:** Haz clic en cualquier petición del índice para que la ventana principal de Gemini se desplace suavemente hasta esa pregunta, resaltándola visualmente por un momento.
- **Actualización Inteligente:** Gemini carga las conversaciones más antiguas a medida que te desplazas hacia arriba. La extensión es consciente de este comportamiento. Si haces clic en una de las últimas peticiones del índice (la penúltima o la última), la extensión esperará unos segundos (un tiempo que puedes configurar) para darle tiempo a Gemini a cargar las peticiones anteriores en el DOM.
- **Recarga y Sincronización:** Tras la espera, el índice se actualiza automáticamente, añadiendo las nuevas peticiones cargadas con un suave efecto visual para que puedas identificarlas fácilmente. También puedes forzar una recarga manual en cualquier momento con el botón de actualizar.

## Detalles Técnicos

- **Manifest V3:** La extensión utiliza la última versión del manifiesto de Chrome.
- **Side Panel API:** La interfaz principal se muestra utilizando la `Side Panel API` de Chrome para una integración limpia.
- **Scripting API:** Se inyectan scripts en la página de Gemini de forma segura para analizar el DOM, identificar las peticiones y realizar el scroll. No se modifica el contenido de la página de forma persistente.
- **Permisos:**
    - `sidePanel`: Para mostrar el panel lateral.
    - `scripting`: Para ejecutar código en la página de Gemini.
    - `activeTab`: Para interactuar con la pestaña activa.
    - `storage`: Para guardar la configuración de retardo (delay) seleccionada por el usuario.
- **Archivos Clave:**
    - `manifest.json`: Define la estructura y permisos de la extensión.
    - `sidepanel.html` / `sidepanel.js` / `sidepanel.css`: Componen la interfaz y la lógica principal del panel lateral.
    - `background.js`: Gestiona la apertura del panel lateral.
    - `content.js` / `content.css`: Inyectan los estilos para el resaltado visual en la página de Gemini.

## Instalación (en modo desarrollador)

Sigue estos pasos para instalar la extensión de forma local:

1.  Descarga o clona este repositorio en tu máquina.
2.  Abre Google Chrome y ve a la página de extensiones: `chrome://extensions`.
3.  Activa el **"Modo de desarrollador"** en la esquina superior derecha.
4.  Haz clic en el botón **"Cargar descomprimida"**.
5.  Selecciona la carpeta del proyecto que has descargado.
6.  ¡Listo! La extensión aparecerá en tu lista de extensiones y estará activa en `gemini.google.com`.

### Nota sobre la publicación en la Chrome Web Store

Puesto que la extensión se basa en el análisis de la estructura del DOM de la aplicación de Gemini, y esta puede cambiar en cualquier momento sin previo aviso, el autor prefiere no publicarla en la Chrome Web Store por el momento. El coste de mantenimiento y la necesidad de adaptarla a cambios frecuentes hacen que sea más práctico distribuirla como un proyecto de código abierto para su instalación manual.
