import {test} from 'node:test';import assert from 'node:assert/strict';import {testDatabase} from './db';
const customer='00000000-0000-4000-8000-000000000001';const other='00000000-0000-4000-8000-000000000002';const tech='00000000-0000-4000-8000-000000000101';const office='00000000-0000-4000-8000-000000000102';const unrelated='00000000-0000-4000-8000-000000000103';
test('database enforces technician, anonymous and office access boundaries',async()=>{
 const {db,asUser}=await testDatabase();
 try{
 await db.exec(`insert into auth.users values ('${tech}'),('${office}'),('${unrelated}');insert into public.profiles values ('${tech}','Test tech','tech'),('${office}','Test office','office'),('${unrelated}','Other tech','tech');insert into public.customer_assignments values ('${customer}','${tech}');`);
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
 // Housecall Pro import: office only, all-or-nothing, and each Housecall Pro customer only once.
 const parentId='00000000-0000-4000-8000-0000000000a1',tenantId='00000000-0000-4000-8000-0000000000a2';
 const payload=(rows:object[])=>`select public.import_hcp_customers('${JSON.stringify(rows).replace(/'/g,"''")}'::jsonb) as n`;
 const good=[{id:parentId,name:'TEST — Import parent',type:'Commercial',hcp_id:'HCP-T-1',locations:[{name:'Building 2',address:'2 Example Rd',notes:''}]},{id:tenantId,name:'TEST — Import tenant',type:'Residential',hcp_id:'HCP-T-2',parent_id:parentId}];
 await assert.rejects(()=>asUser(tech,payload(good)),'techs cannot import');
 await assert.rejects(()=>asUser(office,payload([{...good[0],id:'00000000-0000-4000-8000-0000000000a9',hcp_id:'HCP-T-9'},{id:'00000000-0000-4000-8000-0000000000a8',name:'Bad row',type:'Bogus'}])),'a bad row fails the whole import');
 assert.equal((await asUser(office,`select id from public.customers where hcp_id='HCP-T-9'`)).rows.length,0,'nothing from a failed import is saved');
 assert.deepEqual((await asUser(office,payload(good))).rows,[{n:2}]);
 assert.deepEqual((await asUser(office,`select parent_id,bill_to from public.customers where id='${tenantId}'`)).rows,[{parent_id:parentId,bill_to:'parent'}]);
 assert.deepEqual((await asUser(office,`select name from public.locations where customer_id='${parentId}'`)).rows,[{name:'Building 2'}]);
 await assert.rejects(()=>asUser(office,payload([{...good[0],id:'00000000-0000-4000-8000-0000000000a7'}])),'the same Housecall Pro customer cannot be imported twice');
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from public.customers'));await assert.rejects(()=>db.query('select * from storage.objects'));
 }finally{await db.close();}
});
