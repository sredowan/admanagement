import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertClientSchema,
  insertAdCostSchema,
  insertInvoiceSchema,
  insertInvoiceItemSchema,
  insertPaymentSchema,
  insertAccountSchema,
  insertExpenseSchema,
  insertTransferSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
      res.status(201).json(client);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const data = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, data);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ad-costs", async (req, res) => {
    try {
      const adCosts = await storage.getAdCosts();
      res.json(adCosts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ad-costs/:id", async (req, res) => {
    try {
      const adCost = await storage.getAdCost(req.params.id);
      if (!adCost) {
        return res.status(404).json({ error: "Ad cost not found" });
      }
      res.json(adCost);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ad-costs", async (req, res) => {
    try {
      const data = insertAdCostSchema.parse(req.body);
      const adCost = await storage.createAdCost(data);
      res.status(201).json(adCost);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ad-costs/:id", async (req, res) => {
    try {
      const adCost = await storage.getAdCost(req.params.id);
      if (!adCost) {
        return res.status(404).json({ error: "Ad cost not found" });
      }
      if (adCost.invoiced) {
        return res.status(400).json({ error: "Cannot delete invoiced ad cost" });
      }
      await storage.deleteAdCost(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices/recent", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      const sorted = invoices.sort(
        (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
      );
      res.json(sorted.slice(0, 5));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const { invoice: invoiceData, items, adCostIds } = req.body;
      console.log("Creating invoice with data:", invoiceData);
      console.log("Items received:", items);

      const parsedInvoice = insertInvoiceSchema.parse(invoiceData);
      const invoice = await storage.createInvoice(parsedInvoice);

      let subtotal = 0;
      let totalAdSpend = 0;

      for (const item of items) {
        // Validate item before processing
        if (!item.amount && item.amount !== 0) {
          console.warn("Skipping item with invalid amount:", item);
          continue;
        }

        const itemData = {
          ...item,
          invoiceId: invoice.id,
        };
        await storage.createInvoiceItem(itemData);
        subtotal += item.amount;
        if (item.itemType === 'AdCost') {
          totalAdSpend += (item.actualCost || 0);
        }
      }

      console.log("Calculated subtotal:", subtotal);

      for (const adCostId of adCostIds) {
        await storage.updateAdCost(adCostId, {
          invoiced: true,
          invoiceId: invoice.id,
        });
      }

      const vatAmount = subtotal * (invoice.vatPercent / 100);
      let totalAmount = subtotal + vatAmount;

      if (invoice.includeBkashFee) {
        const bkashFee = subtotal * (invoice.bkashFeePercent / 100);
        totalAmount += bkashFee;
      }

      console.log("Final Total Amount:", totalAmount);

      const dueAmount = totalAmount;

      const updatedInvoice = await storage.updateInvoice(invoice.id, {
        subtotal,
        vatAmount,
        totalAmount,
        dueAmount,
      });

      res.status(201).json(updatedInvoice);
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      // Check if this is a full update (edit mode) or just status update
      if (req.body.fullUpdate) {
        const { invoice: invoiceData, items, adCostIds } = req.body;
        console.log("Updating invoice debug:", { id: req.params.id, itemsCount: items?.length });
        const id = req.params.id;

        // 1. Update Invoice Basic Fields
        const parsedInvoice = insertInvoiceSchema.partial().parse(invoiceData);
        await storage.updateInvoice(id, parsedInvoice);
        const invoice = await storage.getInvoice(id);
        if (!invoice) return res.status(404).json({ error: "Invoice not found" });

        // 2. Manage Ad Costs (Unlink removed ones, Link new ones)
        const allAdCosts = await storage.getAdCosts();
        // Unlink those that were associated but are no longer in adCostIds
        const existingLinkedAds = allAdCosts.filter(cost => cost.invoiceId === id);
        for (const cost of existingLinkedAds) {
          if (!adCostIds.includes(cost.id)) {
            await storage.updateAdCost(cost.id, { invoiced: false, invoiceId: null });
          }
        }
        // Link the ones in adCostIds
        for (const adCostId of adCostIds) {
          await storage.updateAdCost(adCostId, { invoiced: true, invoiceId: id });
        }

        // 3. Manage Items (Delete all existing, Re-create new)
        await storage.deleteInvoiceItems(id);

        // 4. Recalculate Totals
        let subtotal = 0;
        let totalAdSpend = 0;

        for (const item of items) {
          const itemData = {
            ...item,
            invoiceId: id,
          };
          // Ensure actualCost is preserved or set
          if (item.itemType === 'AdCost' && !item.actualCost) {
            // Try to find the ad cost to get expected amount? 
            // The frontend seems to send actualCost.
          }

          await storage.createInvoiceItem(itemData);
          subtotal += item.amount;
          if (item.itemType === 'AdCost') {
            totalAdSpend += (item.actualCost || 0);
          }
        }

        const vatAmount = subtotal * (invoice.vatPercent / 100);
        let totalAmount = subtotal + vatAmount;

        if (invoice.includeBkashFee) {
          // Updated Logic: Fee on Subtotal (Ad+Markup+Additional)
          const bkashFee = subtotal * (invoice.bkashFeePercent / 100);
          totalAmount += bkashFee;
        }

        // Calculate Paid Amount to update Balance Due
        const payments = await storage.getPaymentsByInvoice(id);
        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const dueAmount = totalAmount - paidAmount;

        const updatedInvoice = await storage.updateInvoice(id, {
          subtotal,
          vatAmount,
          totalAmount,
          dueAmount,
          paidAmount // Ensure this is accurate
        });

        return res.json(updatedInvoice);

      } else {
        // Simple update (e.g. status change)
        const invoice = await storage.updateInvoice(req.params.id, req.body);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        res.json(invoice);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const data = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(data);
      res.status(201).json(payment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const success = await storage.deletePayment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = req.body;
      const results = [];

      for (const [key, value] of Object.entries(settingsData)) {
        const setting = await storage.saveSetting(key, String(value));
        results.push(setting);
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/accounts", async (req, res) => {
    try {
      const accounts = await storage.getAccounts();
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const data = insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(data);
      res.status(201).json(account);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/accounts/:id", async (req, res) => {
    try {
      const data = insertAccountSchema.partial().parse(req.body);
      const account = await storage.updateAccount(req.params.id, data);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const success = await storage.deleteAccount(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/transfers", async (req, res) => {
    try {
      const transfers = await storage.getTransfers();
      res.json(transfers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/transfers", async (req, res) => {
    try {
      const data = insertTransferSchema.parse(req.body);
      const transfer = await storage.createTransfer(data);
      res.status(201).json(transfer);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const data = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(data);
      res.status(201).json(expense);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const success = await storage.deleteExpense(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  return httpServer;
}
