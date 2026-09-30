import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const customer='00000000-0000-4000-8000-000000000001';const other='00000000-0000-4000-8000-000000000002';const tech='00000000-0000-4000-8000-000000000101';const office='00000000-0000-4000-8000-000000000102';const unrelated='00000000-0000-4000-8000-000000000103';
test('database enforces technician, anonymous and office access boundaries',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(await readFile('supabase/migrations/202609300001_foundation.sql','utf8'));await db.exec(await readFile('supabase/seed.sql','utf8'));
 await db.exec(`insert into auth.users values ('${tech}'),('${office}'),('${unrelated}');insert into public.profiles values ('${tech}','Test tech','tech'),('${office}','Test office','office'),('${unrelated}','Other tech','tech');insert into public.customer_assignments values ('${customer}','${tech}');`);
 async function asUser(id:string,sql:string){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);return db.query(sql);}
 const visible=await asUser(tech,'select id from public.customers');assert.deepEqual(visible.rows,[{id:customer}]);
 assert.equal((await asUser(unrelated,'select * from public.customers')).rows.length,0);
 await assert.rejects(()=>asUser(tech,`update public.profiles set role='admin' where id='${tech}'`));
 await assert.rejects(()=>asUser(tech,`insert into public.customer_assignments values ('${other}','${tech}')`));
 await assert.rejects(()=>asUser(tech,`insert into public.customers(name,type) values ('Forbidden','Residential')`));
 await assert.rejects(()=>asUser(tech,`insert into public.equipment(customer_id,trade,type) values ('${other}','hvac','Heat pump')`));
 await asUser(tech,`insert into public.equipment(customer_id,trade,type) values ('${customer}','plumbing','Water heater')`);
 await assert.rejects(()=>asUser(tech,`insert into public.equipment(customer_id,location_id,trade,type) values ('${other}','00000000-0000-4000-8000-000000000011','hvac','Heat pump')`));
 assert.equal((await asUser(office,'select * from public.customers')).rows.length,3);
 await asUser(office,`update public.customers set terms='net60' where id='${other}'`);
 await assert.rejects(()=>asUser(office,`insert into public.customers(name,type,bill_to) values ('Invalid parent','Residential','parent')`));
 await assert.rejects(()=>asUser(office,`update public.customers set parent_id='00000000-0000-4000-8000-000000000003' where id='${other}'`));
 await assert.rejects(()=>asUser(office,`insert into public.equipment(customer_id,location_id,trade,type) values ('${other}','00000000-0000-4000-8000-000000000011','hvac','Heat pump')`));
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from public.customers'));
 }finally{await db.close();}
});
