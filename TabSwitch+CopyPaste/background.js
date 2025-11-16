function interceptAndSpoof() {
    const config = {
        blockedEvents: ['visibilitychange', 'blur', 'focus', 'paste', 'copy', 'cut']
    };

    const applySpoofs = (win) => {
        const { document, EventTarget, Function, Object, Promise } = win;

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
                        if (event.ctrlKey && (event.key === 'c' || event.key === 'v' || event.key === 'x')) {
                            return;
                        }
                        if (event.metaKey && event.ctrlKey) {
                            return;
                        }
                        if (event.metaKey && event.ctrlKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
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

        ['onblur', 'onfocus', 'onvisibilitychange', 'onpaste', 'oncopy', 'oncut'].forEach(eventName => {
            const descriptor = { set: () => {}, configurable: true };
            defineProperty(win, eventName, descriptor);
            defineProperty(document, eventName, descriptor);
        });

        // if (navigator.clipboard) {
        //     const newReadText = async () => {
        //         return Promise.resolve('');
        //     };
        //     defineProperty(navigator.clipboard, 'readText', { value: newReadText, configurable: true });
        //     spoofToString(newReadText, 'readText');

        //     const newWriteText = async () => {
        //         return Promise.resolve();
        //     };
        //     defineProperty(navigator.clipboard, 'writeText', { value: newWriteText, configurable: true });
        //     spoofToString(newWriteText, 'writeText');
        // }
    };

    applySpoofs(window);
}

chrome.webNavigation.onCommitted.addListener((details) => {
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [details.frameId] },
    func: interceptAndSpoof,
    world: 'MAIN',
    injectImmediately: true,
  });
});