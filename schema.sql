-- =========================================================
-- NAIL SALON POS - DATABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and click Run
-- =========================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =========================================================
-- 1. STAFF / USERS
-- =========================================================
create type staff_role as enum ('owner', 'manager', 'cashier', 'technician');

create table staff (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  pin_code text not null, -- 4-6 digit PIN for fast iPad login at shared device
  role staff_role not null default 'technician',
  commission_rate numeric(5,2) default 0, -- percentage, e.g. 40.00 = 40%
  phone text,
  active boolean default true,
  created_at timestamptz default now()
);

-- =========================================================
-- 2. CUSTOMERS
-- =========================================================
create table customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  email text,
  notes text, -- allergies, preferences
  loyalty_points int default 0,
  membership_tier text default 'standard',
  created_at timestamptz default now()
);

-- =========================================================
-- 3. SERVICES (price list)
-- =========================================================
create table services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text, -- manicure, pedicure, gel, acrylic, nail art, add-on
  price numeric(10,2) not null,
  duration_minutes int default 30,
  active boolean default true,
  created_at timestamptz default now()
);

-- =========================================================
-- 4. PRODUCTS / INVENTORY
-- =========================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sku text,
  category text, -- polish, tools, consumables, retail
  retail_price numeric(10,2) default 0, -- if sold to customer
  stock_quantity numeric(10,2) default 0,
  unit text default 'pcs', -- pcs, ml, bottle, etc.
  low_stock_threshold numeric(10,2) default 5,
  cost_per_unit numeric(10,2) default 0, -- for expense/profit calc
  active boolean default true,
  created_at timestamptz default now()
);

-- Track product usage per service (optional, for consumable deduction)
create table service_product_usage (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid references services(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  quantity_used numeric(10,2) not null default 0
);

-- =========================================================
-- 5. APPOINTMENTS
-- =========================================================
create type appointment_status as enum ('booked','confirmed','in_progress','completed','no_show','cancelled');

create table appointments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  technician_id uuid references staff(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status appointment_status default 'booked',
  notes text,
  created_by uuid references staff(id),
  created_at timestamptz default now()
);

-- Services attached to a single appointment (many-to-many)
create table appointment_services (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid references appointments(id) on delete cascade,
  service_id uuid references services(id) on delete restrict,
  price_at_booking numeric(10,2) not null
);

-- =========================================================
-- 6. TRANSACTIONS (Cashier / POS)
-- =========================================================
create type payment_method as enum ('cash','card','e_wallet','split');

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  appointment_id uuid references appointments(id) on delete set null,
  cashier_id uuid references staff(id),
  subtotal numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  tip_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  payment_method payment_method not null default 'cash',
  payment_reference text, -- card/e-wallet ref number if any
  status text default 'completed', -- completed, voided, refunded
  created_at timestamptz default now()
);

-- Line items: services rendered in this transaction
create table transaction_services (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) on delete cascade,
  service_id uuid references services(id) on delete restrict,
  technician_id uuid references staff(id), -- who performed it (for commission)
  price numeric(10,2) not null,
  tip_amount numeric(10,2) default 0
);

-- Line items: retail products sold in this transaction
create table transaction_products (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) on delete cascade,
  product_id uuid references products(id) on delete restrict,
  quantity numeric(10,2) not null default 1,
  price numeric(10,2) not null
);

-- =========================================================
-- 7. EXPENSES (for profit & loss reporting)
-- =========================================================
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null, -- rent, utilities, payroll, supplies, other
  description text,
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  created_by uuid references staff(id),
  created_at timestamptz default now()
);

-- =========================================================
-- 8. BUSINESS SETTINGS
-- =========================================================
create table business_settings (
  id int primary key default 1,
  business_name text default 'My Nail Salon',
  address text,
  phone text,
  tax_rate numeric(5,2) default 0, -- percentage
  receipt_footer text,
  logo_url text,
  constraint single_row check (id = 1)
);
insert into business_settings (id) values (1);

-- =========================================================
-- INDEXES for performance
-- =========================================================
create index idx_appointments_scheduled_start on appointments(scheduled_start);
create index idx_appointments_technician on appointments(technician_id);
create index idx_transactions_created_at on transactions(created_at);
create index idx_transaction_services_technician on transaction_services(technician_id);
create index idx_expenses_date on expenses(expense_date);

-- =========================================================
-- ROW LEVEL SECURITY
-- For a shared-iPad app using PIN login (not Supabase Auth sessions per se),
-- we'll authenticate via our own staff table + PIN, and use a single
-- Supabase service role ONLY on a secured backend function -- but since this
-- is a simple internal tool, we enable RLS with permissive policies scoped
-- to "authenticated" role using Supabase Auth anonymous sign-in per device.
-- =========================================================
alter table staff enable row level security;
alter table customers enable row level security;
alter table services enable row level security;
alter table products enable row level security;
alter table service_product_usage enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table transactions enable row level security;
alter table transaction_services enable row level security;
alter table transaction_products enable row level security;
alter table expenses enable row level security;
alter table business_settings enable row level security;

-- Allow all access for authenticated sessions (device-level auth via Supabase anonymous auth)
create policy "allow all authenticated" on staff for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on services for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on service_product_usage for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on appointments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on appointment_services for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on transaction_services for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on transaction_products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on expenses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "allow all authenticated" on business_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================
-- SEED DATA (sample services so the app isn't empty on first run)
-- =========================================================
insert into services (name, category, price, duration_minutes) values
('Classic Manicure', 'manicure', 80000, 30),
('Gel Manicure', 'manicure', 120000, 45),
('Classic Pedicure', 'pedicure', 100000, 40),
('Gel Pedicure', 'pedicure', 140000, 50),
('Acrylic Full Set', 'acrylic', 250000, 90),
('Nail Art (per nail)', 'nail_art', 15000, 10);

insert into products (name, category, retail_price, stock_quantity, unit, low_stock_threshold, cost_per_unit) values
('Gel Polish - Red', 'polish', 0, 10, 'bottle', 2, 45000),
('Gel Polish - Nude', 'polish', 0, 10, 'bottle', 2, 45000),
('Acetone', 'consumables', 0, 5, 'bottle', 1, 25000),
('Cotton Pads', 'consumables', 0, 50, 'pcs', 10, 500);
