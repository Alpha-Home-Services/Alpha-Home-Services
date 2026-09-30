# Alpha Service Desk — Phase 1 foundation

This is the start of the real app, separate from the click-through prototype. It uses Next.js, TypeScript, Supabase Auth and Postgres. It does not use browser localStorage as its database.

## Current scope

- Password login, sign-out, and server-verified sessions.
- Admin, office and technician roles; no public signup or client-controlled role changes.
- Customer search, creation and editing, main accounts and one-level tenant sub-accounts, billing recipient and payment terms.
- Multiple buildings, equipment capture by trade, and the prototype's exact site intake fields.
- Database policies limit techs to explicitly assigned accounts; financial/payroll tables are absent.
- Fictional test seed. No imports of real customers, no payment SDKs, no calls, texts, emails, or integrations.

The prototype remains the reference for subsequent phases. Memberships, scheduling, invoices, customer CSV import, equipment photo uploads, and offline sync are NOT implemented in this first foundation commit. Do not call Phase 1 complete until the remaining items and acceptance tests pass against a disposable database.

## Run without connecting a database

Node 20.9+ required. Run `npm ci`, then `npm run dev`. Open http://localhost:3000. With no environment values the app shows a setup page and makes no Supabase calls. `npm run build`, `npm run typecheck` and `npm test` check the code locally.

## Connect a separate TEST database

Do not use Alpha's production data or a production Supabase project. Prefer a local Supabase stack if Docker is available. A hosted disposable test project is also possible, but account setup and any charges must be approved separately. No project, subscription or deployment is created by this code.

1. Apply `supabase/migrations/202609300001_foundation.sql` in the disposable database, then `supabase/seed.sql`.
2. Disable public signup. Create test accounts through Supabase Auth: admin@example.test, office@example.test, tech@example.test and other-tech@example.test. Use your own test passwords; none are committed. Do not send invitations or email real addresses.
3. Using the database administrator, insert each auth user's ID into public.profiles with the corresponding role. Only a database administrator can assign roles. Example (replace the UUID with the real test Auth ID):

```sql
insert into public.profiles(id,display_name,role)
values ('AUTH-USER-UUID', 'Test office', 'office');
```

4. Assign the first technician to one fictional customer using `public.customer_assignments(customer_id,tech_id)`. Techs start with zero access. Parent/child and other buildings do not inherit assignment automatically.
5. Copy `.env.example` to `.env.local`. Set the TEST Supabase URL, publishable key (or legacy anon key), and `ALPHA_ENVIRONMENT=test`. Never put a service-role key into this app. Restart the dev server.

Setting the test flag is a guard against accidental configuration, NOT proof that a project is disposable; verify the project yourself before using its URL. The app has no live-mode implementation.

## Acceptance checklist

- Sign in as office: search test accounts; add a customer, set Net 30, edit it, add a tenant billed to its parent and add a building.
- Add equipment under each trade, choose the right building, and save/reopen site fields.
- Sign in as assigned tech: only its account is visible; it can record equipment and site details, but cannot create/edit customers, locations, roles or assignments.
- Sign in as other tech: the first tech's customer is hidden, including direct URLs and direct database requests.
- Check anonymous reads, self-promotion, cross-customer equipment locations and invalid parent billing are rejected.
- Refresh the browser after a save; records persist in Postgres.

Automated Postgres policy tests use PGlite with a mocked auth.uid() and PostgreSQL roles. They verify policies but do not replace testing Supabase Auth/cookie refresh in the real test project. No live database or customer action is used during tests.

## Next work

Finish equipment editing/photo storage with private access, implement a preview-and-confirm CSV import using a fictional HCP fixture, and test end to end against the isolated Supabase environment before advancing to Phase 2. Deployments and live integrations remain off.
