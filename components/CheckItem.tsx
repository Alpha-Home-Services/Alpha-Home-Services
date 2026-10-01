'use client';
import {useRef} from 'react';import {setChecklistItem} from '@/app/actions';
// A checklist line that saves as soon as it's tapped. Big tap target for gloves.
export function CheckItem({jobId,index,label,done,locked}:{jobId:string;index:number;label:string;done:boolean;locked:boolean}){
 const form=useRef<HTMLFormElement>(null);
 return <form ref={form} action={setChecklistItem} className={'check'+(done?' done':'')}><input type="hidden" name="job_id" value={jobId}/><input type="hidden" name="index" value={index}/><input type="hidden" name="done" value={done?'0':'1'}/>
  <label><input type="checkbox" defaultChecked={done} disabled={locked} onChange={()=>form.current?.requestSubmit()}/><span>{label}</span></label></form>;
}
