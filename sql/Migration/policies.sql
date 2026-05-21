schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
public,allowlist,allowlist_admin_delete,PERMISSIVE,{authenticated},DELETE,is_admin(),null
public,allowlist,allowlist_admin_insert,PERMISSIVE,{authenticated},INSERT,null,is_admin()
public,allowlist,allowlist_admin_select,PERMISSIVE,{authenticated},SELECT,is_admin(),null
public,allowlist,allowlist_admin_update,PERMISSIVE,{authenticated},UPDATE,is_admin(),is_admin()
public,checklist_instances,checklist_instances_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,checklist_instances,checklist_instances_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,checklist_instances,checklist_instances_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,checklist_template_items,checklist_template_items_select_staff,PERMISSIVE,{public},SELECT,is_staff(),null
public,checklist_template_items,checklist_template_items_write_admin,PERMISSIVE,{public},ALL,is_admin(),is_admin()
public,checklist_templates,checklist_templates_select_staff,PERMISSIVE,{public},SELECT,is_staff(),null
public,checklist_templates,checklist_templates_write_admin,PERMISSIVE,{public},ALL,is_admin(),is_admin()
public,kb_articles,kb_articles_delete_admin,PERMISSIVE,{authenticated},DELETE,(get_role() = 'admin'::text),null
public,kb_articles,kb_articles_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,kb_articles,kb_articles_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,kb_articles,kb_articles_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,kb_checklists,kb_checklists_admin_delete,PERMISSIVE,{authenticated},DELETE,is_admin(),null
public,kb_checklists,kb_checklists_admin_insert,PERMISSIVE,{authenticated},INSERT,null,is_admin()
public,kb_checklists,kb_checklists_admin_update,PERMISSIVE,{authenticated},UPDATE,is_admin(),is_admin()
public,kb_checklists,kb_checklists_select_published,PERMISSIVE,{authenticated},SELECT,(published = true),null
public,kb_templates,kb_templates_admin_delete,PERMISSIVE,{authenticated},DELETE,is_admin(),null
public,kb_templates,kb_templates_admin_insert,PERMISSIVE,{authenticated},INSERT,null,is_admin()
public,kb_templates,kb_templates_admin_update,PERMISSIVE,{authenticated},UPDATE,is_admin(),is_admin()
public,kb_templates,kb_templates_select_published,PERMISSIVE,{authenticated},SELECT,(published = true),null
public,profiles,profiles_select_all_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,profiles,profiles_select_own,PERMISSIVE,{authenticated},SELECT,(auth.uid() = id),null
public,profiles,profiles_update_own,PERMISSIVE,{authenticated},UPDATE,(auth.uid() = id),(auth.uid() = id)
public,project_comments,Users can update own project comments,PERMISSIVE,{public},UPDATE,(auth.uid() = author_id),(auth.uid() = author_id)
public,project_comments,project_comments_insert,PERMISSIVE,{public},INSERT,null,(auth.role() = 'authenticated'::text)
public,project_comments,project_comments_select,PERMISSIVE,{public},SELECT,(auth.role() = 'authenticated'::text),null
public,project_links,project_links_delete,PERMISSIVE,{public},DELETE,(auth.role() = 'authenticated'::text),null
public,project_links,project_links_insert,PERMISSIVE,{public},INSERT,null,(auth.role() = 'authenticated'::text)
public,project_links,project_links_select,PERMISSIVE,{public},SELECT,(auth.role() = 'authenticated'::text),null
public,projects,projects_delete_auth,PERMISSIVE,{authenticated},DELETE,true,null
public,projects,projects_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,projects,projects_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,projects,projects_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,public_requests,Public can create requests,PERMISSIVE,{anon},INSERT,null,true
public,push_subscriptions,push_delete_own,PERMISSIVE,{authenticated},DELETE,(auth.uid() = user_id),null
public,push_subscriptions,push_insert_own,PERMISSIVE,{authenticated},INSERT,null,(auth.uid() = user_id)
public,push_subscriptions,push_select_own,PERMISSIVE,{authenticated},SELECT,(auth.uid() = user_id),null
public,push_subscriptions,push_update_own,PERMISSIVE,{authenticated},UPDATE,(auth.uid() = user_id),(auth.uid() = user_id)
public,task_activity,task_activity_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_activity,task_activity_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_activity,task_activity_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,task_assignees,task_assignees_delete_admin,PERMISSIVE,{authenticated},DELETE,(get_role() = 'admin'::text),null
public,task_assignees,task_assignees_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_assignees,task_assignees_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_assignees,task_assignees_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,task_checklist_items,task_checklist_items_delete_admin,PERMISSIVE,{authenticated},DELETE,(get_role() = 'admin'::text),null
public,task_checklist_items,task_checklist_items_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_checklist_items,task_checklist_items_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_checklist_items,task_checklist_items_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,task_checklists,task_checklists_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_checklists,task_checklists_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_checklists,task_checklists_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,task_comments,task_comments_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_comments,task_comments_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_comments,task_comments_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,task_files,task_files_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_files,task_files_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_files,task_files_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,task_links,task_links_delete_auth,PERMISSIVE,{authenticated},DELETE,true,null
public,task_links,task_links_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,task_links,task_links_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,task_links,task_links_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true
public,tasks,tasks_insert_auth,PERMISSIVE,{authenticated},INSERT,null,true
public,tasks,tasks_select_auth,PERMISSIVE,{authenticated},SELECT,true,null
public,tasks,tasks_update_auth,PERMISSIVE,{authenticated},UPDATE,true,true