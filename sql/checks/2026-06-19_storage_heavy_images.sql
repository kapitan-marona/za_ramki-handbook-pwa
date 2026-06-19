-- ZA RAMKI Storage heavy image check.
-- Read-only query for Supabase SQL Editor.
--
-- Shows large image files in Supabase Storage. Useful before production
-- because heavy instruction images slow down article opening.

select
  bucket_id,
  name,
  metadata->>'mimetype' as mimetype,
  ((metadata->>'size')::bigint / 1024.0 / 1024.0)::numeric(10,2) as size_mb,
  updated_at
from storage.objects
where bucket_id = 'kb-media'
  and (
    metadata->>'mimetype' like 'image/%'
    or lower(name) ~ '\.(png|jpg|jpeg|webp)$'
  )
order by (metadata->>'size')::bigint desc nulls last;
