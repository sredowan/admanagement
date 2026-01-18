import {
    type User,
    type InsertUser,
    type Client,
    type InsertClient,
    type AdCost,
    type InsertAdCost,
    type Invoice,
    type InsertInvoice,
    type InvoiceItem,
    type InsertInvoiceItem,
    type Payment,
    type InsertPayment,
    type Settings,
    type InsertSettings,
    type DashboardMetrics,
    type InvoiceWithDetails,
    type Account,
    type InsertAccount,
    type Expense,
    type InsertExpense,
    type Transfer,
    type InsertTransfer,
    users, clients, adCosts, invoices, invoiceItems, payments, settings, accounts, expenses, transfers
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;

    getClients(): Promise<Client[]>;
    getClient(id: string): Promise<Client | undefined>;
    createClient(client: InsertClient): Promise<Client>;
    updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
    deleteClient(id: string): Promise<boolean>;

    getAdCosts(): Promise<AdCost[]>;
    getAdCostsByClient(clientId: string): Promise<AdCost[]>;
    getAdCost(id: string): Promise<AdCost | undefined>;
    createAdCost(adCost: InsertAdCost): Promise<AdCost>;
    updateAdCost(id: string, adCost: Partial<AdCost>): Promise<AdCost | undefined>;
    deleteAdCost(id: string): Promise<boolean>;

    getInvoices(): Promise<Invoice[]>;
    getInvoice(id: string): Promise<InvoiceWithDetails | undefined>;
    createInvoice(invoice: InsertInvoice): Promise<Invoice>;
    updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice | undefined>;
    deleteInvoice(id: string): Promise<boolean>;

    getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
    createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
    deleteInvoiceItems(invoiceId: string): Promise<boolean>;

    getPayments(): Promise<Payment[]>;
    getPaymentsByClient(clientId: string): Promise<Payment[]>;
    getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
    createPayment(payment: InsertPayment): Promise<Payment>;
    deletePayment(id: string): Promise<boolean>;

    getSettings(): Promise<Settings[]>;
    getSetting(key: string): Promise<Settings | undefined>;
    saveSetting(key: string, value: string): Promise<Settings>;

    getDashboardMetrics(): Promise<DashboardMetrics>;

    getAccounts(): Promise<Account[]>;
    createAccount(account: InsertAccount): Promise<Account>;
    updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
    deleteAccount(id: string): Promise<boolean>;

    getExpenses(): Promise<Expense[]>;
    createExpense(expense: InsertExpense): Promise<Expense>;
    deleteExpense(id: string): Promise<boolean>;

    getTransfers(): Promise<Transfer[]>;
    createTransfer(transfer: InsertTransfer): Promise<Transfer>;
}

export class MySQLStorage implements IStorage {
    async getUser(id: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
    }

    async createUser(insertUser: InsertUser): Promise<User> {
        const id = randomUUID();
        const newUser: User = { ...insertUser, id };
        await db.insert(users).values(newUser);
        return newUser;
    }

    async getClients(): Promise<Client[]> {
        return await db.select().from(clients);
    }

    async getClient(id: string): Promise<Client | undefined> {
        const [client] = await db.select().from(clients).where(eq(clients.id, id));
        return client;
    }

    async createClient(insertClient: InsertClient): Promise<Client> {
        const id = randomUUID();
        const newClient: Client = {
            id,
            companyName: insertClient.companyName,
            contactPerson: insertClient.contactPerson || null,
            phone: insertClient.phone || null,
            email: insertClient.email || null,
            billingAddress: insertClient.billingAddress || null,
            defaultMarkupPercent: insertClient.defaultMarkupPercent ?? 20,
            defaultVatPercent: insertClient.defaultVatPercent ?? 0,
            notes: insertClient.notes || null,
        };
        await db.insert(clients).values(newClient);
        return newClient;
    }

