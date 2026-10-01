import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {testDatabase} from './db';
const office='00000000-0000-4000-8000-000000000302',tech='00000000-0000-4000-8000-000000000303';
test('inventory keeps counts right, logs every change and hides cost from techs',async()=>{
 const {db,asUser}=await testDatabase();
 try{
 await db.exec(`insert into auth.users values ('${office}'),('${tech}');insert into public.profiles values ('${office}','Test office','office'),('${tech}','Test tech','tech');`);
 await db.exec(await readFile('supabase/seed_inventory.sql','utf8'));
 const one=async(who:string,sql:string)=>(await asUser(who,sql)).rows[0] as Record<string,unknown>;
 // Sample data: 18 parts with costs, each starting count logged.
 assert.equal((await asUser(office,'select 1 from public.inventory_items')).rows.length,18);
 assert.equal((await asUser(office,'select 1 from public.inventory_costs')).rows.length,18);
 assert.equal((await asUser(office,`select 1 from public.inventory_moves where kind='added'`)).rows.length,18);
 // Techs see parts and counts, but not cost or history, and can't change stock.
 assert.equal((await asUser(tech,'select name,sku,location,on_hand,reorder_at from public.inventory_items')).rows.length,18);
 assert.equal((await asUser(tech,'select * from public.inventory_costs')).rows.length,0);
 assert.equal((await asUser(tech,'select * from public.inventory_moves')).rows.length,0);
 const id=(await one(office,`select public.save_inventory_item(null,'hvac','TEST — Gauge set','GS-1','Truck 2',2,89.5,3) as id`)).id as string;
 await assert.rejects(()=>asUser(tech,`select public.receive_stock('${id}',5)`),'techs cannot receive stock');
 await assert.rejects(()=>asUser(tech,`select public.save_inventory_item(null,'hvac','TEST — Tech part','','',0,1,1)`),'techs cannot add parts');
 await assert.rejects(()=>asUser(office,`update public.inventory_items set on_hand=99 where id='${id}'`),'no direct count edits');
 // Receiving adds; a correction sets the counted number with a reason; both are logged with who did it.
 assert.deepEqual(await one(office,`select public.receive_stock('${id}',5) as n`),{n:8});
 assert.deepEqual(await one(office,`select public.correct_stock('${id}',6,'Stock count') as n`),{n:6});
 await assert.rejects(()=>asUser(office,`select public.correct_stock('${id}',4,' ')`),'a correction needs a reason');
 await assert.rejects(()=>asUser(office,`select public.correct_stock('${id}',-1,'Stock count')`),'counts cannot go negative');
 await assert.rejects(()=>asUser(office,`select public.receive_stock('${id}',0)`),'receive at least 1');
 const log=(await asUser(office,`select kind,change,on_hand_after,reason,by_user from public.inventory_moves where item_id='${id}' order by id`)).rows;
 assert.deepEqual(log,[{kind:'added',change:3,on_hand_after:3,reason:'',by_user:office},{kind:'received',change:5,on_hand_after:8,reason:'',by_user:office},{kind:'correction',change:-2,on_hand_after:6,reason:'Stock count',by_user:office}]);
 // Editing details never changes the count; cost is updated.
 await asUser(office,`select public.save_inventory_item('${id}','hvac','TEST — Gauge set (digital)','GS-2','Truck 2',3,99,999)`);
 assert.deepEqual(await one(office,`select i.on_hand,i.name,c.unit_cost::float as cost from public.inventory_items i join public.inventory_costs c on c.item_id=i.id where i.id='${id}'`),{on_hand:6,name:'TEST — Gauge set (digital)',cost:99});
 // Deleting keeps the history, with the part's name.
 await asUser(office,`select public.delete_inventory_item('${id}')`);
 assert.equal((await asUser(office,`select 1 from public.inventory_items where id='${id}'`)).rows.length,0);
 assert.deepEqual(await one(office,`select item_id,item_name,change from public.inventory_moves where kind='deleted'`),{item_id:null,item_name:'TEST — Gauge set (digital)',change:-6});
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from public.inventory_items'),'signed-out users see nothing');
 }finally{await db.close();}
});
