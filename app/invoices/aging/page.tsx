import Link from 'next/link';
import {session} from '@/lib/auth';
import {Nav} from '@/components/Nav';
import {money} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function AgingPage() {
  const {db, profile} = await session();

  if (profile.role === 'tech') {
    return (
      <>
        <Nav name={profile.display_name} role={profile.role} />
        <p className="error">No access.</p>
      </>
    );
  }

  // Get all invoices with balances
  const {data: invoiceList} = await db
    .from('invoices')
    .select(
      `
      id, number, date, terms,
      jobs!inner(id, customer_id, job_tasks(*), customers!inner(name))
      `
    )
    .order('date', {ascending: false});

  // Get all payments
  const {data: allPayments} = await db.from('payments').select('invoice_id, amount');

  const paymentsByInvoice = (allPayments || []).reduce(
    (acc: Record<string, number>, p) => {
      acc[p.invoice_id] = (acc[p.invoice_id] || 0) + Number(p.amount);
      return acc;
    },
    {}
  );

  // Calculate aging buckets
  const today = new Date();
  const buckets = {
    current: [] as any[],