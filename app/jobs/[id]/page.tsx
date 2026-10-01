import Link from 'next/link';import {notFound} from 'next/navigation';import {z} from 'zod';import {session} from '@/lib/auth';import {Nav} from '@/components/Nav';import {CHECK,SITE,TRADE_NAMES} from '@/lib/fields';import {JOB_STATUS,WINDOWS,windowText,longDate,jobNumber} from '@/lib/jobs';import {money} from '@/lib/pricing';
import {setJobStatus,rescheduleJob,saveJobDetails,addJobTask,setJobTaskQty,addJobMaterial,removeJobMaterial,addJobNote,saveSite} from '@/app/actions';import {CheckItem} from '@/components/CheckItem';import {equipmentRows,addEquipmentForms,type EquipmentRow} from '@/components/Equipment';
export const dynamic='force-dynamic';
const OPEN=['scheduled','enroute','progress','parts'];
const TERMS:Record<string,string>={due:'Due on receipt',net15:'Net 15',net30:'Net 30',net60:'Net 60'};
const SAVED:Record<string,string>={enroute:'Marked on the way.',progress:'Job started.',parts:'Marked waiting on parts.',complete:'Job completed. It’s ready to invoice.',scheduled:'Job rescheduled.'};
const stamp=(iso:string)=>new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Phoenix'});
type Costing={billed:number;hours:number;hours_actual:boolean;estimated_hours:number;rate:number;labor:number;parts:number;parts_actual:boolean;gross:number;materials:Record<string,number>};
// The tech job page, phone-first like the prototype. Every change is a small form that saves straight away.
export default async function Job({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const sp=await searchParams;const {db,profile}=await session();if(!z.uuid().safeParse(id).success)notFound();
 const {data:j}=await db.from('jobs').select('*').eq('id',id).maybeSingle();if(!j)notFound();
 const office=profile.role!=='tech';const open=OPEN.includes(j.status);const back='/jobs/'+id;
 // The customer may no longer be visible to a tech once the job is invoiced; the job itself still shows.
 const [c,l,n,p,t,m,pb,inv,site,eq,cost]=await Promise.all([
  db.from('customers').select('id,name,type,phone,service_address,access_notes,terms').eq('id',j.customer_id).maybeSingle(),
  db.from('locations').select('id,name,address').eq('customer_id',j.customer_id).order('name'),
  db.from('job_notes').select('body,by_user,created_at').eq('job_id',id).order('created_at'),
  db.from('profiles').select('id,display_name'),
  db.from('job_tasks').select('id,name,includes,unit_price,qty').eq('job_id',id).order('created_at'),
  db.from('job_materials').select('id,item_id,name,qty').eq('job_id',id).order('created_at'),
  open?db.from('price_book').select('id,name,price').eq('trade',j.trade).order('name'):null,
  open?db.from('inventory_items').select('id,name,sku,on_hand,trade').order('name'):null,
  db.from('site_details').select('details').eq('customer_id',j.customer_id).eq('trade',j.trade).maybeSingle(),
  db.from('equipment').select('*').eq('customer_id',j.customer_id).eq('trade',j.trade).order('created_at'),
  office?db.rpc('job_costing',{p_job:id}):null]);
 if(t.error||m.error)return <><Nav name={profile.display_name} role={profile.role}/><p className="error" role="alert">The job page isn’t set up in this database yet. Apply <code>supabase/migrations/202610060001_job_work.sql</code> to the test project.</p></>;
 const who=new Map((p.data??[]).map(x=>[x.id,x.display_name]));const customer=c.data;const locations=l.data??[];const building=locations.find(x=>x.id===j.location_id);
 const tasks=t.data??[];const materials=m.data??[];const costing=(cost?.data??null) as Costing|null;const siteValues=(site.data?.details??{}) as Record<string,string>;
 const total=tasks.reduce((s,x)=>s+Number(x.unit_price)*x.qty,0);const items=CHECK[j.trade];const checked=(j.checklist??[]) as boolean[];const doneCount=items.filter((_,i)=>checked[i]).length;
 // Like the prototype: when the customer has buildings, show the equipment at this job's building (or main property).
 const equipment=((eq.data??[]) as EquipmentRow[]).filter(x=>!locations.length||(x.location_id??null)===(j.location_id??null));
 const place={customerId:j.customer_id,locations,returnTo:back};
 const hidden=<input type="hidden" name="job_id" value={id}/>;
 const address=building?.address||customer?.service_address||'';
 const missing=[!tasks.length&&'add at least one flat-rate task',doneCount<items.length&&`finish the checklist (${items.length-doneCount} open)`,!j.summary.trim()&&'write the job summary'].filter(Boolean) as string[];
 const status=(to:string,label:string,primary=false)=><form action={setJobStatus}>{hidden}<input type="hidden" name="status" value={to}/><button className={primary?'primary':''}>{label}</button></form>;
 const reschedule=(label:string)=><details><summary>{label}</summary><form action={rescheduleJob}>{hidden}<div className="grid"><label className="field">Date<input name="date" type="date" defaultValue={j.scheduled_date} required/></label><label className="field">Arrival time<input name="time" type="time" defaultValue={String(j.arrival_time).slice(0,5)} required/></label><label className="field">Arrival window<select name="window" defaultValue={String(Number(j.window_hours))}>{WINDOWS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><button className="primary">Save new time</button></form></details>;
 const message=sp.error?null:sp.created?`Job ${jobNumber(j.number)} scheduled for ${longDate(j.scheduled_date)}.`:sp.status?SAVED[sp.status]:sp.saved?'Saved.':null;
 return <><Nav name={profile.display_name} role={profile.role}/>
  {message&&<p className="success" role="status">{message}</p>}{sp.error&&<p className="error" role="alert">{sp.error}</p>}
  <div className="jobhead"><span className="pill">{TRADE_NAMES[j.trade]}</span> <span className={'pill status-'+j.status}>{JOB_STATUS[j.status]}</span> <span className="muted">{jobNumber(j.number)}</span>
   <h1>{customer?.name??'Customer'}{building?', '+building.name:''}</h1><p>{j.description}</p>
   <p className="muted">{longDate(j.scheduled_date)}, {windowText(j.arrival_time,j.window_hours)}, {j.tech_id?'with '+(who.get(j.tech_id)??'tech'):<strong className="neg">not assigned to a tech</strong>}</p>
   {j.status==='parts'&&<p className="callout warn"><strong>Parts needed:</strong> {j.parts_needed}</p>}
   {j.status==='complete'&&<p className="callout"><strong>Completed{j.completed_at?' '+stamp(j.completed_at):''}.</strong> Ready to invoice; invoicing comes in Phase 4. {office?'Reopen the job to make changes.':'Ask the office to reopen it if something needs to change.'}</p>}
   <div className="actions">
    {j.status==='scheduled'&&<>{status('enroute','On my way',true)}{status('progress','Start job')}</>}
    {j.status==='enroute'&&status('progress','Arrived, start job',true)}
    {j.status==='progress'&&(missing.length?<p className="muted">To complete this job, {missing.join(', ')}.</p>:<>{!equipment.length&&<p className="callout warn">No {TRADE_NAMES[j.trade]} equipment is on file here yet. Add it below before you leave if you can.</p>}{status('complete','Complete job',true)}</>)}
    {j.status==='parts'&&reschedule('Parts arrived, reschedule')}
    {open&&j.status!=='parts'&&<><details><summary>Needs parts</summary><form action={setJobStatus}>{hidden}<input type="hidden" name="status" value="parts"/><label className="field">Which parts are needed?<textarea name="parts_needed" required maxLength={1000} placeholder="Part, model or size, and where to get it"/></label><button className="primary">Mark waiting on parts</button></form></details>{reschedule('Reschedule')}</>}
    {j.status==='complete'&&office&&status('progress','Reopen job')}
   </div>
  </div>
  <section className="panel"><h2>Where the job is</h2>{customer?<><dl>{building&&<><dt>Building</dt><dd>{building.name}</dd></>}<dt>Address</dt><dd>{address||'—'}</dd>{j.work_location&&<><dt>Work location</dt><dd>{j.work_location}</dd></>}{customer.access_notes&&<><dt>Access notes</dt><dd>{customer.access_notes}</dd></>}<dt>Customer</dt><dd>{customer.type}, {TERMS[customer.terms]??customer.terms}{customer.phone?', '+customer.phone:''}</dd></dl>
   <div className="actions">{address&&<a className="button" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)} target="_blank" rel="noreferrer">Open in Maps</a>}<Link className="button" href={'/customers/'+customer.id}>Customer profile</Link></div></>:<p className="muted">Customer details are no longer available to you for this job.</p>}</section>
  <section className="panel private"><h2>Private notes</h2><p className="muted">Office and techs only. Never on the invoice or customer emails.</p>
   {(n.data??[]).map((x,i)=><div className="record" key={i}><span>{x.body}</span><span className="muted">{who.get(x.by_user??'')??'Unknown user'} · {stamp(x.created_at)}</span></div>)}
   <form action={addJobNote}>{hidden}<label className="field">Add a note<textarea name="body" required maxLength={2000} placeholder="Gate codes, customer concerns, what to quote, what not to say"/></label><button>Add private note</button></form></section>
  {customer&&<section className="panel"><h2>{TRADE_NAMES[j.trade]} site details</h2>
   <dl>{SITE[j.trade].filter(f=>siteValues[f.k]).map(f=><div key={f.k} style={{display:'contents'}}><dt>{f.l}</dt><dd>{siteValues[f.k]}</dd></div>)}</dl>{!SITE[j.trade].some(f=>siteValues[f.k])&&<p className="empty">No {TRADE_NAMES[j.trade]} site details yet.</p>}
   {open&&<details><summary>Edit site details</summary><form action={saveSite}><input type="hidden" name="customer_id" value={j.customer_id}/><input type="hidden" name="trade" value={j.trade}/><input type="hidden" name="return_to" value={back}/><div className="grid">{SITE[j.trade].map(f=><label className="field" key={f.k}>{f.l}{f.o?<select name={f.k} defaultValue={siteValues[f.k]??''}><option value="">Not recorded</option>{f.o.map(o=><option key={o}>{o}</option>)}</select>:<input name={f.k} type={f.t??'text'} min={f.t==='number'?0:undefined} defaultValue={siteValues[f.k]??''} maxLength={500}/>}</label>)}</div><button className="primary">Save site details</button></form></details>}</section>}
  {customer&&<section className="panel"><h2>{TRADE_NAMES[j.trade]} equipment{building?' at '+building.name:''}</h2><p className="muted">{equipment.length} on file.{!equipment.length&&' Most customers don’t know their equipment, so record it from the data plate on site.'}</p>
   {equipmentRows(place,equipment)}{open&&addEquipmentForms(place,j.location_id??'',j.trade)}</section>}
  <section className="panel"><h2>{TRADE_NAMES[j.trade]} checklist</h2><p className="muted">{doneCount} of {items.length} done</p><div className="progressline"><span style={{width:`${doneCount/items.length*100}%`}}/></div>
   {items.map((label,i)=><CheckItem key={i} jobId={id} index={i+1} label={label} done={!!checked[i]} locked={!open}/>)}</section>
  <section className="panel"><h2>Flat-rate work</h2><p className="muted">What the customer pays.</p>
   {tasks.map(x=><div className="line" key={x.id}><div><strong>{x.name}</strong><span className="muted">{x.includes}</span>
     {open?<div className="stepper"><form action={setJobTaskQty}>{hidden}<input type="hidden" name="line_id" value={x.id}/><input type="hidden" name="qty" value={x.qty-1}/><button aria-label={'One less '+x.name}>−</button></form><span>{x.qty}</span><form action={setJobTaskQty}>{hidden}<input type="hidden" name="line_id" value={x.id}/><input type="hidden" name="qty" value={x.qty+1}/><button aria-label={'One more '+x.name}>+</button></form></div>:<span className="muted">Qty {x.qty}</span>}</div>
    <strong className="amt">{money(Number(x.unit_price)*x.qty,Number(x.unit_price)%1?2:0)}</strong></div>)}
   {!tasks.length&&<p className="empty">No flat-rate tasks yet. Add what the customer is approving.</p>}
   {open&&<form action={addJobTask} className="inline">{hidden}<label className="field">Add a {TRADE_NAMES[j.trade]} task<select name="task_id" required defaultValue=""><option value="" disabled>Choose from the price book</option>{(pb?.data??[]).map(x=><option key={x.id} value={x.id}>{x.name} — {money(Number(x.price),Number(x.price)%1?2:0)}</option>)}</select></label><button className="primary">Add task</button></form>}
   <div className="total"><strong>Customer total</strong><strong>{money(total,total%1?2:0)}</strong></div></section>
  <section className="panel"><h2>Parts and materials used</h2><p className="muted">Parts from inventory come out of stock automatically and show on the invoice as included in the flat rate.</p>
   {materials.map(x=><div className="line" key={x.id}><div><strong>{x.name}</strong><span className="muted">{x.item_id?'From inventory':'Not stocked'}, qty {x.qty}{costing?.materials[x.id]!==undefined?`, ${money(costing.materials[x.id],2)} each`:''}</span></div>
    {open&&<form action={removeJobMaterial}>{hidden}<input type="hidden" name="line_id" value={x.id}/><button className="danger" aria-label={'Remove '+x.name}>Remove</button></form>}</div>)}
   {!materials.length&&<p className="empty">No parts logged yet.</p>}
   {open&&<><form action={addJobMaterial} className="inline">{hidden}<label className="field">Add a part from inventory<select name="item_id" required defaultValue=""><option value="" disabled>Choose a part</option>{[...(inv?.data??[])].sort((a,b)=>Number(b.trade===j.trade)-Number(a.trade===j.trade)).map(x=><option key={x.id} value={x.id} disabled={x.on_hand<=0}>{x.name}{x.sku?` (${x.sku})`:''} — {x.on_hand<=0?'out of stock':x.on_hand+' on hand'}</option>)}</select></label><label className="field qty">Qty<input name="qty" type="number" inputMode="numeric" min="1" step="1" defaultValue="1" required/></label><button className="primary">Add part</button></form>
    <details><summary>Part not in inventory</summary><form action={addJobMaterial}>{hidden}<div className="grid"><label className="field">Part name<input name="name" required maxLength={160}/></label><label className="field">Cost each ($)<input name="cost" type="number" inputMode="decimal" min="0" step="0.01" required/></label><label className="field">Qty<input name="qty" type="number" inputMode="numeric" min="1" step="1" defaultValue="1" required/></label></div><button>Add part</button></form></details></>}</section>
  <section className="panel"><h2>Job summary</h2><p className="muted">Written for the customer. It goes with the invoice.</p>
   {open?<form action={saveJobDetails}>{hidden}<label className="field">What we found and what we did<textarea name="summary" defaultValue={j.summary} maxLength={5000} placeholder="Example: Found a failed capacitor stopping the outdoor fan. Replaced it and confirmed the system is cooling normally."/></label>
     <label className="field">Recommendations (optional)<textarea name="recommendations" defaultValue={j.recommendations} maxLength={5000} placeholder="Future work to consider, like replacing an aging unit or adding a riser"/></label>
     <label className="field qty">Actual hours on this job<input name="actual_hours" type="number" inputMode="decimal" min="0" step="0.25" defaultValue={j.actual_hours??''} placeholder={costing?String(costing.estimated_hours):''}/></label><button className="primary">Save summary and hours</button></form>
   :<>{j.summary?<p className="summarybox">{j.summary}</p>:<p className="empty">No summary.</p>}{j.recommendations&&<><h3>Recommendations</h3><p className="summarybox">{j.recommendations}</p></>}{j.actual_hours!=null&&<p className="muted">Actual hours: {Number(j.actual_hours)}</p>}</>}</section>
  {costing&&<section className="panel"><h2>Job costing</h2><p className="muted">Office only. The customer only sees the flat-rate price.</p>
   <dl><dt>Billed</dt><dd>{money(costing.billed,2)}</dd><dt>Labor</dt><dd>{money(costing.labor,2)} ({Number(costing.hours)} hr at {money(costing.rate)}/hr{costing.hours_actual?'':', price book estimate'})</dd><dt>Parts</dt><dd>{money(costing.parts,2)} ({costing.parts_actual?'logged parts':'price book estimate'})</dd><dt>Gross profit</dt><dd className={costing.gross<0?'neg':''}><strong>{money(costing.gross,2)}</strong>{costing.billed>0?` (${Math.round(costing.gross/costing.billed*100)}%)`:''}</dd></dl>
   <p className="muted">Labor uses the average tech cost from Pricing settings until per-tech pay rates come with the time clock.</p></section>}
  <Link className="button" href="/jobs">All jobs</Link>
 </>;
}
