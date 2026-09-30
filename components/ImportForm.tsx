'use client';
import {useActionState} from 'react';import {previewImport,runImport,type ImportPreview} from '@/app/actions';import {HCP_NOT_IMPORTED} from '@/lib/hcp';
const SHOWN=100;
export function ImportForm(){
 const [state,preview,reading]=useActionState<ImportPreview,FormData>(previewImport,null);
 const plan=state&&'plan' in state?state.plan:null;
 const count=plan?.customers.length??0;const subs=plan?.customers.filter(c=>c.bill_to==='parent').length??0;const buildings=plan?.customers.reduce((n,c)=>n+c.locations.length,0)??0;
 return <>
  <form action={preview} className="panel"><label className="field">Housecall Pro customer export (CSV)<input name="file" type="file" accept=".csv,text/csv" required/></label><button className="primary" disabled={reading}>{reading?'Reading file…':'Preview import'}</button></form>
  {state&&'error' in state&&<p className="error" role="alert">{state.error}</p>}
  {plan&&<>
   <section className="panel" role="status"><h2>Preview</h2>
    <p><strong>{count} {count===1?'customer':'customers'}</strong> will be added{subs?`, including ${subs} tenant ${subs===1?'sub-account':'sub-accounts'} billed to a parent`:''}{buildings?`, with ${buildings} extra ${buildings===1?'building':'buildings'}`:''}.{plan.skipped.length?` ${plan.skipped.length} ${plan.skipped.length===1?'row':'rows'} will be skipped.`:''} Nothing is saved until you confirm.</p>
    <p className="muted">Payment terms start as Due on receipt. Not brought over from Housecall Pro: {HCP_NOT_IMPORTED.join(', ')}. Extra phones, extra emails and address notes go in access notes.</p>
    {count>0&&<form action={runImport}><input type="hidden" name="csv" value={state&&'csv' in state?state.csv:''}/><button className="primary">Import {count} {count===1?'customer':'customers'}</button></form>}
   </section>
   {!!plan.warnings.length&&<section className="panel"><h2>Check these ({plan.warnings.length})</h2><ul>{plan.warnings.map((w,i)=><li key={i}>Row {w.line}: {w.message}</li>)}</ul></section>}
   {!!plan.skipped.length&&<section className="panel"><h2>Skipped ({plan.skipped.length})</h2><ul>{plan.skipped.map((w,i)=><li key={i}>Row {w.line}: {w.message}</li>)}</ul></section>}
   {count>0&&<section className="panel"><h2>Customers to add</h2><div className="tablewrap"><table><thead><tr><th>Row</th><th>Name</th><th>Type</th><th>Phone</th><th>Email</th><th>Service address</th><th>Bills to</th><th>Buildings</th></tr></thead><tbody>{plan.customers.slice(0,SHOWN).map(c=><tr key={c.ref}><td>{c.line}</td><td>{c.name}{c.do_not_service&&<> <span className="pill">Do not service</span></>}</td><td>{c.type}</td><td>{c.phone||'—'}</td><td>{c.email||'—'}</td><td>{c.service_address||'—'}</td><td>{c.bill_to==='parent'?c.parent_name:'Self'}</td><td>{c.locations.length?c.locations.map(l=>l.address).join('; '):'—'}</td></tr>)}</tbody></table></div>{count>SHOWN&&<p className="muted">Showing the first {SHOWN}. All {count} will be imported.</p>}</section>}
  </>}
 </>;
}
