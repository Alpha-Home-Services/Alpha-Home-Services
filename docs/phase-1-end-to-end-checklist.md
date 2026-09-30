# Phase 1 end-to-end checklist

Click through this on the **test** Supabase project before starting Phase 2. Use made-up data only; every name you type should start with `TEST —`. Tick each box as you go. If a step doesn't behave as described, stop and note the step number.

The automated tests (`npm test`) already check the database rules directly. This checklist checks the real app: real logins, real storage, real browser and phone.

## Before you start

- [ ] 0.1 All four migration files are applied to the test project, each once: `202609300001_foundation.sql`, `seed.sql`, `202610010001_equipment_editing_photos.sql`, `202610020001_hcp_import.sql`.
- [ ] 0.2 `npm run dev` is running and http://localhost:3000 shows the **TEST** badge and the yellow "Test environment" bar.
- [ ] 0.3 You know which customer `tech@example.test` is assigned to. Below it's called **the assigned customer**. `other-tech@example.test` has no assignments.
- [ ] 0.4 Have a phone on the same Wi-Fi. Use the Network address `npm run dev` prints (for example `http://192.168.1.184:3000`).

## 1. Signed out

- [ ] 1.1 Open http://localhost:3000 in a private window: you're sent to **Sign in**. No customer data shows.
- [ ] 1.2 Open a customer link directly (copy one from a signed-in window, e.g. `/customers/00000000-0000-4000-8000-000000000001`): you're sent to **Sign in**.
- [ ] 1.3 Open `/import` directly: you're sent to **Sign in**.
- [ ] 1.4 There's no sign-up link, and a wrong password shows "Sign-in failed."

## 2. Office (`office@example.test`)

Customers
- [ ] 2.1 Sign in. The customer list shows all test customers, with **Add customer** and **Import from Housecall Pro** buttons.
- [ ] 2.2 Search by part of a name, then by phone number; filter by Residential and Commercial.
- [ ] 2.3 Add customer `TEST — E2E Office Co`, Commercial, terms **Net 30**. Save, then **Edit customer** and change the phone. Refresh: the change is still there.
- [ ] 2.4 Add customer `TEST — E2E Tenant`, parent **TEST — E2E Office Co**, bills to **parent**. Open it: it says it bills to the parent account. Open the parent: the tenant is listed under Sub-accounts.
- [ ] 2.5 Try to make **TEST — E2E Office Co** a sub-account of another customer: it's refused (it already has a tenant).

Buildings and equipment
- [ ] 2.6 On TEST — E2E Office Co, add buildings `TEST — North` and `TEST — South`. The Locations section shows "2 buildings".
- [ ] 2.7 Open **TEST — North** and add one piece of equipment for each trade (HVAC, Electrical, Plumbing, Septic). Each form already has TEST — North selected. All four appear under North with "4 units"; South says "No equipment recorded at this building."
- [ ] 2.8 From TEST — North's **Add HVAC equipment** form, change Location to **Main property** and save: a **Main property** group appears with that unit.
- [ ] 2.9 Edit a unit under North, change Location to **TEST — South** and fill in the serial. It moves to South and shows the serial.
- [ ] 2.10 Save HVAC and Septic site details; refresh; the values are still there.

Photos (on the phone)
- [ ] 2.11 On the phone, sign in as office, open TEST — E2E Office Co, edit a unit, **Take or upload photo**. The camera opens; take a picture of any label; a preview appears; save. The thumbnail shows; tapping it opens the full photo.
- [ ] 2.12 Retake the photo on the same unit and save. The new photo shows. (The old one is deleted from storage; optional: check the `equipment-photos` bucket in Supabase has one file for that unit.)
- [ ] 2.13 Buttons and fields are easy to tap with a thumb; nothing runs off the side of the screen.

Import
- [ ] 2.14 **Import from Housecall Pro**, choose `tests/fixtures/hcp-sample.csv`. The preview says 4 customers to add (1 tenant, 1 extra building), 3 warnings, 2 skipped. Nothing new shows on the customer list yet.
- [ ] 2.15 Click **Import 4 customers**. The list says "Imported 4 customers from Housecall Pro."
- [ ] 2.16 Open **TEST — Riley Tenant**: it bills to TEST — Mesa Example Properties. Open **TEST — Mesa Example Properties**: it's Commercial, has the PO Box as billing address, one extra building, and Riley under Sub-accounts. **TEST — Jordan Example** access notes start with "DO NOT SERVICE".
- [ ] 2.17 Import the same file again: the preview shows 0 to add and no Import button.
- [ ] 2.18 Upload any non-Housecall Pro CSV (e.g. two columns `Name,Phone`): it says the file doesn't look like a Housecall Pro export.

## 3. Assigned tech (`tech@example.test`)

- [ ] 3.1 Sign in. The list says "Only accounts assigned to you are shown" and shows only **the assigned customer**. No Add customer or Import buttons.
- [ ] 3.2 Open the assigned customer. No **Edit customer** or **Add location** buttons.
- [ ] 3.3 Add a piece of equipment with a data plate photo (on the phone). It saves and shows the photo.
- [ ] 3.4 Edit an existing unit on the assigned customer (change condition, retake the photo). It saves.
- [ ] 3.5 Save site details for one trade. They save.
- [ ] 3.6 Type `/customers/new` in the address bar: **"You don't have access to that"** with a Back to customers button.
- [ ] 3.7 Type the assigned customer's link plus `/edit`: **"You don't have access to that"**.
- [ ] 3.8 Type `/import`: **"You don't have access to that"**.
- [ ] 3.9 Open the link of a customer that is **not** assigned (e.g. TEST — E2E Office Co, copied from the office window): **"You don't have access to that customer."**

## 4. Other tech (`other-tech@example.test`)

- [ ] 4.1 Sign in. The customer list is empty.
- [ ] 4.2 Open the assigned customer's link directly: **"You don't have access to that customer."**
- [ ] 4.3 Open `/customers/new` directly: **"You don't have access to that"**.

## 5. Admin (`admin@example.test`)

- [ ] 5.1 Sign in. Sees everything office sees, including Import.
- [ ] 5.2 The role shown at the top says **admin**, and there's no way in the app to change anyone's role or tech assignments (that's done only in the database).

## 6. Finish

- [ ] 6.1 Sign out on each device; the back button doesn't show customer pages again without signing in.
- [ ] 6.2 Note anything that failed, with the step number, and send it to Claude.
- [ ] 6.3 When everything passes, Phase 1 is done. Test records (`TEST — E2E …` and the imported sample customers) can stay in the test project.
