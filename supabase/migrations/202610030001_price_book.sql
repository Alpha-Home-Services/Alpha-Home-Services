-- Price book and flat-rate pricing (Phase 2).
-- Apply once to the TEST project after 202610020001_hcp_import.sql. Does not touch existing rows.
--
-- Formula price = (labor hours x labor rate + parts cost x (1 + markup)) / (1 - card coverage), rounded to whole dollars.
-- Prices are stored, and only the functions below write them, so a formula price can never drift from the settings.
-- Labor hours, parts cost and the cost settings are office/admin only; techs can read task names, what's included and prices.

create function public.is_admin() returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function public.is_staff() returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid());
$$;
revoke all on function public.is_admin(),public.is_staff() from public;
grant execute on function public.is_admin(),public.is_staff() to authenticated;

create table public.pricing_settings (
 id boolean primary key default true check(id),
 labor_rate numeric(10,2) not null default 165 check(labor_rate>0 and labor_rate<=10000),
 parts_markup numeric(7,2) not null default 50 check(parts_markup between 0 and 1000),
 card_cover numeric(5,2) not null default 3 check(card_cover>=0 and card_cover<10),
 -- Average loaded tech cost per hour, for the margin badge until real per-tech rates exist (Phase 6).
 tech_cost numeric(10,2) not null default 40 check(tech_cost between 0 and 10000),
 target_margin numeric(5,2) not null default 60 check(target_margin between 0 and 100),
 updated_at timestamptz not null default now()
);
insert into public.pricing_settings default values;

create table public.price_book (
 id uuid primary key default gen_random_uuid(),
 trade text not null check(trade in ('hvac','electrical','plumbing','septic')),
 name text not null check(length(trim(name)) between 1 and 160),
 includes text not null default '' check(length(includes)<=500),
 mode text not null default 'formula' check(mode in ('formula','custom')),
 price numeric(10,2) not null check(price>=0 and price<=1000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.price_book_costs (
 task_id uuid primary key references public.price_book(id) on delete cascade,
 hours numeric(6,2) not null default 0 check(hours between 0 and 100),
 parts numeric(10,2) not null default 0 check(parts between 0 and 100000)
);
create index price_book_trade_idx on public.price_book(trade,name);

alter table public.pricing_settings enable row level security;
alter table public.price_book enable row level security;
alter table public.price_book_costs enable row level security;
revoke all on public.pricing_settings,public.price_book,public.price_book_costs from anon,authenticated;
grant select on public.pricing_settings,public.price_book,public.price_book_costs to authenticated;
create policy staff_price_book on public.price_book for select to authenticated using(public.is_staff());
create policy office_price_costs on public.price_book_costs for select to authenticated using(public.is_office());
create policy office_pricing_settings on public.pricing_settings for select to authenticated using(public.is_office());

create function public.formula_price(hours numeric,parts numeric) returns numeric language sql stable security definer
set search_path='' as $$
 select round((hours*s.labor_rate+parts*(1+s.parts_markup/100))/(1-s.card_cover/100)) from public.pricing_settings s;
$$;
revoke all on function public.formula_price(numeric,numeric) from public;

-- Office and admin add or edit a task. Trade is fixed once a task exists. Returns the task id.
create function public.save_price_task(p_id uuid,p_trade text,p_name text,p_includes text,p_hours numeric,p_parts numeric,p_mode text,p_custom_price numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare task uuid;v_price numeric;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if p_mode not in ('formula','custom') then raise exception 'Invalid price type'; end if;
 if p_mode='custom' and p_custom_price is null then raise exception 'A custom price is required'; end if;
 v_price:=case when p_mode='formula' then public.formula_price(coalesce(p_hours,0),coalesce(p_parts,0)) else p_custom_price end;
 if p_id is null then
  insert into public.price_book(trade,name,includes,mode,price) values(p_trade,trim(p_name),coalesce(p_includes,''),p_mode,v_price) returning id into task;
 else
  update public.price_book set name=trim(p_name),includes=coalesce(p_includes,''),mode=p_mode,price=v_price,updated_at=now() where id=p_id returning id into task;
  if task is null then raise exception 'Task not found'; end if;
 end if;
 insert into public.price_book_costs(task_id,hours,parts) values(task,coalesce(p_hours,0),coalesce(p_parts,0))
 on conflict(task_id) do update set hours=excluded.hours,parts=excluded.parts;
 return task;
end;$$;

create function public.delete_price_task(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 delete from public.price_book where id=p_id;
end;$$;

-- Admin only. Saves the settings and reprices every formula task in the same transaction; custom prices are untouched.
-- Returns how many prices were recalculated.
create function public.save_pricing_settings(p_labor_rate numeric,p_parts_markup numeric,p_card_cover numeric,p_tech_cost numeric,p_target_margin numeric)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.pricing_settings set labor_rate=p_labor_rate,parts_markup=p_parts_markup,card_cover=p_card_cover,tech_cost=p_tech_cost,target_margin=p_target_margin,updated_at=now();
 update public.price_book b set price=public.formula_price(c.hours,c.parts),updated_at=now()
 from public.price_book_costs c where c.task_id=b.id and b.mode='formula';
 get diagnostics n=row_count;
 return n;
end;$$;

revoke all on function public.save_price_task(uuid,text,text,text,numeric,numeric,text,numeric),public.delete_price_task(uuid),
 public.save_pricing_settings(numeric,numeric,numeric,numeric,numeric) from public;
grant execute on function public.save_price_task(uuid,text,text,text,numeric,numeric,text,numeric),public.delete_price_task(uuid),
 public.save_pricing_settings(numeric,numeric,numeric,numeric,numeric) to authenticated;
