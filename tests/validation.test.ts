import {test} from 'node:test';import assert from 'node:assert/strict';import {customerInput,equipmentInput,photoType,inventoryItemInput} from '../lib/validation';
const base={name:'Sample customer',type:'Residential',phone:'',email:'',service_address:'',billing_address:'',terms:'net30',access_notes:'',lead_source:'',parent_id:'',bill_to:'self'};
test('parent billing requires a valid parent and cannot reference itself',()=>{assert.ok(customerInput.safeParse(base).success);assert.equal(customerInput.safeParse({...base,bill_to:'parent'}).success,false);const id='00000000-0000-4000-8000-000000000001';assert.equal(customerInput.safeParse({...base,id,parent_id:id,bill_to:'parent'}).success,false);assert.equal(customerInput.safeParse({...base,terms:'net999'}).success,false);});
test('equipment accepts unknown year but rejects invalid dates and trades',()=>{const eq={customer_id:'00000000-0000-4000-8000-000000000001',location_id:'',trade:'hvac',type:'Heat pump',brand:'',model:'',serial:'',year:'',size:'',extra_value:'R-410A',property_location:'',condition:'Good',warranty_date:'',notes:''};assert.ok(equipmentInput.safeParse(eq).success);assert.equal(equipmentInput.safeParse({...eq,trade:'unknown'}).success,false);assert.equal(equipmentInput.safeParse({...eq,warranty_date:'2026-02-30'}).success,false);});
test('photos are recognised by their contents, not their file name',()=>{
 assert.equal(photoType(new Uint8Array([0xff,0xd8,0xff,0xe0])),'jpg');
 assert.equal(photoType(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a])),'png');
 assert.equal(photoType(new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])),'webp');
 assert.equal(photoType(new TextEncoder().encode('<svg onload=alert(1)>')),null);
 assert.equal(photoType(new Uint8Array([0x25,0x50,0x44,0x46])),null,'PDF is rejected');
});
test('a new inventory part is accepted without an id, as the Add part form sends it',()=>{
 const form={trade:'hvac',name:'TEST — Click-through part',sku:'',location:'Truck 2',unit_cost:'10',reorder_at:'2',on_hand:'3'};
 assert.ok(inventoryItemInput.safeParse(form).success);
 assert.ok(inventoryItemInput.safeParse({...form,id:'00000000-0000-4000-8000-000000000001'}).success);
 assert.ok(!inventoryItemInput.safeParse({...form,id:'not-an-id'}).success);
 assert.ok(!inventoryItemInput.safeParse({...form,on_hand:'-1'}).success);
});
