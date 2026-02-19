🇪🇸 [Versión en español](./README.md)

# Gemini™ Navigator

A Chrome extension to generate a conversation index and quickly navigate between prompts in the Gemini interface.

![Gemini Navigator](readme-archivos/gamini-navigator1.1.png)

## Description

**Gemini™ Navigator** is a Google Chrome extension that enhances the Gemini user experience by adding a side panel with an index of all prompts in the current conversation. This allows you to jump directly to any point in the conversation with a single click, making it easier to navigate long and complex chats.

The extension is designed to be intuitive and integrates natively into the Gemini interface.

## How does it work?

Clicking on the extension icon opens a side panel (`Side Panel`) that displays a reverse chronological list of all the prompts you have made in the active conversation.

![Gemini Navigator GIF](readme-archivos/gemini-navigator1.1.gif)

- **🚀 Quick Navigation:** Click on any prompt in the index for the main Gemini window to scroll smoothly to that question, highlighting it visually for a moment.
- **🔍 Instant Filtering:** Use the top search box to filter prompts in real-time. Ideal for quickly finding specific topics in long conversations without reading the entire index.
- **⚡ Auto-Refresh:** Forget about reloading! The extension automatically detects when you send a new message to Gemini and instantly updates the index to include your new prompt.
- **📜 History Loading:** Gemini loads older conversations as you scroll up. If you click on one of the last prompts in the index, the extension smartly waits a few seconds (configurable) to allow Gemini to load the previous content before jumping to it.

## Key Features

*   **Automatic Indexing:** Generates a clean and readable list of your prompts.
*   **Integrated Search:** Filter by keywords to locate specific requests.
*   **Robust Design:** Uses semantic selectors (`<user-query>`) to ensure compatibility with future Gemini updates.
*   **Native Aesthetics:** Visually integrates with Google's design, including elegant text truncation and dark mode support (automatic based on system/theme).
*   **Privacy:** All processing is done locally in your browser. No data is sent to external servers.

## Technical Details

- **Manifest V3:** The extension uses the latest version of the Chrome manifest for maximum security and performance.
- **Side Panel API:** The main interface is displayed using the Chrome `Side Panel API`.
- **MutationObserver:** Used to efficiently and reactively detect DOM changes without relying on polling.
- **Scripting API:** Scripts are safely injected into the Gemini page to analyze the conversation structure and perform scrolling.
- **Permissions:**
    - `sidePanel`: To display the interface.
    - `scripting`: To interact with the Gemini page.
    - `activeTab`: To access the current tab.
    - `storage`: To save your settings preferences.

## Installation (in developer mode)

Follow these steps to install the extension locally:

1.  Download and unzip the [zip file](https://github.com/pfelipm/gemini-navigator/archive/refs/heads/master.zip) or clone this repository on your machine.
2.  Open Google Chrome and go to the extensions page: `chrome://extensions`.
3.  Enable **"Developer mode"** in the upper right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the project folder you downloaded.
6.  Done! The extension will appear in your list of extensions and will be active on `gemini.google.com`.

### Note on publishing to the Chrome Web Store

Since the extension is based on analyzing the DOM structure of the Gemini application, and this can change at any time without notice, the author prefers not to publish it in the Chrome Web Store for the time being. The maintenance cost and the need to adapt it to frequent changes make it more practical to distribute it as an open source project for manual installation.

## Credits

This project was created and is maintained by **[Pablo Felip](https://www.linkedin.com/in/pfelipm/)**.

## License

This project is distributed under the terms of the [LICENSE](/LICENSE) file.
