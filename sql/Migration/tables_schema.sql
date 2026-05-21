| table_schema | table_name                                 |
| ------------ | ------------------------------------------ |
| auth         | audit_log_entries                          |
| auth         | custom_oauth_providers                     |
| auth         | flow_state                                 |
| auth         | identities                                 |
| auth         | instances                                  |
| auth         | mfa_amr_claims                             |
| auth         | mfa_challenges                             |
| auth         | mfa_factors                                |
| auth         | oauth_authorizations                       |
| auth         | oauth_client_states                        |
| auth         | oauth_clients                              |
| auth         | oauth_consents                             |
| auth         | one_time_tokens                            |
| auth         | refresh_tokens                             |
| auth         | saml_providers                             |
| auth         | saml_relay_states                          |
| auth         | schema_migrations                          |
| auth         | sessions                                   |
| auth         | sso_domains                                |
| auth         | sso_providers                              |
| auth         | users                                      |
| auth         | webauthn_challenges                        |
| auth         | webauthn_credentials                       |
| extensions   | pg_stat_statements                         |
| extensions   | pg_stat_statements_info                    |
| public       | allowlist                                  |
| public       | backup_checklist_instances_2026_04_05      |
| public       | backup_checklist_template_items_2026_04_05 |
| public       | backup_checklist_templates_2026_04_05      |
| public       | backup_kb_checklists_2026_04_05            |
| public       | backup_task_checklist_items_2026_04_05     |
| public       | backup_task_checklists_2026_04_05          |
| public       | checklist_instances                        |
| public       | checklist_template_items                   |
| public       | checklist_templates                        |
| public       | kb_articles                                |
| public       | kb_checklists                              |
| public       | kb_templates                               |
| public       | profiles                                   |
| public       | project_comments                           |
| public       | project_links                              |
| public       | projects                                   |
| public       | public_requests                            |
| public       | push_subscriptions                         |
| public       | task_activity                              |
| public       | task_assignees                             |
| public       | task_checklist_items                       |
| public       | task_checklists                            |
| public       | task_comments                              |
| public       | task_files                                 |
| public       | task_links                                 |
| public       | tasks                                      |
| realtime     | messages                                   |
| realtime     | schema_migrations                          |
| realtime     | subscription                               |
| storage      | buckets                                    |
| storage      | buckets_analytics                          |
| storage      | buckets_vectors                            |
| storage      | migrations                                 |
| storage      | objects                                    |
| storage      | s3_multipart_uploads                       |
| storage      | s3_multipart_uploads_parts                 |
| storage      | vector_indexes                             |
| vault        | decrypted_secrets                          |
| vault        | secrets                                    |



