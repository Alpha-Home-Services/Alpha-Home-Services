import Link from 'next/link';import {session} from '@/lib/auth';import {Nav} from '@/components/Nav';import {TRADE_NAMES} from '@/lib/fields';import {trades} from '@/lib/validation';import {deletePriceTask} from '@/app/actions';import {PriceTaskForm,type PriceTask} from '@/components/PriceTaskForm';import {priceBreakdown,margin,marginLevel,money,type PricingSettings} from '@/lib/pricing';
export const dynamic='force-dynamic';
const STATUS:Record<string,[string,string]>={saved:['success','Task saved.'],deleted:['success','Task deleted.'],error:['error','That didn’t save. Check the fields and try again.']};
export default async function PriceBook({searchParams}:{searchParams:Promise<{trade?:string;saved?:string;deleted?:string;error?:string}>}){
 const {db,profile}=await session();const sp=await searchParams;const trade=trades.find(t=>t===sp.trade)??'hvac';const office=profile.role!=='tech';
 // Techs can only read names, what's included and prices; hours, parts cost and settings are office/admin only (enforced by the database too).
 const [b,c,s]=await Promise.all([db.from('price_book').select('id,trade,name,includes,mode,price').order('name'),office?db.from('price_book_costs').select('task_id,hours,parts'):null,office?db.from('pricing_settings').select('*').single():null]);
 const nav=<Nav name={profile.display_name} role={profile.role}/>;
 if(b.error||c?.error||s?.error)return <>{nav}<h1>Price book</h1><p className="error" role="alert">The price book isn’t set up in this database yet. Apply <code>supabase/migrations/202610030001_price_book.sql</code> to the test project.</p></>;
 const costs=new Map((c?.data??[]).map(x=>[x.task_id,{hours:Number(x.hours),parts:Number(x.parts)}]));
 const settings=s?.data?Object.fromEntries(Object.entries(s.data).map(([k,v])=>[k,Number(v)])) as unknown as PricingSettings:null;
 const all=(b.data??[]).map(t=>({...t,price:Number(t.price),...(costs.get(t.id)??{hours:0,parts:0})})) as PriceTask[];const items=all.filter(t=>t.trade===trade);
 const status=sp.error?STATUS.error:sp.deleted?STATUS.deleted:sp.saved?STATUS.saved:null;
 return <>{nav}<h1>Price book</h1>
  {settings?<p>Every flat-rate price is labor hours at <strong>{money(settings.labor_rate)}/hr</strong> plus parts marked up {settings.parts_markup}%, with {settings.card_cover}% added to cover card processing. Customers see one price, no card fee.{profile.role==='admin'?<> Change these in <Link href="/settings">Pricing settings</Link> and every formula price updates.</>:' Only the owner can change these.'}</p>:<p>Flat-rate prices. Customers see one price; no card fee is added at payment.</p>}
  {status&&<p className={status[0]} role={status[0]==='error'?'alert':'status'}>{status[1]}</p>}
  <div className="chips" role="tablist" aria-label="Trade">{trades.map(t=><Link key={t} role="tab" aria-selected={t===trade} className={'button'+(t===trade?' primary':'')} href={'/price-book?trade='+t}>{TRADE_NAMES[t]} <span className="muted">{all.filter(x=>x.trade===t).length}</span></Link>)}</div>
  <section className="panel"><h2>{TRADE_NAMES[trade]} tasks</h2>
   {items.map(t=>{const m=settings?margin(t.price,t.hours,t.parts,settings):0;return <details className="record" key={t.id}><summary><span><strong>{t.name}</strong><span>{t.includes}</span></span><span className="pricecol"><strong className="price">{money(t.price,t.price%1?2:0)}</strong>{t.mode==='custom'&&<span className="pill">Custom price</span>}{settings&&<span className={'pill '+marginLevel(m,settings)}>{Math.round(m*100)}% margin</span>}</span></summary>
    {settings&&<><p className="muted">Labor {t.hours} hr × {money(settings.labor_rate)} = {money(priceBreakdown(t.hours,t.parts,settings).labor,2)}, parts {money(t.parts,2)} + {settings.parts_markup}% = {money(priceBreakdown(t.hours,t.parts,settings).markedUp,2)}{settings.card_cover>0?`, + ${settings.card_cover}% card coverage`:''}.</p>
     <details><summary>Edit task</summary><PriceTaskForm trade={trade} settings={settings} task={t}/><details><summary>Delete task</summary><form action={deletePriceTask}><input type="hidden" name="id" value={t.id}/><input type="hidden" name="trade" value={trade}/><p>This removes {t.name} from the price book.</p><button className="danger">Yes, delete this task</button></form></details></details></>}
   </details>})}
   {!items.length&&<p className="empty">No {TRADE_NAMES[trade]} tasks yet.</p>}
   {settings&&<details><summary>Add {TRADE_NAMES[trade]} task</summary><PriceTaskForm trade={trade} settings={settings}/></details>}
  </section></>;
}
