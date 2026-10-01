import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
// A throwaway Postgres in memory with the Supabase pieces the migrations expect (roles, auth.uid(), a storage stand-in),
// then every migration in order and the fictional seed. No real database is touched.
export const MIGRATIONS=['202609300001_foundation.sql','202610010001_equipment_editing_photos.sql','202610020001_hcp_import.sql','202610030001_price_book.sql'];
export async function testDatabase(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 // Minimal stand-in for Supabase Storage, which PGlite doesn't have. Supabase itself enables row level security on storage.objects.
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 for(const [i,file] of MIGRATIONS.entries()){await db.exec(await readFile('supabase/migrations/'+file,'utf8'));if(i===0)await db.exec(await readFile('supabase/seed.sql','utf8'));}
 // Runs one statement as a signed-in user, with the same row level security the app gets.
 async function asUser(id:string,sql:string){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);return db.query(sql);}
 return {db,asUser};
}
