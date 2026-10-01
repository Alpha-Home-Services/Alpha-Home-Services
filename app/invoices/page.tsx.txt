import Link from 'next/link';
import {session} from '@/lib/auth';
import {Nav} from '@/components/Nav';
import {money} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const {db, profile} = await session();

  // Check access: office/admin only
  if (profile.role === 'tech') {
    return (
      <>
        <Nav name={profile.display_name} role={profile.role} />
        <p className="error" role="alert">You don't have access to invoices.</p>
      </>
    );
  }

  // Get filters from search params
  const search = sp.search?.toLowerCase() || '';
  const status = sp.status || 'all';

  // Get all invoices with balances
  const {data: invoiceList} = await db
    .from('invoices')
    .select(
      `
      id, number, date, terms, emailed_at,
      jobs!inner(id, number, description, customer_id, customers!inner(id, name, email))
      `
    )
    .order('date', {ascending: false});

  // Get all payments for balance calculation
  const {data: allPayments} = await db.from('payments').select('invoice_id, amount');

  const paymentsByInvoice = (allPayments || []).reduce(
    (acc: Record<string, number>, p) => {
      acc[p.invoice_id] = (acc[p.invoice_id] || 0) + Number(p.amount);
      return acc;
    },
    {}
  );

  // Get price book items and materials for total calculation
  const {data: jobTasks} = await db.from('job_tasks').select('job_id, qty, unit_price');

  const tasksByJob: Record<string, number> = {};
  (jobTasks || []).forEach((t) => {
    if (!tasksByJob[t.job_id]) tasksByJob[t.job_id] = 0;
    tasksByJob[t.job_id] += t.qty * Number(t.unit_price);
  });

  // Format and filter invoices
  const invoices = (invoiceList || [])
    .map((inv: any) => {
      const jobId = inv.jobs?.id;
      const customerName = inv.jobs?.customers?.name || 'Unknown';
      const customerEmail = inv.jobs?.customers?.email || '';
      const totalAmount = tasksByJob[jobId] || 0;
      const paid = paymentsByInvoice[inv.id] || 0;
      const balance = totalAmount - paid;
      const isPaid = balance <= 0;
      const isOverdue =
        new Date(inv.date) < new Date() &&
        new Date(inv.date).getTime() +
          (inv.terms === 'net15'
            ? 15 * 86400000
            : inv.terms === 'net30'
              ? 30 * 86400000
              : inv.terms === 'net60'
                ? 60 * 86400000
                : 0) < new Date().getTime() &&
        !isPaid;

      return {
        id: inv.id,
        number: inv.number,
        date: inv.date,
        customer: customerName,
        email: customerEmail,
        totalAmount,
        balance,
        paid,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        emailed: inv.emailed_at ? true : false
      };
    })
    .filter((inv) => {
      if (status !== 'all' && inv.status !== status) return false;
      if (
        search &&
        !inv.number.toLowerCase().includes(search) &&
        !inv.customer.toLowerCase().includes(search) &&
        !inv.email.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totals = {
    pending: invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.balance, 0),
    overdue: invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.balance, 0),
    paid: invoices.filter((i) => i.status === 'paid').length
  };

  return (
    <>
      <Nav name={profile.display_name} role={profile.role} />

      <div style={{maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap'}}>
          <h1>Invoices</h1>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <Link href="/invoices/aging" className="button">
              View AR Aging
            </Link>
            <Link href="/invoices/followups" className="button">
              Follow-ups
            </Link>
          </div>
        </div>

        {/* Summary cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}
        >
          <div
            style={{
              border: '1px solid #d9534f',
              borderRadius: '8px',
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: '#fde9e6'
            }}
          >
            <div style={{fontSize: '0.85rem', color: '#d9534f', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
              Overdue
            </div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold', margin: '0.5rem 0'}}>{money(totals.overdue, 2)}</div>
            <div style={{fontSize: '0.85rem', color: '#999'}}>
              {invoices.filter((i) => i.status === 'overdue').length} invoices
            </div>
          </div>
          <div
            style={{
              border: '1px solid #f0ad4e',
              borderRadius: '8px',
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: '#fef8f1'
            }}
          >
            <div style={{fontSize: '0.85rem', color: '#f0ad4e', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
              Pending
            </div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold', margin: '0.5rem 0'}}>{money(totals.pending, 2)}</div>
            <div style={{fontSize: '0.85rem', color: '#999'}}>
              {invoices.filter((i) => i.status === 'pending').length} invoices
            </div>
          </div>
          <div
            style={{
              border: '1px solid #5cb85c',
              borderRadius: '8px',
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: '#efe9f7'
            }}
          >
            <div style={{fontSize: '0.85rem', color: '#5cb85c', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
              Paid
            </div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold', margin: '0.5rem 0'}}>{totals.paid}</div>
            <div style={{fontSize: '0.85rem', color: '#999'}}>this month</div>
          </div>
        </div>

        {/* Filter bar */}
        <form style={{marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
          <input
            type="search"
            name="search"
            placeholder="Search invoice #, customer, email..."
            defaultValue={search}
            style={{flex: 1, minWidth: '200px'}}
          />
          <select name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
          <button type="submit" className="button">
            Filter
          </button>
        </form>

        {/* Invoice table */}
        {invoices.length === 0 ? (
          <p className="muted" style={{textAlign: 'center', padding: '2rem'}}>
            No invoices found.
          </p>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{borderBottom: '2px solid var(--border)'}}>
                  <th style={{textAlign: 'left', padding: '0.75rem'}}>Invoice</th>
                  <th style={{textAlign: 'left', padding: '0.75rem'}}>Customer</th>
                  <th style={{textAlign: 'left', padding: '0.75rem'}}>Date</th>
                  <th style={{textAlign: 'right', padding: '0.75rem'}}>Amount</th>
                  <th style={{textAlign: 'right', padding: '0.75rem'}}>Paid</th>
                  <th style={{textAlign: 'right', padding: '0.75rem'}}>Balance</th>
                  <th style={{textAlign: 'center', padding: '0.75rem'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: inv.status === 'overdue' ? '#fff5f5' : undefined
                    }}
                  >
                    <td style={{padding: '0.75rem'}}>
                      <Link href={`/invoices/${inv.id}`} style={{fontWeight: 'bold'}}>
                        {inv.number}
                      </Link>
                    </td>
                    <td style={{padding: '0.75rem'}}>
                      <div>{inv.customer}</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--muted)'}}>{inv.email}</div>
                    </td>
                    <td style={{padding: '0.75rem', whiteSpace: 'nowrap'}}>{inv.date}</td>
                    <td style={{padding: '0.75rem', textAlign: 'right'}}>{money(inv.totalAmount, 2)}</td>
                    <td style={{padding: '0.75rem', textAlign: 'right', color: 'var(--success)'}}>
                      {money(inv.paid, 2)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        color: inv.status === 'paid' ? 'var(--success)' : inv.status === 'overdue' ? 'var(--danger)' : 'inherit'
                      }}
                    >
                      {inv.status === 'paid' ? '—' : money(inv.balance, 2)}
                    </td>
                    <td style={{padding: '0.75rem', textAlign: 'center'}}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          backgroundColor:
                            inv.status === 'paid'
                              ? 'var(--success-bg)'
                              : inv.status === 'overdue'
                                ? 'var(--danger-bg)'
                                : 'var(--muted-bg)',
                          color:
                            inv.status === 'paid'
                              ? 'var(--success)'
                              : inv.status === 'overdue'
                                ? 'var(--danger)'
                                : 'var(--muted)'
                        }}
                      >
                        {inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}