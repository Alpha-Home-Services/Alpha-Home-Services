'use client';
import {useState} from 'react';import {savePriceTask} from '@/app/actions';import {priceBreakdown,margin,marginLevel,money,type PricingSettings} from '@/lib/pricing';
export type PriceTask={id:string;trade:string;name:string;includes:string;mode:'formula'|'custom';price:number;hours:number;parts:number};
// Add or edit a price book task, with the formula price and margin worked out as you type (like the prototype).
export function PriceTaskForm({trade,settings,task}:{trade:string;settings:PricingSettings;task?:PriceTask}){
 const [hours,setHours]=useState(String(task?.hours??''));const [parts,setParts]=useState(String(task?.parts??''));
 const [mode,setMode]=useState<'formula'|'custom'>(task?.mode??'formula');const [custom,setCustom]=useState(task?.mode==='custom'?String(task.price):'');
 const h=Number(hours)||0,p=Number(parts)||0,b=priceBreakdown(h,p,settings),price=mode==='formula'?b.price:Number(custom)||0,m=margin(price,h,p,settings),level=marginLevel(m,settings);
 return <form action={savePriceTask}><input type="hidden" name="id" value={task?.id??''}/><input type="hidden" name="trade" value={trade}/>
  <label className="field">Task name<input name="name" defaultValue={task?.name} required maxLength={160}/></label>
  <label className="field">What’s included (shows on the invoice)<input name="includes" defaultValue={task?.includes} maxLength={500}/></label>
  <div className="grid"><label className="field">Parts cost ($)<input name="parts" type="number" inputMode="decimal" step="0.01" min="0" value={parts} onChange={e=>setParts(e.target.value)} required/></label><label className="field">Labor hours<input name="hours" type="number" inputMode="decimal" step="0.25" min="0" max="100" value={hours} onChange={e=>setHours(e.target.value)} required/></label></div>
  <p className="callout" aria-live="polite"><strong>Formula price {money(b.price)}</strong><br/>Labor {h} hr × {money(settings.labor_rate)} = {money(b.labor,2)}<br/>Parts {money(p,2)} + {settings.parts_markup}% markup = {money(b.markedUp,2)}{settings.card_cover>0&&<><br/>Card fee coverage ({settings.card_cover}%) = {money(b.cardCover,2)}</>}<br/><span className="muted">Your cost is {money(p+h*settings.tech_cost,2)} (parts plus {h} hr at {money(settings.tech_cost)} tech cost), so {mode==='formula'?'this':'your custom'} price leaves a <strong>{Math.round(m*100)}%</strong> margin{level!=='good'?`, under your ${settings.target_margin}% target`:''}.</span></p>
  <fieldset className="field"><legend>Price</legend><label className="choice"><input type="radio" name="mode" value="formula" checked={mode==='formula'} onChange={()=>setMode('formula')}/> Use the {money(settings.labor_rate)}/hr formula ({money(b.price)})</label><label className="choice"><input type="radio" name="mode" value="custom" checked={mode==='custom'} onChange={()=>setMode('custom')}/> Set a custom price</label></fieldset>
  {mode==='custom'&&<label className="field">Custom price ($)<input name="custom_price" type="number" inputMode="decimal" step="0.01" min="0" value={custom} onChange={e=>setCustom(e.target.value)} required/></label>}
  {mode==='formula'&&<input type="hidden" name="custom_price" value=""/>}
  <button className="primary">Save task</button></form>;
}
