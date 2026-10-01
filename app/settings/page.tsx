import Link from 'next/link';import {adminSession} from '@/lib/auth';import {Nav} from '@/components/Nav';import {savePricingSettings} from '@/app/actions';
export const dynamic='force-dynamic';
const FIELDS=[['labor_rate','Labor rate per hour ($)','0.01'],['parts_markup','Parts markup (%)','0.01'],['card_cover','Cover card processing (%)','0.01'],['tech_cost','Average tech cost per hour ($)','0.01'],['target_margin','Target margin (%)','1']] as const;
export default async function Settings({searchParams}:{searchParams:Promise<{repriced?:string;error?:string}>}){
 const {db,profile}=await adminSession();const sp=await searchParams;
 const [s,b]=await Promise.all([db.from('pricing_settings').select('*').single(),db.from('price_book').select('mode')]);
 const nav=<Nav name={profile.display_name} role={profile.role}/>;
 if(s.error||b.error)return <>{nav}<h1>Pricing settings</h1><p className="error" role="alert">Pricing isn’t set up in this database yet. Apply <code>supabase/migrations/202610030001_price_book.sql</code> to the test project.</p></>;
 const formula=(b.data??[]).filter(x=>x.mode==='formula').length,custom=(b.data??[]).length-formula;
 return <>{nav}<h1>Pricing settings</h1>
  {sp.repriced&&<p className="success" role="status">Saved. {Number(sp.repriced)} formula {Number(sp.repriced)===1?'price was':'prices were'} recalculated. <Link href="/price-book">See the price book</Link>.</p>}
  {sp.error&&<p className="error" role="alert">That didn’t save. Card coverage must be under 10% and the labor rate above $0.</p>}
  <form action={savePricingSettings} className="panel"><h2>Flat-rate pricing</h2>
   <p>Price = (labor hours × labor rate + parts cost with markup), then raised so the card processing percentage of it is covered. Set card coverage to 0 to turn it off.</p>
   <div className="grid">{FIELDS.map(([k,label,step])=><label className="field" key={k}>{label}<input name={k} type="number" inputMode="decimal" step={step} min="0" max={k==='card_cover'?9.99:k==='target_margin'?100:undefined} defaultValue={Number(s.data[k])} required/></label>)}</div>
   <p className="muted">Average tech cost and target margin only affect the margin badge in the price book, which office and admin see. They don’t change prices. Real per-tech pay rates come with the time clock.</p>
   <p><strong>Saving recalculates {formula} formula {formula===1?'price':'prices'}.</strong> {custom} custom {custom===1?'price stays':'prices stay'} as {custom===1?'it is':'they are'}. Jobs already quoted will keep their price.</p>
   <button className="primary">Save pricing settings</button></form></>;
}
