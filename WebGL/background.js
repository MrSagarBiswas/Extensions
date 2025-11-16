// This function will be injected. It intercepts context creation.
function interceptAndSpoof() {
  const SPOOF_VENDOR = "Google Inc. (Intel)";
  const SPOOF_RENDERER = "ANGLE (Intel, Intel(R) UHD Graphics (0x-00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)";
  const UNMASKED_VENDOR = 0x9245;
  const UNMASKED_RENDERER = 0x9246;

  // This function takes a WebGL context and patches its getParameter method.
  const patchContext = (context) => {
    if (!context) return;
    
    // Store the original getParameter function
    const originalGetParameter = context.getParameter;
    
    // Create the new, patched getParameter function
    context.getParameter = function(param) {
      if (param === UNMASKED_VENDOR) return SPOOF_VENDOR;
      if (param === UNMASKED_RENDERER) return SPOOF_RENDERER;
      
      // Call the original function for all other parameters
      return originalGetParameter.apply(context, arguments);
    };
  };

  // --- Intercept HTMLCanvasElement.getContext ---
  try {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const context = originalGetContext.apply(this, [type, ...args]);
      if (type === 'webgl' || type === 'webgl2') {
        patchContext(context);
      }
      return context;
    };
  } catch (e) {
  }
  
  // --- Intercept OffscreenCanvas.getContext (for web workers) ---
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const originalOffscreenGetContext = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = function(type, ...args) {
        const context = originalOffscreenGetContext.apply(this, [type, ...args]);
        if (type === 'webgl' || type === 'webgl2') {
          patchContext(context);
        }
        return context;
      };
    }
  } catch(e) {
  }
}

// Listen for when a document is about to be committed (i.e., starts loading)
chrome.webNavigation.onCommitted.addListener((details) => {
  // We only want to inject into the main top-level frame, not iframes
  if (details.frameId === 0) {
    chrome.scripting.executeScript({
      target: { tabId: details.tabId, frameIds: [details.frameId] },
      func: interceptAndSpoof,
      world: 'MAIN',
      injectImmediately: true,
    });
  }
});