-- ZA RAMKI RLS admin role hotfix.
-- Date: 2026-06-18
--
-- Purpose:
-- After RLS hardening, staff access works but an admin session can become
-- server-side invisible if the JWT email does not resolve through allowlist.
-- This keeps allowlist as the primary role source and adds profiles.role as a
-- fallback by auth.uid(). Profile roles are normalized because older profile
-- rows may contain UI labels such as "Админ" instead of technical values.

begin;

create or replace function public.get_role()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  em text;
  uid uuid;
  r text;
begin
  em := lower(auth.jwt() ->> 'email');

  if em is not null and em <> '' then
    select a.role
      into r
    from public.allowlist a
    where lower(a.email) = em
      and a.enabled = true
    limit 1;

    if lower(r) in ('admin','staff') then
      return lower(r);
    end if;
  end if;

  uid := auth.uid();

  if uid is not null then
    select case
      when lower(trim(p.role)) in ('admin', 'админ') then 'admin'
      when lower(trim(p.role)) in ('staff', 'сотрудник', 'employee') then 'staff'
      else null
    end
      into r
    from public.profiles p
    where p.id = uid
    limit 1;

    if r in ('admin','staff') then
      return r;
    end if;
  end if;

  return null;
end;
$function$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.get_role() = 'admin';
$function$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.get_role() in ('staff','admin');
$function$;

commit;
