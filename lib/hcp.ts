// Reads a Housecall Pro customer export and turns it into Alpha customers, locations and billing links.
// Pure functions only (no database), so the preview and the real import use exactly the same rules.

export const HCP_REQUIRED=['Display Name','First Name','Last Name','ID'] as const;
export const HCP_NOT_IMPORTED=['Role','Tags','Accepts bills from','Customer notifications enabled','Customer is Contractor','Customer created at','Last service date','Lifetime value'];
export const MAX_ROWS=5000;

export type ImportLocation={name:string;address:string;notes:string};
export type ImportCustomer={line:number;ref:string;hcp_id:string|null;name:string;type:'Residential'|'Commercial';phone:string;email:string;service_address:string;billing_address:string;access_notes:string;lead_source:string;parent_ref:string|null;parent_id:string|null;bill_to:'self'|'parent';parent_name:string;locations:ImportLocation[];do_not_service:boolean};
export type ImportNote={line:number;message:string};
export type ImportPlan={customers:ImportCustomer[];warnings:ImportNote[];skipped:ImportNote[]};
export type ExistingCustomer={id:string;name:string;parent_id:string|null;hcp_id:string|null};

// RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. Tab-separated files work too.
export function parseCsv(text:string):string[][]{
 text=text.replace(/^﻿/,'');
 const first=text.slice(0,text.search(/\r?\n|$/));const sep=first.includes('\t')&&!first.includes(',')?'\t':',';
 const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=ch;continue;}
  if(ch==='"'&&field==='')quoted=true;
  else if(ch===sep){row.push(field);field='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
  else field+=ch;}
 if(field!==''||row.length){row.push(field);rows.push(row);}
 return rows.filter(r=>r.some(x=>x.trim()!==''));
}

const yes=(v:string)=>/^(true|yes|y|1)$/i.test(v.trim());
const clip=(v:string,max:number)=>v.trim().slice(0,max);
const key=(name:string)=>name.trim().toLowerCase().replace(/\s+/g,' ');
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function planImport(text:string,existing:ExistingCustomer[]):ImportPlan|{error:string}{
 const rows=parseCsv(text);if(!rows.length)return {error:'The file is empty.'};
 const header=rows[0].map(h=>h.trim());const missing=HCP_REQUIRED.filter(h=>!header.includes(h));
 if(missing.length)return {error:'This doesn’t look like a Housecall Pro customer export. Missing columns: '+missing.join(', ')+'.'};
 if(rows.length-1>MAX_ROWS)return {error:`The file has ${rows.length-1} customers. Import at most ${MAX_ROWS} at a time.`};
 const warnings:ImportNote[]=[];const skipped:ImportNote[]=[];const customers:ImportCustomer[]=[];
 const knownIds=new Set(existing.map(c=>c.hcp_id).filter(Boolean));const seenIds=new Set<string>();
 rows.slice(1).forEach((cells,i)=>{
  const line=i+2;const get=(col:string)=>(cells[header.indexOf(col)]??'').trim();const warn=(message:string)=>warnings.push({line,message});
  const hcp_id=get('ID')||null;
  const name=get('Display Name')||get('Company')||[get('First Name'),get('Last Name')].filter(Boolean).join(' ');
  if(!name)return skipped.push({line,message:'No name.'});
  if(hcp_id&&knownIds.has(hcp_id))return skipped.push({line,message:`${name} was already imported.`});
  if(hcp_id&&seenIds.has(hcp_id))return skipped.push({line,message:`${name} appears twice in this file (same Housecall Pro ID).`});
  if(hcp_id)seenIds.add(hcp_id);
  if(name.length>160)warn('Name shortened to 160 characters.');
  // Addresses: the first non-billing address is the service address; extra service addresses become buildings.
  const addresses=[1,2,3].map(n=>{const p=`Address_${n} `;const street=[get(p+'Street Line 1'),get(p+'Street Line 2')].filter(Boolean).join(', ');const cityLine=[get(p+'City'),[get(p+'State'),get(p+'Postal Code')].filter(Boolean).join(' ')].filter(Boolean).join(', ');return {street:get(p+'Street Line 1'),text:[street,cityLine].filter(Boolean).join(', '),billing:yes(get(p+'Billing?')),notes:get(p+'Notes')};}).filter(a=>a.text);
  const service=addresses.filter(a=>!a.billing);const main=service[0]??addresses[0];
  const bill=addresses.find(a=>a.billing&&a!==main);
  // Extra phone numbers, extra emails and address notes have no field of their own yet, so they go in access notes.
  const phones=[['Mobile',get('Mobile Number')],['Home',get('Home Number')],['Work',get('Work Number')]].filter(([,v])=>v);
  let email=get('Email');if(email&&!EMAIL.test(email)){warn(`Email "${email}" isn’t valid and was left blank.`);email='';}
  const do_not_service=yes(get('Do Not Service'));if(do_not_service)warn(`${name} is marked Do Not Service in Housecall Pro.`);
  const notes=[do_not_service?'DO NOT SERVICE (from Housecall Pro).':'',get('Notes'),main?.notes??'',phones.length>1?'Other phones: '+phones.slice(1).map(([l,v])=>`${l} ${v}`).join(', '):'',get('Additional Emails')?'Other emails: '+get('Additional Emails'):''].filter(Boolean).join('\n');
  if(notes.length>2000)warn('Notes shortened to 2,000 characters.');
  const type=/business|commercial/i.test(get('Customer Type'))?'Commercial':'Residential';
  customers.push({line,ref:'row'+line,hcp_id,name:clip(name,160),type,phone:clip(phones[0]?.[1]??'',80),email,service_address:clip(main?.text??'',500),billing_address:clip(bill?.text??'',500),access_notes:notes.slice(0,2000),lead_source:clip(get('Lead Source'),120),parent_ref:null,parent_id:null,bill_to:'self',parent_name:get('Bills to'),do_not_service,
   locations:service.slice(1).map(a=>({name:clip(a.street||a.text,160),address:clip(a.text,500),notes:clip(a.notes,2000)}))});
 });
 // "Bills to" names the account that pays. Link it as a parent (tenant sub-account billed to parent), one level deep only.
 const inFile=new Map(customers.map(c=>[key(c.name),c]));const inDb=new Map(existing.map(c=>[key(c.name),c]));
 const hasChildren=new Set<string>();
 for(const c of customers){if(!c.parent_name)continue;const p=inFile.get(key(c.parent_name))??inDb.get(key(c.parent_name));
  if(!p){warnings.push({line:c.line,message:`Bills to "${c.parent_name}", but no customer with that name was found. Imported as its own account.`});continue;}
  if(p===c){continue;}
  hasChildren.add('ref' in p?p.ref:p.id);
  if('ref' in p){c.parent_ref=p.ref;}else c.parent_id=p.id;c.bill_to='parent';}
 const unlink=(c:ImportCustomer)=>{warnings.push({line:c.line,message:`Bills to "${c.parent_name}", but Alpha only allows one level of sub-accounts. Imported as its own account.`});c.parent_ref=null;c.parent_id=null;c.bill_to='self';};
 // An account that others bill to stays a main account; then nobody may bill to an existing sub-account.
 for(const c of customers)if((c.parent_ref||c.parent_id)&&hasChildren.has(c.ref))unlink(c);
 for(const c of customers)if(c.parent_id&&existing.find(x=>x.id===c.parent_id)?.parent_id)unlink(c);
 return {customers,warnings,skipped};
}
