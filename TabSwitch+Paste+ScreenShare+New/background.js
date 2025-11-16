function interceptAndSpoof() {
    const config = {
        blockedEvents: ['visibilitychange', 'blur', 'focus', 'focusin', 'focusout', 'fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']
    };

    const applySpoofs = (win) => {
        // if (win.__tabSwitchSpoofApplied) {
        //     return;
        // }
        // Object.defineProperty(win, '__tabSwitchSpoofApplied', { value: true, configurable: false, enumerable: false });

        const { document, EventTarget, Function, Object, Promise, navigator, MediaStreamTrack, screen } = win;

        const defineProperty = (obj, prop, descriptor) => {
            try {
                Object.defineProperty(obj, prop, descriptor);
            } catch (e) {}
        };

        const originalToString = Function.prototype.toString;
        const spoofedFunctions = new Map();
        const spoofToString = (func, name) => {
            spoofedFunctions.set(func, `function ${name}() { [native code] }`);
        };

        const newToString = function() {
            return spoofedFunctions.get(this) || originalToString.apply(this, arguments);
        };
        defineProperty(Function.prototype, 'toString', { value: newToString, writable: true, configurable: true });
        spoofToString(newToString, 'toString');

        defineProperty(document, 'hidden', { get: () => false, configurable: true });
        defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        const newHasFocus = () => true;
        defineProperty(document, 'hasFocus', { value: newHasFocus, configurable: true });
        spoofToString(newHasFocus, 'hasFocus');

        const listenerMap = new WeakMap();

        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const newAddEventListener = function(type, listener, options) {
            if (config.blockedEvents.includes(type)) {
                return;
            }
            let finalListener = listener;
            if ((type === 'keydown' || type === 'keyup') && typeof listener === 'function') {
                let listenerWrappers = listenerMap.get(listener);
                if (!listenerWrappers) {
                    listenerWrappers = {};
                    listenerMap.set(listener, listenerWrappers);
                }
                let wrapped = listenerWrappers[type];
                if (!wrapped) {
                    wrapped = function(event) {
                        if (event.key === 'Meta' || event.key === 'PrintScreen') {
                            return;
                        }
                        return listener.apply(this, arguments);
                    };
                    listenerWrappers[type] = wrapped;
                }
                finalListener = wrapped;
            }
            return originalAddEventListener.call(this, type, finalListener, options);
        };
        defineProperty(EventTarget.prototype, 'addEventListener', { value: newAddEventListener, configurable: true });
        spoofToString(newAddEventListener, 'addEventListener');

        const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
        const newRemoveEventListener = function(type, listener, options) {
            let finalListener = listener;
            if ((type === 'keydown' || type === 'keyup') && typeof listener === 'function') {
                const listenerWrappers = listenerMap.get(listener);
                if (listenerWrappers && listenerWrappers[type]) {
                    finalListener = listenerWrappers[type];
                }
            }
            return originalRemoveEventListener.call(this, type, finalListener, options);
        };
        defineProperty(EventTarget.prototype, 'removeEventListener', { value: newRemoveEventListener, configurable: true });
        spoofToString(newRemoveEventListener, 'removeEventListener');

        const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
        const newDispatchEvent = function(event) {
            const type = event && (event.type || event);
            if (type && config.blockedEvents.includes(type)) {
                return true;
            }
            return originalDispatchEvent.call(this, event);
        };
        defineProperty(EventTarget.prototype, 'dispatchEvent', { value: newDispatchEvent, configurable: true });
        spoofToString(newDispatchEvent, 'dispatchEvent');

        ['onblur', 'onfocus', 'onvisibilitychange', 'onpaste', 'onfullscreenchange', 'onwebkitfullscreenchange', 'onmozfullscreenchange', 'onmsfullscreenchange'].forEach(eventName => {
            const descriptor = { set: () => {}, configurable: true };
            defineProperty(win, eventName, descriptor);
            defineProperty(document, eventName, descriptor);
        });

        // --- Fullscreen API Spoofing ---
        // Make websites think we're ALWAYS in fullscreen
        defineProperty(document, 'fullscreenElement', { get: () => document.documentElement, configurable: true });
        defineProperty(document, 'webkitFullscreenElement', { get: () => document.documentElement, configurable: true });
        defineProperty(document, 'mozFullScreenElement', { get: () => document.documentElement, configurable: true });
        defineProperty(document, 'msFullscreenElement', { get: () => document.documentElement, configurable: true });
        defineProperty(document, 'fullscreen', { get: () => true, configurable: true });
        defineProperty(document, 'webkitIsFullScreen', { get: () => true, configurable: true });
        defineProperty(document, 'mozFullScreen', { get: () => true, configurable: true });

        // --- Screen Sharing Spoofing ---
        // Force screen share inspection APIs to report that the entire monitor is shared
        const spoofSurfaceSettings = {
            displaySurface: 'monitor',
            logicalSurface: true,
            cursor: 'always'
        };
        const patchedTracks = new WeakSet();

        const patchTrack = (track) => {
            if (!track || patchedTracks.has(track)) {
                return;
            }

            if (typeof track.getSettings === 'function') {
                const originalGetSettings = track.getSettings.bind(track);
                const newGetSettings = function() {
                    const settings = originalGetSettings();
                    const width = (settings && settings.width) || (screen && screen.width);
                    const height = (settings && settings.height) || (screen && screen.height);
                    return Object.assign({}, settings, spoofSurfaceSettings, {
                        width,
                        height
                    });
                };
                defineProperty(track, 'getSettings', { value: newGetSettings, configurable: true });
                spoofToString(newGetSettings, 'getSettings');
            }

            if (typeof track.getCapabilities === 'function') {
                const originalGetCapabilities = track.getCapabilities.bind(track);
                const newGetCapabilities = function() {
                    const capabilities = originalGetCapabilities();
                    return Object.assign({}, capabilities, {
                        displaySurface: ['monitor'],
                        logicalSurface: [true]
                    });
                };
                defineProperty(track, 'getCapabilities', { value: newGetCapabilities, configurable: true });
                spoofToString(newGetCapabilities, 'getCapabilities');
            }

            if (typeof track.getConstraints === 'function') {
                const originalGetConstraints = track.getConstraints.bind(track);
                const newGetConstraints = function() {
                    const constraints = originalGetConstraints();
                    return Object.assign({}, constraints, {
                        displaySurface: 'monitor'
                    });
                };
                defineProperty(track, 'getConstraints', { value: newGetConstraints, configurable: true });
                spoofToString(newGetConstraints, 'getConstraints');
            }

            try {
                defineProperty(track, 'label', {
                    get: () => 'Screen 1',
                    configurable: true
                });
            } catch (e) {}

            patchedTracks.add(track);
        };

        if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
            const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
            const newGetDisplayMedia = async function(...args) {
                const stream = await originalGetDisplayMedia(...args);
                if (stream && typeof stream.getVideoTracks === 'function') {
                    stream.getVideoTracks().forEach(patchTrack);
                    if (typeof stream.addEventListener === 'function') {
                        stream.addEventListener('addtrack', (event) => patchTrack(event.track));
                    }
                }
                return stream;
            };
            defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: newGetDisplayMedia, configurable: true });
            spoofToString(newGetDisplayMedia, 'getDisplayMedia');
        }

        if (typeof MediaStreamTrack !== 'undefined' && MediaStreamTrack.prototype && typeof MediaStreamTrack.prototype.getSettings === 'function') {
            const originalPrototypeGetSettings = MediaStreamTrack.prototype.getSettings;
            if (!originalPrototypeGetSettings.__spoofedByExtension) {
                const newPrototypeGetSettings = function() {
                    const settings = originalPrototypeGetSettings.apply(this, arguments);
                    if (settings && typeof settings === 'object' && 'displaySurface' in settings) {
                        settings.displaySurface = 'monitor';
                        settings.logicalSurface = true;
                        if (!settings.width && screen) {
                            settings.width = screen.width;
                        }
                        if (!settings.height && screen) {
                            settings.height = screen.height;
                        }
                        settings.cursor = 'always';
                    }
                    return settings;
                };
                newPrototypeGetSettings.__spoofedByExtension = true;
                defineProperty(MediaStreamTrack.prototype, 'getSettings', { value: newPrototypeGetSettings, configurable: true });
                spoofToString(newPrototypeGetSettings, 'getSettings');
            }
        }
    };

    applySpoofs(window);
}

