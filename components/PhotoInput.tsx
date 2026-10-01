'use client';
import {useState} from 'react';
// Shrinks the photo on the device before upload (like the prototype) so it sends quickly on weak signal.
// If shrinking fails, the original file is sent and the server still checks it.
const MAX_SIDE=1600;
async function shrink(file:File){const img=await createImageBitmap(file);const k=Math.min(1,MAX_SIDE/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*k);canvas.height=Math.round(img.height*k);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);img.close();const blob=await new Promise<Blob|null>(done=>canvas.toBlob(done,'image/jpeg',0.8));return blob?new File([blob],'data-plate.jpg',{type:'image/jpeg'}):file;}
export function PhotoInput({current}:{current?:string|null}){
 const [preview,setPreview]=useState(current??'');const [busy,setBusy]=useState(false);
 async function pick(e:React.ChangeEvent<HTMLInputElement>){const input=e.currentTarget;const file=input.files?.[0];if(!file)return;setBusy(true);try{const small=await shrink(file);const list=new DataTransfer();list.items.add(small);input.files=list.files;setPreview(URL.createObjectURL(small));}catch{setPreview(URL.createObjectURL(file));}finally{setBusy(false);}}
 return <div className="field">Data plate photo<div className="eqphoto">{preview?<img src={preview} alt="Data plate photo"/>:<span className="eqph">No photo yet</span>}<label className="button">{busy?'Preparing photo…':preview?'Retake photo':'Take or upload photo'}<input className="sr" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pick}/></label></div></div>;
}
