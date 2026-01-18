import { defineConfig } from "drizzle-kit";

// Use environment variable or default fallback for running migrations if env not set
// (Though for safety, environment variable is preferred)
const DATABASE_URL = process.env.DATABASE_URL || "mysql://u632925822_userbill:Redowan173123@srv2045.hstgr.io:3306/u632925822_agencybilling";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
