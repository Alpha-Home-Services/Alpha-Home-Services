'use client';
import {useActionState} from 'react';import {createJob,type IntakeState} from '@/app/actions';import {WINDOWS,LEAD_SOURCES} from '@/lib/jobs';
type SiteField={k:string;l:string;t?:string;o?:string[];value:string};
const TERMS=[['due','Due on receipt'],['net15','Net 15'],['net30','Net 30'],['net60','Net 60']];
// The rest of intake after the trade and customer are chosen. Keeps everything typed if the server sends back a warning.
export function JobForm({trade,tradeName,customerId,locations,site,techs,today}:{trade:string;tradeName:string;customerId:string|null;locations:{id:string;name:string}[];site:SiteField[];techs:{id:string;name:string}[];today:string}){
 const [state,action,saving]=useActionState<IntakeState,FormData>(createJob,null);const v=(k:string,d='')=>state?.values?.[k]??d;
 return <form action={action}>
  <input type="hidden" name="trade" value={trade}/><input type="hidden" name="customer_id" value={customerId??''}/><input type="hidden" name="book_anyway" value={v('book_anyway')}/>
  {!customerId&&<section className="panel"><h2>New customer</h2>
   <label className="field">Name or company<input name="c_name" defaultValue={v('c_name')} required maxLength={160} autoComplete="name"/></label>
   <div className="grid"><label className="field">Customer type<select name="c_type" defaultValue={v('c_type','Residential')}><option>Residential</option><option>Commercial</option></select></label><label className="field">Payment terms<select name="c_terms" defaultValue={v('c_terms','due')}>{TERMS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    <label className="field">Phone<input name="c_phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v('c_phone')} required maxLength={80}/></label><label className="field">Email<input name="c_email" type="email" autoComplete="email" defaultValue={v('c_email')} maxLength={254}/></label></div>
   <label className="field">Service address<input name="c_service_address" autoComplete="street-address" defaultValue={v('c_service_address')} required maxLength={500}/></label>
   <label className="field">Billing address<input name="c_billing_address" defaultValue={v('c_billing_address')} maxLength={500} placeholder="Leave blank if same as service address"/></label>
   <label className="field">Access notes<input name="c_access_notes" defaultValue={v('c_access_notes')} maxLength={2000} placeholder="Gate code, pets, parking"/></label>
   <label className="field">How did they hear about us?<select name="c_lead_source" defaultValue={v('c_lead_source','Google')}>{LEAD_SOURCES.map(s=><option key={s}>{s}</option>)}</select></label>
  </section>}
  <section className="panel"><h2>{tradeName} site details</h2><p className="muted">Ask what the customer knows and skip anything they’re not sure of. The tech records the actual equipment from the data plates on site.</p>
   <div className="grid">{site.map(f=><label className="field" key={f.k}>{f.l}{f.o?<select name={'site_'+f.k} defaultValue={v('site_'+f.k,f.value)}><option value="">Not recorded</option>{f.o.map(o=><option key={o}>{o}</option>)}</select>:<input name={'site_'+f.k} type={f.t??'text'} min={f.t==='number'?0:undefined} defaultValue={v('site_'+f.k,f.value)} maxLength={500}/>}</label>)}</div>
  </section>
  <section className="panel"><h2>Job and schedule</h2>
   {locations.length>0&&<label className="field">Which building?<select name="location_id" defaultValue={v('location_id')}><option value="">Main property</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
   <label className="field">What is the problem?<textarea name="description" defaultValue={v('description')} required maxLength={2000} placeholder="Customer’s description of the issue"/></label>
   <label className="field">Exact work location on the property<input name="work_location" defaultValue={v('work_location')} maxLength={500} placeholder={trade==='septic'?'Where the tank lids are':'Which unit, room, or area'}/></label>
   <div className="grid"><label className="field">Date (schedule as far out as you need)<input name="date" type="date" defaultValue={v('date',today)} required/></label><label className="field">Arrival time<input name="time" type="time" defaultValue={v('time','08:00')} required/></label>
    <label className="field">Arrival window<select name="window" defaultValue={v('window','3')}>{WINDOWS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label className="field">Assign tech<select name="tech_id" defaultValue={v('tech_id')}><option value="">Unassigned</option>{techs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
   {state?.warning&&<p className="callout warn" role="alert"><strong>Double booking.</strong> {state.warning}</p>}
  </section>
  <section className="panel private"><h2>Private note for the tech</h2><p className="muted">Only your team sees this. It never goes on the invoice.</p>
   <label className="field">Note<textarea name="note" defaultValue={v('note')} maxLength={2000} placeholder="What the customer said on the phone, what to quote, anything to watch for"/></label>
   {state?.error&&<p className="error" role="alert">{state.error}</p>}
   <button className="primary" disabled={saving}>{saving?'Creating job…':state?.warning?'Create job anyway':'Create and schedule job'}</button>
  </section>
 </form>;
}
