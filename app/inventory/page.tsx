import Link from 'next/link';import {session} from '@/lib/auth';import {Nav} from '@/components/Nav';import {TRADE_NAMES} from '@/lib/fields';import {trades,STOCK_REASONS} from '@/lib/validation';import {saveInventoryItem,receiveStock,correctStock,deleteInventoryItem} from '@/app/actions';import {money} from '@/lib/pricing';
export const dynamic='force-dynamic';
type Item={id:string;trade:string;name:string;sku:string;location:string;on_hand:number;reorder_at:number};
type Move={item_id:string|null;kind:string;change:number;on_hand_after:number;reason:string;by_user:string|null;created_at:string};
const KIND:Record<string,string>={added:'Added',received:'Received',correction:'Count correction',deleted:'Deleted',used:'Used on job',returned:'Returned from job'};
const VIEWS=['all','low',...trades] as const;
const STATUS:Record<string,string>={saved:'Part saved.',deleted:'Part deleted.',corrected:'Count corrected.'};
const ERRORS:Record<string,string>={qty:'Enter how many were received (at least 1).',correction:'Enter the counted number and pick a reason.',invalid:'Check the part details and try again.'};
const when=(iso:string)=>new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export default async function Inventory({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {db,profile}=await session();const sp=await searchParams;const office=profile.role!=='tech';
 const view=VIEWS.find(v=>v===sp.view)??'all';const q=(sp.q??'').trim().slice(0,100);const keep=new URLSearchParams({...(view!=='all'?{view}:{}),...(q?{q}:{})}).toString();
 // Techs can read parts and counts only; cost and history are office/admin only (enforced by the database too).
 const [i,c,m,p]=await Promise.all([db.from('inventory_items').select('id,trade,name,sku,location,on_hand,reorder_at').order('name'),office?db.from('inventory_costs').select('item_id,unit_cost'):null,office?db.from('inventory_moves').select('item_id,kind,change,on_hand_after,reason,by_user,created_at').order('created_at',{ascending:false}).limit(500):null,office?db.from('profiles').select('id,display_name'):null]);
 const nav=<Nav name={profile.display_name} role={profile.role}/>;
 if(i.error||c?.error||m?.error)return <>{nav}<h1>Inventory</h1><p className="error" role="alert">Inventory isn’t set up in this database yet. Apply <code>supabase/migrations/202610040001_inventory.sql</code> to the test project.</p></>;
 const items=(i.data??[]) as Item[];const cost=new Map((c?.data??[]).map(x=>[x.item_id,Number(x.unit_cost)]));const moves=(m?.data??[]) as Move[];
 const names=new Map((p?.data??[]).map(x=>[x.id,x.display_name]));
 const low=(x:Item)=>x.on_hand<=x.reorder_at;const lowCount=items.filter(low).length;const value=items.reduce((s,x)=>s+x.on_hand*(cost.get(x.id)??0),0);
 const shown=items.filter(x=>(view==='all'||(view==='low'?low(x):x.trade===view))&&(!q||[x.name,x.sku,x.location].join(' ').toLowerCase().includes(q.toLowerCase())));
 const status=sp.error?null:sp.received?`Received ${Number(sp.received)}. ${Number(sp.now)} on hand.`:Object.keys(STATUS).map(k=>sp[k]&&STATUS[k]).find(Boolean);
 const href=(v:string)=>'/inventory?'+new URLSearchParams({...(v!=='all'?{view:v}:{}),...(q?{q}:{})}).toString();
 const hidden=(id?:string)=><>{id&&<input type="hidden" name="id" value={id}/>}<input type="hidden" name="back" value={keep}/></>;
 const details=(x?:Item)=><>{hidden(x?.id)}<label className="field">Part name<input name="name" defaultValue={x?.name} required maxLength={160}/></label><div className="grid"><label className="field">SKU or part number<input name="sku" defaultValue={x?.sku} maxLength={80}/></label><label className="field">Trade<select name="trade" defaultValue={x?.trade??(trades.find(t=>t===view)??'hvac')}>{trades.map(t=><option key={t} value={t}>{TRADE_NAMES[t]}</option>)}</select></label><label className="field">Your cost each ($)<input name="unit_cost" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={x?cost.get(x.id)??0:''} required/></label><label className="field">Location<input name="location" defaultValue={x?.location} maxLength={160} placeholder="Warehouse shelf or truck"/></label>{!x&&<label className="field">On hand now<input name="on_hand" type="number" inputMode="numeric" step="1" min="0" defaultValue={0} required/></label>}<label className="field">Reorder at<input name="reorder_at" type="number" inputMode="numeric" step="1" min="0" defaultValue={x?.reorder_at??2} required/></label></div></>;
 return <>{nav}<h1>Inventory</h1>
  <p>{office?'Parts used on a job will come out of stock automatically and show on that customer’s invoice.':'Parts in stock and where to find them. Ask the office to reorder anything that’s low or out.'}</p>
  {status&&<p className="success" role="status">{status}</p>}{sp.error&&<p className="error" role="alert">{ERRORS[sp.error]??'That didn’t save. Try again.'}</p>}
  <section className="panel"><dl className="stats">{office&&<div><dt>Stock value</dt><dd>{money(value)}</dd></div>}<div><dt>Parts tracked</dt><dd>{items.length}</dd></div><div><dt>At or below reorder</dt><dd className={lowCount?'neg':''}>{lowCount}</dd></div></dl></section>
  <div className="chips">{VIEWS.map(v=><Link key={v} aria-current={v===view?'page':undefined} className={'button'+(v===view?' primary':'')} href={href(v)}>{v==='all'?'All':v==='low'?'Needs reorder':TRADE_NAMES[v]}</Link>)}</div>
  <form className="search" action="/inventory">{view!=='all'&&<input type="hidden" name="view" value={view}/>}<label className="field">Search inventory<input name="q" type="search" defaultValue={q} placeholder="Part, SKU or location" maxLength={100}/></label><button>Search</button></form>
  <section className="panel">
   {shown.map(x=>{const hist=moves.filter(h=>h.item_id===x.id).slice(0,10);const head=<><span><strong>{x.name}</strong><span>{[x.sku,x.location].filter(Boolean).join(' · ')}</span><span>{TRADE_NAMES[x.trade]}{office&&<> · {money(cost.get(x.id)??0,2)} each</>}</span></span><span className="pricecol"><strong className="price">{x.on_hand}</strong><span>on hand</span>{x.on_hand<=0?<span className="pill low">Out</span>:low(x)?<span className="pill close">Reorder</span>:null}</span></>;
    if(!office)return <div className="record stock" key={x.id}>{head}</div>;
    return <details className="record" key={x.id}><summary>{head}</summary>
     <form action={receiveStock} className="inline">{hidden(x.id)}<label className="field">Received stock<input name="qty" type="number" inputMode="numeric" step="1" min="1" placeholder="Quantity received" required/></label><button className="primary">Add to stock</button></form>
     <details><summary>Correct the count</summary><form action={correctStock}>{hidden(x.id)}<div className="grid"><label className="field">Counted on hand<input name="counted" type="number" inputMode="numeric" step="1" min="0" defaultValue={x.on_hand} required/></label><label className="field">Reason<select name="reason" required>{STOCK_REASONS.map(r=><option key={r}>{r}</option>)}</select></label></div><label className="field">Note (optional)<input name="note" maxLength={400}/></label><button className="primary">Save count</button></form></details>
     <details><summary>Edit part</summary><form action={saveInventoryItem}>{details(x)}<button className="primary">Save part</button></form></details>
     <details><summary>Stock history</summary>{hist.length?<ul className="history">{hist.map((h,n)=><li key={n}><strong>{KIND[h.kind]??h.kind} {h.change>0?'+':''}{h.change}</strong> → {h.on_hand_after} on hand{h.reason&&<> · {h.reason}</>}<br/><span className="muted">{when(h.created_at)}{h.by_user&&<> · {names.get(h.by_user)??'Unknown user'}</>}</span></li>)}</ul>:<p className="empty">No changes recorded yet.</p>}</details>
     <details><summary>Delete part</summary><form action={deleteInventoryItem}>{hidden(x.id)}<p>This removes {x.name} from inventory. Its stock history is kept.</p><button className="danger">Yes, delete this part</button></form></details>
    </details>})}
   {!shown.length&&<p className="empty">No parts match.</p>}
   {office&&<details><summary>Add part</summary><form action={saveInventoryItem}>{details()}<button className="primary">Save part</button></form></details>}
  </section></>;
}
