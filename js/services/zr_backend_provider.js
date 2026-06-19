/* js/services/zr_backend_provider.js
   Provider boundary for the backend facade.
   Current provider: Supabase browser client. Future provider: Russian API.
*/
(function(){
  "use strict";

  function getMode(){
    return (window.ZR_CONFIG && window.ZR_CONFIG.backendMode) || window.ZR_BACKEND_MODE || "supabase";
  }

  function get(){
    return window.SB || null;
  }

  function require(){
    var provider = get();

    if(!provider){
      throw new Error("Supabase client is not ready");
    }

    return provider;
  }

  function isReady(){
    return !!get();
  }

  window.ZRBackendProvider = {
    getMode: getMode,
    get: get,
    require: require,
    isReady: isReady
  };
})();
