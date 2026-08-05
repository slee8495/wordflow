import { existsSync } from "node:fs";
import path from "node:path";

// Integration tests hit the same dev DB the app itself uses (see src/db/index.ts) — this repo has
// no separate test database. They're written to only ever touch disposable rows they create and
// tear down themselves; never real user data.
const envLocal = path.resolve(import.meta.dirname, ".env.local");
if (existsSync(envLocal)) process.loadEnvFile(envLocal);
