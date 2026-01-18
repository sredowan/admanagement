
import { db } from "./server/firebase";
import { doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Helper to fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
    console.log("Starting migration...");

    const dataPath = path.join(__dirname, "data.json");
    if (!fs.existsSync(dataPath)) {
        console.error("data.json not found at", dataPath);
        process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(rawData);

    // Collections to migrate
    const collections = ["users", "clients", "adCosts", "invoices", "invoiceItems", "payments", "settings"];

    for (const colName of collections) {
        const items = data[colName] || [];
        console.log(`Migrating ${items.length} items for collection: ${colName}`);

        for (const item of items) {
            if (!item.id) {
                console.warn(`Skipping item in ${colName} without ID`);
                continue;
            }

            // We use setDoc to preserve the original ID from the JSON file
            // causing the Firestore document ID to match the JSON ID.
            await setDoc(doc(db, colName, item.id), item);
        }
    }

    console.log("Migration completed successfully!");
    process.exit(0);
}

migrate().catch(console.error);
