# MAX SPEED RACING SHOP Dashboard

A sales monitoring dashboard for Max Speed Racing Shop, built with React + Vite frontend and Express.js backend.

## Architecture

### Monorepo (pnpm workspaces)
- **Frontend**: `artifacts/racing-shop/` - React + Vite + TailwindCSS, port 5000
- **Backend**: `artifacts/api-server/` - Express.js + TypeScript, port 3001
- **DB Library**: `lib/db/` - Drizzle ORM with PostgreSQL
- **API Spec**: `lib/api-spec/` - OpenAPI spec + orval code generation
- **API Client**: `lib/api-client-react/` - React Query hooks (generated)
- **API Zod**: `lib/api-zod/` - Zod schemas

### Database
- PostgreSQL (Replit built-in)
- ORM: Drizzle ORM
- Schema push: `pnpm --filter "@workspace/db" push`

### Tables
- `users` - Authentication users
- `roles` - Role-based permissions (superadmin, admin, staff)
- `penjualan` - Sales transactions
- `biaya` - Operational expenses
- `master_barang` - Product master data
- `master_bank` - Bank accounts
- `master_online_shop` - Online shop channels
- `customer` - Customer records
- `transaksi_bank` - Bank transactions

## Default Admin Credentials
- Username: `admin`
- Password: `admin123`
- Role: `superadmin`

## Development

### Running the App
Two workflows are configured:
1. **Start application** - Frontend on port 5000 (`cd artifacts/racing-shop && pnpm dev`)
2. **API Server** - Backend on port 3001 (`cd artifacts/api-server && pnpm dev`)

### Installing Dependencies
```bash
pnpm install --no-frozen-lockfile
```

### Pushing DB Schema
```bash
pnpm --filter "@workspace/db" push
```

## Deployment
- Target: `autoscale`
- Build: builds both frontend and backend
- Run: `node artifacts/api-server/dist/index.cjs`
- In production, the API server serves the built frontend static files

## Features
- Dashboard with sales summary and charts
- Sales input (Penjualan) with Excel-like interface
- Payment methods: Cash, Bank Transfer, Online Shop, Credit
- Pencairan - clearing online shop and credit transactions
- Biaya - operational expense tracking
- Master data: Products, Banks, Online Shops, Customers
- Modal - cost/profit analysis
- Laporan - reporting
- User management with role-based access control
- Export to Excel/PDF
