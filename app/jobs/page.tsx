import Link from 'next/link';import {session} from '@/lib/auth';import {Nav} from '@/components/Nav';import {TRADE_NAMES} from '@/lib/fields';import {JOB_STATUS,windowText,longDate,jobNumber,todayIso} from '@/lib/jobs';
export const dynamic='force-dynamic';
type Job={id:string;number:number;customer_id:string;location_id:string|null;trade:string;tech_id:string|null;scheduled_date:string;arrival_time:string;window_hours:number;status:string;description:string};
// A simple list until the scheduling board (Phase 3). Office sees every job; a tech sees their own.
export default async function Jobs(){
 const {db,profile}=await session();const office=profile.role!=='tech';const today=todayIso();
 const since=new Date(Date.parse(today+'T12:00:00Z')-30*864e5).toISOString().slice(0,10);
 const {data,error}=await db.from('jobs').select('id,number,customer_id,location_id,trade,tech_id,scheduled_date,arrival_time,window_hours,status,description').gte('scheduled_date',since).order('scheduled_date').order('arrival_time');
 const nav=<Nav name={profile.display_name} role={profile.role}/>;
 if(error)return <>{nav}<h1>Jobs</h1><p className="error" role="alert">Jobs aren’t set up in this database yet. Apply <code>supabase/migrations/202610050001_jobs.sql</code> to the test project.</p></>;
 const jobs=(data??[]) as Job[];
 const [c,l,p]=await Promise.all([db.from('customers').select('id,name').in('id',[...new Set(jobs.map(j=>j.customer_id))]),db.from('locations').select('id,name').in('id',[...new Set(jobs.map(j=>j.location_id).filter(Boolean))] as string[]),db.from('profiles').select('id,display_name')]);
 const name=new Map([...(c.data??[]),...(l.data??[])].map(x=>[x.id,x.name]));const tech=new Map((p.data??[]).map(x=>[x.id,x.display_name]));
 const groups:[string,Job[]][]=[['Today',jobs.filter(j=>j.scheduled_date===today)],['Upcoming',jobs.filter(j=>j.scheduled_date>today)],['Past 30 days',jobs.filter(j=>j.scheduled_date<today).reverse()]];
 return <>{nav}<h1>Jobs</h1><p>{office?'Every job, by date. The scheduling board comes in Phase 3.':'Jobs assigned to you, by date.'}</p>
  {office&&<Link className="button primary" href="/jobs/new">New job</Link>}
  {groups.map(([title,list])=><section className="panel" key={title}><h2>{title}</h2>
   {list.map(j=><Link className="record" key={j.id} href={'/jobs/'+j.id}><strong>{jobNumber(j.number)} · {name.get(j.customer_id)??'Customer'}{j.location_id&&name.get(j.location_id)?', '+name.get(j.location_id):''}</strong><span>{title==='Today'?'':longDate(j.scheduled_date)+', '}{windowText(j.arrival_time,j.window_hours)} · {TRADE_NAMES[j.trade]} · {j.tech_id?tech.get(j.tech_id)??'Tech':'Unassigned'}</span><span>{j.description}</span><span><span className="pill">{JOB_STATUS[j.status]}</span></span></Link>)}
   {!list.length&&<p className="empty">No jobs.</p>}
  </section>)}
 </>;
}
