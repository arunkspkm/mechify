# ADR-001: Retail Shop Management Tool for Car Accessories Business

**Date:** 2026-03-27
**Status:** Proposed
**Deciders:** Shop Owner

---

## Context

The business is a retail car accessories shop that currently manages all inventory and operations manually using Excel spreadsheets. The shop sells a wide range of products — infotainment systems, speakers, horns, cameras, lights, car shampoo, perfumes, wipers, mobile holders, gear knobs, antennas, microfiber cloths, arm rests, spoilers, lips, and more. Many of these products require professional installation on vehicles.

The shop procures products from multiple vendors where pricing and quality vary. There is no systematic way to track batch-level cost, manage purchase orders, handle returns, monitor stock levels, manage employees, or analyze business performance. This creates risks around selling products below cost, stockouts, dead inventory, and lack of financial visibility.

A purpose-built retail shop management tool is needed to digitize and streamline all aspects of the business.

### Current Excel Structure (Reference)

The shop currently maintains inventory in an Excel spreadsheet with the following columns:

| Column | Purpose |
|---|---|
| Si No | Serial number |
| Description of Goods | Product name/description |
| HSN Code | Harmonized System of Nomenclature code (for GST classification) |
| Category | Product category |
| Quantity | Total quantity purchased |
| Unit | Unit of measurement (e.g., mtr, pcs, set) |
| Unit Price | Cost per unit (before tax) |
| Tax % | Applicable tax rate |
| Taxable Amount | Amount subject to tax |
| Unit Price GST Inc | Unit price inclusive of GST |
| Price | Selling price |
| MRP | Maximum Retail Price |
| Our Price | Shop's selling price (may differ from MRP) |
| CGST | Central GST component |
| SGST | State GST component |
| Distributors | Supplier/vendor name |
| Sold Quantity | Number of units sold |
| Stock | Current stock balance (Quantity - Sold Quantity) |

This structure must be supported during Excel import. The system should map these columns to the internal data model, preserving HSN codes, tax rates, MRP, supplier associations, and current stock levels.

---

## Decision

Build a comprehensive retail shop management application — **Mechify** — covering the following functional areas:

### 1. Configurable Master Data

All core lookup/reference data in the system must be fully configurable by the owner — no hardcoded lists. This ensures the system adapts as the business evolves without requiring code changes.

| Master Data | Examples | Used In |
|---|---|---|
| Units of Measurement | pcs, mtr, ltr, set, pair, kg, roll, bundle | Product catalog, billing, purchase orders |
| Product Categories | Electronics, Cleaning, Exterior, Interior, Lighting, Audio, Safety | Product catalog, reports, PO generation |
| Brands | Pioneer, JBL, Bosch, 3M, etc. | Product catalog, filtering |
| Expense Categories | Advertisement, Donations, Utilities, Rent, Maintenance, Transport | Expense management, reports |
| Payment Methods | Cash, UPI, Card, Bank Transfer, Credit | Billing, expense recording |
| Return Reasons | Didn't like, Defective, Warranty claim, Wrong item, Damaged in transit | Customer returns, supplier returns |
| Quality Grades | Premium, Standard, Economy | Batch tracking, supplier rating |
| Loyalty Tiers | Silver, Gold, Platinum | Customer loyalty program |
| Tax Rates | 5%, 12%, 18%, 28% (mapped to HSN codes) | GST management |
| Installation Charge Types | Standard, Complex, Custom | Billing |
| Vehicle Makes | Maruti Suzuki, Hyundai, Tata, Mahindra, Toyota, Kia, Honda, etc. | Invoices, estimates, customer vehicle profile |
| Vehicle Models | Swift, Creta, Nexon, XUV700, Innova, Seltos, etc. (linked to make) | Invoices, estimates, customer vehicle profile |
| Stock Adjustment Reasons | Damage, Theft, Miscounting, Natural Wastage, Found Excess | Stock audit, write-offs |
| Estimate Validity Periods | 7 days, 15 days, 30 days | Estimates & quotations |

