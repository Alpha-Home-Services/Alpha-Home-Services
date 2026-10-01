-- Apply only to a separate TEST database. No real records are included.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null check (role in ('admin','office','tech'))
);
create table public.customers (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 160),
 type text not null check(type in ('Residential','Commercial')),
 phone text not null default '', email text not null default '',
 service_address text not null default '',billing_address text not null default '',
 terms text not null default 'due' check(terms in ('due','net15','net30','net60')),
 access_notes text not null default '',lead_source text not null default '',
 parent_id uuid references public.customers(id),
 bill_to text not null default 'self' check(bill_to in ('self','parent')),
 created_at timestamptz not null default now(),
 check(parent_id is null or parent_id<>id),
 check(bill_to='self' or parent_id is not null)
);
create table public.customer_assignments (
 customer_id uuid not null references public.customers(id) on delete cascade,
 tech_id uuid not null references public.profiles(id) on delete cascade,
 primary key(customer_id,tech_id)
);
create table public.locations (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id),
 name text not null check(length(trim(name))>0), address text not null check(length(trim(address))>0),
 notes text not null default '',unique(id,customer_id)
);
create table public.equipment (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id),
 location_id uuid,
 trade text not null check(trade in ('hvac','electrical','plumbing','septic')),
 type text not null check(length(trim(type))>0),
 brand text not null default '',model text not null default '',serial text not null default '',
 year integer check(year between 1900 and 2100),size text not null default '',
 extra jsonb not null default '{}' check(jsonb_typeof(extra)='object'),
 property_location text not null default '',
 condition text not null default 'Good' check(condition in ('Good','Fair','Poor','Needs replacement')),
 warranty_date date,notes text not null default '',
 created_at timestamptz not null default now(),
 foreign key(location_id,customer_id) references public.locations(id,customer_id)
);
create table public.site_details (
 customer_id uuid not null references public.customers(id),
 trade text not null check(trade in ('hvac','electrical','plumbing','septic')),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 primary key(customer_id,trade)
);
create index customers_parent_idx on public.customers(parent_id);
create index assignments_tech_idx on public.customer_assignments(tech_id);
create index equipment_customer_idx on public.equipment(customer_id);
create index locations_customer_idx on public.locations(customer_id);

-- Explicitly allow only a single level of tenant sub-accounts, as in the prototype.
create function public.validate_parent_account() returns trigger language plpgsql
set search_path='' as $$
begin
 if new.parent_id is not null then
  if exists(select 1 from public.customers where id=new.parent_id and parent_id is not null) then
   raise exception 'A sub-account cannot be the parent of another account';
  end if;
  if exists(select 1 from public.customers where parent_id=new.id) then
   raise exception 'An account with tenants cannot become a sub-account';
  end if;
 end if;
 return new;
end;$$;
create trigger check_parent before insert or update on public.customers
for each row execute function public.validate_parent_account();

-- SECURITY DEFINER avoids policy recursion. No caller-provided user ID is accepted.
create function public.is_office() returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','office'));
$$;
create function public.can_access_customer(target uuid) returns boolean language sql stable security definer
set search_path='' as $$
 select public.is_office() or exists(
 select 1 from public.customer_assignments a join public.profiles p on p.id=a.tech_id
 where a.customer_id=target and a.tech_id=auth.uid() and p.role='tech');
$$;
revoke all on function public.is_office() from public;
revoke all on function public.can_access_customer(uuid) from public;
grant execute on function public.is_office(),public.can_access_customer(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_assignments enable row level security;
alter table public.locations enable row level security;
alter table public.equipment enable row level security;
alter table public.site_details enable row level security;

revoke all on public.profiles,public.customers,public.customer_assignments,public.locations,public.equipment,public.site_details from anon,authenticated;
grant select on public.profiles,public.customer_assignments to authenticated;
grant select,insert,update on public.customers,public.locations,public.equipment,public.site_details to authenticated;
-- Profiles and assignment changes intentionally require the database administrator.
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_assignments on public.customer_assignments for select to authenticated using(tech_id=auth.uid() or public.is_office());
create policy visible_customers on public.customers for select to authenticated using(public.can_access_customer(id));
create policy office_customer_insert on public.customers for insert to authenticated with check(public.is_office());
create policy office_customer_update on public.customers for update to authenticated using(public.is_office()) with check(public.is_office());
create policy visible_locations on public.locations for select to authenticated using(public.can_access_customer(customer_id));
create policy office_location_insert on public.locations for insert to authenticated with check(public.is_office());
create policy office_location_update on public.locations for update to authenticated using(public.is_office()) with check(public.is_office());
create policy visible_equipment on public.equipment for select to authenticated using(public.can_access_customer(customer_id));
create policy assigned_equipment_insert on public.equipment for insert to authenticated with check(public.can_access_customer(customer_id));
-- Only office can move/edit existing equipment; techs can capture new equipment.
create policy office_equipment_update on public.equipment for update to authenticated using(public.is_office()) with check(public.is_office());
create policy visible_site_details on public.site_details for select to authenticated using(public.can_access_customer(customer_id));
create policy assigned_site_insert on public.site_details for insert to authenticated with check(public.can_access_customer(customer_id));
create policy assigned_site_update on public.site_details for update to authenticated using(public.can_access_customer(customer_id)) with check(public.can_access_customer(customer_id));
