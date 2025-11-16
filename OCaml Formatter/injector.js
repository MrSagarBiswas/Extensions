(function() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('helper.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).prepend(script);
})();