function enablePasteAndDragDrop() {
    if (window.__tabSwitchPasteApplied) {
        return;
    }
    Object.defineProperty(window, '__tabSwitchPasteApplied', { value: true, configurable: false, enumerable: false });

    const EDITABLE_INPUT_TYPES = new Set([
        'text', 'search', 'url', 'tel', 'email', 'password', 'number'
    ]);

    const isEditableElement = (el) => {
        if (!el) {
            return false;
        }
        if (el.nodeType === Node.TEXT_NODE) {
            el = el.parentElement;
        }
        if (!(el instanceof Element)) {
            return false;
        }
        if (el.isContentEditable) {
            return true;
        }
        if (el instanceof HTMLTextAreaElement) {
            return true;
        }
        if (el instanceof HTMLInputElement) {
            const type = (el.getAttribute('type') || '').toLowerCase();
            return type === '' || EDITABLE_INPUT_TYPES.has(type);
        }
        return false;
    };

    const cleanEditableElement = (el) => {
        if (!isEditableElement(el)) {
            return;
        }

        ['onpaste', 'oncopy', 'oncut', 'ondrop', 'ondragstart', 'ondragover', 'ondragleave', 'ondragenter'].forEach(attr => {
            if (el.hasAttribute && el.hasAttribute(attr)) {
                el.removeAttribute(attr);
            }
        });

        el.onpaste = null;
        el.oncopy = null;
        el.oncut = null;
        el.ondrop = null;
        el.ondragstart = null;
        el.ondragover = null;
        el.ondragleave = null;
        el.ondragenter = null;

        if (el.getAttribute && el.getAttribute('autocomplete') === 'off') {
            el.setAttribute('autocomplete', 'on');
        }

        if ('readOnly' in el && el.readOnly) {
            el.readOnly = false;
            el.removeAttribute('readonly');
        }

        if ('disabled' in el && el.disabled) {
            el.disabled = false;
            el.removeAttribute('disabled');
        }

        if (el.style) {
            el.style.userSelect = 'auto';
            el.style.webkitUserSelect = 'auto';
            el.style.mozUserSelect = 'auto';
            el.style.msUserSelect = 'auto';
        }
    };

    const applyCleanups = () => {
        const root = document;
        if (!root) {
            return;
        }
        root.querySelectorAll('input, textarea, [contenteditable]').forEach(cleanEditableElement);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCleanups, { once: true });
    } else {
        applyCleanups();
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) {
                    return;
                }
                cleanEditableElement(node);
                node.querySelectorAll && node.querySelectorAll('input, textarea, [contenteditable]').forEach(cleanEditableElement);
            });
        });
    });

    const observeTarget = () => {
        const target = document.body || document.documentElement;
        if (!target) {
            return false;
        }
        observer.observe(target, { childList: true, subtree: true });
        return true;
    };

    if (!observeTarget()) {
        const readyStateHandler = () => {
            if (observeTarget()) {
                document.removeEventListener('readystatechange', readyStateHandler);
            }
        };
        document.addEventListener('readystatechange', readyStateHandler);
    }

    const shouldBypassInterference = (event) => {
        if (!event || !event.isTrusted) {
            return false;
        }
        return isEditableElement(event.target);
    };

    const shouldBlockPreventDefault = (event) => {
        if (!shouldBypassInterference(event)) {
            return false;
        }
        if (event.type === 'beforeinput') {
            const inputType = event.inputType || '';
            return inputType === 'insertFromPaste' || inputType === 'insertFromDrop';
        }
        return event.type === 'paste' || event.type === 'drop';
    };

    const shouldBlockPropagation = (event) => {
        if (!shouldBypassInterference(event)) {
            return false;
        }
        if (event.type === 'beforeinput') {
            const inputType = event.inputType || '';
            return inputType === 'insertFromPaste' || inputType === 'insertFromDrop';
        }
        return event.type === 'paste' || event.type === 'drop';
    };

    const patchEventMethod = (methodName, guardFn) => {
        const original = Event.prototype[methodName];
        if (typeof original !== 'function' || original.__tabSwitchPatched) {
            return;
        }

        const patched = function(...args) {
            if (guardFn(this)) {
                return false;
            }
            return original.apply(this, args);
        };

        Object.defineProperty(patched, '__tabSwitchPatched', { value: true });
        try {
            Object.defineProperty(Event.prototype, methodName, { value: patched, configurable: true });
        } catch (error) {
            try {
                Event.prototype[methodName] = patched;
            } catch (e) {}
        }
    };

    patchEventMethod('preventDefault', shouldBlockPreventDefault);
    patchEventMethod('stopPropagation', shouldBlockPropagation);
    patchEventMethod('stopImmediatePropagation', shouldBlockPropagation);

    const ensureDropPermitted = (event) => {
        if (!shouldBypassInterference(event) || (event.type !== 'dragenter' && event.type !== 'dragover')) {
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
            try {
                event.dataTransfer.dropEffect = 'copy';
            } catch (e) {}
        }
    };

    ['dragenter', 'dragover'].forEach(type => {
        document.addEventListener(type, ensureDropPermitted, true);
    });

    const insertTextAtCursor = (text) => {
        if (!text) {
            return;
        }

        const target = document.activeElement;
        if (!isEditableElement(target)) {
            return;
        }

        const dispatchInputEvent = (el) => {
            let event;
            try {
                event = new InputEvent('input', { bubbles: true, cancelable: false, data: text, inputType: 'insertFromPaste' });
            } catch (err) {
                event = new Event('input', { bubbles: true, cancelable: false });
            }
            el.dispatchEvent(event);
        };

        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            const start = target.selectionStart != null ? target.selectionStart : target.value.length;
            const end = target.selectionEnd != null ? target.selectionEnd : target.value.length;
            const prefix = target.value.slice(0, start);
            const suffix = target.value.slice(end);
            target.value = `${prefix}${text}${suffix}`;
            const cursor = start + text.length;
            try {
                target.setSelectionRange(cursor, cursor);
            } catch (e) {}
            dispatchInputEvent(target);
            return;
        }

        if (target.isContentEditable) {
            const selection = window.getSelection();
            if (!selection) {
                return;
            }

            if (selection.rangeCount === 0) {
                target.focus();
            }

            if (selection.rangeCount === 0) {
                const fallbackRange = document.createRange();
                fallbackRange.selectNodeContents(target);
                fallbackRange.collapse(false);
                selection.addRange(fallbackRange);
            }

            if (selection.rangeCount === 0) {
                return;
            }

            const range = selection.getRangeAt(0);
            range.deleteContents();
            const node = document.createTextNode(text);
            range.insertNode(node);
            range.setStartAfter(node);
            range.setEndAfter(node);
            selection.removeAllRanges();
            selection.addRange(range);
            dispatchInputEvent(target);
        }
    };

    const readClipboardText = async () => {
        try {
            const text = await navigator.clipboard.readText();
            return typeof text === 'string' ? text : '';
        } catch (error) {
            console.warn('Clipboard read failed', error);
            return '';
        }
    };

    let comboTriggered = false;

    const isCommaKey = (event) => {
        const key = event.key || '';
        if (key === ',') {
            return true;
        }
        const code = event.code || '';
        return code.toLowerCase() === 'comma';
    };

    const triggerPasteFromCombo = () => {
        readClipboardText().then(insertTextAtCursor);
    };

    const keydownHandler = (event) => {
        if (!event.isTrusted) {
            return;
        }
        if (!(event.ctrlKey || event.metaKey) || !isCommaKey(event)) {
            return;
        }

        if (!comboTriggered) {
            comboTriggered = true;
            event.preventDefault();
            event.stopImmediatePropagation();
            triggerPasteFromCombo();
        }
    };

    const keyupHandler = (event) => {
        if (!event.isTrusted) {
            return;
        }
        if (isCommaKey(event) || event.key === 'Control' || event.key === 'Meta') {
            comboTriggered = false;
        }
    };

    const keypressHandler = (event) => {
        if (!event.isTrusted) {
            return;
        }
        if (comboTriggered && isCommaKey(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };

    document.addEventListener('keydown', keydownHandler, true);
    document.addEventListener('keyup', keyupHandler, true);
    document.addEventListener('keypress', keypressHandler, true);

    window.addEventListener('blur', () => {
        comboTriggered = false;
    }, true);
}

chrome.webNavigation.onCommitted.addListener((details) => {
  // Inject the main spoofing script
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [details.frameId] },
    func: interceptAndSpoof,
    world: 'MAIN',
    injectImmediately: true,
  }).catch((error) => {});

  // Inject the paste and drag-drop enabler
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [details.frameId] },
    func: enablePasteAndDragDrop,
    world: 'MAIN',
    injectImmediately: true,
  }).catch((error) => {});
});