
import { storage } from "./server/storage";
import { insertClientSchema, insertInvoiceSchema, insertPaymentSchema } from "./shared/schema";

async function runTest() {
    try {
        console.log("Starting Payment Linkage Test...");

        // 1. Create a Client
        console.log("Creating Client...");
        const client = await storage.createClient({
            companyName: "Test Client " + Date.now(),
            defaultMarkupPercent: 20,
        });
        console.log(`Client created: ${client.id}`);

        // 2. Create an Invoice
        console.log("Creating Invoice...");
        const invoice = await storage.createInvoice({
            invoiceNumber: "TEST-INV-" + Date.now(),
            clientId: client.id,
            invoiceDate: "2025-12-16",
            periodStart: "2025-12-01",
            periodEnd: "2025-12-31",
            status: "Pending",
            fbDollarRate: 100,
            supplierDollarRate: 110,
        });

        // Add an item to give it value using existing storage method? 
        // storage.createInvoice only creates the headers. `routes.ts` handles the full creation logic including items.
        // We need to manually update the invoice totals to simulate a real invoice with value.
        await storage.updateInvoice(invoice.id, {
            subtotal: 1000,
            totalAmount: 1000,
            dueAmount: 1000,
            paidAmount: 0
        });

        console.log(`Invoice created: ${invoice.id} with Total: 1000`);

        // 3. Create a Payment linked to the Invoice
        console.log("Creating Payment...");
        const payment = await storage.createPayment({
            clientId: client.id,
            invoiceId: invoice.id,
            amount: 500,
            date: "2025-12-16",
            method: "Cash",
            notes: "Partial Payment Test"
        });
        console.log(`Payment created: ${payment.id}`);

        // 4. Verify Invoice Updates
        console.log("Fetching updated invoice...");
        const updatedInvoice = await storage.getInvoice(invoice.id);

        if (!updatedInvoice) {
            throw new Error("Invoice not found after update");
        }

        console.log("Updated Invoice State:");
        console.log(`- Total: ${updatedInvoice.totalAmount}`);
        console.log(`- Paid: ${updatedInvoice.paidAmount}`);
        console.log(`- Due: ${updatedInvoice.dueAmount}`);
        console.log(`- Status: ${updatedInvoice.status}`);

        if (updatedInvoice.paidAmount === 500 && updatedInvoice.dueAmount === 500 && updatedInvoice.status === 'Partial') {
            console.log("SUCCESS: Partial payment calculated correctly.");
        } else {
            console.error("FAILURE: Partial payment calculation failed.");
        }

        // 5. Full Payment
        console.log("Creating Remaining Payment...");
        await storage.createPayment({
            clientId: client.id,
            invoiceId: invoice.id,
            amount: 500,
            date: "2025-12-16",
            method: "Cash",
            notes: "Final Payment Test"
        });

        const finalInvoice = await storage.getInvoice(invoice.id);
        console.log("Final Invoice State:");
        console.log(`- Paid: ${finalInvoice?.paidAmount}`);
        console.log(`- Status: ${finalInvoice?.status}`);

        if (finalInvoice?.status === 'Paid' && finalInvoice?.dueAmount === 0) {
            console.log("SUCCESS: Full payment status updated correctly.");
        } else {
            console.error("FAILURE: Full payment update failed.");
        }

        // Cleanup (optional, but good for local dev)
        // await storage.deleteInvoice(invoice.id);
        // await storage.deleteClient(client.id);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

runTest();