| table_name                                 | column_name    | data_type                | is_nullable |
| ------------------------------------------ | -------------- | ------------------------ | ----------- |
| allowlist                                  | email          | text                     | NO          |
| allowlist                                  | enabled        | boolean                  | NO          |
| allowlist                                  | role           | text                     | NO          |
| backup_checklist_instances_2026_04_05      | id             | uuid                     | YES         |
| backup_checklist_instances_2026_04_05      | user_id        | uuid                     | YES         |
| backup_checklist_instances_2026_04_05      | checklist_id   | text                     | YES         |
| backup_checklist_instances_2026_04_05      | items_state    | jsonb                    | YES         |
| backup_checklist_instances_2026_04_05      | status         | text                     | YES         |
| backup_checklist_instances_2026_04_05      | created_at     | timestamp with time zone | YES         |
| backup_checklist_instances_2026_04_05      | updated_at     | timestamp with time zone | YES         |
| backup_checklist_instances_2026_04_05      | task_id        | uuid                     | YES         |
| backup_checklist_template_items_2026_04_05 | id             | uuid                     | YES         |
| backup_checklist_template_items_2026_04_05 | template_id    | uuid                     | YES         |
| backup_checklist_template_items_2026_04_05 | pos            | integer                  | YES         |
| backup_checklist_template_items_2026_04_05 | text           | text                     | YES         |
| backup_checklist_template_items_2026_04_05 | created_at     | timestamp with time zone | YES         |
| backup_checklist_templates_2026_04_05      | id             | uuid                     | YES         |
| backup_checklist_templates_2026_04_05      | title          | text                     | YES         |
| backup_checklist_templates_2026_04_05      | description    | text                     | YES         |
| backup_checklist_templates_2026_04_05      | created_at     | timestamp with time zone | YES         |
| backup_checklist_templates_2026_04_05      | updated_at     | timestamp with time zone | YES         |
| backup_kb_checklists_2026_04_05            | id             | text                     | YES         |
| backup_kb_checklists_2026_04_05            | title          | text                     | YES         |
| backup_kb_checklists_2026_04_05            | desc           | text                     | YES         |
| backup_kb_checklists_2026_04_05            | url            | text                     | YES         |
| backup_kb_checklists_2026_04_05            | tags           | ARRAY                    | YES         |
| backup_kb_checklists_2026_04_05            | published      | boolean                  | YES         |
| backup_kb_checklists_2026_04_05            | sort           | integer                  | YES         |
| backup_kb_checklists_2026_04_05            | created_at     | timestamp with time zone | YES         |
| backup_kb_checklists_2026_04_05            | updated_at     | timestamp with time zone | YES         |
| backup_kb_checklists_2026_04_05            | actions        | jsonb                    | YES         |
| backup_kb_checklists_2026_04_05            | items          | jsonb                    | YES         |
| backup_task_checklist_items_2026_04_05     | id             | uuid                     | YES         |
| backup_task_checklist_items_2026_04_05     | task_id        | uuid                     | YES         |
| backup_task_checklist_items_2026_04_05     | pos            | integer                  | YES         |
| backup_task_checklist_items_2026_04_05     | text           | text                     | YES         |
| backup_task_checklist_items_2026_04_05     | done           | boolean                  | YES         |
| backup_task_checklist_items_2026_04_05     | done_at        | timestamp with time zone | YES         |
| backup_task_checklists_2026_04_05          | id             | uuid                     | YES         |
| backup_task_checklists_2026_04_05          | task_id        | uuid                     | YES         |
| backup_task_checklists_2026_04_05          | template_id    | uuid                     | YES         |
| backup_task_checklists_2026_04_05          | title          | text                     | YES         |
| backup_task_checklists_2026_04_05          | created_at     | timestamp with time zone | YES         |
| checklist_instances                        | id             | uuid                     | NO          |
| checklist_instances                        | user_id        | uuid                     | NO          |
| checklist_instances                        | checklist_id   | text                     | NO          |
| checklist_instances                        | items_state    | jsonb                    | NO          |
| checklist_instances                        | status         | text                     | YES         |
| checklist_instances                        | created_at     | timestamp with time zone | NO          |
| checklist_instances                        | updated_at     | timestamp with time zone | NO          |
| checklist_instances                        | task_id        | uuid                     | YES         |
| checklist_template_items                   | id             | uuid                     | NO          |
| checklist_template_items                   | template_id    | uuid                     | NO          |
| checklist_template_items                   | pos            | integer                  | NO          |
| checklist_template_items                   | text           | text                     | NO          |
| checklist_template_items                   | created_at     | timestamp with time zone | NO          |
| checklist_templates                        | id             | uuid                     | NO          |
| checklist_templates                        | title          | text                     | NO          |
| checklist_templates                        | description    | text                     | YES         |
| checklist_templates                        | created_at     | timestamp with time zone | NO          |
| checklist_templates                        | updated_at     | timestamp with time zone | NO          |
| kb_articles                                | id             | text                     | NO          |
| kb_articles                                | title          | text                     | NO          |
| kb_articles                                | type           | text                     | NO          |
| kb_articles                                | status         | text                     | NO          |
| kb_articles                                | category       | text                     | YES         |
| kb_articles                                | tags           | ARRAY                    | YES         |
| kb_articles                                | roles          | ARRAY                    | YES         |
| kb_articles                                | pinned         | boolean                  | YES         |
| kb_articles                                | updated_at     | timestamp with time zone | YES         |
| kb_articles                                | content_md     | text                     | NO          |
| kb_articles                                | created_by     | uuid                     | YES         |
| kb_articles                                | actions        | jsonb                    | YES         |
| kb_articles                                | excerpt        | text                     | YES         |
| kb_articles                                | has_inline_new | boolean                  | NO          |
| kb_checklists                              | id             | text                     | NO          |
| kb_checklists                              | title          | text                     | NO          |
| kb_checklists                              | desc           | text                     | YES         |
| kb_checklists                              | url            | text                     | YES         |
| kb_checklists                              | tags           | ARRAY                    | NO          |
| kb_checklists                              | published      | boolean                  | NO          |
| kb_checklists                              | sort           | integer                  | NO          |
| kb_checklists                              | created_at     | timestamp with time zone | NO          |
| kb_checklists                              | updated_at     | timestamp with time zone | NO          |
| kb_checklists                              | actions        | jsonb                    | NO          |
| kb_checklists                              | items          | jsonb                    | NO          |
| kb_templates                               | id             | text                     | NO          |
| kb_templates                               | title          | text                     | NO          |
| kb_templates                               | format         | text                     | YES         |
| kb_templates                               | link           | text                     | YES         |
| kb_templates                               | tags           | ARRAY                    | NO          |
| kb_templates                               | published      | boolean                  | NO          |
| kb_templates                               | sort           | integer                  | NO          |
| kb_templates                               | created_at     | timestamp with time zone | NO          |
| kb_templates                               | updated_at     | timestamp with time zone | NO          |
| kb_templates                               | actions        | jsonb                    | NO          |
| profiles                                   | id             | uuid                     | NO          |
| profiles                                   | email          | text                     | YES         |
| profiles                                   | name           | text                     | YES         |
| profiles                                   | role           | text                     | NO          |