function interceptAndSpoof() {
    const config = {
        blockedEvents: ['visibilitychange', 'blur', 'focus', 'focusin', 'focusout', 'paste', 'fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']
    };

    const applySpoofs = (win) => {
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
                        if (event.ctrlKey && event.key === 'v') {
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
    // Remove onpaste handlers from all input and textarea elements
    document.querySelectorAll('input[onpaste], textarea[onpaste]')
        .forEach(el => {
            el.onpaste = null;
            // Also remove the attribute
            el.removeAttribute('onpaste');
        });

    // Remove ondrop, ondragstart, ondragover handlers
    document.querySelectorAll('input[ondrop], textarea[ondrop], input[ondragstart], textarea[ondragstart], input[ondragover], textarea[ondragover]')
        .forEach(el => {
            el.ondrop = null;
            el.ondragstart = null;
            el.ondragover = null;
            el.removeAttribute('ondrop');
            el.removeAttribute('ondragstart');
            el.removeAttribute('ondragover');
        });

    // Remove inline event handlers that might block paste/drag operations
    document.querySelectorAll('input, textarea')
        .forEach(el => {
            // Remove any paste-blocking handlers
            el.onpaste = null;
            el.oncopy = null;
            el.oncut = null;
            el.ondrop = null;
            el.ondragstart = null;
            el.ondragover = null;
            el.ondragleave = null;
            el.ondragenter = null;
            
            // Remove attributes
            ['onpaste', 'oncopy', 'oncut', 'ondrop', 'ondragstart', 'ondragover', 'ondragleave', 'ondragenter'].forEach(attr => {
                if (el.hasAttribute(attr)) {
                    el.removeAttribute(attr);
                }
            });

            // Remove autocomplete="off" which sometimes blocks paste
            if (el.getAttribute('autocomplete') === 'off') {
                el.setAttribute('autocomplete', 'on');
            }

            // Enable paste and drag/drop via style
            el.style.userSelect = 'auto';
            el.style.webkitUserSelect = 'auto';
            el.style.mozUserSelect = 'auto';
            el.style.msUserSelect = 'auto';
        });

    // Override any event listeners that might block paste/drag
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const blockedPasteEvents = ['paste', 'copy', 'cut', 'drop', 'dragstart', 'dragover', 'dragleave', 'dragenter'];
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        // Allow paste and drag/drop events
        if (blockedPasteEvents.includes(type)) {
            // Don't block these events
            return;
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    // Force enable contenteditable elements
    document.querySelectorAll('[contenteditable="false"]').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.setAttribute('contenteditable', 'true');
        }
    });

    // Monitor for dynamically added elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    if (node.matches && (node.matches('input') || node.matches('textarea'))) {
                        node.onpaste = null;
                        node.oncopy = null;
                        node.oncut = null;
                        node.ondrop = null;
                        node.ondragstart = null;
                        node.ondragover = null;
                        
                        ['onpaste', 'oncopy', 'oncut', 'ondrop', 'ondragstart', 'ondragover'].forEach(attr => {
                            node.removeAttribute(attr);
                        });
                    }
                    
                    // Check child elements
                    if (node.querySelectorAll) {
                        node.querySelectorAll('input, textarea').forEach(el => {
                            el.onpaste = null;
                            el.oncopy = null;
                            el.oncut = null;
                            el.ondrop = null;
                            el.ondragstart = null;
                            el.ondragover = null;
                            
                            ['onpaste', 'oncopy', 'oncut', 'ondrop', 'ondragstart', 'ondragover'].forEach(attr => {
                                el.removeAttribute(attr);
                            });
                        });
                    }
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
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