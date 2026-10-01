import {z} from 'zod';import {configured} from '@/lib/config';import {database} from '@/lib/supabase';import {PHOTO_BUCKET} from '@/lib/fields';
// Data plate photos are only ever served through here, never by a shareable storage link, so every view checks the
// signed-in user. The database and storage rules decide access: a photo for a customer this user can't see is "not found".
const TYPES:Record<string,string>={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const HEADERS={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'};
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!configured()||!z.uuid().safeParse(id).success)return new Response('Not found',{status:404,headers:HEADERS});
 const db=await database();const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Sign in required',{status:401,headers:HEADERS});
 const {data:eq}=await db.from('equipment').select('photo_path').eq('id',id).single();if(!eq?.photo_path)return new Response('Not found',{status:404,headers:HEADERS});
 const {data:file,error}=await db.storage.from(PHOTO_BUCKET).download(eq.photo_path);if(error||!file)return new Response('Not found',{status:404,headers:HEADERS});
 return new Response(file,{headers:{...HEADERS,'Content-Type':TYPES[eq.photo_path.split('.').pop()??'']??'application/octet-stream'}});
}
