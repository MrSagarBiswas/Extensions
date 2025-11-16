// This function will be injected to apply various anti-fingerprinting measures.
function interceptAndSpoof() {
    const config = {
        blockedEvents: ['paste', 'fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']
    };

    /**
     * Applies all spoofing and interception logic to a given window object.
     * @param {Window} win The window object (e.g., window or an iframe's contentWindow).
     */
    const applySpoofs = (win) => {
        // Destructure required objects from the target window.
        const { document, EventTarget, Function, Object, navigator, Promise, HTMLCanvasElement, OffscreenCanvas } = win;

        // --- Core Spoofing Infrastructure ---

        const defineProperty = (obj, prop, descriptor) => {
            try {
                Object.defineProperty(obj, prop, descriptor);
            } catch (e) {
                // Errors can occur in sandboxed environments, so we suppress them.
            }
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

        // --- Event Listener Interception (for blocking keyboard shortcuts and events) ---

        const listenerMap = new WeakMap();
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const newAddEventListener = function(type, listener, options) {
            if (config.blockedEvents.includes(type)) {
                return; // Block events like 'paste', 'blur', etc.
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
                        // Block detection of various keys and combinations.
                        if (
                            event.key === 'Meta' ||       // Windows/Command key
                            event.key === 'PrintScreen' || // Print screen key
                            (event.ctrlKey && event.key === 'v') || // Ctrl+V
                            (event.ctrlKey && event.shiftKey) || // Ctrl+Shift
                            (event.altKey && event.ctrlKey) ||   // Alt+Ctrl
                            (event.metaKey && event.ctrlKey)     // Meta+Ctrl
                        ) {
                            return; // Suppress the event by not calling the original listener.
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

        // Block direct event handler assignments.
        ['onpaste', 'onfullscreenchange', 'onwebkitfullscreenchange', 'onmozfullscreenchange', 'onmsfullscreenchange'].forEach(eventName => {
            const descriptor = { set: () => {}, configurable: true };
            defineProperty(win, eventName, descriptor);
            defineProperty(document, eventName, descriptor);
        });

        // --- Clipboard and Navigator Spoofing ---

        // if (navigator.clipboard) {
        //     const newReadText = async () => Promise.resolve('');
        //     defineProperty(navigator.clipboard, 'readText', { value: newReadText, configurable: true });
        //     spoofToString(newReadText, 'readText');
        // }

        // --- WebGL Spoofing (integrated from original script) ---

        const SPOOF_VENDOR = "Google Inc. (Intel)";
        const SPOOF_RENDERER = "ANGLE (Intel, Intel(R) UHD Graphics (0x-00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)";
        const UNMASKED_VENDOR_WEBGL = 0x9245;
        const UNMASKED_RENDERER_WEBGL = 0x9246;

        const patchContext = (context) => {
            if (!context) return;
            const originalGetParameter = context.getParameter;
            const newGetParameter = function(param) {
                if (param === UNMASKED_VENDOR_WEBGL) return SPOOF_VENDOR;
                if (param === UNMASKED_RENDERER_WEBGL) return SPOOF_RENDERER;
                return originalGetParameter.apply(context, arguments);
            };
            spoofToString(newGetParameter, 'getParameter');
            defineProperty(context, 'getParameter', { value: newGetParameter, writable: true, configurable: true });
        };

        const patchCanvasPrototype = (prototype, methodName) => {
            if (!prototype || !prototype[methodName]) return;
            const originalMethod = prototype[methodName];
            const newMethod = function(...args) {
                const context = originalMethod.apply(this, args);
                const type = args[0];
                if (context && (type === 'webgl' || type === 'webgl2')) {
                    patchContext(context);
                }
                return context;
            };
            spoofToString(newMethod, methodName);
            defineProperty(prototype, methodName, { value: newMethod, writable: true, configurable: true });
        };

        patchCanvasPrototype(HTMLCanvasElement.prototype, 'getContext');
        if (typeof OffscreenCanvas !== 'undefined') {
            patchCanvasPrototype(OffscreenCanvas.prototype, 'getContext');
        }
    };

    // --- Iframe Interception ---

    // Intercept iframe creation to apply spoofs to them as well.
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.apply(this, arguments);
        if (tagName.toLowerCase() === 'iframe') {
            element.addEventListener('load', () => {
                try {
                    applySpoofs(element.contentWindow);
                } catch (e) {
                    // Errors can occur due to cross-origin restrictions.
                }
            });
        }
        return element;
    };

    // Apply spoofs to the main window.
    applySpoofs(window);
}

// --- Chrome Extension Boilerplate ---

chrome.webNavigation.onCommitted.addListener((details) => {
  // Inject the script into every frame as it commits. This is necessary
  // to ensure that sandboxed iframes, which have restricted access from
  // the parent frame, can also have their WebGL information spoofed.
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [details.frameId] },
    func: interceptAndSpoof,
    world: 'MAIN',
    injectImmediately: true,
  }).catch((error) => {});
});