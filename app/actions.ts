'use server';

import {redirect} from 'next/navigation';
import {session} from '@/lib/auth';
import {createInvoice, recordPayment as recordPaymentDB, scheduleFollowUp} from '@/lib/invoicing';
import {syncJobCompletionToGHL} from '@/lib/ghl';

export async function setJobStatus(jobId: string, status: string) {
  const {db} = await session();

  // Update job status
  const {data: job, error} = await db
    .from('jobs')
    .update({status})
    .eq('id', jobId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update job: ${error.message}`);

  // If job is completed, create invoice and schedule follow-ups
  if (status === 'completed') {
    try {
      // Create invoice
      const invoice = await createInvoice(db, jobId);

      // Get job details for GHL sync
      const {data: jobData} = await db
        .from('jobs')
        .select('*, customers(*)')
        .eq('id', jobId)
        .single();

      // Schedule follow-up based on trade
      const followUpDays: Record<string, number> = {
        hvac: 180,
        electrical: 365,
        plumbing: 730,
        septic: 1095
      };

      if (jobData?.trade && followUpDays[jobData.trade]) {
        await scheduleFollowUp(db, jobData.customer_id, jobData.trade, followUpDays[jobData.trade]);
      }

      // Sync to GHL if customer has GHL ID
      if (jobData?.customers?.ghl_contact_id) {
        await syncJobCompletionToGHL(jobData.customers.ghl_contact_id, {
          number: job.number,
          description: jobData.description,
          trade: jobData.trade,
          status: 'completed'
        });
      }

      console.log(`Invoice ${invoice.number} created for job ${jobId}`);
    } catch (err) {
      console.error('Error on job completion:', err);
      // Don't throw - job status was updated, just log the error
    }
  }

  return job;
}

export async function recordPayment(invoiceId: string, amount: number, method: string, reference?: string) {
  const {db} = await session();

  // Only office/admin can record payments
  const {profile} = await session();
  if (profile.role === 'tech') {
    throw new Error('Technicians cannot record payments');
  }

  try {
    const payment = await recordPaymentDB(db, invoiceId, amount, method, reference);

    // Get invoice and job for email notification
    const {data: inv} = await db
      .from('invoices')
      .select('*, jobs(*, customers(email, name))')
      .eq('id', invoiceId)
      .single();

    console.log(`Payment of ${amount} recorded for invoice ${inv.number}`);

    // TODO: Send payment confirmation email when email service is configured
    // await sendPaymentConfirmationEmail(inv.jobs.customers.email, ...);

    return payment;
  } catch (error) {
    throw new Error(`Failed to record payment: ${error}`);
  }
}

export async function deletePayment(paymentId: string) {
  const {db} = await session();

  // Only office/admin can delete payments
  const {profile} = await session();
  if (profile.role === 'tech') {
    throw new Error('Technicians cannot delete payments');
  }

  const {error} = await db.from('payments').delete().eq('id', paymentId);

  if (error) throw new Error(`Failed to delete payment: ${error.message}`);

  return {success: true};
}