-- ZA RAMKI profile role typo fix.
-- Date: 2026-06-18
--
-- Fixes an existing profile role typo found during RLS hardening:
-- satff -> staff.

begin;

update public.profiles
set role = 'staff'
where role = 'satff';

commit;
