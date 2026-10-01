'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';

export function Nav({name, role}: {name: string; role: string}) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout', {method: 'POST'});
    router.push('/login');
  };

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: '#2c5282',
        color: 'white',
        borderBottom: '3px solid #1a3a5c'
      }}
    >
      <div style={{display: 'flex', gap: '2rem', alignItems: 'center'}}>
        <Link href="/" style={{color: 'white', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem'}}>
          Alpha Home Services
        </Link>

        <div style={{display: 'flex', gap: '1.5rem', alignItems: 'center'}}>
          <Link href="/customers" style={{color: 'white', textDecoration: 'none'}}>
            Customers
          </Link>
          <Link href="/jobs" style={{color: 'white', textDecoration: 'none'}}>
            Jobs
          </Link>

          {role !== 'tech' && (
            <>
              <Link href="/price-book" style={{color: 'white', textDecoration: 'none'}}>
                Price Book
              </Link>
              <Link href="/inventory" style={{color: 'white', textDecoration: 'none'}}>
                Inventory
              </Link>
              <Link href="/invoices" style={{color: 'white', textDecoration: 'none'}}>
                Invoices
              </Link>
            </>
          )}

          {role === 'admin' && (
            <Link href="/settings" style={{color: 'white', textDecoration: 'none'}}>
              Settings
            </Link>
          )}
        </div>
      </div>

      <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
        <span style={{fontSize: '0.9rem'}}>{name}</span>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#d9534f',
            color: 'white',
            border: