import Link from 'next/link';import {logout} from '@/app/actions';
export function Nav({name,role}:{name:string;role:string}){return <nav><Link href="/">Customers</Link><span>{name} · {role}</span><form action={logout}><button>Sign out</button></form></nav>}
