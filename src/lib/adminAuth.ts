import { auth } from "@/auth";

export class AdminOnlyError extends Error {}

// The only account allowed to view /admin or call /api/admin/* — a single hardcoded email rather
// than a role/permission system, since this app has exactly one operator.
export async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    throw new AdminOnlyError("not an admin");
  }
}