    async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
        await db.update(clients).set(data).where(eq(clients.id, id));
        return this.getClient(id);
    }

    async deleteClient(id: string): Promise<boolean> {
        const [result] = await db.delete(clients).where(eq(clients.id, id));
        // Drizzle with MySQL returns ResultSetHeader usually for raw, or object with affectedRows
        // assuming result has metadata or we check if getClient returns undefined
        // For simplicity, returning true as delete is idempotent-ish here if we don't strictly check count
        return true;
    }

    async getAdCosts(): Promise<AdCost[]> {
        return await db.select().from(adCosts);
    }

    async getAdCostsByClient(clientId: string): Promise<AdCost[]> {
        return await db.select().from(adCosts).where(eq(adCosts.clientId, clientId));
    }

    async getAdCost(id: string): Promise<AdCost | undefined> {
        const [adCost] = await db.select().from(adCosts).where(eq(adCosts.id, id));
        return adCost;
    }

    async createAdCost(insertAdCost: InsertAdCost): Promise<AdCost> {
        const id = randomUUID();
        const newAdCost: AdCost = {
            id,
            clientId: insertAdCost.clientId,
            date: insertAdCost.date,
            platform: insertAdCost.platform,
            campaignName: insertAdCost.campaignName || null,
            spendBdt: insertAdCost.spendBdt,
            invoiced: false,
            invoiceId: null,
        };
        await db.insert(adCosts).values(newAdCost);
        return newAdCost;
    }

    async updateAdCost(id: string, data: Partial<AdCost>): Promise<AdCost | undefined> {
        await db.update(adCosts).set(data).where(eq(adCosts.id, id));
        return this.getAdCost(id);
    }

    async deleteAdCost(id: string): Promise<boolean> {
        await db.delete(adCosts).where(eq(adCosts.id, id));
        return true;
    }

    async getInvoices(): Promise<InvoiceWithDetails[]> {
        const allInvoices = await db.select().from(invoices);

        // Enrich with items for the list view if needed, or keeping it light?
        // The previous implementation fetched items for ALL invoices.
        const invoicesWithDetails = await Promise.all(allInvoices.map(async (invoice) => {
            const items = await this.getInvoiceItems(invoice.id);
            return { ...invoice, items };
        }));

        return invoicesWithDetails;
    }

    async getInvoice(id: string): Promise<InvoiceWithDetails | undefined> {
        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
        if (!invoice) return undefined;

        const items = await this.getInvoiceItems(id);
        const client = await this.getClient(invoice.clientId);
        const paymentList = await this.getPaymentsByInvoice(id);

        return {
            ...invoice,
            items,
            client,
            payments: paymentList,
        };
    }

    async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
        const id = randomUUID();
        const newInvoice: Invoice = {
            id,
            invoiceNumber: insertInvoice.invoiceNumber,
            clientId: insertInvoice.clientId,
            invoiceDate: insertInvoice.invoiceDate,
            periodStart: insertInvoice.periodStart,
            periodEnd: insertInvoice.periodEnd,
            status: insertInvoice.status || "Pending",
            subtotal: 0,
            vatAmount: 0,
            totalAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            fbDollarRate: insertInvoice.fbDollarRate ?? 122,
            supplierDollarRate: insertInvoice.supplierDollarRate ?? 128,
            bkashFeePercent: insertInvoice.bkashFeePercent ?? 1.8,
            includeBkashFee: insertInvoice.includeBkashFee ?? false,
            markupPercent: insertInvoice.markupPercent ?? 20,
            vatPercent: insertInvoice.vatPercent ?? 0,
            notes: insertInvoice.notes || null,
        };
        await db.insert(invoices).values(newInvoice);
        return newInvoice;
    }

    async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice | undefined> {
        await db.update(invoices).set(data).where(eq(invoices.id, id));
        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
        return invoice;
    }

    async deleteInvoice(id: string): Promise<boolean> {
        await this.deleteInvoiceItems(id);

        // Unlink ad costs
        await db.update(adCosts)
            .set({ invoiced: false, invoiceId: null })
            .where(eq(adCosts.invoiceId, id));

        await db.delete(invoices).where(eq(invoices.id, id));
        return true;
    }

    async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
        return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    }

    async createInvoiceItem(insertItem: InsertInvoiceItem): Promise<InvoiceItem> {
        const id = randomUUID();
        const newItem: InvoiceItem = {
            id,
            invoiceId: insertItem.invoiceId,
            itemType: insertItem.itemType,
            description: insertItem.description,
            platform: insertItem.platform || null,
            date: insertItem.date || null,
            adCostId: insertItem.adCostId || null,
            actualCost: insertItem.actualCost ?? 0,
            amount: insertItem.amount,
        };
        await db.insert(invoiceItems).values(newItem);
        return newItem;
    }

    async deleteInvoiceItems(invoiceId: string): Promise<boolean> {
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
        return true;
    }

    async getPayments(): Promise<Payment[]> {
        return await db.select().from(payments);
    }

    async getPaymentsByClient(clientId: string): Promise<Payment[]> {
        return await db.select().from(payments).where(eq(payments.clientId, clientId));
    }

    async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
        return await db.select().from(payments).where(eq(payments.invoiceId, invoiceId));
    }

    async createPayment(insertPayment: InsertPayment): Promise<Payment> {
        const id = randomUUID();
        const newPayment: Payment = {
            id,
            clientId: insertPayment.clientId,
            invoiceId: insertPayment.invoiceId || null,
            date: insertPayment.date,
            amount: insertPayment.amount,
            method: insertPayment.method,
            notes: insertPayment.notes || null,
            accountId: insertPayment.accountId || null,
        };
        await db.insert(payments).values(newPayment);

        if (insertPayment.invoiceId) {
            await this.updateInvoicePayments(insertPayment.invoiceId);

            // Handle Profit-Only Balance Update
            if (insertPayment.accountId) {
                const invoice = await this.getInvoice(insertPayment.invoiceId);
                if (invoice) {
                    // Calculate profit portion
                    // Profit Margin = (TotalAmount - ActualCost) / TotalAmount
                    // We need actual calculations here. 
                    // Let's use a simplified approach matching the frontend logic
                    const adCostItems = invoice.items?.filter((i) => i.itemType === "AdCost") || [];
                    const otherItems = invoice.items?.filter((i) => i.itemType !== "AdCost") || [];
                    const totalAdActualCost = adCostItems.reduce((sum, i) => sum + (i.actualCost || 0), 0);
                    const usdSpend = totalAdActualCost / invoice.fbDollarRate;
                    const supplierPaymentForAds = usdSpend * (invoice.supplierDollarRate || 128);
                    const totalOtherActualCost = otherItems.reduce((sum, i) => sum + (i.actualCost || 0), 0);
                    const totalActualCost = supplierPaymentForAds + totalOtherActualCost;

                    const profitMargin = (invoice.totalAmount - totalActualCost) / invoice.totalAmount;
                    const paymentProfit = insertPayment.amount * profitMargin;

                    await this.updateAccountBalance(insertPayment.accountId, paymentProfit);
                }
            }
        }
        return newPayment;
    }

    async updateAccountBalance(id: string, amount: number): Promise<void> {
        const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
        if (account) {
            const currentBalance = Number(account.balance || 0);
            const change = Number(amount);
            const newBalance = currentBalance + change;
            await db.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, id));
        }
    }

    private async updateInvoicePayments(invoiceId: string): Promise<void> {
        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
        if (!invoice) return;

        const paymentList = await this.getPaymentsByInvoice(invoiceId);
        const paidAmount = paymentList.reduce((sum, p) => sum + p.amount, 0);
        const dueAmount = Math.max(0, invoice.totalAmount - paidAmount);

        let status: string;
        if (paidAmount >= invoice.totalAmount) {
            status = "Paid";
        } else if (paidAmount > 0) {
            status = "Partial";
        } else {
            status = "Pending";
        }

        await this.updateInvoice(invoiceId, { paidAmount, dueAmount, status });
    }

    async deletePayment(id: string): Promise<boolean> {
        const [payment] = await db.select().from(payments).where(eq(payments.id, id));
        await db.delete(payments).where(eq(payments.id, id));

        if (payment?.invoiceId) {
            await this.updateInvoicePayments(payment.invoiceId);
        }
        return true;
    }

    async getSettings(): Promise<Settings[]> {
        return await db.select().from(settings);
    }

    async getSetting(key: string): Promise<Settings | undefined> {
        const [setting] = await db.select().from(settings).where(eq(settings.key, key));
        return setting;
    }

    async saveSetting(key: string, value: string): Promise<Settings> {
        const existing = await this.getSetting(key);
        if (existing) {
            await db.update(settings).set({ value }).where(eq(settings.id, existing.id));
            const [updated] = await db.select().from(settings).where(eq(settings.id, existing.id));
            return updated;
        }
        const id = randomUUID();
        const newSetting: Settings = { id, key, value };
        await db.insert(settings).values(newSetting);
        return newSetting;
    }

    async getDashboardMetrics(): Promise<DashboardMetrics> {
        const allInvoices = await this.getInvoices();
        const allPayments = await this.getPayments();
        const allClients = await this.getClients();
        const allExpenses = await this.getExpenses();

        const totalBilled = allInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
        const totalReceived = allPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalOutstanding = allInvoices.reduce((sum, i) => sum + i.dueAmount, 0);
        const totalAgencyExpenses = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        let totalRealizedProfit = 0;
        const invoiceMargins = new Map<string, number>();

        for (const invoice of allInvoices) {
            const items = await this.getInvoiceItems(invoice.id);

            const adItems = items.filter(i => i.itemType === 'AdCost');
            const otherItems = items.filter(i => i.itemType !== 'AdCost');

            const adCostSum = adItems.reduce((sum, i) => sum + (i.actualCost || 0), 0);
            const otherCostSum = otherItems.reduce((sum, i) => sum + (i.actualCost || 0), 0);

            const usdSpend = invoice.fbDollarRate ? adCostSum / invoice.fbDollarRate : 0;
            const supplierCost = usdSpend * (invoice.supplierDollarRate || 0);
            const bkashFee = invoice.includeBkashFee ? invoice.subtotal * (invoice.bkashFeePercent / 100) : 0;

            const invoiceTotalCost = supplierCost + otherCostSum + bkashFee;
            const invoiceProfit = invoice.totalAmount - invoiceTotalCost;

            const margin = invoice.totalAmount > 0 ? invoiceProfit / invoice.totalAmount : 0;
            invoiceMargins.set(invoice.id, margin);
        }

        for (const payment of allPayments) {
            if (payment.invoiceId && invoiceMargins.has(payment.invoiceId)) {
                const margin = invoiceMargins.get(payment.invoiceId) || 0;
                totalRealizedProfit += (payment.amount * margin);
            }
        }

        const totalProfit = totalRealizedProfit - totalAgencyExpenses;

        const pendingInvoices = allInvoices.filter(
            (i) => i.status === "Pending" || i.status === "Partial"
        ).length;

        return {
            totalBilled,
            totalReceived,
            totalOutstanding,
            totalProfit,
            clientCount: allClients.length,
            invoiceCount: allInvoices.length,
            pendingInvoices,
        };
    }

    async getAccounts(): Promise<Account[]> {
        return await db.select().from(accounts);
    }

    async createAccount(insertAccount: InsertAccount): Promise<Account> {
        const id = randomUUID();
        const newAccount: Account = {
            id,
            name: insertAccount.name,
            type: insertAccount.type,
            balance: insertAccount.balance || 0,
            isDefault: insertAccount.isDefault || false,
        };
        await db.insert(accounts).values(newAccount);
        return newAccount;
    }

    async updateAccount(id: string, data: Partial<InsertAccount>): Promise<Account | undefined> {
        await db.update(accounts).set(data).where(eq(accounts.id, id));
        const [updated] = await db.select().from(accounts).where(eq(accounts.id, id));
        return updated;
    }

    async deleteAccount(id: string): Promise<boolean> {
        await db.delete(accounts).where(eq(accounts.id, id));
        return true;
    }

    async getExpenses(): Promise<Expense[]> {
        return await db.select().from(expenses);
    }

    async createExpense(insertExpense: InsertExpense): Promise<Expense> {
        const id = randomUUID();
        const newExpense: Expense = {
            id,
            date: insertExpense.date,
            amount: insertExpense.amount,
            category: insertExpense.category,
            description: insertExpense.description || null,
            accountId: insertExpense.accountId,
            spendingType: insertExpense.spendingType || "Agency",
            linkedClientId: insertExpense.linkedClientId || null,
        };
        await db.insert(expenses).values(newExpense);

        // Update Account Balance (Decrease)
        await this.updateAccountBalance(insertExpense.accountId, -insertExpense.amount);

        return newExpense;
    }

    async getTransfers(): Promise<Transfer[]> {
        return await db.select().from(transfers).orderBy(desc(transfers.date));
    }

    async createTransfer(insertTransfer: InsertTransfer): Promise<Transfer> {
        const id = randomUUID();
        const newTransfer: Transfer = {
            id,
            fromAccountId: insertTransfer.fromAccountId,
            toAccountId: insertTransfer.toAccountId,
            amount: insertTransfer.amount,
            date: insertTransfer.date,
            notes: insertTransfer.notes || null,
        };

        // 1. Decrease From Account
        await this.updateAccountBalance(newTransfer.fromAccountId, -newTransfer.amount);
        // 2. Increase To Account
        await this.updateAccountBalance(newTransfer.toAccountId, newTransfer.amount);
        // 3. Record Transfer
        await db.insert(transfers).values(newTransfer);

        return newTransfer;
    }

    async deleteExpense(id: string): Promise<boolean> {
        const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
        if (expense) {
            // Revert Account Balance (Increase)
            await this.updateAccountBalance(expense.accountId, expense.amount);
            await db.delete(expenses).where(eq(expenses.id, id));
            return true;
        }
        return false;
    }
}

export const storage = new MySQLStorage();
