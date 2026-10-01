-- Sample inventory from the prototype. TEST project only, run once after 202610040001_inventory.sql.
-- Names start with "TEST —" so samples are never mistaken for real stock. Starting counts are logged as "added".
with sample(trade,name,sku,unit_cost,on_hand,reorder_at,location) as (values
 ('hvac','Dual run capacitor 45/5 MFD','CAP-455',18,6,4,'Warehouse A1'),
 ('hvac','Contactor 2-pole 30A','CON-230',24,3,3,'Warehouse A1'),
 ('hvac','Pleated filter 20x25x1','FLT-20251',6,24,12,'Warehouse A3'),
 ('hvac','Condensate drain tablets','CDT-01',1.5,40,20,'Truck 1'),
 ('hvac','Blower motor 1/2 HP','BLM-050',265,1,1,'Warehouse A2'),
 ('electrical','GFCI outlet 20A tamper-resistant','GFCI-20',22,14,10,'Warehouse B1'),
 ('electrical','Breaker 20A single pole','QO120',16,4,6,'Warehouse B1'),
 ('electrical','Whole-home surge protector','SPD-T2',120,2,2,'Warehouse B2'),
 ('electrical','Wire nuts, assorted bag','WN-AST',8,9,5,'Truck 3'),
 ('plumbing','Moen 1225 cartridge','MOEN-1225',48,0,2,'Warehouse C1'),
 ('plumbing','Toilet fill valve','FV-400',14,7,5,'Warehouse C1'),
 ('plumbing','Toilet flapper 3 in.','FLP-3',6,10,6,'Warehouse C1'),
 ('plumbing','Braided supply line 3/8 x 12','SUP-12',7,18,10,'Truck 4'),
 ('plumbing','Gas flex connector 24 in.','GFC-24',22,4,3,'Warehouse C2'),
 ('septic','Effluent filter 4 in.','EFF-4',65,3,2,'Yard shed'),
 ('septic','Riser section 24 in.','RSR-24',120,2,2,'Yard shed'),
 ('septic','Riser lid 24 in.','LID-24',60,2,2,'Yard shed'),
 ('septic','Riser sealant tube','SEAL-01',12,8,4,'Yard shed')
),items as (
 insert into public.inventory_items(trade,name,sku,location,on_hand,reorder_at)
 select trade,'TEST — '||name,sku,location,on_hand,reorder_at from sample returning id,name,sku,on_hand
),costs as (
 insert into public.inventory_costs(item_id,unit_cost) select i.id,s.unit_cost from items i join sample s on s.sku=i.sku returning item_id
)
insert into public.inventory_moves(item_id,item_name,kind,change,on_hand_after,reason)
select id,name,'added',on_hand,on_hand,'Sample data' from items;
