-- Housecall Pro customer import.
-- Apply once to the TEST project after 202610010001_equipment_editing_photos.sql. Does not touch existing rows.

-- Remembers where an imported customer came from, so re-importing the same file skips it and job history can be linked later.
alter table public.customers add column hcp_id text unique check(hcp_id is null or length(trim(hcp_id)) between 1 and 100);

-- Saves a whole import in one transaction: if any row fails, nothing is saved.
-- Runs with the caller's permissions (not security definer), so the normal office-only rules still apply.
-- Customer ids are chosen by the app so parent links can be set in the same call.
create function public.import_hcp_customers(payload jsonb) returns integer language plpgsql
set search_path='' as $$
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if jsonb_typeof(payload)<>'array' then raise exception 'Import payload must be a list'; end if;
 insert into public.customers(id,name,type,phone,email,service_address,billing_address,access_notes,lead_source,hcp_id)
 select (r->>'id')::uuid,r->>'name',r->>'type',coalesce(r->>'phone',''),coalesce(r->>'email',''),coalesce(r->>'service_address',''),
  coalesce(r->>'billing_address',''),coalesce(r->>'access_notes',''),coalesce(r->>'lead_source',''),nullif(r->>'hcp_id','')
 from jsonb_array_elements(payload) r;
 insert into public.locations(customer_id,name,address,notes)
 select (r->>'id')::uuid,l->>'name',l->>'address',coalesce(l->>'notes','')
 from jsonb_array_elements(payload) r,jsonb_array_elements(coalesce(r->'locations','[]'::jsonb)) l;
 update public.customers c set parent_id=(r->>'parent_id')::uuid,bill_to='parent'
 from jsonb_array_elements(payload) r where c.id=(r->>'id')::uuid and r->>'parent_id' is not null;
 return jsonb_array_length(payload);
end;$$;
revoke all on function public.import_hcp_customers(jsonb) from public;
grant execute on function public.import_hcp_customers(jsonb) to authenticated;
