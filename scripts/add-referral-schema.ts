// One-off: adds the referral-gift-trial columns/table to the shared Neon DB. No tracked
// migrations in this repo (drizzle-kit push is non-interactive-hostile) — raw SQL run once.
// Run with: set -a && source .env.local && set +a && npx tsx scripts/add-referral-schema.ts
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS referral_token text`;
  await sql`ALTER TABLE "user" ADD CONSTRAINT user_referral_token_unique UNIQUE (referral_token)`.catch((err) => {
    if (!String(err).includes("already exists")) throw err;
  });

  await sql`
    CREATE TABLE IF NOT EXISTS referral_grants (
      id serial PRIMARY KEY,
      referrer_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      referred_user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log("referral schema applied.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
