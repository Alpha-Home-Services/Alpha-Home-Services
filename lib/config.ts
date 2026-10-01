export function configured() {
 return process.env.ALPHA_ENVIRONMENT === 'test' && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}
export function connection() {
 if (!configured()) throw new Error('Configure a separate test database before signing in.');
 return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! };
}
