# Nail Salon POS — Deployment Guide

This is your complete nail salon system: Cashier, Appointments, Customers, Inventory,
Staff, and Financial Reports (monthly/yearly), built as an installable iPad app (PWA)
connected to your Supabase database.

Your Supabase credentials are already filled in inside the `.env` file — you don't need
to edit anything, just follow the steps below to put the code on GitHub and deploy it
with Vercel.

## Step 1 — Upload this code to GitHub

1. Go to github.com (you're already logged in) → click the **+** icon top right → **New repository**.
2. Name it `nail-salon-pos`. Keep it **Private** (recommended, since it touches business data). Click **Create repository**.
3. On the next page, look for **"uploading an existing file"** (a blue link in the quick setup instructions).
4. Unzip the file I gave you on your laptop first (double-click the .zip — it should extract into a folder).
5. Drag the entire contents of that unzipped folder (not the folder itself, but everything inside it — all the files and folders like `src`, `public`, `package.json`, etc.) onto the GitHub upload page.
6. Scroll down, click **Commit changes**.

## Step 2 — Deploy with Vercel

1. Go to vercel.com (you're already logged in) → click **Add New** → **Project**.
2. Find `nail-salon-pos` in the list of your GitHub repos and click **Import**.
3. Vercel will auto-detect it's a Vite project — leave the default settings as is.
4. Before clicking Deploy, expand **Environment Variables** and add these two (copy exactly):
   - `VITE_SUPABASE_URL` → `https://dhzowjhfvpensyqmokej.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → (the long key starting with `eyJ...` — find it in your `.env` file in the unzipped folder)
5. Click **Deploy**. Wait 1-2 minutes.
6. Once done, Vercel gives you a live URL like `nail-salon-pos.vercel.app` — that's your app, live on the internet.

## Step 3 — Create your first staff login (PIN)

The app starts empty of staff, so you need one login to get in:

1. In Supabase, go to **Table Editor → staff** table.
2. Click **Insert → Insert row**.
3. Fill in:
   - `full_name`: your name
   - `pin_code`: a 4-6 digit number you'll remember, e.g. `1234`
   - `role`: `owner`
   - `commission_rate`: `0`
   - `active`: `true` (toggle on)
4. Click **Save**.

## Step 4 — Install on iPad

1. Open Safari on the iPad, go to your Vercel URL.
2. Tap the **Share** icon (square with an arrow) → **Add to Home Screen** → **Add**.
3. An app icon now appears on the iPad home screen — tap it to open the app full-screen, no browser bar.
4. Log in using the PIN you created in Step 3.

## How staff logins work

Since this is one shared iPad, instead of everyone typing emails/passwords, each staff
member has a short PIN (set up by you/the manager in **Staff** page inside the app). Tapping
"Switch user" on the sidebar logs the current person out so the next person can enter their PIN.

## What's included

- **Cashier** — checkout screen: pick services/products, assign technician, discounts, tax, tips, payment method, completes a sale
- **Appointments** — daily schedule view, book new appointments with services/technician/time, update status (booked → confirmed → in progress → completed/no-show/cancelled)
- **Customers** — customer database with contact info, loyalty points, notes
- **Inventory** — product/stock tracking with low-stock indicators, manual stock adjustment, auto-deducts stock when products are sold
- **Reports** — monthly and yearly revenue, expenses, net profit, charts, breakdown by service/technician/payment method
- **Staff** — manage staff, roles, PINs, commission rates
- **Settings** — business info, tax rate, expense logging (rent, utilities, payroll, supplies)

## Notes on what's NOT included yet (let me know if you want these added)

- SMS/email appointment reminders (needs a third-party messaging service)
- Printable/PDF receipts (currently shows confirmation in-app; can add print formatting)
- Multi-location support
- Customer-facing self-booking page

## Updating the app later

Whenever you want changes, send me the request — I'll update the code and give you new
files. To redeploy: just re-upload the changed files to your GitHub repo (drag and drop
on the GitHub web page works for updates too, or replace the whole folder), and Vercel
automatically redeploys within a minute or two.
