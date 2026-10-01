import {SupabaseClient} from '@supabase/supabase-js';

export async function createInvoice(db: SupabaseClient, jobId: string) {
  // Get the next invoice number
  const {data: lastInv} = await db
    .from('invoices')
    .select('number')
    .order('number', {ascending: false})
    .limit(1);

  const nextNum = (lastInv?.[0]?.number || 0) + 1;
  const invoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;

  // Create invoice
  const {data: inv, error} = await db
    .from('invoices')
    .insert({
      job_id: jobId,
      number: invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      terms: 'net30'
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invoice: ${error.message}`);

  // Update job with invoice_id
  await db.from('jobs').update({invoice_id: inv.id}).eq('id', jobId);

  return inv;
}

export async function getInvoiceData(db: SupabaseClient, invoiceId: string) {
  const {data: inv} = await db.from('invoices').select('*').eq('id', invoiceId).single();

  const {data: job} = await db.from('jobs').select('*, customers(*), job_tasks(*)').eq('id', inv?.job_id).single();

  const {data: payments} = await db.from('payments').select('*').eq('invoice_id', invoiceId);

  const totalAmount = (job?.job_tasks || []).reduce((sum, t) => sum + t.qty * Number(t.unit_price), 0);
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalAmount - totalPaid;

  return {inv, job, payments, totalAmount, totalPaid, balance};
}

export async function recordPayment(
  db: SupabaseClient,
  invoiceId: string,
  amount: number,
  method: string,
  reference?: string
) {
  const {data: payment, error} = await db
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount,
      method,
      reference,
      date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record payment: ${error.message}`);

  return payment;
}

export async function scheduleFollowUp(
  db: SupabaseClient,
  customerId: string,
  trade: string,
  daysFromNow: number
) {
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + daysFromNow);

  const labels: Record<string, string> = {
    hvac: 'Spring/fall seasonal check',
    electrical: 'Annual electrical inspection',
    plumbing: 'Two-year plumbing maintenance',
    septic: 'Three-year septic pump service'
  };

  const {data, error} = await db
    .from('follow_ups')
    .insert({
      customer_id: customerId,
      trade,
      date: followUpDate.toISOString().split('T')[0],
      label: labels[trade] || 'Follow-up service'
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to schedule follow-up: ${error.message}`);

  return data;
}