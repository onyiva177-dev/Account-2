# 🔷 FinAI — Universal Accounting & Financial Management System

AI-assisted, cloud-based accounting system for schools, businesses, hospitals, NGOs, and retail.

## 🚀 Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase_setup.sql`
3. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key_optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

### 4. Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Import Project**
3. Select your repo
4. Add all environment variables from `.env.local`
5. Deploy!

## 🧩 Modules

| Module | Description |
|--------|-------------|
| 📒 Accounting | Journal entries, CoA, Trial Balance |
| 🧾 Tax | VAT, PAYE, NHIF, NSSF (Kenya-ready) |
| 💰 Payroll | Employee salaries, deductions |
| 🛍️ POS | Point-of-sale with cart |
| 📦 Inventory | Stock tracking |
| 🏦 Banking | Reconciliation |
| 📊 Analytics | AI insights & charts |
| 📄 Reports | P&L, Balance Sheet, Cash Flow |
| ⚙️ Settings | Modules, tax policy, security |

## 🏢 Supported Sectors
- Education (schools, universities)
- Business / SME
- Healthcare / Hospitals
- NGO / Nonprofits
- Government entities
- Retail (POS-enabled)

## 🔒 Security
- Row Level Security (RLS) on all tables
- Organization data isolation
- Role-based access control
- Audit logging
- No auto tax remittance without approval
