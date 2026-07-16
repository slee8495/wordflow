import { NextRequest } from "next/server";

// Trusted hosts for the site's own browser-side callers (ChatWidget), which have no way to
// carry a real secret without shipping it to every visitor. Not spoof-proof (Origin/Referer
// can be forged by a direct curl), but it filters out the realistic threat: bots that scan
// Vercel apps for open API routes without ever loading the page.
const TRUSTED_HOSTS = [/^wordflow\.vercel\.app$/, /^wordflow-.*\.vercel\.app$/, /^localhost:\d+$/];

function isTrustedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return TRUSTED_HOSTS.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

export function isAuthorizedRequest(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  if (key && key === process.env.APP_API_KEY) return true;
  return isTrustedOrigin(req);
}
