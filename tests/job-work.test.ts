import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {testDatabase} from './db';import {CHECK} from '../lib/fields';
const office='00000000-0000-4000-8000-000000000502',tech='00000000-0000-4000-8000-000000000503',tech2='00000000-0000-4000-8000-000000000504',household='00000000-0000-4000-8000-000000000002';
test('tech job page: status, tasks at the quoted price, parts in and out of stock, completing, locking and costing',async()=>{
 const {db,asUser}=await testDatabase();
 try{
 await db.exec(`insert into auth.users values ('${office}'),('${tech}'),('${tech2}');insert into public.profiles values ('${office}','Test office','office'),('${tech}','Test tech','tech'),('${tech2}','Other tech','tech');`);
 await db.exec(await readFile('supabase/seed_price_book.sql','utf8'));await db.exec(await readFile('supabase/seed_inventory.sql','utf8'));
 // App and database agree on checklist lengths.
 for(const [trade,items] of Object.entries(CHECK))assert.equal(((await db.query(`select public.checklist_size('${trade}') as n`)).rows[0] as {n:number}).n,items.length,trade);
 const job=((await asUser(office,`select public.create_job('${household}',null,null,'hvac','{}','${tech}','2026-10-06','08:00',3,'TEST — No cooling','','') as j`)).rows[0] as {j:{id:string}}).j.id;
 const call=(who:string,fn:string)=>asUser(who,`select public.${fn}`);const job1=async()=>(await asUser(office,`select * from public.jobs where id='${job}'`)).rows[0] as Record<string,unknown>;
 const task=((await asUser(office,`select id from public.price_book where name='TEST — Replace run capacitor'`)).rows[0] as {id:string}).id;
 const part=((await asUser(office,`select id from public.inventory_items where sku='CAP-455'`)).rows[0] as {id:string}).id;
 const moen=((await asUser(office,`select id from public.inventory_items where sku='MOEN-1225'`)).rows[0] as {id:string}).id;
 // Only office or the job's tech can work the job.
 await assert.rejects(()=>call(tech2,`set_job_status('${job}','enroute')`),'other tech cannot change the job');
 await call(tech,`set_job_status('${job}','enroute')`);await call(tech,`set_job_status('${job}','progress')`);
 await assert.rejects(()=>call(tech,`set_job_status('${job}','enroute')`),'no going back to On the way');
 // Tasks keep the price they were added at.
 await call(tech,`add_job_task('${job}','${task}',1)`);await call(tech,`add_job_task('${job}','${task}',1)`);
 await db.exec(`reset role;update public.price_book set price=999 where id='${task}'`);
 assert.deepEqual((await asUser(tech,`select qty,unit_price::float as p from public.job_tasks where job_id='${job}'`)).rows,[{qty:2,p:113}]);
 await assert.rejects(()=>call(office,`delete_price_task('${task}')`),/on existing jobs/);
 // Parts: inventory parts come out of stock and go back when removed; out-of-stock parts are refused; costs hidden from techs.
 await call(tech,`add_job_material('${job}','${part}',2,null,null)`);
 assert.equal(((await asUser(office,`select on_hand from public.inventory_items where id='${part}'`)).rows[0] as {on_hand:number}).on_hand,4);
 await assert.rejects(()=>call(tech,`add_job_material('${job}','${moen}',1,null,null)`),/out of stock/);
 await call(tech,`add_job_material('${job}',null,1,'TEST — Supply house fuse',4.5)`);
 assert.deepEqual((await asUser(tech,`select name,qty from public.job_materials where job_id='${job}' order by created_at`)).rows,[{name:'TEST — Dual run capacitor 45/5 MFD',qty:2},{name:'TEST — Supply house fuse',qty:1}]);
 await assert.rejects(()=>asUser(tech,`select unit_cost from public.job_materials`),'techs cannot read part costs');
 await assert.rejects(()=>call(tech,`job_costing('${job}')`),'costing is office only');
 const used=(await asUser(office,`select kind,change,reason from public.inventory_moves where job_id='${job}'`)).rows;assert.deepEqual(used,[{kind:'used',change:-2,reason:'J-1001'}]);
 const fuse=((await asUser(tech,`select id from public.job_materials where name='TEST — Supply house fuse'`)).rows[0] as {id:string}).id;
 const capLine=((await asUser(tech,`select id from public.job_materials where item_id='${part}'`)).rows[0] as {id:string}).id;
 await call(tech,`remove_job_material('${capLine}')`);assert.equal(((await asUser(office,`select on_hand from public.inventory_items where id='${part}'`)).rows[0] as {on_hand:number}).on_hand,6);
 await call(tech,`add_job_material('${job}','${part}',1,null,null)`);
 // Completing needs a task, the whole checklist and a summary.
 await assert.rejects(()=>call(tech,`set_job_status('${job}','complete')`),/checklist/);
 for(let i=1;i<=7;i++)await call(tech,`set_checklist_item('${job}',${i},true)`);
 await assert.rejects(()=>call(tech,`set_job_status('${job}','complete')`),/summary/);
 await call(tech,`save_job_details('${job}','TEST — Replaced capacitor, cooling normally','TEST — Coil is aging',1.5)`);
 await call(tech,`set_job_status('${job}','complete')`);assert.equal((await job1()).status,'complete');
 // Completed jobs are locked for everyone; notes still allowed; office reopens.
 await assert.rejects(()=>call(tech,`add_job_task('${job}','${task}',1)`),/completed/);
 await assert.rejects(()=>call(office,`remove_job_material('${fuse}')`),/completed/);
 await call(tech,`add_job_note('${job}','TEST — Customer asked about a maintenance plan')`);
 await assert.rejects(()=>call(tech,`set_job_status('${job}','progress')`),/Only office/);
 await call(office,`set_job_status('${job}','progress')`);assert.equal((await job1()).status,'progress');
 // Costing: billed 2 x $113; labor 1.5 actual hours x $40; parts = logged materials (1 x $18 + 1 x $4.50).
 const cost=((await call(office,`job_costing('${job}') as c`)).rows[0] as {c:Record<string,unknown>}).c;
 assert.equal(Number(cost.billed),226);assert.equal(Number(cost.labor),60);assert.equal(Number(cost.parts),22.5);assert.equal(Number(cost.gross),143.5);assert.equal(cost.parts_actual,true);
 // Needs parts, then reschedule back to Scheduled.
 await assert.rejects(()=>call(tech,`set_job_status('${job}','parts','')`),/which parts/);
 await call(tech,`set_job_status('${job}','parts','TEST — Condenser fan motor')`);assert.equal((await job1()).parts_needed,'TEST — Condenser fan motor');
 await call(tech,`reschedule_job('${job}','2026-10-09','13:00',2)`);const r=await job1();assert.equal(r.status,'scheduled');assert.equal(r.parts_needed,'');
 }finally{await db.close();}
});
