import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {testDatabase} from './db';import {priceBreakdown,margin,marginLevel,DEFAULT_PRICING} from '../lib/pricing';
const admin='00000000-0000-4000-8000-000000000201',office='00000000-0000-4000-8000-000000000202',tech='00000000-0000-4000-8000-000000000203';
test('formula matches the business rule: (hours x $165 + parts x 1.5) / 0.97, whole dollars',()=>{
 assert.equal(priceBreakdown(1,6,DEFAULT_PRICING).price,179);
 assert.equal(priceBreakdown(0.5,0,DEFAULT_PRICING).price,85);
 assert.equal(priceBreakdown(4,960,DEFAULT_PRICING).price,2165);
 const b=priceBreakdown(2,265,DEFAULT_PRICING);assert.equal(b.labor+b.markedUp+b.cardCover,b.price,'breakdown adds up to the price');
 assert.equal(priceBreakdown(1,10,{...DEFAULT_PRICING,card_cover:0}).price,180);
 const m=margin(179,1,6,DEFAULT_PRICING);assert.ok(Math.abs(m-(179-6-40)/179)<1e-9);assert.equal(marginLevel(m,DEFAULT_PRICING),'good');assert.equal(marginLevel(0.55,DEFAULT_PRICING),'close');assert.equal(marginLevel(0.3,DEFAULT_PRICING),'low');
});
test('database prices the price book and enforces who sees and changes what',async()=>{
 const {db,asUser}=await testDatabase();
 try{
 await db.exec(`insert into auth.users values ('${admin}'),('${office}'),('${tech}');insert into public.profiles values ('${admin}','Test admin','admin'),('${office}','Test office','office'),('${tech}','Test tech','tech');`);
 await db.exec(await readFile('supabase/seed_price_book.sql','utf8'));
 // Every sample price equals the app's preview formula, so what the editor shows is what gets saved.
 const all=(await asUser(office,'select b.name,b.price::float as price,c.hours::float as hours,c.parts::float as parts from public.price_book b join public.price_book_costs c on c.task_id=b.id')).rows as {name:string;price:number;hours:number;parts:number}[];
 assert.equal(all.length,27);for(const r of all)assert.equal(r.price,priceBreakdown(r.hours,r.parts,DEFAULT_PRICING).price,r.name);
 // Techs see names, what's included and prices, but never hours, parts cost or settings.
 assert.equal((await asUser(tech,'select name,includes,price from public.price_book')).rows.length,27);
 assert.equal((await asUser(tech,'select * from public.price_book_costs')).rows.length,0);
 assert.equal((await asUser(tech,'select * from public.pricing_settings')).rows.length,0);
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from public.price_book'),'signed-out users see nothing');
 // Office adds a formula task and a custom-priced task; tables can't be written directly.
 const add=(who:string,args:string)=>asUser(who,`select public.save_price_task(${args}) as id`);
 const formulaId=((await add(office,`null,'hvac','TEST — Formula task','',1,6,'formula',null`)).rows[0] as {id:string}).id;
 const customId=((await add(office,`null,'hvac','TEST — Custom task','',1,6,'custom',99.5`)).rows[0] as {id:string}).id;
 const priceOf=async(id:string)=>((await asUser(office,`select price::float as p from public.price_book where id='${id}'`)).rows[0] as {p:number}).p;
 assert.equal(await priceOf(formulaId),179);assert.equal(await priceOf(customId),99.5);
 await assert.rejects(()=>add(tech,`null,'hvac','TEST — Tech task','',1,0,'formula',null`),'techs cannot add tasks');
 await assert.rejects(()=>asUser(office,`insert into public.price_book(trade,name,price) values ('hvac','Direct',1)`),'no direct writes');
 await assert.rejects(()=>asUser(office,`update public.price_book set price=1 where id='${formulaId}'`),'no direct price edits');
 await assert.rejects(()=>add(office,`null,'hvac','TEST — No price','',1,0,'custom',null`),'custom needs a price');
 // Editing hours re-prices a formula task.
 await add(office,`'${formulaId}','hvac','TEST — Formula task','',2,6,'formula',null`);assert.equal(await priceOf(formulaId),349);
 // Only admin changes the formula; it reprices every formula task and leaves custom prices alone.
 const settings=(who:string,rate:number)=>asUser(who,`select public.save_pricing_settings(${rate},50,3,40,60) as n`);
 await assert.rejects(()=>settings(office,200),'office cannot change the formula');await assert.rejects(()=>settings(tech,200));
 assert.deepEqual((await settings(admin,200)).rows,[{n:28}]);
 assert.equal(await priceOf(formulaId),Math.round((2*200+9)/0.97));assert.equal(await priceOf(customId),99.5);
 await assert.rejects(()=>asUser(admin,`select public.save_pricing_settings(165,50,10,40,60)`),'card coverage must stay under 10%');
 // Delete is office only.
 await assert.rejects(()=>asUser(tech,`select public.delete_price_task('${customId}')`));
 await asUser(office,`select public.delete_price_task('${customId}')`);assert.equal((await asUser(office,`select 1 from public.price_book_costs where task_id='${customId}'`)).rows.length,0);
 }finally{await db.close();}
});
