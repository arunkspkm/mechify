# Mechify — Retail Shop Management System

A comprehensive, self-hosted retail management system built for car accessories shops. Replaces Excel-based operations with a modern web application covering billing, inventory, purchases, employees, returns, warranty tracking, and business analytics.

Built with **Next.js 16** + **TypeScript** + **PostgreSQL** + **Prisma** + **Tailwind CSS** + **shadcn/ui**. Designed to run on a local server (LAN) using Docker.

---

## Features

### Point of Sale (POS)
- Three-column POS layout: product search, cart, customer + payment
- Product search by name, SKU, or barcode with keyboard navigation (arrow keys + Enter)
- Custom items (products not in catalog)
- Split payments (cash, UPI, card, credit)
- Discount with real-time margin guard (10% minimum above landed cost)
- Price locked for counter operators — only owner can override
- Companion product alerts
- Installation charge per item
- Bill hold/resume for serving multiple customers
- Cart auto-saves across page navigation
- Confirmation dialog before completing sale
- GST support (CGST/SGST) with toggle
- Customer loyalty points (earn on purchase, redeem as discount)
- Phone-first customer identification
- Vehicle selection (make/model/registration)
- Credit sale support with customer credit limit

### Invoices & Estimates
- Auto-generated invoice numbers (Indian FY format: `MEC/2026-27/0001`)
- Print-optimized invoices with shop details
- PDF download (jsPDF)
- WhatsApp share with pre-filled message
- Estimates with validity period
- Convert estimate to invoice (one-click)
- Price labels printing (A4 65-up, 40-up, 24-up + thermal)

### Inventory & Stock
- Multi-item stock inward with handling charge distribution
- FIFO/FEFO batch tracking
- Landed cost calculation per unit
- Bundle size support (e.g., 50m cable sold by meter)
- Low stock alerts
- Near-expiry alerts
- Stock write-off with owner approval workflow
- Excel import for bulk product + stock setup
- Excel export for inventory
- Auto-generated SKU (first 3 chars per word, max 16 chars)

### Purchase Management
- Supplier CRUD with quality rating
- Purchase Orders with auto-generate from low stock
- Purchase Invoices with supplier bill tracking
- Supplier advance payments
- Overpayment detection and credit application
- Supplier payment history per invoice
- Auto-detect supplier from product's last batch

### Returns & Warranty
- **Customer Returns** — from invoice, with reason codes
  - Refund (cash back)
  - Warranty (send to supplier, track status)
  - Replace (immediate replacement from stock)
  - Credit (store credit)
- **Warranty Tracking** — full lifecycle
  - Replace now from stock, send defective to supplier later
  - Send for repair, customer waits
  - Status: Sent for Warranty -> Replacement Received / Repaired / Rejected
  - Replacement restocks to inventory when received from supplier
- **Supplier Returns** — auto-detect supplier from batch, credit applies to oldest outstanding invoices
- Return refunds deducted from shift cash reconciliation
- Return discount-aware (refunds effective price after discount)

### Customer Management
- Phone-first identification across all flows
- Customer profile with outstanding balance, vehicles, loyalty points
- Credit sales with payment collection
- Vehicle management (make/model/registration)
- Loyalty points history (earn, redeem, transactions)

### Employee & Payroll
- Employee CRUD with daily wage rate
- Daily attendance grid (Present, Absent, Half Day, On-Call, Leave, Holiday)
- Sunday in red, click header to mark all as Holiday
- Weekly salary settlement (Saturday)
  - Auto-calculates: presentDays x dailyWage + onCallDays x rate - advances
  - Preview breakdown before settling
- Advance payments with tracking
- Partial pay and overpay support (excess becomes advance)

### Expenses
- Expense recording with categories and payment methods
- Date and category filters
- Summary by category

### Shifts & Cash Reconciliation
- Shift open/close with cash counting
- Expected vs actual cash with variance
- Customer return refunds deducted from expected cash
- Variance reason required when cash doesn't match
- Only shift operator or owner can close a shift
- Shift detail with all invoices and returns

### Reports & Analytics
- **Financial Year aware** — defaults to Indian FY (Apr-Mar)
- Quick period buttons: This FY, Last FY, Quarter, Month, Week
- All reports support **Excel download**

