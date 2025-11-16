(function(){
  const SPOOF_VENDOR = "Google Inc. (Intel)";
  const SPOOF_RENDERER = "ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)";
  const UNMASKED_VENDOR = 0x9245, UNMASKED_RENDERER = 0x9246;
  const LEAK_RE = /(intel|nvidia|amd|angle|mali|adreno|geforce|radeon)/i;

function makeGetParameter(orig) {
  return function (param) {
    try {
      if (param === UNMASKED_VENDOR) return SPOOF_VENDOR;
      if (param === UNMASKED_RENDERER) return SPOOF_RENDERER;
      if (param === this.VENDOR) return "WebKit";
      if (param === this.RENDERER) return "WebKit WebGL";

      let val;
      try {
        val = orig.call(this, param);
      } catch (err) {
        return null;
      }

      if (typeof val === "string" && LEAK_RE.test(val)) return SPOOF_RENDERER;
      return val;
    } catch (e) {
      return null;
    }
  };
}


  function makeGetExtension(orig){
    return function(name){
      if (name === "WEBGL_debug_renderer_info") {
        return {
          UNMASKED_VENDOR_WEBGL: UNMASKED_VENDOR,
          UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER
        };
      }
      return orig.call(this, name);
    };
  }

  function makeGetSupportedExtensions(orig){
    return function(){
      const exts = (orig && orig.call(this)) || [];
      return exts.filter(e => e !== "WEBGL_debug_renderer_info");
    };
  }

  function installOn(proto){
    if (!proto || proto.__ws_spoofed) return;
    if (proto.getParameter) proto.getParameter = makeGetParameter(proto.getParameter);
    if (proto.getExtension) proto.getExtension = makeGetExtension(proto.getExtension);
    if (proto.getSupportedExtensions) proto.getSupportedExtensions = makeGetSupportedExtensions(proto.getSupportedExtensions);
    proto.__ws_spoofed = true;
  }

  try{ installOn(globalThis.WebGLRenderingContext && WebGLRenderingContext.prototype); }catch(e){}
  try{ installOn(globalThis.WebGL2RenderingContext && WebGL2RenderingContext.prototype); }catch(e){}

  try{
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...a){
      const ctx = orig.call(this, type, ...a);
      return ctx;
    };
  }catch(e){}

  try{
    if (typeof OffscreenCanvas !== "undefined"){
      const origOff = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = function(type, ...a){
        const ctx = origOff.call(this, type, ...a);
        return ctx;
      };
    }
  }catch(e){}

  // ensure prototypes patched now (covers already-created contexts)
  try{ installOn(WebGLRenderingContext.prototype); }catch(e){}
  try{ installOn(WebGL2RenderingContext.prototype); }catch(e){}
})();
