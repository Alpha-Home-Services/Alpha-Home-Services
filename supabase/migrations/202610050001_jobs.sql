-- Jobs and intake (Phase 2).
-- Apply once to the TEST project after 202610040001_inventory.sql. Does not touch existing rows.

-- Staff can see each other's names and roles (for the tech list, notes and stock history). Still no one can change a profile.
create policy staff_profiles on public.profiles for select to authenticated using(public.is_staff());

create sequence public.job_number_seq start 1001;
create table public.jobs (
 id uuid primary key default gen_random_uuid(),
 number integer not null unique default nextval('public.job_number_seq'),
 customer_id uuid not null references public.customers(id),
 location_id uuid,
 trade text not null check(trade in ('hvac','electrical','plumbing','septic')),
 tech_id uuid references public.profiles(id),
 scheduled_date date not null,
 arrival_time time not null,
 window_hours numeric(3,1) not null default 3 check(window_hours between 0.5 and 12),
 status text not null default 'scheduled' check(status in ('scheduled','enroute','progress','parts','invoiced','paid')),
 description text not null check(length(trim(description)) between 1 and 2000),
 work_location text not null default '' check(length(work_location)<=500),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(location_id,customer_id) references public.locations(id,customer_id)
);
-- Private notes for the team. Never shown on invoices or to customers.
create table public.job_notes (
 id bigint generated always as identity primary key,
 job_id uuid not null references public.jobs(id) on delete cascade,
 by_user uuid references public.profiles(id),
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index jobs_customer_idx on public.jobs(customer_id,scheduled_date);
create index jobs_tech_idx on public.jobs(tech_id,scheduled_date);
create index job_notes_job_idx on public.job_notes(job_id,created_at);

-- A tech can now also see a customer while they have an open job there (not yet invoiced or paid),
-- as well as customers explicitly assigned to them. Same signature, so every existing rule picks this up.
create or replace function public.can_access_customer(target uuid) returns boolean language sql stable security definer
set search_path='' as $$
 select public.is_office() or exists(
  select 1 from public.customer_assignments a join public.profiles p on p.id=a.tech_id
  where a.customer_id=target and a.tech_id=auth.uid() and p.role='tech')
 or exists(
  select 1 from public.jobs j join public.profiles p on p.id=j.tech_id
  where j.customer_id=target and j.tech_id=auth.uid() and p.role='tech' and j.status in ('scheduled','enroute','progress','parts'));
$$;

alter table public.jobs enable row level security;
alter table public.job_notes enable row level security;
revoke all on public.jobs,public.job_notes from anon,authenticated;
grant select on public.jobs,public.job_notes to authenticated;
-- Office sees every job; a tech sees the jobs assigned to them.
create policy visible_jobs on public.jobs for select to authenticated using(public.is_office() or tech_id=auth.uid());
create policy visible_job_notes on public.job_notes for select to authenticated
 using(exists(select 1 from public.jobs j where j.id=job_id and (public.is_office() or j.tech_id=auth.uid())));

-- Office creates a job from intake in one transaction: the new customer (if any), that trade's site details, the job,
-- and the private note. If anything fails, nothing is saved. Returns the job id and number.
create function public.create_job(p_customer_id uuid,p_customer jsonb,p_location_id uuid,p_trade text,p_site jsonb,p_tech_id uuid,
 p_date date,p_time time,p_window numeric,p_description text,p_work_location text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=p_customer_id;job record;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if cid is null then
  if length(trim(coalesce(p_customer->>'name','')))=0 or length(trim(coalesce(p_customer->>'phone','')))=0 or length(trim(coalesce(p_customer->>'service_address','')))=0
   then raise exception 'New customers need a name, phone and service address'; end if;
  insert into public.customers(name,type,phone,email,service_address,billing_address,terms,access_notes,lead_source)
  values(trim(p_customer->>'name'),coalesce(p_customer->>'type','Residential'),trim(p_customer->>'phone'),coalesce(p_customer->>'email',''),
   trim(p_customer->>'service_address'),coalesce(p_customer->>'billing_address',''),coalesce(p_customer->>'terms','due'),
   coalesce(p_customer->>'access_notes',''),coalesce(p_customer->>'lead_source',''))
  returning id into cid;
 elsif not exists(select 1 from public.customers where id=cid) then raise exception 'Customer not found';
 end if;
 if p_tech_id is not null and not exists(select 1 from public.profiles where id=p_tech_id and role='tech') then raise exception 'Assigned person is not a tech'; end if;
 if p_site is not null and jsonb_typeof(p_site)='object' and p_site<>'{}'::jsonb then
  insert into public.site_details(customer_id,trade,details) values(cid,p_trade,p_site)
  on conflict(customer_id,trade) do update set details=public.site_details.details||excluded.details;
 end if;
 insert into public.jobs(customer_id,location_id,trade,tech_id,scheduled_date,arrival_time,window_hours,description,work_location,created_by)
 values(cid,p_location_id,p_trade,p_tech_id,p_date,p_time,p_window,trim(p_description),trim(coalesce(p_work_location,'')),auth.uid())
 returning id,number into job;
 if length(trim(coalesce(p_note,'')))>0 then insert into public.job_notes(job_id,by_user,body) values(job.id,auth.uid(),trim(p_note)); end if;
 return jsonb_build_object('id',job.id,'number',job.number,'customer_id',cid);
end;$$;
revoke all on function public.create_job(uuid,jsonb,uuid,text,jsonb,uuid,date,time,numeric,text,text,text) from public;
grant execute on function public.create_job(uuid,jsonb,uuid,text,jsonb,uuid,date,time,numeric,text,text,text) to authenticated;
