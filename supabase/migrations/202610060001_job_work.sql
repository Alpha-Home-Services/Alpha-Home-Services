-- The tech job page (Phase 2): status, checklist, flat-rate tasks, parts and materials, summary, hours, notes, costing.
-- Apply once to the TEST project after 202610050001_jobs.sql. Does not touch existing rows.
--
-- Every change goes through the functions below, which check the person is office or the job's tech.
-- A completed job is locked for everyone until office reopens it. Part costs are never readable by techs:
-- office gets them through job_costing().

alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check check(status in ('scheduled','enroute','progress','parts','complete','invoiced','paid'));
alter table public.jobs
 add column checklist boolean[] not null default '{}',
 add column summary text not null default '' check(length(summary)<=5000),
 add column recommendations text not null default '' check(length(recommendations)<=5000),
 add column parts_needed text not null default '' check(length(parts_needed)<=1000),
 add column actual_hours numeric(5,2) check(actual_hours between 0 and 200),
 add column completed_at timestamptz;

-- Number of checklist items per trade. Must match CHECK in lib/fields.ts (a test checks this).
create function public.checklist_size(p_trade text) returns integer language sql immutable set search_path='' as $$
 select case p_trade when 'hvac' then 7 when 'electrical' then 6 when 'plumbing' then 6 when 'septic' then 7 end;
$$;

-- The customer stays visible to the tech through Completed, until the job is invoiced.
create or replace function public.can_access_customer(target uuid) returns boolean language sql stable security definer
set search_path='' as $$
 select public.is_office() or exists(
  select 1 from public.customer_assignments a join public.profiles p on p.id=a.tech_id
  where a.customer_id=target and a.tech_id=auth.uid() and p.role='tech')
 or exists(
  select 1 from public.jobs j join public.profiles p on p.id=j.tech_id
  where j.customer_id=target and j.tech_id=auth.uid() and p.role='tech' and j.status in ('scheduled','enroute','progress','parts','complete'));
$$;

