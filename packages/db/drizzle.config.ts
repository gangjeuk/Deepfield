import { defineConfig } from "drizzle-kit";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const token = process.env.CLOUDFLARE_D1_TOKEN;
const hasD1HttpCredentials = Boolean(accountId && databaseId && token);

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  ...(hasD1HttpCredentials
    ? {
        driver: "d1-http" as const,
        dbCredentials: {
          accountId: accountId!,
          databaseId: databaseId!,
          token: token!
        }
      }
    : {}),
  strict: true,
  verbose: true
});