| Report | Details |
|--------|---------|
| **Sales** | Revenue, discounts, collections, outstanding. Sales trend chart. Discount analysis by product and operator. |
| **Inventory** | Stock value (cost + retail), low stock, near expiry. |
| **P&L** | Revenue -> COGS -> Gross Profit -> Expenses -> Salaries -> Net Profit. Expense breakdown pie chart. |
| **GST** | B2C summary (GSTR-1 Table 7), HSN summary (Table 12), invoice-level tax details. |
| **Supplier Ledger** | Per-supplier purchases, paid, outstanding, overpayments, pending advances. |
| **Customer Ledger** | Per-customer sales, paid, outstanding. |
| **Payroll** | Weekly settlements, pending advances, totals. |
| **Returns** | Customer & supplier returns by product with reason breakdown. |

### Dashboard
- **KPI Cards** — today/week/month sales, profit, payables, receivables
- **Sales Chart** — 30-day bar chart (Recharts)
- **Top Products** — pie chart
- **Low Stock Alerts** — table with links
- **Recent Invoices** — quick access
- **Business Health Metrics:**
  - Revenue growth (vs last month)
  - Average bill value trend
  - Gross margin %
  - Discount leakage %
  - Return rate
  - New vs returning customers
  - Dead stock (no sales in 60+ days)
  - Enquiry conversion rate
  - Receivables aging (< 30, 30-60, > 60 days)

### Notifications
- In-app bell icon with unread count
- Auto-polls every 30 seconds
- Click to navigate to relevant page
- Triggered on: return created, return approved/rejected, write-off submitted, shift variance, price change, new enquiry

### Roles & Permissions

| Feature | Owner | Manager | Counter Operator |
|---------|-------|---------|-----------------|
| Billing / POS | Yes | Yes | Yes |
| Invoices, Estimates | Yes | Yes | Yes |
| Enquiries, Returns (create) | Yes | Yes | Yes |
| Shifts, Customers | Yes | Yes | Yes |
| Returns (approve/reject) | Yes | Yes | No |
| Employees, Attendance | Yes | Yes | No |
| Expenses, Advances | Yes | Yes | No |
| Reports | Yes | Yes | No |
| Dashboard | Yes | Yes | Billing only |
| Products, Master Data | Yes | No | No |
| Settings, Users | Yes | No | No |
| Salary Settlement | Yes | No | No |
| Price Override | Yes | No | No |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma v7 with `@prisma/adapter-pg` |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Excel | xlsx (SheetJS) |
| Auth | NextAuth.js (Credentials + JWT) |
| Deployment | Docker (PostgreSQL + Node.js) |

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/mechify.git
cd mechify

# Create environment file
cp .env.example .env
# Edit .env and set:
#   DB_PASSWORD=your_secure_password
#   NEXTAUTH_SECRET=your_random_secret_key

# Start with Docker
docker compose up -d --build

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Seed default data (admin user + master data)
docker compose exec app npx prisma db seed

# Access the app
# Open http://localhost:3000
```

**Default login:** `admin` / `admin123` — change the password immediately.

### Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your local PostgreSQL connection

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Seed data
npx prisma db seed

# Start dev server
npm run dev
```

---

## Deployment

### Docker (Recommended)

See [DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md) for detailed Windows 10 deployment instructions.

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

The app runs on port 3000. Access from LAN: `http://<server-ip>:3000`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `DB_PASSWORD` | Database password | `mechify_secret` |
| `NEXTAUTH_SECRET` | JWT signing secret | Required |
| `NEXTAUTH_URL` | App URL | `http://localhost:3000` |

---

## Database Schema

30+ Prisma models organized by domain:

- **Auth** — User, UserRole (Owner/Manager/Counter Operator)
- **Master Data** — Polymorphic table for 14 configurable types (categories, brands, units, tax rates, vehicle makes/models, etc.)
- **Products** — Product, ProductImage, ProductCompanion, ProductPriceChange
- **Inventory** — Batch (FIFO/FEFO), StockAdjustment, StockWriteOff
- **Billing** — Invoice, InvoiceItem, InvoicePayment, Estimate, EstimateItem
- **Customers** — Customer, CustomerVehicle, CustomerPayment, LoyaltyTransaction
- **Suppliers** — Supplier, PurchaseOrder, PurchaseInvoice, SupplierPayment
- **Returns** — CustomerReturn, CustomerReturnItem (with warranty tracking), SupplierReturn, SupplierReturnItem
- **Employees** — Employee, Attendance, SalaryRecord, AdvancePayment
- **Operations** — Shift, Expense, CustomerEnquiry, Notification, BusinessConfig

