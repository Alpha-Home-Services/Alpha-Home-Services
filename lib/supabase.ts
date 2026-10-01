import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connection } from './config';
export async function database() {
 const jar = await cookies(); const {url,key} = connection();
 return createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll(items){try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Server Component: proxy refreshes cookies. */}}}});
}
