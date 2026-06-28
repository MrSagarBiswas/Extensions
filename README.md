# Web Privacy Control Extension

A Chrome extension designed to restore user control by intercepting APIs that monitor tab switches, restrict screen sharing, or block native copy/paste functionality.

## 🛠️ Installation

1. **Clone the repository:**
```bash
git clone https://github.com/MrSagarBiswas/Extensions.git

```


2. **Navigate:** Open the `TabSwitch+Paste+ScreenShare+New` directory on your machine.
3. **Load Extension:** * Navigate to `chrome://extensions/` in your Chrome browser.
* Toggle **Developer mode** on (top right corner).
* Click **Load unpacked** (top left) and select the `TabSwitch+Paste+ScreenShare+New` folder.



---

## 🚀 Features & Usage

### 1. Tab Switch & Focus Spoofing

Overrides `document.hidden`, `visibilityState`, and `hasFocus()` while spoofing the Fullscreen API. This forces websites to believe the tab is constantly active, visible, and in full screen, even when you switch tabs or minimize the window.

* **How to use:** Operates entirely in the background. No manual action is required.

### 2. Screen Share Spoofing

Patches `MediaStreamTrack` inspection methods (`getSettings`, `getCapabilities`, `getConstraints`) to falsely report the `displaySurface` as your entire `"monitor"`.

* **How to use:** When a site forces you to share your entire desktop, select a single Chrome tab or specific window instead. The extension automatically spoofs the stream data to bypass the restriction.

### 3. Unrestricted Paste & Drag-and-Drop

Actively strips restrictive event listeners (e.g., `onpaste`, `oncopy`, `ondrop`) from input fields and blocks sites from calling `preventDefault()` or `stopPropagation()` on paste events.

* **How to use:** Standard paste (**`Ctrl + V`** or **`Cmd + V`**) will work normally on most sites because the blocking scripts are neutralized. If a site still manages to block it, use the fallback: click inside the target text box and press **`Ctrl + ,`** (or `Cmd + ,` on Mac) to forcefully inject your clipboard text directly at the cursor position.
* **Note:** The first time you use `Ctrl + ,` on any website, Chrome will prompt for clipboard access. You **must click "Allow"** for the injection to function.

---

## ⚠️ Important Warnings

* **Paste Fallback:** Standard `Ctrl + V` usually works fine (including pasting images). If a site strictly blocks it, use the `Ctrl + ,` fallback. *(Note: `Ctrl + ,` may add extra indentation spaces in some online code editors, so copy text line-by-line or without leading spaces).*
* **Site Breakage:** Overriding core browser APIs can break complex web apps like video conferencing tools or rich-text editors.
* **Best Practice:** Do not enable this globally. Go to your extension settings and change site access to **"On specific sites"** where you actually need it.
