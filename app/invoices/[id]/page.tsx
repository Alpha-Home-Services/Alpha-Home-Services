import Link from 'next/link';
import {session} from '@/lib/auth';
import {Nav} from '@/components/Nav';
import {money} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = await params;
  const {db, profile} = await session();

  if (profile.role === 'tech') {
    return (
      <>
        <Nav name={profile.display_name} role={profile.role} />
        <p className="error">No access.</p>
      </>
    );
  }

  const {data: inv} = await db.from('invoices').select('*').eq('id', id).single();

  if (!inv) {
    return (
      <>
        <Nav name={profile.display_name} role={profile.role} />
        <p className="error">Invoice not found.</p>
      </>
    );
  }

  const {data: job} = await db.from('jobs').select('*, customers(*), job_tasks(*)').eq('id', inv.job_id).single();

  const {data: payments} = await db.from('payments').select('*').eq('invoice_id', id).order('date', {ascending: false});

  const totalAmount = (job?.job_tasks || []).reduce((sum, t) => sum + t.qty * Number(t.unit_price), 0);
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalAmount - totalPaid;

  return (
    <>
      <Nav name={profile.display_name} role={profile.role} />

      <div style={{maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem'}}>
        <Link href="/invoices" style={{marginBottom: '1rem', display: 'inline-block'}}>
          ← Back to invoices
        </Link>

        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '2rem',
            marginBottom: '2rem',
            backgroundColor: 'var(--background)'
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '2rem'}}>
            <div>
              <h1 style={{margin: '0 0 0.5rem 0'}}>{inv.number}</h1>
              <div style={{color: 'var(--muted)'}}>{job?.customers?.name}</div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: '0.85rem', color: 'var(--muted)'}}>Date</div>
              <div style={{fontWeight: 'bold'}}>{inv.date}</div>
            </div>
          </div>

          <table style={{width: '100%', marginBottom: '2rem', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '2px solid var(--border)'}}>
                <th style={{textAlign: 'left', padding: '0.5rem'}}>Item</th>
                <th style={{textAlign: 'center', padding: '0.5rem'}}>Qty</th>
                <th style={{textAlign: 'right', padding: '0.5rem'}}>Unit</th>
                <th style={{textAlign: 'right', padding: '0.5rem'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(job?.job_tasks || []).map((t) => (
                <tr key={t.id} style={{borderBottom: '1px solid var(--border)'}}>
                  <td style={{padding: '0.5rem'}}>{t.description}</td>
                  <td style={{textAlign: 'center', padding: '0.5rem'}}>{t.qty}</td>
                  <td style={{textAlign: 'right', padding: '0.5rem'}}>{money(t.unit_price, 2)}</td>
                  <td style={{textAlign: 'right', padding: '0.5rem'}}>{money(t.qty * Number(t.unit_price), 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '1rem',
              padding: '1rem 0',
              borderTop: '2px solid var(--border)',
              borderBottom: '2px solid var(--border)',
              marginBottom: '2rem'
            }}
          >
            <div style={{textAlign: 'right'}}>Total</div>
            <div style={{fontWeight: 'bold'}}>{money(totalAmount, 2)}</div>
            <div style={{textAlign: 'right'}}>Paid</div>
            <div style={{color: 'var(--success)'}}>{money(totalPaid, 2)}</div>
            <div style={{textAlign: 'right', fontWeight: 'bold'}}>Balance</div>
            <div style={{fontWeight: 'bold', color: balance > 0 ? 'var(--danger)' : 'var(--success)'}}>
              {money(balance, 2)}
            </div>
          </div>

          {balance > 0 && (
            <form action="/actions" method="post" style={{marginBottom: '2rem'}}>
              <input type="hidden" name="action" value="recordPayment" />
              <input type="hidden" name="invoiceId" value={id} />

              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>
                  Payment amount
                  <input type="number" name="amount" step="0.01" min="0" max={balance} required style={{width: '100%'}} />
                </label>
              </div>

              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>
                  Payment method
                  <select name="method" required style={{width: '100%'}}>
                    <option>Cash</option>
                    <option>Check</option>
                    <option>ACH</option>
                    <option>Credit card</option>
                    <option>Card on file</option>
                  </select>
                </label>
              </div>

              <button type="submit" className="button primary" style={{width: '100%'}}>
                Record Payment
              </button>
            </form>
          )}

          {payments && payments.length > 0 && (
            <div>
              <h3 style={{marginBottom: '1rem'}}>Payment history</h3>
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '1px solid var(--border)'}}>
                    <th style={{textAlign: 'left', padding: '0.5rem'}}>Date</th>
                    <th style={{textAlign: 'left', padding: '0.5rem'}}>Method</th>
                    <th style={{textAlign: 'right', padding: '0.5rem'}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{borderBottom: '1px solid var(--border)'}}>
                      <td style={{padding: '0.5rem'}}>{p.date}</td>
                      <td style={{padding: '0.5rem'}}>{p.method}</td>
                      <td style={{textAlign: 'right', padding: '0.5rem'}}>{money(p.amount, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}