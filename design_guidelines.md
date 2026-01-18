# Ad Agency Billing System - Design Guidelines

## Design Approach

**Selected System:** Carbon Design System (IBM)
**Rationale:** Purpose-built for data-intensive enterprise applications with emphasis on productivity, clarity, and efficient data presentation. Perfect for finance/billing tools replacing Excel workflows.

**Supporting References:** Stripe Dashboard (clean financial UI), QuickBooks (invoicing patterns), Linear (modern productivity aesthetics)

---

## Core Design Principles

1. **Data Clarity First** - Information hierarchy optimized for quick scanning and decision-making
2. **Desktop-Optimized Workflows** - Primary focus on wide-screen efficiency with responsive mobile views
3. **Familiar Excel-Like Patterns** - Minimize learning curve with recognizable table structures
4. **Professional Financial Aesthetic** - Trustworthy, clean, no-nonsense business tool

---

## Typography System

**Font Family:** IBM Plex Sans (via Google Fonts CDN)
- Primary: IBM Plex Sans for UI and data
- Monospace: IBM Plex Mono for numbers, currency, invoice codes

**Type Scale:**
- Page Titles: text-3xl font-semibold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Table Headers: text-sm font-semibold uppercase tracking-wide (14px)
- Table Data: text-sm (14px)
- Meta Info/Labels: text-xs uppercase tracking-wider (12px)
- Numbers/Currency: Use tabular-nums for alignment

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing: gap-2, p-2 (component internals)
- Standard spacing: gap-4, p-4, mb-4 (card padding, form fields)
- Section spacing: py-8, gap-8 (between major sections)
- Page margins: p-6 to p-8 on containers

**Grid Structure:**
- Dashboard: 12-column grid with 2-3-4 column metric cards
- Main content area: max-w-7xl with side navigation (240px fixed width)
- Tables: Full-width within containers with horizontal scroll if needed
- Forms: 2-column layout on desktop, stack on mobile

---

## Component Library

### Navigation
- **Top Bar:** Fixed header with logo left, client switcher center, user profile right (h-16)
- **Sidebar:** Collapsible left navigation (240px expanded, 64px collapsed) with icon + label pattern
- **Breadcrumbs:** Below top bar for deep navigation contexts

### Data Display
- **Tables:** Striped rows, hover states, sticky headers, sortable columns, right-aligned numbers
- **Metric Cards:** Large number display with label, trend indicator, icon (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- **Status Badges:** Pill-shaped with subtle backgrounds (Paid, Pending, Overdue)
- **Data Lists:** Compact alternating row style for transaction histories

### Forms & Input
- **Form Layout:** Label above input, helper text below, required indicators
- **Input Fields:** Medium height (h-10), clear borders, focus rings
- **Dropdowns:** Native select styled or custom with search for clients/platforms
- **Date Pickers:** Calendar overlay with range selection capability
- **Currency Inputs:** Prefix with currency symbol, right-aligned numbers

### Invoices
- **Invoice Viewer:** White background card with clear sections (header, items table, totals, footer)
- **Line Items Table:** Platform icon, date, campaign, amount columns with subtotals
- **Totals Section:** Right-aligned with clear hierarchy (Subtotal → VAT → Total → Paid → Due)

### Dashboard
- **Overview Cards:** 4-column grid showing Total Billed, Received, Outstanding, Profit with large numbers
- **Charts:** Simple bar/line charts for monthly trends (use Chart.js or Recharts)
- **Client List Table:** Name, last invoice, outstanding, actions columns

### Modals & Overlays
- **Modal Dialogs:** Centered, max-w-2xl for forms, backdrop blur
- **Slide-over Panels:** Right-side drawer (w-96) for quick actions like payment entry
- **Toast Notifications:** Top-right positioned success/error messages

---

## Page Layouts

### Dashboard
- Top metrics row (4 cards)
- Recent invoices table
- Quick actions sidebar (Create Invoice, Add Payment buttons)

### Client Management
- Client list table with search/filter bar
- Add/Edit client form in modal or dedicated page

### Daily Ad Cost Entry
- Date range selector prominent at top
- Platform filter chips
- Inline editable table for quick entry
- Running total footer

### Invoice Creation
- Step wizard OR single-page form with sections:
  1. Client selection + date range
  2. Ad cost selection (checkbox table)
  3. Additional line items
  4. Review + generate

### Invoice Detail
- Professional printable layout
- PDF download button prominent
- Payment history below main invoice

---

## Interaction Patterns

- **Inline Editing:** Click-to-edit for quick updates in tables
- **Bulk Actions:** Checkbox selection with action bar
- **Smart Defaults:** Auto-populate based on last entry/client settings
- **Keyboard Shortcuts:** Tab navigation, Enter to submit, Escape to cancel
- **Loading States:** Skeleton screens for tables, spinners for actions

---

## Icons

**Library:** Heroicons (via CDN)
- Navigation: home, users, document-text, currency-dollar, chart-bar
- Actions: plus, pencil, trash, download, print, check, x-mark
- Status: exclamation-circle, check-circle, clock

---

## Accessibility

- All inputs with proper labels and ARIA attributes
- Keyboard navigation for all interactive elements
- Focus indicators on all focusable items
- Sufficient contrast for all text (WCAG AA minimum)
- Screen reader friendly table headers and data labels

---

## Responsive Behavior

- **Desktop (1024px+):** Full feature set, multi-column layouts, sidebar visible
- **Tablet (768px-1023px):** Collapsible sidebar, 2-column grids reduce to 1-2
- **Mobile (<768px):** Single column, hamburger menu, horizontal scroll tables

---

This design system creates a professional, data-focused billing application that feels immediately familiar to users transitioning from Excel while providing modern web capabilities and improved workflows.