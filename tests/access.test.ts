import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const customer='00000000-0000-4000-8000-000000000001';const other='00000000-0000-4000-8000-000000000002';const tech='00000000-0000-4000-8000-000000000101';const office='00000000-0000-4000-8000-000000000102';const unrelated='00000000-0000-4000-8000-000000000103';
test('database enforces technician, anonymous and office access boundaries',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 // Minimal stand-in for Supabase Storage, which PGlite doesn't have. Supabase itself enables row level security on storage.objects.
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 await db.exec(await readFile('supabase/migrations/202609300001_foundation.sql','utf8'));await db.exec(await readFile('supabase/seed.sql','utf8'));await db.exec(await readFile('supabase/migrations/202610010001_equipment_editing_photos.sql','utf8'));
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
 // Equipment editing and data plate photos.
 const mine=(await asUser(tech,`insert into public.equipment(customer_id,trade,type) values ('${customer}','hvac','Heat pump') returning id`)).rows[0] as {id:string};
 const theirs=(await asUser(office,`insert into public.equipment(customer_id,trade,type) values ('${other}','hvac','Heat pump') returning id`)).rows[0] as {id:string};
 await asUser(tech,`update public.equipment set serial='SN-1',photo_path='${customer}/${mine.id}/plate.jpg' where id='${mine.id}'`);
 assert.deepEqual((await asUser(office,`select serial from public.equipment where id='${mine.id}'`)).rows,[{serial:'SN-1'}]);
 await asUser(tech,`update public.equipment set serial='SN-X' where id='${theirs.id}'`);
 assert.deepEqual((await asUser(office,`select serial from public.equipment where id='${theirs.id}'`)).rows,[{serial:''}],'tech cannot edit an unassigned customer\'s equipment');
 await assert.rejects(()=>asUser(tech,`update public.equipment set customer_id='${other}' where id='${mine.id}'`),'equipment cannot move to another customer');
 await assert.rejects(()=>asUser(office,`update public.equipment set customer_id='${customer}' where id='${theirs.id}'`),'even office cannot move equipment between customers');
 await assert.rejects(()=>asUser(office,`update public.equipment set photo_path='${other}/${mine.id}/plate.jpg' where id='${mine.id}'`),'photo must sit in its own customer and equipment folder');
 await asUser(tech,`insert into storage.objects(bucket_id,name) values ('equipment-photos','${customer}/${mine.id}/plate.jpg')`);
 await assert.rejects(()=>asUser(tech,`insert into storage.objects(bucket_id,name) values ('equipment-photos','${other}/${theirs.id}/plate.jpg')`),'tech cannot upload to an unassigned customer');
 await assert.rejects(()=>asUser(tech,`insert into storage.objects(bucket_id,name) values ('equipment-photos','not-a-customer/plate.jpg')`),'uploads need a customer folder');
 await asUser(office,`insert into storage.objects(bucket_id,name) values ('equipment-photos','${other}/${theirs.id}/plate.jpg')`);
 assert.deepEqual((await asUser(tech,`select name from storage.objects`)).rows,[{name:`${customer}/${mine.id}/plate.jpg`}],'tech only sees assigned photos');
 assert.equal((await asUser(unrelated,`select name from storage.objects`)).rows.length,0);
 await asUser(unrelated,`delete from storage.objects`);assert.equal((await asUser(office,`select name from storage.objects`)).rows.length,2,'unassigned tech cannot delete photos');
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from public.customers'));await assert.rejects(()=>db.query('select * from storage.objects'));
 }finally{await db.close();}
});
