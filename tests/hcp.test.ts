import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parseCsv,planImport,type ImportPlan} from '../lib/hcp';
const sample=()=>readFile('tests/fixtures/hcp-sample.csv','utf8');
const plan=async(existing=[] as Parameters<typeof planImport>[1])=>{const p=planImport(await sample(),existing);if('error' in p)throw new Error(p.error);return p as ImportPlan;};
test('CSV parser handles quotes, commas, line breaks, tabs and a byte-order mark',()=>{
 assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",\n'),[['a','b'],['x, y','say "hi"'],['two\nlines','']]);
 assert.deepEqual(parseCsv('a\tb\n1\t2'),[['a','b'],['1','2']]);
});
test('sample file columns match the Housecall Pro export',async()=>{const rows=parseCsv(await sample());assert.equal(rows[0].length,43);for(const r of rows)assert.ok(r.length>=42,'row width '+r.length);});
test('Housecall Pro rows map to Alpha customers',async()=>{
 const p=await plan();const by=(n:string)=>p.customers.find(c=>c.name===n)!;
 assert.equal(p.customers.length,4);
 const pat=by('TEST — Pat Sample');
 assert.equal(pat.type,'Residential');assert.equal(pat.phone,'202-555-0131');assert.equal(pat.service_address,'300 Example Lane, Test City, AZ 85000');assert.equal(pat.lead_source,'Google');assert.equal(pat.hcp_id,'HCP-TEST-001');
 assert.match(pat.access_notes,/Gate code 1234\. Dog in yard, "friendly"\./);assert.match(pat.access_notes,/Side gate/);assert.match(pat.access_notes,/Other phones: Home 202-555-0132/);assert.match(pat.access_notes,/Other emails: pat\.work@example\.test/);
 const mesa=by('TEST — Mesa Example Properties');
 assert.equal(mesa.type,'Commercial');assert.equal(mesa.phone,'202-555-0140');assert.equal(mesa.service_address,'400 Example Blvd, Suite 2, Test City, AZ 85001');assert.equal(mesa.billing_address,'PO Box 55, Test City, AZ 85002');
 assert.deepEqual(mesa.locations,[{name:'400 Example Blvd',address:'400 Example Blvd, Building B, Test City, AZ 85001',notes:'Roof access by ladder'}]);
 const riley=by('TEST — Riley Tenant');assert.equal(riley.parent_ref,mesa.ref);assert.equal(riley.bill_to,'parent');
 const jordan=by('TEST — Jordan Example');assert.equal(jordan.email,'');assert.equal(jordan.bill_to,'self');assert.ok(jordan.do_not_service);assert.match(jordan.access_notes,/^DO NOT SERVICE/);
 const w=p.warnings.map(x=>x.message).join('\n');assert.match(w,/not-an-email/);assert.match(w,/Do Not Service/);assert.match(w,/TEST — Nobody Here/);
 assert.deepEqual(p.skipped.map(x=>x.line),[6,7]);assert.match(p.skipped[1].message,/appears twice/);
});
test('re-importing skips customers already brought in, and links tenants to existing parents',async()=>{
 const p=await plan([{id:'00000000-0000-4000-8000-0000000000aa',name:'TEST — Mesa Example Properties',parent_id:null,hcp_id:'HCP-TEST-002'},{id:'00000000-0000-4000-8000-0000000000bb',name:'x',parent_id:null,hcp_id:'HCP-TEST-001'}]);
 assert.deepEqual(p.customers.map(c=>c.name),['TEST — Riley Tenant','TEST — Jordan Example']);
 assert.equal(p.customers[0].parent_id,'00000000-0000-4000-8000-0000000000aa');
});
test('sub-accounts stay one level deep whatever the row order',()=>{
 const head='Display Name,First Name,Last Name,ID,Bills to\n';
 for(const body of ['A,,,1,B\nB,,,2,C\nC,,,3,\n','C,,,3,\nB,,,2,C\nA,,,1,B\n']){const p=planImport(head+body,[]) as ImportPlan;const by=(n:string)=>p.customers.find(c=>c.name===n)!;
  assert.equal(by('B').parent_ref,null,'B has a tenant, so stays a main account');assert.equal(by('A').parent_ref,by('B').ref);}
 const p=planImport(head+'A,,,1,Old tenant\n',[{id:'00000000-0000-4000-8000-0000000000cc',name:'Old tenant',parent_id:'00000000-0000-4000-8000-0000000000dd',hcp_id:null}]) as ImportPlan;
 assert.equal(p.customers[0].parent_id,null);
});
test('files that are not Housecall Pro exports are rejected',()=>{assert.match((planImport('Name,Phone\nx,1',[]) as {error:string}).error,/Missing columns/);assert.ok('error' in planImport('',[]));});
