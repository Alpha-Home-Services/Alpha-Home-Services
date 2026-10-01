-- Inventory (Phase 2).
-- Apply once to the TEST project after 202610030001_price_book.sql. Does not touch existing rows.
--
-- Everyone signed in can see parts, SKUs, locations and on-hand counts. Unit cost and the stock history are office/admin only.
-- On-hand counts only change through the functions below. Each change is logged with who, when, how many and why,
-- and counts can never go below zero. Parts used on jobs ("used"/"returned") come with the job page.

create table public.inventory_items (
 id uuid primary key default gen_random_uuid(),
 trade text not null check(trade in ('hvac','electrical','plumbing','septic')),
 name text not null check(length(trim(name)) between 1 and 160),
 sku text not null default '' check(length(sku)<=80),
 location text not null default '' check(length(location)<=160),
 on_hand integer not null default 0 check(on_hand between 0 and 1000000),
 reorder_at integer not null default 2 check(reorder_at between 0 and 1000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.inventory_costs (
 item_id uuid primary key references public.inventory_items(id) on delete cascade,
 unit_cost numeric(10,2) not null default 0 check(unit_cost between 0 and 100000)
);
create table public.inventory_moves (
 id bigint generated always as identity primary key,
 -- Kept after a part is deleted, so the history still shows what happened to it.
 item_id uuid references public.inventory_items(id) on delete set null,
 item_name text not null,
 kind text not null check(kind in ('added','received','correction','deleted','used','returned')),
 change integer not null,
 on_hand_after integer not null check(on_hand_after>=0),
 reason text not null default '' check(length(reason)<=500),
 by_user uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index inventory_items_trade_idx on public.inventory_items(trade,name);
create index inventory_moves_item_idx on public.inventory_moves(item_id,created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_costs enable row level security;
alter table public.inventory_moves enable row level security;
revoke all on public.inventory_items,public.inventory_costs,public.inventory_moves from anon,authenticated;
grant select on public.inventory_items,public.inventory_costs,public.inventory_moves to authenticated;
create policy staff_inventory on public.inventory_items for select to authenticated using(public.is_staff());
create policy office_inventory_costs on public.inventory_costs for select to authenticated using(public.is_office());
create policy office_inventory_moves on public.inventory_moves for select to authenticated using(public.is_office());

-- Office adds or edits a part. A new part's starting count is logged as "added"; editing never changes the count.
create function public.save_inventory_item(p_id uuid,p_trade text,p_name text,p_sku text,p_location text,p_reorder_at integer,p_unit_cost numeric,p_on_hand integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare item uuid;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if p_id is null then
  insert into public.inventory_items(trade,name,sku,location,on_hand,reorder_at) values(p_trade,trim(p_name),trim(coalesce(p_sku,'')),trim(coalesce(p_location,'')),coalesce(p_on_hand,0),p_reorder_at) returning id into item;
  insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,by_user) values(item,trim(p_name),'added',coalesce(p_on_hand,0),coalesce(p_on_hand,0),auth.uid());
 else
  update public.inventory_items set trade=p_trade,name=trim(p_name),sku=trim(coalesce(p_sku,'')),location=trim(coalesce(p_location,'')),reorder_at=p_reorder_at,updated_at=now() where id=p_id returning id into item;
  if item is null then raise exception 'Part not found'; end if;
 end if;
 insert into public.inventory_costs(item_id,unit_cost) values(item,p_unit_cost) on conflict(item_id) do update set unit_cost=excluded.unit_cost;
 return item;
end;$$;

-- Office receives a delivery. Adds to the current count (safe if two people receive at once). Returns the new count.
create function public.receive_stock(p_id uuid,p_qty integer) returns integer language plpgsql security definer set search_path='' as $$
declare v_after integer;nm text;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if p_qty is null or p_qty<1 or p_qty>100000 then raise exception 'Quantity received must be at least 1'; end if;
 update public.inventory_items set on_hand=on_hand+p_qty,updated_at=now() where id=p_id returning on_hand,name into v_after,nm;
 if v_after is null then raise exception 'Part not found'; end if;
 insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,by_user) values(p_id,nm,'received',p_qty,v_after,auth.uid());
 return v_after;
end;$$;

-- Office sets the counted number after a stock count, with a reason. Logged as the difference.
create function public.correct_stock(p_id uuid,p_counted integer,p_reason text) returns integer language plpgsql security definer set search_path='' as $$
declare v_before integer;nm text;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 if p_counted is null or p_counted<0 then raise exception 'Counted quantity cannot be negative'; end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'A reason is required'; end if;
 select on_hand,name into v_before,nm from public.inventory_items where id=p_id for update;
 if v_before is null then raise exception 'Part not found'; end if;
 update public.inventory_items set on_hand=p_counted,updated_at=now() where id=p_id;
 insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,reason,by_user) values(p_id,nm,'correction',p_counted-v_before,p_counted,trim(p_reason),auth.uid());
 return p_counted;
end;$$;

create function public.delete_inventory_item(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_before integer;nm text;
begin
 if not public.is_office() then raise exception 'Office access required'; end if;
 select on_hand,name into v_before,nm from public.inventory_items where id=p_id for update;
 if v_before is null then return; end if;
 insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,by_user) values(p_id,nm,'deleted',-v_before,0,auth.uid());
 delete from public.inventory_items where id=p_id;
end;$$;

revoke all on function public.save_inventory_item(uuid,text,text,text,text,integer,numeric,integer),public.receive_stock(uuid,integer),
 public.correct_stock(uuid,integer,text),public.delete_inventory_item(uuid) from public;
grant execute on function public.save_inventory_item(uuid,text,text,text,text,integer,numeric,integer),public.receive_stock(uuid,integer),
 public.correct_stock(uuid,integer,text),public.delete_inventory_item(uuid) to authenticated;
