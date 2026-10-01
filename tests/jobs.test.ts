import {test} from 'node:test';import assert from 'node:assert/strict';import {testDatabase} from './db';import {overlaps,windowText} from '../lib/jobs';
const office='00000000-0000-4000-8000-000000000402',tech='00000000-0000-4000-8000-000000000403',tech2='00000000-0000-4000-8000-000000000404';
const household='00000000-0000-4000-8000-000000000002',property='00000000-0000-4000-8000-000000000001',buildingA='00000000-0000-4000-8000-000000000011';
test('arrival windows that overlap are caught; back-to-back ones are not',()=>{
 assert.ok(overlaps({time:'08:00',window_hours:3},{time:'10:00',window_hours:2}));
 assert.ok(overlaps({time:'09:00:00',window_hours:'1'},{time:'08:00',window_hours:8}));
 assert.ok(!overlaps({time:'08:00',window_hours:2},{time:'10:00',window_hours:2}));
 assert.ok(!overlaps({time:'13:00',window_hours:1.5},{time:'08:00',window_hours:3}));
 assert.equal(windowText('08:00',3),'8:00 AM–11:00 AM');assert.equal(windowText('13:30:00',1.5),'1:30 PM–3:00 PM');
});
test('office creates jobs in one step, and techs see a customer only while their job there is open',async()=>{
 const {db,asUser}=await testDatabase();
 try{
 await db.exec(`insert into auth.users values ('${office}'),('${tech}'),('${tech2}');insert into public.profiles values ('${office}','Test office','office'),('${tech}','Test tech','tech'),('${tech2}','Other tech','tech');`);
 const create=(who:string,args:string)=>asUser(who,`select public.create_job(${args}) as j`).then(r=>(r.rows[0] as {j:{id:string;number:number;customer_id:string}}).j);
 // Staff can see each other's names (for the tech list and notes).
 assert.equal((await asUser(tech,'select display_name from public.profiles')).rows.length,3);
 // Before any job, the tech can't see the household.
 assert.equal((await asUser(tech,`select 1 from public.customers where id='${household}'`)).rows.length,0);
 const j1=await create(office,`'${household}',null,null,'septic','{"tankSize":"1000","lidDepth":"18"}','${tech}','2026-10-06','08:00',3,'TEST — Slow drains','Back yard','TEST — Dog in yard'`);
 assert.equal(j1.number,1001);
 assert.deepEqual((await asUser(office,`select status,trade,window_hours::float as w from public.jobs where id='${j1.id}'`)).rows,[{status:'scheduled',trade:'septic',w:3}]);
 // Site details are merged into what's on file (the seed already has tankMaterial and riser).
 const site=(await asUser(office,`select details from public.site_details where customer_id='${household}' and trade='septic'`)).rows[0] as {details:Record<string,string>};
 assert.equal(site.details.tankSize,'1000');assert.equal(site.details.lidDepth,'18');assert.equal(site.details.tankMaterial,'Concrete');
 // The assigned tech sees the job, its note and the customer; the other tech sees none of it.
 assert.equal((await asUser(tech,`select 1 from public.jobs where id='${j1.id}'`)).rows.length,1);
 assert.deepEqual((await asUser(tech,`select body from public.job_notes where job_id='${j1.id}'`)).rows,[{body:'TEST — Dog in yard'}]);
 assert.equal((await asUser(tech,`select 1 from public.customers where id='${household}'`)).rows.length,1);
 assert.equal((await asUser(tech2,`select 1 from public.jobs where id='${j1.id}'`)).rows.length,0);
 assert.equal((await asUser(tech2,`select 1 from public.job_notes`)).rows.length,0);
 assert.equal((await asUser(tech2,`select 1 from public.customers where id='${household}'`)).rows.length,0);
 // While the job is open the tech can record equipment there, like at an assigned customer.
 await asUser(tech,`insert into public.equipment(customer_id,trade,type) values ('${household}','septic','Tank')`);
 // Once invoiced, access ends (the job itself stays visible to its tech).
 await db.exec(`reset role;update public.jobs set status='invoiced' where id='${j1.id}'`);
 assert.equal((await asUser(tech,`select 1 from public.customers where id='${household}'`)).rows.length,0);
 assert.equal((await asUser(tech,`select 1 from public.jobs where id='${j1.id}'`)).rows.length,1);
 // A brand-new customer is created with the job; numbers keep counting up.
 const j2=await create(office,`null,'{"name":"TEST — Intake Customer","type":"Residential","phone":"202-555-0199","service_address":"700 Example Rd","terms":"net15","lead_source":"Referral"}',null,'hvac','{}',null,'2026-10-07','13:00',1.5,'TEST — No cooling','',''`);
 assert.equal(j2.number,1002);
 assert.deepEqual((await asUser(office,`select name,terms,lead_source from public.customers where id='${j2.customer_id}'`)).rows,[{name:'TEST — Intake Customer',terms:'net15',lead_source:'Referral'}]);
 assert.equal((await asUser(office,`select 1 from public.job_notes where job_id='${j2.id}'`)).rows.length,0,'blank note is not saved');
 // Buildings must belong to the job's customer.
 await create(office,`'${property}',null,'${buildingA}','hvac','{}',null,'2026-10-08','08:00',2,'TEST — Building A unit','',''`);
 await assert.rejects(()=>create(office,`'${household}',null,'${buildingA}','hvac','{}',null,'2026-10-08','08:00',2,'TEST — Wrong building','',''`));
 // All-or-nothing: a bad job (empty description) doesn't leave the new customer behind.
 await assert.rejects(()=>create(office,`null,'{"name":"TEST — Half saved","phone":"1","service_address":"x"}',null,'hvac','{}',null,'2026-10-07','08:00',1,' ','',''`));
 assert.equal((await asUser(office,`select 1 from public.customers where name='TEST — Half saved'`)).rows.length,0);
 // Guard rails: new customers need name, phone and address; only techs can be assigned; techs can't create jobs or write directly.
 await assert.rejects(()=>create(office,`null,'{"name":"TEST — No phone","service_address":"x"}',null,'hvac','{}',null,'2026-10-07','08:00',1,'x','',''`));
 await assert.rejects(()=>create(office,`'${household}',null,null,'hvac','{}','${office}','2026-10-07','08:00',1,'x','',''`));
 await assert.rejects(()=>create(tech,`'${household}',null,null,'hvac','{}',null,'2026-10-07','08:00',1,'x','',''`));
 await assert.rejects(()=>asUser(office,`insert into public.jobs(customer_id,trade,scheduled_date,arrival_time,description) values ('${household}','hvac','2026-10-07','08:00','x')`));
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from public.jobs'));
 }finally{await db.close();}
});