create table public.job_tasks (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 -- A price book task that's on a job can't be deleted (rename or reprice it instead), like the prototype.
 price_task_id uuid not null references public.price_book(id) on delete restrict,
 name text not null,includes text not null default '',
 -- Price at the time it was added. Later price book changes don't affect jobs already quoted.
 unit_price numeric(10,2) not null check(unit_price>=0),
 qty integer not null default 1 check(qty between 1 and 999),
 by_user uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.job_materials (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 item_id uuid references public.inventory_items(id) on delete set null,
 name text not null check(length(trim(name)) between 1 and 160),
 qty integer not null default 1 check(qty between 1 and 9999),
 unit_cost numeric(10,2) not null default 0 check(unit_cost between 0 and 100000),
 by_user uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index job_tasks_job_idx on public.job_tasks(job_id);
create index job_materials_job_idx on public.job_materials(job_id);
alter table public.inventory_moves add column job_id uuid references public.jobs(id) on delete set null;

alter table public.job_tasks enable row level security;
alter table public.job_materials enable row level security;
revoke all on public.job_tasks,public.job_materials from anon,authenticated;
grant select on public.job_tasks to authenticated;
-- Everything except unit_cost.
grant select(id,job_id,item_id,name,qty,by_user,created_at) on public.job_materials to authenticated;
create policy visible_job_tasks on public.job_tasks for select to authenticated
 using(exists(select 1 from public.jobs j where j.id=job_id and (public.is_office() or j.tech_id=auth.uid())));
create policy visible_job_materials on public.job_materials for select to authenticated
 using(exists(select 1 from public.jobs j where j.id=job_id and (public.is_office() or j.tech_id=auth.uid())));

-- Locks the job row and checks the caller may change it: office or the job's tech, and not completed/invoiced/paid.
create function public.lock_job_for_work(p_job uuid) returns public.jobs language plpgsql security definer set search_path='' as $$
declare j public.jobs;
begin
 select * into j from public.jobs where id=p_job for update;
 if j.id is null or not (public.is_office() or j.tech_id=auth.uid()) then raise exception 'Job not found'; end if;
 if j.status not in ('scheduled','enroute','progress','parts') then raise exception 'This job is completed. Office can reopen it to make changes.'; end if;
 return j;
end;$$;
revoke all on function public.lock_job_for_work(uuid) from public;

create function public.set_job_status(p_job uuid,p_status text,p_parts_needed text default '') returns void language plpgsql security definer set search_path='' as $$
declare j public.jobs;open_items integer;
begin
 if p_status='progress' and exists(select 1 from public.jobs where id=p_job and status='complete') then
  -- Reopen: office only.
  if not public.is_office() then raise exception 'Only office can reopen a completed job'; end if;
  update public.jobs set status='progress',completed_at=null,updated_at=now() where id=p_job;return;
 end if;
 j:=public.lock_job_for_work(p_job);
 if p_status='enroute' and j.status='scheduled' then null;
 elsif p_status='progress' and j.status in ('scheduled','enroute') then null;
 elsif p_status='parts' then
  if length(trim(coalesce(p_parts_needed,'')))=0 then raise exception 'Say which parts are needed'; end if;
 elsif p_status='complete' and j.status='progress' then
  if not exists(select 1 from public.job_tasks where job_id=j.id) then raise exception 'Add at least one flat-rate task before completing this job'; end if;
  select public.checklist_size(j.trade)-count(*) filter(where done) into open_items from unnest(j.checklist[1:public.checklist_size(j.trade)]) done;
  if open_items>0 then raise exception 'Finish the checklist first. % still open',open_items; end if;
  if length(trim(j.summary))=0 then raise exception 'Write the job summary first'; end if;
 else raise exception 'A % job can''t be changed to %',j.status,p_status;
 end if;
 update public.jobs set status=p_status,parts_needed=case when p_status='parts' then trim(p_parts_needed) else parts_needed end,
  completed_at=case when p_status='complete' then now() else completed_at end,updated_at=now() where id=j.id;
end;$$;

-- Moves the job to a new date/time and back to Scheduled (also used for "Parts arrived, reschedule").
create function public.reschedule_job(p_job uuid,p_date date,p_time time,p_window numeric) returns void language plpgsql security definer set search_path='' as $$
declare j public.jobs;
begin
 j:=public.lock_job_for_work(p_job);
 update public.jobs set scheduled_date=p_date,arrival_time=p_time,window_hours=coalesce(p_window,window_hours),status='scheduled',parts_needed='',updated_at=now() where id=j.id;
end;$$;

create function public.set_checklist_item(p_job uuid,p_index integer,p_done boolean) returns void language plpgsql security definer set search_path='' as $$
declare j public.jobs;n integer;list boolean[];
begin
 j:=public.lock_job_for_work(p_job);n:=public.checklist_size(j.trade);
 if p_index<1 or p_index>n then raise exception 'No such checklist item'; end if;
 list:=coalesce(j.checklist,'{}');
 for i in coalesce(array_length(list,1),0)+1..n loop list[i]:=false; end loop;
 list[p_index]:=p_done;
 update public.jobs set checklist=list,updated_at=now() where id=j.id;
end;$$;

create function public.save_job_details(p_job uuid,p_summary text,p_recommendations text,p_actual_hours numeric) returns void language plpgsql security definer set search_path='' as $$
declare j public.jobs;
begin
 j:=public.lock_job_for_work(p_job);
 update public.jobs set summary=trim(coalesce(p_summary,'')),recommendations=trim(coalesce(p_recommendations,'')),actual_hours=p_actual_hours,updated_at=now() where id=j.id;
end;$$;

-- Adds a price book task at today's price; adding the same task again adds to its quantity at the original price.
create function public.add_job_task(p_job uuid,p_task uuid,p_qty integer default 1) returns void language plpgsql security definer set search_path='' as $$
declare j public.jobs;t public.price_book;
begin
 j:=public.lock_job_for_work(p_job);
 select * into t from public.price_book where id=p_task;if t.id is null then raise exception 'Task not found'; end if;
 update public.job_tasks set qty=qty+coalesce(p_qty,1) where job_id=j.id and price_task_id=t.id;
 if not found then insert into public.job_tasks(job_id,price_task_id,name,includes,unit_price,qty,by_user) values(j.id,t.id,t.name,t.includes,t.price,coalesce(p_qty,1),auth.uid()); end if;
end;$$;

create function public.set_job_task_qty(p_line uuid,p_qty integer) returns void language plpgsql security definer set search_path='' as $$
declare jid uuid;
begin
 select job_id into jid from public.job_tasks where id=p_line;if jid is null then raise exception 'Task not found'; end if;
 perform public.lock_job_for_work(jid);
 if p_qty<=0 then delete from public.job_tasks where id=p_line; else update public.job_tasks set qty=p_qty where id=p_line; end if;
end;$$;

-- A part from inventory comes out of stock (and can't if there isn't enough); a part not stocked needs a name and cost.
create function public.add_job_material(p_job uuid,p_item uuid,p_qty integer,p_name text,p_cost numeric) returns void language plpgsql security definer set search_path='' as $$
declare j public.jobs;it public.inventory_items;v_cost numeric;
begin
 j:=public.lock_job_for_work(p_job);
 if coalesce(p_qty,0)<1 then raise exception 'Quantity must be at least 1'; end if;
 if p_item is not null then
  select * into it from public.inventory_items where id=p_item for update;if it.id is null then raise exception 'Part not found'; end if;
  if it.on_hand<p_qty then raise exception '% is out of stock (% on hand). Flag the job for parts instead.',it.name,it.on_hand; end if;
  update public.inventory_items set on_hand=on_hand-p_qty,updated_at=now() where id=it.id;
  insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,reason,by_user,job_id) values(it.id,it.name,'used',-p_qty,it.on_hand-p_qty,'J-'||j.number,auth.uid(),j.id);
  select unit_cost into v_cost from public.inventory_costs where item_id=it.id;
  update public.job_materials set qty=qty+p_qty where job_id=j.id and item_id=it.id;
  if not found then insert into public.job_materials(job_id,item_id,name,qty,unit_cost,by_user) values(j.id,it.id,it.name,p_qty,coalesce(v_cost,0),auth.uid()); end if;
 else
  if length(trim(coalesce(p_name,'')))=0 or p_cost is null then raise exception 'Enter a part name and cost'; end if;
  insert into public.job_materials(job_id,name,qty,unit_cost,by_user) values(j.id,trim(p_name),p_qty,p_cost,auth.uid());
 end if;
end;$$;

-- Removing a part from the job puts inventory parts back in stock.
create function public.remove_job_material(p_line uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.job_materials;j public.jobs;v_after integer;
begin
 select * into m from public.job_materials where id=p_line;if m.id is null then raise exception 'Part not found'; end if;
 j:=public.lock_job_for_work(m.job_id);
 if m.item_id is not null then
  update public.inventory_items set on_hand=on_hand+m.qty,updated_at=now() where id=m.item_id returning on_hand into v_after;
  if v_after is not null then insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,reason,by_user,job_id) values(m.item_id,m.name,'returned',m.qty,v_after,'J-'||j.number,auth.uid(),j.id); end if;
 end if;
 delete from public.job_materials where id=m.id;
end;$$;

-- Notes can be added by office or the job's tech at any time (also after completing).
create function public.add_job_note(p_job uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.jobs where id=p_job and (public.is_office() or tech_id=auth.uid())) then raise exception 'Job not found'; end if;
 if length(trim(coalesce(p_body,'')))=0 then raise exception 'Type a note first'; end if;
 insert into public.job_notes(job_id,by_user,body) values(p_job,auth.uid(),trim(p_body));
end;$$;

-- Office only. Labor = actual hours (or price book hours) x average tech cost; parts = logged materials (or price book parts).
create function public.job_costing(p_job uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j public.jobs;billed numeric;est_hours numeric;est_parts numeric;logged numeric;n_mat integer;rate numeric;hours numeric;labor numeric;parts numeric;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 select * into j from public.jobs where id=p_job;if j.id is null then raise exception 'Job not found'; end if;
 select coalesce(sum(t.unit_price*t.qty),0),coalesce(sum(c.hours*t.qty),0),coalesce(sum(c.parts*t.qty),0) into billed,est_hours,est_parts
  from public.job_tasks t left join public.price_book_costs c on c.task_id=t.price_task_id where t.job_id=j.id;
 select coalesce(sum(unit_cost*qty),0),count(*) into logged,n_mat from public.job_materials where job_id=j.id;
 select tech_cost into rate from public.pricing_settings;
 hours:=coalesce(j.actual_hours,est_hours);labor:=round(hours*rate,2);parts:=case when n_mat>0 then logged else est_parts end;
 return jsonb_build_object('billed',billed,'hours',hours,'hours_actual',j.actual_hours is not null,'estimated_hours',est_hours,'rate',rate,'labor',labor,
  'parts',parts,'parts_actual',n_mat>0,'gross',billed-labor-parts,
  'materials',coalesce((select jsonb_object_agg(id,unit_cost) from public.job_materials where job_id=j.id),'{}'::jsonb));
end;$$;

-- Friendlier message when deleting a price book task that's on a job.
create or replace function public.delete_price_task(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if exists(select 1 from public.job_tasks where price_task_id=p_id) then raise exception 'This task is on existing jobs, so it stays. Rename or reprice it instead.'; end if;
 delete from public.price_book where id=p_id;
end;$$;

revoke all on function public.set_job_status(uuid,text,text),public.reschedule_job(uuid,date,time,numeric),public.set_checklist_item(uuid,integer,boolean),
 public.save_job_details(uuid,text,text,numeric),public.add_job_task(uuid,uuid,integer),public.set_job_task_qty(uuid,integer),
 public.add_job_material(uuid,uuid,integer,text,numeric),public.remove_job_material(uuid),public.add_job_note(uuid,text),public.job_costing(uuid) from public;
grant execute on function public.set_job_status(uuid,text,text),public.reschedule_job(uuid,date,time,numeric),public.set_checklist_item(uuid,integer,boolean),
 public.save_job_details(uuid,text,text,numeric),public.add_job_task(uuid,uuid,integer),public.set_job_task_qty(uuid,integer),
 public.add_job_material(uuid,uuid,integer,text,numeric),public.remove_job_material(uuid),public.add_job_note(uuid,text),public.job_costing(uuid) to authenticated;