Each master data type supports: add, edit, deactivate (soft delete to preserve historical references), and reorder/sort. The owner manages these through a dedicated settings/configuration screen.

### 2. Product & Catalog Management

- Maintain a master product catalog using the configurable categories, brands, and units defined in master data.
- Each product tracks: name, SKU, HSN code, category, brand, description, applicable vehicle types, MRP, and installation requirements.
- **Product images**: Each product can have one or more images (photos of the actual product). Images are displayed on the POS screen to help counter staff visually identify the correct product — reducing picking errors, especially for new staff or products with similar names. Images can be uploaded from the product management screen via file upload or device camera.
- Support product variants (e.g., different sizes, models, qualities).
- **Unit of measurement & bundle pricing**: Each product has a defined unit (selected from configurable units — pcs, mtr, ltr, set, etc.) and may be purchased in bulk bundles. The system must automatically derive the per-unit cost from the bundle. For example, speaker wire purchased as a 50 mtr bundle at Rs. 650 results in a per-unit (per mtr) cost of Rs. 13. The invoice always bills at the derived per-unit price multiplied by the quantity sold.
- **Related/companion items**: Flag items that are commonly needed together for installation (e.g., wiring harness with an infotainment system, mounting brackets with cameras). The billing screen must highlight these to the counter operator to prevent incomplete invoices.

### 3. Inventory & Batch Tracking

- **Batch-level tracking**: Every stock inward entry records the supplier, purchase date, batch number, quantity, unit purchase price, quality grade, and optionally an **expiry date**.
- **Expiry date tracking**: Products like car shampoos, perfumes, adhesives, and other consumables may have expiry dates. When an expiry date is recorded on a batch, the system:
  - Enforces FEFO (First Expiry, First Out) for that product during billing — selling the nearest-to-expiry batch first.
  - Sends alerts when a batch approaches its expiry date (configurable lead time, e.g., 30/60/90 days before expiry).
  - Flags expired batches prominently so they are not sold to customers.
  - Includes near-expiry and expired stock in dashboards and a dedicated report.
- The system must enforce FIFO (First In, First Out) — or FEFO for expiry-tracked products — or allow explicit batch selection during billing so that the correct cost basis is used per sale — preventing unknowing losses from selling newer expensive stock at older cheaper prices.
- **Landed cost calculation**: When products arrive with a courier/handling charge on the supplier invoice, the system distributes that charge proportionally across line items in that invoice to compute the true per-unit landed cost.
- **Stock levels**: Real-time stock quantity per product, with low-stock thresholds configurable per product.
- **Stock adjustment / physical audit**: Periodic physical stock verification is essential. The system supports:
  - **Stock audit workflow**: Select products (or full inventory) for audit → enter physical counts → system calculates discrepancy (excess or shortage) per product/batch → operator records a reason for each discrepancy (damage, theft, miscounting, natural wastage, etc.) → owner reviews and approves adjustments → system updates stock levels.
  - Each adjustment is logged with: date, product, batch, system qty, physical qty, variance, reason, adjusted by, approved by.
  - Stock adjustment reasons are configurable via master data.
- **Damaged / write-off stock**: Stock can become unsaleable due to in-store damage (dropped, broken), natural wastage (leaked perfume, expired shampoo), or other reasons separate from customer/supplier returns. The system provides:
  - A write-off flow: select product → select batch → enter quantity → select reason (from configurable reasons) → add notes → submit for owner approval.
  - Approved write-offs deduct the quantity from the batch and record the value lost at landed cost.
  - Write-off data feeds into P&L as an inventory loss line item and is included in analytics.
