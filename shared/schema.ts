import { mysqlTable, mysqlSchema, AnyMySqlColumn, serial, text, varchar, float, boolean, double } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Platforms for ad spending
export const platforms = ["Facebook", "Google", "LinkedIn", "YouTube", "Other"] as const;
export type Platform = typeof platforms[number];

// Payment methods
export const paymentMethods = ["Cash", "bKash", "Financial Statement"] as const;
export type PaymentMethod = typeof paymentMethods[number];

// Invoice status
export const invoiceStatuses = ["Draft", "Pending", "Paid", "Overdue", "Partial"] as const;
export type InvoiceStatus = typeof invoiceStatuses[number];

// Invoice item types
export const itemTypes = ["AdCost", "Salary", "Adjustment", "PreviousDue", "Misc"] as const;
export type ItemType = typeof itemTypes[number];

// Client schema
export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  billingAddress: text("billing_address"),
  defaultMarkupPercent: float("default_markup_percent").notNull().default(20),
  defaultVatPercent: float("default_vat_percent").default(0),
  notes: text("notes"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Daily Ad Cost schema
export const adCosts = mysqlTable("ad_costs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("client_id", { length: 36 }).notNull(),
  date: varchar("date", { length: 20 }).notNull(), // ISO date string YYYY-MM-DD
  platform: varchar("platform", { length: 50 }).notNull(), // Facebook, Google, LinkedIn, YouTube, Other
  campaignName: varchar("campaign_name", { length: 255 }),
  spendBdt: float("spend_bdt").notNull(), // Amount in BDT
  invoiced: boolean("invoiced").default(false),
  invoiceId: varchar("invoice_id", { length: 36 }),
});

export const insertAdCostSchema = createInsertSchema(adCosts).omit({ id: true, invoiced: true, invoiceId: true });
export type InsertAdCost = z.infer<typeof insertAdCostSchema>;
export type AdCost = typeof adCosts.$inferSelect;

// Invoice schema
export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull(),
  invoiceDate: varchar("invoice_date", { length: 20 }).notNull(), // ISO date string
  periodStart: varchar("period_start", { length: 20 }).notNull(),
  periodEnd: varchar("period_end", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("Pending"), // Draft, Pending, Paid, Overdue, Partial
  subtotal: float("subtotal").notNull().default(0),
  vatAmount: float("vat_amount").notNull().default(0),
  totalAmount: float("total_amount").notNull().default(0),
  paidAmount: float("paid_amount").notNull().default(0),
  dueAmount: float("due_amount").notNull().default(0),
  // Currency settings for this invoice
  fbDollarRate: float("fb_dollar_rate").notNull().default(122),
  supplierDollarRate: float("supplier_dollar_rate").notNull().default(128),
  bkashFeePercent: float("bkash_fee_percent").notNull().default(1.8),
  includeBkashFee: boolean("include_bkash_fee").notNull().default(false), // Charge fee to client?
  markupPercent: float("markup_percent").notNull().default(20),
  vatPercent: float("vat_percent").notNull().default(0),
  notes: text("notes"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  subtotal: true,
  vatAmount: true,
  totalAmount: true,
  paidAmount: true,
  dueAmount: true
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Invoice Items schema (line items in invoice)
export const invoiceItems = mysqlTable("invoice_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull(),
  itemType: varchar("item_type", { length: 50 }).notNull(), // AdCost, Salary, Adjustment, PreviousDue, Misc
  description: text("description").notNull(),
  platform: varchar("platform", { length: 50 }), // Only for AdCost items
  date: varchar("date", { length: 20 }), // Only for AdCost items
  adCostId: varchar("ad_cost_id", { length: 36 }), // Reference to original ad cost if applicable
  actualCost: float("actual_cost").notNull().default(0), // Actual cost before markup
  amount: float("amount").notNull(), // Amount after markup (what client pays)
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// Payments schema
export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("client_id", { length: 36 }).notNull(),
  invoiceId: varchar("invoice_id", { length: 36 }),
  date: varchar("date", { length: 20 }).notNull(), // ISO date string
  amount: float("amount").notNull(),
  method: varchar("method", { length: 50 }).notNull(), // Cash, bKash, Bank
  notes: text("notes"),
  accountId: varchar("account_id", { length: 36 }), // New: account where profit goes
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Settings schema for global configurations
export const settings = mysqlTable("settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Types for profit calculation
export interface ProfitBreakdown {
  actualCost: number;
  usdSpend: number;
  supplierPayment: number;
  bkashFee: number;
  clientCharge: number;
  netProfit: number;
}

// Type for dashboard metrics
export interface DashboardMetrics {
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
  totalProfit: number;
  clientCount: number;
  invoiceCount: number;
  pendingInvoices: number;
}

// Type for invoice with items and client
export interface InvoiceWithDetails extends Invoice {
  client?: Client;
  items?: InvoiceItem[];
  payments?: Payment[];
}

// Type for client with summary
export interface ClientWithSummary extends Client {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  lastInvoiceDate?: string;
}

// Form validation schemas with extended validation
export const clientFormSchema = insertClientSchema.extend({
  companyName: z.string().min(1, "Company name is required"),
  defaultMarkupPercent: z.coerce.number().min(0).max(100),
  defaultVatPercent: z.coerce.number().min(0).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const adCostFormSchema = insertAdCostSchema.extend({
  clientId: z.string().min(1, "Client is required"),
  date: z.string().min(1, "Date is required"),
  platform: z.enum(platforms),
  spendBdt: z.coerce.number().min(0, "Amount must be positive"),
});

export const paymentFormSchema = insertPaymentSchema.extend({
  clientId: z.string().min(1, "Client is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().refine((val) => val !== 0, "Amount cannot be zero"),
  method: z.enum(paymentMethods),
  accountId: z.string().optional(),
});

// Agency Accounts (Money Sources)
export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // Financial Statement, Mobile, Cash
  balance: float("balance").default(0),
  isDefault: boolean("is_default").default(false),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Agency Expenses
export const expenses = mysqlTable("expenses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  date: varchar("date", { length: 20 }).notNull(),
  amount: float("amount").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // Rent, Salary, Utility, Food, Misc
  description: text("description"),
  accountId: varchar("account_id", { length: 36 }).notNull(),
  spendingType: varchar("spending_type", { length: 20 }).notNull().default("Agency"), // Agency, Client
  linkedClientId: varchar("linked_client_id", { length: 36 }),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Transfers between accounts
export const transfers = mysqlTable("transfers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  fromAccountId: varchar("from_account_id", { length: 36 }).notNull(),
  toAccountId: varchar("to_account_id", { length: 36 }).notNull(),
  amount: float("amount").notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  notes: text("notes"),
});

export const insertTransferSchema = createInsertSchema(transfers).omit({ id: true });
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type Transfer = typeof transfers.$inferSelect;

export const expenseFormSchema = insertExpenseSchema.extend({
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
  spendingType: z.enum(["Agency", "Client"]).default("Agency"),
  linkedClientId: z.string().optional().nullable(),
}).refine((data) => {
  if (data.spendingType === "Client") {
    return !!data.linkedClientId && data.linkedClientId.length > 0;
  }
  return true;
}, {
  message: "Please select a client",
  path: ["linkedClientId"],
});

export const accountFormSchema = insertAccountSchema.extend({
  name: z.string().min(1, "Name is required"),
  balance: z.coerce.number().default(0),
});
