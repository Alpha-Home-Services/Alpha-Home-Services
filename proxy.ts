import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configured, connection } from './lib/config';
export async function proxy(request: NextRequest) {
 let response = NextResponse.next({request});
 response.headers.set('Cache-Control','private, no-store');
 if (!configured()) return response;
 const {url,key}=connection();
 const db=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));response.headers.set('Cache-Control','private, no-store');}}});
 await db.auth.getUser();
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
