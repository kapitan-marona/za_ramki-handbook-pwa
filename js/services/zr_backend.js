/* js/services/zr_backend.js
   Backend adapter facade.
   Phase 0: still uses Supabase internally.
   Future: can switch internals to Yandex API without changing views.
*/
(function(){
  "use strict";

  var core = window.ZRBackendCore || {};
  var projects = window.ZRBackendProjects || {};
  var people = window.ZRBackendPeople || {};
  var kb = window.ZRBackendKb || {};
  var push = window.ZRBackendPush || {};
  var taskMeta = window.ZRBackendTaskMeta || {};
  var taskChecklists = window.ZRBackendTaskChecklists || {};
  var taskContent = window.ZRBackendTaskContent || {};
  var tasks = window.ZRBackendTasks || {};

  function requireProvider(){
    if(window.ZRBackendProvider && typeof window.ZRBackendProvider.require === "function"){
      return window.ZRBackendProvider.require();
    }

    throw new Error("Backend provider is not ready");
  }

  window.ZRBackend = {
    isReady(){
      return !!(window.ZRBackendProvider && window.ZRBackendProvider.isReady());
    },

    mode: window.ZRBackendProvider ? window.ZRBackendProvider.getMode() : "supabase",

    /* transitional provider accessor
       future-safe provider boundary
    */
    raw(){
      return requireProvider();
    },

    /* legacy compatibility alias
       remove later after full quarantine
    */
    rawSupabase(){
      return this.raw();
    },

    auth: core.createAuth(requireProvider),

    db: core.createDb(requireProvider),

    projects: projects.createProjects(),
    
    projectLinks: projects.createProjectLinks(),

    projectComments: projects.createProjectComments(),

    tasks: tasks.createTasks(),

    taskActivity: taskMeta.createTaskActivity(),

    taskAssignees: taskMeta.createTaskAssignees(),
    
    checklistInstances: taskChecklists.createChecklistInstances(),

    taskChecklistItems: taskChecklists.createTaskChecklistItems(),

    taskComments: taskContent.createTaskComments(),

    taskFiles: taskContent.createTaskFiles(),

    taskLinks: taskContent.createTaskLinks(),
    
    pushSubscriptions: push.createPushSubscriptions(),

    allowlist: people.createAllowlist(),

    profiles: people.createProfiles(),
    
    kb: kb.createKb()
  };

  console.log("[ZRBackend] ready:", window.ZRBackend.mode, "adapter");
})();