---

## Project Structure

```
mechify/
├── prisma/
│   ├── schema.prisma          # Database schema (30+ models)
│   ├── seed.ts                # Default master data + admin user
│   └── migrations/            # 22 migration files
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # All authenticated pages
│   │   │   ├── billing/       # POS, invoices, price labels
│   │   │   ├── products/      # Catalog, import, edit
│   │   │   ├── inventory/     # Stock overview, inward, write-offs
│   │   │   ├── suppliers/     # Supplier profiles, advances
│   │   │   ├── purchase-*/    # POs, purchase invoices
│   │   │   ├── customers/     # Profiles, vehicles, payments
│   │   │   ├── returns/       # Customer + supplier returns
│   │   │   ├── employees/     # Staff management
│   │   │   ├── attendance/    # Daily attendance grid
│   │   │   ├── expenses/      # Expense tracking
│   │   │   ├── estimates/     # Quotations
│   │   │   ├── enquiries/     # Customer orders
│   │   │   ├── shifts/        # Cash reconciliation
│   │   │   ├── reports/       # 8 report types + Excel export
│   │   │   ├── dashboard/     # KPI + business health
│   │   │   ├── settings/      # Business config, backup
│   │   │   └── users/         # User management
│   │   ├── api/               # 40+ REST API routes
│   │   └── login/             # Authentication
│   ├── components/
│   │   ├── billing/           # POS screen
│   │   ├── inventory/         # Stock inward form
│   │   ├── layout/            # Sidebar with notifications
│   │   ├── shared/            # AsyncSelect, QuickAddProduct, etc.
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── prisma.ts          # Database client
│   │   ├── auth.ts            # NextAuth config
│   │   ├── batch-selector.ts  # FIFO/FEFO selection
│   │   ├── landed-cost.ts     # Handling charge distribution
│   │   ├── margin-guard.ts    # Minimum margin enforcement
│   │   ├── gst.ts             # CGST/SGST calculation
│   │   ├── invoice-number.ts  # Atomic number generation
│   │   ├── financial-year.ts  # Indian FY helpers
│   │   ├── pdf-generator.ts   # Invoice/estimate PDF
│   │   ├── excel-export.ts    # Excel generation
│   │   ├── excel-import.ts    # Excel parsing + column mapping
│   │   ├── notify.ts          # Notification helper
│   │   ├── sku-generator.ts   # Auto SKU generation
│   │   ├── round.ts           # Financial rounding
│   │   ├── validation.ts      # Zod error formatting
│   │   └── roles.ts           # Role hierarchy helpers
│   ├── hooks/
│   │   └── use-barcode-scanner.ts
│   └── types/
│       └── product.ts         # Zod schemas
├── scripts/
│   ├── backup.sh              # PostgreSQL backup
│   └── restore.sh             # Restore from backup
├── docker-compose.yml
├── Dockerfile
├── DEPLOY-WINDOWS.md          # Windows deployment guide
└── README.md
```

---

## Configuration

After first login, go to **Settings** to configure:

| Setting | Description |
|---------|-------------|
| Shop Name, Address, Phone | Appears on invoices and PDFs |
| GST Enabled | Toggle GST on invoices |
| GST Number | GSTIN for invoice header |
| Invoice Prefix | e.g., `MEC` -> `MEC/2026-27/0001` |
| Financial Year Start | 4 = April (Indian FY) |
| Max Discount % | Global cap for counter operators |
| Loyalty Enabled | Toggle loyalty program |
| Points Per Rupee | e.g., 0.01 = 1 point per Rs.100 |
| Redemption Value | Rs per point (e.g., 1 = Rs.1/point) |
| Expiry Alert Days | Low expiry warning threshold |

---

## Backup & Restore

### Manual Backup
```bash
docker compose exec app sh scripts/backup.sh
```

### Automated (Windows Task Scheduler)
See [DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md#automated-daily-backup) for cron setup.

### Restore
```bash
docker compose exec app sh -c "gunzip -c /app/backups/mechify_backup_YYYYMMDD.sql.gz | psql $DATABASE_URL"
```

---

## Screenshots

> TODO: Add screenshots of Dashboard, POS, Reports, etc.

---

## License

MIT

---

## Credits

Built with [Claude Code](https://claude.ai/claude-code) by Anthropic.
