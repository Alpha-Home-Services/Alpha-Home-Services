-- Equipment editing and private data plate photos.
-- Apply once to the TEST project after 202609300001_foundation.sql. Does not touch existing rows.

-- Photos live at <customer id>/<equipment id>/<file> in a private bucket, so storage access follows customer access.
alter table public.equipment add column photo_path text
 check(photo_path is null or photo_path like customer_id::text||'/'||id::text||'/%');

-- Assigned techs can now edit equipment on site, like the prototype.
-- Nobody can move equipment to a different customer from the app: customer_id, trade, id and created_at are not updatable.
drop policy office_equipment_update on public.equipment;
create policy assigned_equipment_update on public.equipment for update to authenticated
 using(public.can_access_customer(customer_id)) with check(public.can_access_customer(customer_id));
revoke update on public.equipment from authenticated;
grant update(location_id,type,brand,model,serial,year,size,extra,property_location,condition,warranty_date,notes,photo_path) on public.equipment to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('equipment-photos','equipment-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create function public.photo_customer(path text) returns uuid language sql immutable
set search_path='' as $$
 select case when split_part(path,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then split_part(path,'/',1)::uuid end;
$$;
grant execute on function public.photo_customer(text) to authenticated;

create policy equipment_photo_read on storage.objects for select to authenticated
 using(bucket_id='equipment-photos' and public.photo_customer(name) is not null and public.can_access_customer(public.photo_customer(name)));
create policy equipment_photo_upload on storage.objects for insert to authenticated
 with check(bucket_id='equipment-photos' and public.photo_customer(name) is not null and public.can_access_customer(public.photo_customer(name)));
-- Lets a retake remove the old file.
create policy equipment_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='equipment-photos' and public.photo_customer(name) is not null and public.can_access_customer(public.photo_customer(name)));
