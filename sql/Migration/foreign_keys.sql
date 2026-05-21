table_name,column_name,data_type,is_nullable
allowlist,email,text,NO
allowlist,enabled,boolean,NO
allowlist,role,text,NO
backup_checklist_instances_2026_04_05,id,uuid,YES
backup_checklist_instances_2026_04_05,user_id,uuid,YES
backup_checklist_instances_2026_04_05,checklist_id,text,YES
backup_checklist_instances_2026_04_05,items_state,jsonb,YES
backup_checklist_instances_2026_04_05,status,text,YES
backup_checklist_instances_2026_04_05,created_at,timestamp with time zone,YES
backup_checklist_instances_2026_04_05,updated_at,timestamp with time zone,YES
backup_checklist_instances_2026_04_05,task_id,uuid,YES
backup_checklist_template_items_2026_04_05,id,uuid,YES
backup_checklist_template_items_2026_04_05,template_id,uuid,YES
backup_checklist_template_items_2026_04_05,pos,integer,YES
backup_checklist_template_items_2026_04_05,text,text,YES
backup_checklist_template_items_2026_04_05,created_at,timestamp with time zone,YES
backup_checklist_templates_2026_04_05,id,uuid,YES
backup_checklist_templates_2026_04_05,title,text,YES
backup_checklist_templates_2026_04_05,description,text,YES
backup_checklist_templates_2026_04_05,created_at,timestamp with time zone,YES
backup_checklist_templates_2026_04_05,updated_at,timestamp with time zone,YES
backup_kb_checklists_2026_04_05,id,text,YES
backup_kb_checklists_2026_04_05,title,text,YES
backup_kb_checklists_2026_04_05,desc,text,YES
backup_kb_checklists_2026_04_05,url,text,YES
backup_kb_checklists_2026_04_05,tags,ARRAY,YES
backup_kb_checklists_2026_04_05,published,boolean,YES
backup_kb_checklists_2026_04_05,sort,integer,YES
backup_kb_checklists_2026_04_05,created_at,timestamp with time zone,YES
backup_kb_checklists_2026_04_05,updated_at,timestamp with time zone,YES
backup_kb_checklists_2026_04_05,actions,jsonb,YES
backup_kb_checklists_2026_04_05,items,jsonb,YES
backup_task_checklist_items_2026_04_05,id,uuid,YES
backup_task_checklist_items_2026_04_05,task_id,uuid,YES
backup_task_checklist_items_2026_04_05,pos,integer,YES
backup_task_checklist_items_2026_04_05,text,text,YES
backup_task_checklist_items_2026_04_05,done,boolean,YES
backup_task_checklist_items_2026_04_05,done_at,timestamp with time zone,YES
backup_task_checklists_2026_04_05,id,uuid,YES
backup_task_checklists_2026_04_05,task_id,uuid,YES
backup_task_checklists_2026_04_05,template_id,uuid,YES
backup_task_checklists_2026_04_05,title,text,YES
backup_task_checklists_2026_04_05,created_at,timestamp with time zone,YES
checklist_instances,id,uuid,NO
checklist_instances,user_id,uuid,NO
checklist_instances,checklist_id,text,NO
checklist_instances,items_state,jsonb,NO
checklist_instances,status,text,YES
checklist_instances,created_at,timestamp with time zone,NO
checklist_instances,updated_at,timestamp with time zone,NO
checklist_instances,task_id,uuid,YES
checklist_template_items,id,uuid,NO
checklist_template_items,template_id,uuid,NO
checklist_template_items,pos,integer,NO
checklist_template_items,text,text,NO
checklist_template_items,created_at,timestamp with time zone,NO
checklist_templates,id,uuid,NO
checklist_templates,title,text,NO
checklist_templates,description,text,YES
checklist_templates,created_at,timestamp with time zone,NO
checklist_templates,updated_at,timestamp with time zone,NO
kb_articles,id,text,NO
kb_articles,title,text,NO
kb_articles,type,text,NO
kb_articles,status,text,NO
kb_articles,category,text,YES
kb_articles,tags,ARRAY,YES
kb_articles,roles,ARRAY,YES
kb_articles,pinned,boolean,YES
kb_articles,updated_at,timestamp with time zone,YES
kb_articles,content_md,text,NO
kb_articles,created_by,uuid,YES
kb_articles,actions,jsonb,YES
kb_articles,excerpt,text,YES
kb_articles,has_inline_new,boolean,NO
kb_checklists,id,text,NO
kb_checklists,title,text,NO
kb_checklists,desc,text,YES
kb_checklists,url,text,YES
kb_checklists,tags,ARRAY,NO
kb_checklists,published,boolean,NO
kb_checklists,sort,integer,NO
kb_checklists,created_at,timestamp with time zone,NO
kb_checklists,updated_at,timestamp with time zone,NO
kb_checklists,actions,jsonb,NO
kb_checklists,items,jsonb,NO
kb_templates,id,text,NO
kb_templates,title,text,NO
kb_templates,format,text,YES
kb_templates,link,text,YES
kb_templates,tags,ARRAY,NO
kb_templates,published,boolean,NO
kb_templates,sort,integer,NO
kb_templates,created_at,timestamp with time zone,NO
kb_templates,updated_at,timestamp with time zone,NO
kb_templates,actions,jsonb,NO
profiles,id,uuid,NO
profiles,email,text,YES
profiles,name,text,YES
profiles,role,text,NO