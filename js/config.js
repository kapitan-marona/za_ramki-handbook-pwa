/* js/config.js
   Runtime configuration for the static app.
   Public client values only. Never put service_role keys or private secrets here.
*/
(function(){
  "use strict";

  var config = {
    backendMode: "supabase",
    supabaseUrl: "https://oedmueajusqhekgnyfsl.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZG11ZWFqdXNxaGVrZ255ZnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NzEzNjUsImV4cCI6MjA4NzM0NzM2NX0.Blndb_1_aJBg9WOV1YwvroIhK9eYuMTltBEh-hD7Yws",
    pushVapidPublicKey: "BKBNpsavLva4LfbCCNKo791rsd-zfgrO4_e6k2mu5j5avriBhVnjDaJnrSCXqaZC2tDzxe0nUKBF45V3nqLpp1U",
    pushFunction: "test-push",
    pushEndpoint: "",
    debugPush: false
  };

  window.ZR_CONFIG = Object.assign({}, config, window.ZR_CONFIG || {});

  // Legacy globals for the current Supabase-backed implementation.
  window.ZR_BACKEND_MODE = window.ZR_CONFIG.backendMode;
  window.SUPABASE_URL = window.ZR_CONFIG.supabaseUrl;
  window.SUPABASE_ANON = window.ZR_CONFIG.supabaseAnonKey;
  window.PUSH_VAPID_PUBLIC_KEY = window.ZR_CONFIG.pushVapidPublicKey;
  window.ZR_PUSH_FUNCTION = window.ZR_CONFIG.pushFunction;
  window.ZR_PUSH_ENDPOINT = window.ZR_CONFIG.pushEndpoint;
  window.ZR_DEBUG_PUSH = !!window.ZR_CONFIG.debugPush;
})();
