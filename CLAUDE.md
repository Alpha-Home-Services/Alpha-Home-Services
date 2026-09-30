# Alpha Service Desk

Custom field service software for **Alpha Home Services**, a home services company doing HVAC, electrical, plumbing, and septic. It replaces Housecall Pro and ServiceTitan for Alpha only. (A sister company, Elite Sales and Service, stays on Fullbay and is out of scope.)

The owner is not a developer. Explain decisions in plain language, ask before anything that costs money or touches real customers, and keep the app simple to run.

## Reference

`prototype/service-desk.html` is a working click-through prototype of the whole app. It is the source of truth for screens, wording, and workflow. Match its behavior unless told otherwise. It stores data in the browser and simulates every integration; the real app must not.

## Who uses it

- **Office / CSR (desktop):** intake, scheduling board, customers, memberships, invoices, payments, reports, settings.
- **Techs (phone):** their day, job details, checklists, flat-rate pricing, parts, equipment, photos, job summary, payment, time clock. Must work on a phone in bright sun with gloves (big tap targets) and keep working with poor or no cell signal (rural septic jobs), syncing when back online.
- **Owner/admin:** everything, plus labor rates, pricing formula, and reports.

Every user logs in. Techs see only what they need; pay rates, margins, and job costing are office/admin only.

## Suggested stack (confirm with the owner before starting)

- Next.js (TypeScript) web app, installable on phones as a PWA with offline support
- Supabase for the Postgres database, logins, file storage (equipment photos, logo), and row-level security
- Vercel for hosting
- Stripe for payments (Terminal + Tap to Pay, payment links, saved cards, ACH)
- QuickBooks Online Accounting API (OAuth 2.0) for customers, invoices, payments
- GoHighLevel API v2 with a Private Integration token for contacts, pipeline, SMS, and calls (Alpha is already on LC Phone)
- GitHub for version history

Secrets live in `.env.local` and the hosting dashboard, never in code or commits.

## Core data model

- **Customer**: name, type (residential/commercial), phones, email, service and billing address, payment terms (due on receipt, Net 15/30/60), access notes, lead source, saved card reference (Stripe id only, never card numbers), QBO and GHL ids.
- **Sub-account**: a customer with `parent_id` (renters/tenants). `bill_to` = parent or self.
- **Location**: many per customer (commercial contracts like City of Benson with 13 buildings).
- **Equipment**: belongs to customer + optional location. Trade, type, brand, model, serial, year, size, trade-specific field (refrigerant, fuel, breaker type, tank material), location on property, condition, warranty date, notes, data plate photo. Techs record it on site; most customers don't know their equipment.
- **Site details**: trade-specific intake fields per customer (see prototype SITE fields).
- **Job**: customer, location, trade, tech (nullable = unassigned), date, start time, arrival window (hours), status (scheduled, on the way, in progress, waiting on parts, invoiced, paid), description, work location note, parts-needed note, checklist state, job summary, recommendations, private notes (office/tech only, never on invoices), actual hours.
- **Job line**: price book task, qty, price at time of sale, `included` flag (membership visit services at $0).
- **Materials used**: from inventory (decrements stock) or ad hoc; cost only, listed on invoice as included.
- **Price book task**: trade, name, what's included (customer-facing), labor hours, parts cost, pricing mode (formula or custom), price.
- **Inventory item**: name, SKU, trade, unit cost, on hand, reorder point, location.
- **Invoice**: number, date, terms, due date, show-materials toggle, emailed flag, QBO sync status.
- **Payment**: invoice, date, method (tap, reader, link, card on file, ACH, check, cash), amount, reference, processor fee, Stripe id. Partial payments allowed.
- **Plan**: name, residential/commercial, price, billing (yearly, monthly, once), discount %, free diagnostics flag, description, included units and add-on price per extra unit (commercial), visit templates (month offset, label, trade, tasks).
- **Membership**: customer, plan, start, end, auto-renew, cover sub-accounts flag, custom price, targets (customer + location pairs covered).
- **Membership visit**: membership, target, label, tasks, due date, linked job, done date.
- **Time punch**: tech, clock in, clock out.
- **Message/call log**: customer, direction, text, time, user (mirrors GHL).
- **Follow-up**: customer, trade, date, label (tune-up reminders, septic pump every 3 years).

## Business rules

- **Flat-rate pricing only.** Formula price = (labor hours x $165 + parts cost x 1.5) / (1 - 0.03). The 3% covers card processing so no fee is ever added at payment. Rate, markup, and card coverage are editable in Settings; changing them reprices all formula tasks, never custom-priced tasks or already-quoted jobs.
- **Job costing** (office only): labor = actual hours (or price book hours) x tech's loaded hourly cost; parts = logged materials if any, otherwise price book parts cost; gross profit and margin per job.
- **Membership discount** applies automatically to non-included lines on jobs dated within an active membership (own, or parent's if it covers sub-accounts). Free diagnostics for plans that include them. Show savings as a line on the invoice.
- **Commercial Comfort Plan** price = base + $150 per HVAC unit over 5 + $150 per water heater over 5, counted from equipment at covered locations (skip thermostats, evaporator coils, air handlers). A custom contract price overrides.
- **Scheduling**: warn before double booking a tech (overlapping arrival windows); allow override. Unassigned column on the board. Drag to move on desktop.
- **Completing a job** requires at least one task, a finished trade checklist, and a job summary. It creates the invoice, emails it with the job summary, sends a Google review request, schedules the trade follow-up, and syncs to QBO and GHL.
- **Sub-account invoices** bill to the parent when `bill_to = parent`.
- **Reports**: billed vs. paid per tech (time clock hours x loaded rate), billable time %, gross profit by tech and trade, unpaid invoices with aging, payments by method with fees, upcoming follow-ups, membership revenue and overdue visits.

## Build phases (finish and test each before the next)

1. **Foundation:** project setup, database, logins and roles, customers, sub-accounts, locations, equipment, site details. Import customers from the Housecall Pro CSV export.
2. **Pricing and jobs:** price book with the formula, inventory, intake by trade, job page for techs (mobile first, offline), checklists, materials, job summary, private notes.
3. **Scheduling:** dispatch board (tech columns, time rows, unassigned, double-booking warnings, drag to move), list view, week strip, parts-waiting banner, reschedule.
4. **Invoices and payments:** invoices, net terms, Stripe in test mode (Tap to Pay, reader, payment links, saved cards, ACH), manual check/cash, partial payments.
5. **Memberships:** plans, agreements, visit generation, schedule-all for contracts, renewals charging the saved card.
6. **Time clock and reports.**
7. **Integrations:** QuickBooks Online (sandbox first), GoHighLevel contacts, pipeline, SMS, calls from Alpha's LC Phone number, Google review requests.
8. **Pilot and cutover:** run alongside Housecall Pro with 1-2 techs, fix issues, import job history, equipment, price book, and memberships, then switch everyone over.

## Working rules for Claude

- Use test/sandbox modes for Stripe and QuickBooks until the owner says go live.
- Never text, call, email, or charge a real customer without the owner's explicit OK.
- Protect customer data: row-level security on every table, no secrets in the browser, no card data stored.
- Commit to GitHub after each working step with a plain-English message.
- Use fictional test data only. No real customers yet.
- Keep payments, texting, emails, deployments, and live integrations off.
- The test Supabase project already has the database setup and seed applied. Don't rerun `supabase/migrations/202609300001_foundation.sql` or `supabase/seed.sql`.
- The test users already exist. Don't recreate them, and never ask the owner to paste passwords.
- Alpha only. Elite Sales and Service stays separate.
- After each phase, give the owner a short list of what to click through and test.
