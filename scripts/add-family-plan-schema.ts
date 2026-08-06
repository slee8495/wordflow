// One-off: adds the family-plan columns/table to the shared Neon DB. No tracked migrations in
// this repo (drizzle-kit push is non-interactive-hostile — see git history) — raw SQL run once.
// Run with: set -a && source .env.local && set +a && npx tsx scripts/add-family-plan-schema.ts
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS plan_type varchar(16)`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS family_invite_token text`;
  await sql`ALTER TABLE "user" ADD CONSTRAINT user_family_invite_token_unique UNIQUE (family_invite_token)`.catch(
    (err) => {
      if (!String(err).includes("already exists")) throw err;
    },
  );

  await sql`
    CREATE TABLE IF NOT EXISTS family_memberships (
      id serial PRIMARY KEY,
      owner_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      member_user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      joined_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log("family-plan schema applied.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