- **Import/Export**:
  - Import existing inventory from the current Excel spreadsheets (column mapping UI to handle the shop's existing format).
  - Export current inventory data to Excel/CSV at any time.

### 4. Supplier & Purchase Order Management

- Maintain a supplier directory: name, contact, product categories supplied, payment terms, quality rating.
- Track historical pricing per supplier per product to identify cost trends.
- **Automatic PO generation**: When stock falls below the configured low-stock threshold, the system generates a suggested purchase order. Supplier selection is based on a combination of lowest price and best quality rating.
- **PO lifecycle**: PO statuses — Draft, Sent, Partially Received, Closed. POs auto-close when the ordered quantity is fully received via stock inward entries referencing that PO.
- **Supplier returns**: Record returns to suppliers for faulty products or other reasons, linked to the original purchase batch. Track return status (Initiated, Shipped, Credit Received).

### 5. Billing & Point of Sale (POS)

- **Counter login**: Dedicated, simplified billing interface for counter staff. Minimal navigation, fast product search (by name, SKU, or barcode), and quick add-to-cart flow.
- **Batch-aware billing**: The system selects the appropriate batch (FIFO by default) and uses the corresponding landed cost to validate margin.
- **Installation charges**: Configurable installation/service charges per product or product category. Added as a line item on the invoice.
- **Related item reminders**: When a product with known companion items is added to the invoice, the system highlights the related items the counter operator should suggest or include.
- **Vehicle information**: Since most products are installed on vehicles, the invoice captures the customer's vehicle details — make, model, year, and registration number. This information is:
  - Printed on the invoice for reference.
  - Used for warranty claims — linking the product to the specific vehicle it was installed on.
  - Stored in the customer profile for future visits — enabling quick selection of a previously entered vehicle.
  - Vehicle makes and models are configurable via master data.
- **Discount controls**: The shop owner sets a maximum discount threshold (percentage or absolute) per product or globally. Counter staff cannot exceed this threshold without owner override/approval.
- **Margin protection**: Independent of discount thresholds, the system enforces a hard floor — if the final selling price (after all discounts) falls at or below the batch's landed cost, the system blocks the sale and shows a loss warning. Only the owner can override this with explicit approval. This prevents accidental below-cost sales regardless of how discounts are configured.
- **Invoice numbering & financial year**: The system follows the Indian financial year (April–March). Invoice numbers follow a configurable format (e.g., `MEC/2026-27/0001`) and auto-increment sequentially. The number series resets or continues based on owner preference at the start of each financial year. The current financial year is derived automatically from the system date.
- **Invoice generation**: Printed/digital invoices with itemized product costs, installation charges, discounts, taxes, vehicle details, and totals.
- **Split payments**: Customers can pay a single invoice using multiple payment methods — e.g., part cash + part UPI, or part card + part cash. The system records each payment leg with its method and amount, and the invoice is marked paid only when the total is fully settled.
- **Price label printing**: Generate and print pricing labels/stickers for products directly from the system. Labels include product name, SKU/barcode, MRP, selling price ("Our Price"), and optionally the category. The counter operator or owner can select one or more products, specify the quantity of labels needed, and print them in standard label sheet formats (e.g., A4 multi-label sheets, thermal label rolls). Useful during new stock arrivals or price changes.

### 6. Estimates & Quotations

- **Estimate creation**: Before a customer commits to a purchase — especially for big-ticket items like infotainment systems, camera setups, or speaker installations — the counter operator can create an estimate (proforma invoice). The estimate includes: product line items, quantities, unit prices, installation charges, discounts, taxes (if GST enabled), vehicle details, and a grand total.
- **Estimate numbering**: Estimates follow a separate configurable number series (e.g., `EST/2026-27/0001`), distinct from invoice numbers.
- **Validity period**: Each estimate has a configurable validity period (e.g., 7 or 15 days). Expired estimates are flagged but remain accessible.
- **Estimate-to-invoice conversion**: An approved estimate can be converted to a final invoice with a single action. All line items, prices, discounts, and vehicle details carry over. The counter operator can still make adjustments before finalizing.
- **Estimate tracking**: Track estimates by status — Draft, Sent to Customer, Converted to Invoice, Expired, Cancelled. This helps understand quote-to-sale conversion rates.
- **Print / share**: Estimates can be printed or shared digitally (PDF) with the customer for their consideration.

### 7. Day-End Closing & Shift Management

- **Shift opening**: When a counter operator starts their shift, they record the opening cash balance in the drawer. The system logs the operator, start time, and opening amount.
- **Shift closing / day-end reconciliation**: At the end of the shift (or end of day), the operator performs a closing:
  - The system calculates expected totals by payment method: total cash collected, total UPI, total card, total credit sales, total returns/refunds for the shift period.
  - The operator enters the actual cash in the drawer.
  - The system shows the variance (expected vs. actual) and the operator records a reason for any discrepancy (e.g., rounding, petty cash withdrawal, miscounting).
  - The shift is closed with a summary: opening balance, sales by payment method, returns, expenses paid from counter, closing balance, variance.
- **Multiple shifts**: Support multiple shifts per day if the shop operates in shifts (e.g., morning and evening operators).
- **Owner review**: The owner can review all shift closing summaries, spot trends in cash variances, and approve/flag discrepancies.
- **Day-end report**: A printable shift closing summary for the operator and owner to sign off on.

### 8. Customer Enquiry & Order Tracking

- **Enquiry recording**: The billing counter can record customer enquiries when a customer asks about a product that is out of stock or not currently in the catalog. Each enquiry captures: customer name/phone, product description, desired quantity, date, and any notes.
- **Enquiry-to-order conversion**: If the shop decides to procure the enquired product, the enquiry can be converted into an internal customer order with a single action. The system links this order to the relevant purchase order raised to the supplier.
- **Order lifecycle**: Customer order statuses — Enquiry Recorded, Order Placed (PO raised), In Transit, Received (stock arrived), Customer Notified, Delivered/Closed, Cancelled.
- **Customer notification**: When the ordered product arrives and is received into inventory, the system flags the order for customer notification. The counter operator marks it as "Customer Notified" after informing the customer.
- **Enquiry analytics**: Track enquiry volume by product/category to identify demand for products not currently stocked — feeding into purchasing decisions and catalog expansion.
- **Counter view**: The billing counter has a dedicated tab/section to view all open enquiries and pending customer orders, making it easy to update status or inform walk-in customers about their order.

### 9. GST Management

- The shop currently does **not** have GST registration as sales have not reached the Indian government's mandatory threshold. However, this threshold may be crossed in the next financial year.
- The system must be **GST-ready from day one** with the ability to toggle GST on or off at the business level.
- **When GST is disabled**: Invoices do not show tax breakdowns. Internal records still retain HSN codes and tax rates per product for future readiness.
- **When GST is enabled**: Invoices include full tax breakdowns — CGST, SGST (intra-state) or IGST (inter-state), HSN code, taxable amount, and tax amount per line item.
- Tax rates are configurable per product (mapped via HSN code). Common rates: 5%, 12%, 18%, 28%.
- **GST reports**: When enabled, generate GSTR-1 (outward supplies), GSTR-3B (summary return), and HSN-wise summary reports to simplify filing.

### 10. Customer Loyalty Program

- **Points accrual**: Customers earn loyalty points on each purchase. The points-per-rupee ratio is configurable by the owner (e.g., 1 point per Rs. 100 spent).
- **Points redemption**: Accumulated points can be redeemed as a discount on future purchases. The redemption value (e.g., 100 points = Rs. 10) is configurable.
- **Customer profile**: Maintain a customer directory with name, phone number, purchase history, and loyalty points balance.
- **Tier system (optional)**: Owner can define tiers (e.g., Silver, Gold, Platinum) based on cumulative spend, with higher tiers earning points at a faster rate.
- Points should have a configurable expiry period (e.g., 12 months from accrual).
- The POS screen should display the customer's points balance and prompt for redemption during checkout.

### 11. Returns & Warranty Management

- **Customer returns**: Record returns with reason (didn't like, defective, warranty claim, etc.), linked to the original invoice.
- Track return status: Pending, Approved, Refunded/Replaced/Credited.
- Returned items re-enter inventory (if resaleable) or are flagged for supplier return/write-off.
- **Warranty tracking**: Record warranty period per product/batch. Alert when warranty claims are valid or expired.

### 12. Credit & Accounts Tracking

Credit transactions occur on both the purchase side (money owed to suppliers) and the sales side (money owed by customers). The system must track both to give a complete picture of the shop's payables and receivables.

#### Purchase Credit (Payables — money the shop owes to suppliers)

- When goods are received from a supplier, the payment may be made in full, partially, or entirely on credit.
- Each purchase invoice records: total amount, amount paid, and outstanding balance.
- **Supplier ledger**: A running account per supplier showing all purchases, payments made, credit notes (from supplier returns), and current outstanding balance.
- **Payment recording**: Record partial or full payments against a supplier's outstanding balance at any time. Each payment logs: date, amount, payment method, and reference (e.g., cheque number, UTR).
- **Credit period tracking**: If a supplier offers a credit period (e.g., 30 days), the system flags overdue payables.
- **Payable aging report**: Categorize outstanding amounts by age (0-30 days, 31-60 days, 61-90 days, 90+ days) to prioritize payments.

#### Sales Credit (Receivables — money customers owe to the shop)

- Customers may take products on credit — paying partially or promising to pay later.
- During billing, the counter operator can mark an invoice as "Credit Sale" and record the amount paid vs. outstanding.
- **Customer ledger**: A running account per customer showing all credit purchases, payments received, and current outstanding balance.
- **Payment collection**: Record partial or full payments against a customer's outstanding balance. Each collection logs: date, amount, payment method, received by (counter operator), and reference.
- **Credit limit**: The owner can set a maximum credit limit per customer. The system warns or blocks new credit sales if the customer's outstanding balance exceeds their limit.
- **Receivable aging report**: Categorize outstanding amounts by age to identify overdue collections.
- **Credit sale visibility**: The POS screen shows the customer's current outstanding balance when their profile is selected, so the counter operator is aware before extending further credit.

### 13. Employee Management

- **Attendance tracking**: Daily attendance log for all employees.
- **Salary management**: Support multiple pay cycles — monthly, weekly, or per-call/on-call.
- **Salary advance**: Record advances given to employees, automatically deducted from future salary payouts.
- **On-call workers**: Log per-job payments for on-call/contract workers with service date and amount.

### 14. Expense Management

- Record miscellaneous business expenses under configurable categories: Advertisement, Donations, Utilities, Rent, Maintenance, Transport, etc.
- Each expense entry: date, category, description, amount, payment method.
- Expense data feeds into P&L and business analytics.

### 15. Business Analytics & Reporting

- **Profit & Loss**: Revenue vs. cost of goods sold (using batch-level landed cost) vs. operating expenses.
- **Day-to-day business trends**: Daily/weekly/monthly sales volume and revenue charts.
- **Stock analytics**:
  - Fast-moving products (highest sales velocity).
  - Dead stock (no sales in configurable period, e.g., 90 days).
  - Low stock alerts.
- **Expense analysis**: Highest expense categories, month-over-month trends.
- **Supplier analytics**: Price trends per product across suppliers, quality ratings.
- **Customer analytics**: Top customers by spend, loyalty tier distribution, repeat purchase rate.
- **Cash flow tracking**: Beyond P&L, the system tracks actual money movement to give the owner a real-time liquidity picture:
  - **Daily cash flow**: All inflows (cash sales, UPI/card collections, credit payment collections) vs. all outflows (supplier payments, expenses, salary disbursements, petty cash) for each day.
  - **Cash in hand**: Running balance of physical cash based on shift opening/closing data.
  - **Bank balance tracking (manual)**: Owner can record bank account balances periodically. The system tracks UPI and card payment inflows expected vs. settled to bank.
  - **Cash flow dashboard**: Visual chart showing daily/weekly/monthly net cash flow trends, helping the owner anticipate tight periods and plan supplier payments accordingly.
- **Dashboard**: A single-screen overview with key KPIs — today's sales, current stock value, pending POs, low-stock count, P&L summary, top products, cash position, near-expiry alerts.

#### Downloadable Reports

All reports must be available for download in PDF and Excel/CSV formats. The following reports are required:

| Report | Description | Formats |
|---|---|---|
| Daily Sales Report | All invoices for a selected date with line items, totals, and payment method breakdown | PDF, Excel |
| Monthly Sales Summary | Aggregated sales, returns, and net revenue for a month | PDF, Excel |
| Profit & Loss Statement | Revenue, COGS (batch-level), gross margin, operating expenses, net profit for a period | PDF, Excel |
| Inventory Valuation | Current stock with quantity, landed cost, and total value per product | PDF, Excel |
| Stock Movement | Inward, outward, and return quantities per product for a period | Excel |
| Low Stock Report | Products below their configured threshold with suggested reorder qty | PDF, Excel |
| Dead Stock Report | Products with zero sales in a configurable period | PDF, Excel |
| Purchase Order Report | All POs for a period with status, supplier, and amounts | PDF, Excel |
| Supplier-wise Purchase | Purchase history grouped by supplier for a period | Excel |
| Customer Purchase History | Purchases by a specific customer or all customers for a period | PDF, Excel |
| Loyalty Points Statement | Points earned, redeemed, and balance per customer | PDF |
| Employee Attendance | Attendance summary for a period by employee | PDF, Excel |
| Salary Report | Salary disbursements, advances, and deductions for a period | PDF, Excel |
| Expense Report | All expenses by category for a period | PDF, Excel |
| GST Reports (when enabled) | GSTR-1, GSTR-3B, HSN-wise summary | PDF, Excel |
| Returns Report | Customer and supplier returns with reasons and resolution status | PDF, Excel |
| Enquiry & Order Report | All customer enquiries and orders with status, conversion rate, and demand patterns | PDF, Excel |
| Accounts Payable (Supplier) | Outstanding balances per supplier with aging breakdown (0-30, 31-60, 61-90, 90+ days) | PDF, Excel |
| Accounts Receivable (Customer) | Outstanding balances per customer with aging breakdown and credit limit utilization | PDF, Excel |
| Supplier Ledger | Full transaction history for a supplier — purchases, payments, credit notes, running balance | PDF, Excel |
| Customer Ledger | Full transaction history for a customer — credit sales, payments received, running balance | PDF, Excel |
| Estimate Report | All estimates for a period with status, conversion rate, and value of converted vs. lost quotes | PDF, Excel |
| Shift Closing Report | Per-shift summary — sales by payment method, opening/closing balance, variance | PDF |
| Stock Audit Report | Audit results — products audited, discrepancies found, adjustments made, reasons, approvals | PDF, Excel |
| Stock Write-Off Report | All write-offs for a period — products, quantities, value lost, reasons | PDF, Excel |
| Expiry Alert Report | Batches approaching expiry within configurable lead time, and already expired batches with remaining qty | PDF, Excel |
| Cash Flow Statement | Daily/weekly/monthly inflows vs. outflows, net cash flow, running cash position | PDF, Excel |

---

## Architectural Considerations

### Data Model Highlights

| Entity | Key Attributes |
|---|---|
| Master Data (generic) | Type (unit, category, brand, expense category, payment method, return reason, quality grade, loyalty tier, tax rate, installation charge type, vehicle make, vehicle model, stock adjustment reason, estimate validity period), name, parent ref (e.g., model → make), display order, active flag |
| Product | SKU, name, HSN code, category ref, brand ref, unit ref, bundle size, variants, MRP, selling price, installation charge, tax rate ref, related items, low-stock threshold, images (one or more), has expiry (boolean) |
| Batch | Product ref, supplier ref, PO ref, purchase date, qty received (in bundle units), bundle size, unit cost, derived per-unit cost, courier/handling charge, landed cost per unit, quality grade ref, **expiry date** (optional), current qty remaining |
| Supplier | Name, contact, categories, quality rating, payment terms, credit period (days) |
| Purchase Order | Supplier ref, line items (product, qty, agreed price), status, created date |
| Purchase Invoice | Supplier ref, PO ref, line items, total amount, amount paid, outstanding balance, due date |
| Supplier Payment | Supplier ref, purchase invoice ref, date, amount, payment method, reference (cheque/UTR), notes |
| Estimate | Estimate number, counter operator, customer ref, vehicle ref, line items (product, qty, unit price, discount, installation charge, tax breakdown), subtotal, tax total, grand total, validity date, status (Draft/Sent/Converted/Expired/Cancelled), converted invoice ref, date |
| Invoice | Invoice number (formatted per financial year), counter operator, customer ref, vehicle ref, estimate ref (if converted), line items (product, batch, qty, unit price, discount, installation charge, tax breakdown), subtotal, tax total, grand total, GST enabled flag, credit sale flag, amount paid, outstanding balance, date |
| Invoice Payment | Invoice ref, payment method ref (Cash/UPI/Card/Bank Transfer/Credit), amount — multiple records per invoice for split payments |
| Customer | Name, phone, email, loyalty points balance, loyalty tier ref, credit limit, outstanding balance |
| Customer Vehicle | Customer ref, vehicle make ref, vehicle model ref, year, registration number — multiple vehicles per customer |
| Customer Payment | Customer ref, invoice ref, date, amount, payment method, received by (operator), reference, notes |
| Loyalty Transaction | Customer ref, invoice ref, points earned/redeemed, transaction date, expiry date |
| Customer Enquiry | Customer name/phone, product description, desired qty, date, notes, status (Enquiry Recorded → Order Placed → In Transit → Received → Customer Notified → Delivered/Closed / Cancelled), linked PO ref |
| Customer Return | Invoice ref, product, batch, reason ref, status, resolution |
| Supplier Return | Batch ref, product, qty, reason ref, status, credit amount |
| Stock Adjustment | Date, product ref, batch ref, system qty, physical qty, variance, reason ref, notes, adjusted by (operator), approved by (owner), status (Pending Approval/Approved/Rejected) |
| Stock Write-Off | Date, product ref, batch ref, qty written off, landed cost value lost, reason ref, notes, submitted by, approved by (owner), status |
| Shift | Counter operator, date, opening balance, closing balance, expected cash, actual cash, variance, variance reason, status (Open/Closed), start time, end time |
| Employee | Name, role, pay type (monthly/weekly/on-call), salary amount |
| Attendance | Employee ref, date, status (present/absent/half-day) |
| Salary Transaction | Employee ref, period, gross, advance deduction, net, payment date |
| Expense | Date, category ref, description, amount, payment method ref |
| Business Config | GST enabled (boolean), GST number, loyalty points ratio, redemption value, point expiry months, default discount threshold, default credit limit, financial year start month, invoice number format, estimate number format, expiry alert lead days |

### Non-Functional Requirements

- **Usability**: The POS/billing screen must be optimized for speed and simplicity — minimal clicks, keyboard shortcuts, barcode scanner support.
- **Data integrity**: Batch-level cost tracking is critical for accurate margin calculation. The system must never allow a sale without a traceable cost basis.
- **Role-based access**: At minimum two roles — Owner (full access, settings, analytics, discount overrides) and Counter Operator (billing, basic stock lookup).
- **Offline resilience**: The shop may have intermittent internet. Core billing and inventory operations should work offline with sync capability.
- **Data portability**: Excel import for migration, Excel/CSV export for ongoing use.
- **Backup & data recovery**: The system must implement a robust backup strategy to protect business-critical data:
  - **Automated daily backups**: Full database backup runs automatically every day at a configurable time (e.g., after shop closing hours). Backups are stored both locally and on a remote/cloud location for redundancy.
  - **Backup retention**: Configurable retention policy — e.g., daily backups kept for 30 days, weekly backups kept for 3 months, monthly backups kept for 1 year.
  - **Manual backup on demand**: The owner can trigger a manual backup at any time from the settings screen (e.g., before a major data import or system update).
  - **Restore capability**: A documented and tested restore procedure. The owner or administrator can restore from any available backup point. Restore should be a guided process with confirmation steps to prevent accidental overwrites.
  - **Backup verification**: Periodic automated integrity checks to ensure backups are not corrupted and can be restored successfully.
  - **Backup notifications**: The owner is alerted if a scheduled backup fails or if no backup has been completed in the last 24 hours.

### Technology Stack (To Be Decided)

The technology stack will be evaluated and decided in a subsequent ADR. Key considerations include:

- Web-based vs. desktop application
- Cloud-hosted vs. local server
- Database selection (relational DB preferred given the transactional nature)
- Frontend framework for the POS interface
- Reporting/charting library

---

## Consequences

### Positive

- Eliminates risk of selling below cost by enforcing batch-level cost tracking, bundle-to-unit cost derivation, landed cost calculation, and hard margin protection floor.
- Automates purchase order generation, reducing stockouts and manual effort.
- Provides real-time business visibility through analytics, dashboards, cash flow tracking, and 28+ downloadable reports.
- Streamlines billing with vehicle info capture, related item reminders, discount guardrails, split payment support, and estimates/quotations workflow.
- GST-ready architecture allows seamless transition when the threshold is crossed — no system changes needed, just flip a toggle.
- Invoice numbering aligned with Indian financial year (April–March) ensures compliance readiness.
- Customer loyalty program drives repeat business and increases customer retention.
- Enquiry tracking captures unmet demand, enabling data-driven catalog expansion and reducing lost sales.
- Price label printing eliminates manual labelling effort during stock arrivals and price changes.
- Product images on POS screen reduce picking errors and speed up staff onboarding.
- Configurable master data (14 types including vehicle makes/models) ensures the system adapts to business changes without code modifications.
- Credit tracking on both purchase and sales sides gives full visibility into payables and receivables with aging analysis.
- Expiry date tracking with FEFO enforcement and advance alerts prevents selling expired products (shampoos, perfumes, adhesives).
- Stock audit and write-off workflows ensure inventory accuracy with full traceability and owner approval.
- Day-end shift closing with cash reconciliation provides daily financial accountability at the counter level.
- Automated backup strategy with local + remote storage protects against data loss.
- Centralizes employee, expense, and return tracking — replacing scattered spreadsheets.
- Excel import with column mapping provides a smooth migration path from the current system, preserving HSN codes, tax rates, and stock levels.

### Negative / Risks

- Initial data migration from Excel requires careful column mapping and validation to avoid data quality issues.
- Training counter staff on the new system will require time and patience.
- The breadth of features means a phased delivery approach is necessary to avoid scope overload.
- Batch-level tracking adds complexity to daily stock inward operations compared to simple quantity updates.

### Mitigation

- Provide a guided Excel import wizard with preview and validation.
- Design the POS screen for minimal learning curve — large buttons, search-first flow, clear prompts.
- Deliver in phases:
  - Phase 1: Master Data + Product Catalog + Inventory (with expiry & write-off) + Billing/POS (with vehicle info, margin protection, shift closing) + GST toggle + Price Labels + Estimates + Invoice Numbering + Backup
  - Phase 2: PO + Supplier management + Enquiry/Order Tracking + Credit Tracking (payables & receivables)
  - Phase 3: Employee + Expenses + Loyalty + Stock Audit
  - Phase 4: Analytics + Reports + Dashboard + Cash Flow Tracking
- Allow a parallel-run period where Excel and the app are used side by side before full cutover.

---

## References

- Current inventory Excel columns: Si No, Description of Goods, HSN Code, Category, Quantity, Unit, Unit Price, Tax %, Taxable Amount, Unit Price GST Inc, Price, MRP, Our Price, CGST, SGST, Distributors, Sold Quantity, Stock
- Shop operations: As described by the owner in the project brief
- Indian GST framework: CGST + SGST (intra-state), IGST (inter-state), HSN-based classification
- GST registration threshold: As per current Indian government mandate (shop has not yet crossed it)
