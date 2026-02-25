/* js/utils/supabase_client.js
   Client-only Supabase init (anon key only).
   IMPORTANT: never put service_role here.
*/
(function(){
  const URL  = window.SUPABASE_URL  || "";
  const ANON = window.SUPABASE_ANON || "";

  if(!URL || !ANON){
    console.warn("[Supabase] Missing SUPABASE_URL / SUPABASE_ANON");
    window.SB = null;
    return;
  }

  if(!window.supabase || !window.supabase.createClient){
    console.warn("[Supabase] supabase-js is not loaded");
    window.SB = null;
    return;
  }

  window.SB = window.supabase.createClient(URL, ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  console.log("[Supabase] client ready");
})();
