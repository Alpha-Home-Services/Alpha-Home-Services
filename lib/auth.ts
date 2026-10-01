import 'server-only';
import { redirect } from 'next/navigation';
import { configured } from './config';
import { database } from './supabase';
export type Role = 'admin'|'office'|'tech';
export async function session() {
 if(!configured()) redirect('/setup');
 const db=await database();const {data:{user}}=await db.auth.getUser();
 if(!user) redirect('/login');
 const {data:profile,error}=await db.from('profiles').select('id,display_name,role').eq('id',user.id).single();
 if(error||!profile) redirect('/login?error=access');
 return {db,user,profile:profile as {id:string;display_name:string;role:Role}};
}
export async function officeSession(){const s=await session();if(s.profile.role==='tech') redirect('/denied?reason=office');return s;}
export async function adminSession(){const s=await session();if(s.profile.role!=='admin') redirect(s.profile.role==='tech'?'/denied?reason=office':'/denied?reason=admin');return s;}
