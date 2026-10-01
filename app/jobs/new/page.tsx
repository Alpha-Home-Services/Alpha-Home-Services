import Link from 'next/link';import {officeSession} from '@/lib/auth';import {Nav} from '@/components/Nav';import {SITE,TRADE_NAMES} from '@/lib/fields';import {trades} from '@/lib/validation';import {JobForm} from '@/components/JobForm';import {todayIso} from '@/lib/jobs';
export const dynamic='force-dynamic';
const TERMS:Record<string,string>={due:'Due on receipt',net15:'Net 15',net30:'Net 30',net60:'Net 60'};
// Intake, like the prototype: pick the trade, then the customer (search or new), then the job details.
// Steps 1 and 2 are plain links and a search, so it works with thousands of customers and on a slow connection.
export default async function NewJob({searchParams}:{searchParams:Promise<{trade?:string;customer?:string;q?:string}>}){
 const {db,profile}=await officeSession();const sp=await searchParams;const trade=trades.find(t=>t===sp.trade);
 const q=(sp.q??'').replace(/[,()%*\\]/g,' ').trim().slice(0,80);const link=(p:Record<string,string|undefined>)=>'/jobs/new?'+new URLSearchParams(Object.entries({trade,...p}).filter(([,v])=>v) as [string,string][]).toString();
 const chosen=sp.customer&&sp.customer!=='new'?sp.customer:null;
 const [c,l,s,t,found]=await Promise.all([
  chosen?db.from('customers').select('id,name,type,phone,service_address,terms,access_notes,parent_id').eq('id',chosen).maybeSingle():null,
  chosen?db.from('locations').select('id,name').eq('customer_id',chosen).order('name'):null,
  chosen&&trade?db.from('site_details').select('details').eq('customer_id',chosen).eq('trade',trade).maybeSingle():null,
  trade&&sp.customer?db.from('profiles').select('id,display_name').eq('role','tech').order('display_name'):null,
  trade&&!sp.customer&&q?db.from('customers').select('id,name,phone,service_address,parent_id').or(`name.ilike.%${q}%,phone.ilike.%${q}%,service_address.ilike.%${q}%`).order('name').limit(20):null]);
 const customer=c?.data;const onFile=(s?.data?.details??{}) as Record<string,string>;
 return <><Nav name={profile.display_name} role={profile.role}/><h1>New job</h1><p>Customer intake. Pick the trade first to open its form.</p>
  <div className="chips" role="group" aria-label="Trade">{trades.map(k=><Link key={k} aria-pressed={k===trade} className={'button'+(k===trade?' primary':'')} href={'/jobs/new?'+new URLSearchParams(Object.entries({trade:k,customer:sp.customer}).filter(([,v])=>v) as [string,string][]).toString()}>{TRADE_NAMES[k]}</Link>)}</div>
  {trade&&<section className="panel"><h2>Customer</h2>
   {customer?<><p><strong>{customer.name}</strong>{customer.parent_id&&' (tenant sub-account)'}</p><dl><dt>Address</dt><dd>{customer.service_address||'—'}</dd><dt>Phone</dt><dd>{customer.phone||'—'}</dd><dt>Terms</dt><dd>{TERMS[customer.terms]??customer.terms}</dd>{customer.access_notes&&<><dt>Access notes</dt><dd>{customer.access_notes}</dd></>}</dl><Link className="button" href={link({})}>Change customer</Link></>
   :sp.customer==='new'?<><p>Adding a new customer with this job.</p><Link className="button" href={link({})}>Choose an existing customer instead</Link></>
   :chosen?<p className="error" role="alert">That customer wasn’t found. <Link href={link({})}>Search again</Link>.</p>
   :<><form className="search" action="/jobs/new"><input type="hidden" name="trade" value={trade}/><label className="field">Find an existing customer<input name="q" type="search" defaultValue={q} placeholder="Name, phone or address" maxLength={80}/></label><button>Search</button></form>
     {q&&<>{(found?.data??[]).map(x=><Link className="record" key={x.id} href={link({customer:x.id})}><strong>{x.name}</strong><span>{[x.phone,x.service_address,x.parent_id&&'Tenant sub-account'].filter(Boolean).join(' · ')}</span></Link>)}{!(found?.data??[]).length&&<p className="empty">No customers match “{q}”.</p>}</>}
     <Link className="button primary" href={link({customer:'new'})}>New customer</Link></>}
  </section>}
  {trade&&(customer||sp.customer==='new')&&<JobForm key={trade+(customer?.id??'new')} trade={trade} tradeName={TRADE_NAMES[trade]} customerId={customer?.id??null} locations={l?.data??[]} site={SITE[trade].map(f=>({...f,value:onFile[f.k]??''}))} techs={(t?.data??[]).map(x=>({id:x.id,name:x.display_name}))} today={todayIso()}/>}
 </>;
}
