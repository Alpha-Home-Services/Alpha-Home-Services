import Link from 'next/link';import {notFound} from 'next/navigation';import {z} from 'zod';import {session} from '@/lib/auth';import {Nav} from '@/components/Nav';import {TRADE_NAMES} from '@/lib/fields';import {JOB_STATUS,windowText,longDate,jobNumber} from '@/lib/jobs';
export const dynamic='force-dynamic';
// Read-only for now. The tech job page (status, checklists, tasks, materials, summary) builds on this next.
export default async function Job({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{created?:string}>}){
 const {id}=await params;const sp=await searchParams;const {db,profile}=await session();if(!z.uuid().safeParse(id).success)notFound();
 const {data:j}=await db.from('jobs').select('*').eq('id',id).maybeSingle();if(!j)notFound();
 // The customer may no longer be visible to a tech once the job is invoiced; the job itself still shows.
 const [c,l,n,p]=await Promise.all([db.from('customers').select('id,name,phone,service_address,access_notes').eq('id',j.customer_id).maybeSingle(),j.location_id?db.from('locations').select('name,address').eq('id',j.location_id).maybeSingle():null,db.from('job_notes').select('body,by_user,created_at').eq('job_id',id).order('created_at'),db.from('profiles').select('id,display_name')]);
 const who=new Map((p.data??[]).map(x=>[x.id,x.display_name]));const customer=c.data;const building=l?.data;
 return <><Nav name={profile.display_name} role={profile.role}/>
  {sp.created&&<p className="success" role="status">Job {jobNumber(j.number)} scheduled for {longDate(j.scheduled_date)}.</p>}
  <span className="pill">{JOB_STATUS[j.status]}</span> <span className="pill">{TRADE_NAMES[j.trade]}</span>
  <h1>{jobNumber(j.number)} · {customer?.name??'Customer'}{building?', '+building.name:''}</h1>
  <p>{longDate(j.scheduled_date)}, arrive {windowText(j.arrival_time,j.window_hours)} · {j.tech_id?who.get(j.tech_id)??'Tech':'Unassigned'}</p>
  <section className="panel"><h2>The problem</h2><p>{j.description}</p>{j.work_location&&<><h3>Work location on the property</h3><p>{j.work_location}</p></>}</section>
  <section className="panel"><h2>Customer</h2>{customer?<><dl><dt>Address</dt><dd>{building?.address||customer.service_address||'—'}</dd><dt>Phone</dt><dd>{customer.phone||'—'}</dd>{customer.access_notes&&<><dt>Access notes</dt><dd>{customer.access_notes}</dd></>}</dl><Link className="button" href={'/customers/'+customer.id}>Open customer</Link></>:<p className="muted">Customer details are no longer available to you for this job.</p>}</section>
  <section className="panel private"><h2>Private notes</h2><p className="muted">Only your team sees these. They never go on the invoice.</p>
   {(n.data??[]).map((x,i)=><div className="record" key={i}><span>{x.body}</span><span className="muted">{who.get(x.by_user??'')??'Unknown user'} · {new Date(x.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Phoenix'})}</span></div>)}
   {!(n.data??[]).length&&<p className="empty">No notes.</p>}</section>
  <Link className="button" href="/jobs">All jobs</Link>
 </>;
}
