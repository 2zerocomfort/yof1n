import { hasValidSession, jsonResponse } from "../_lib/session.js";

// GET /api/links
//
// The real URLs never appear anywhere in the HTML, JS bundle, or any
// response until this handler decides the visitor already passed
// Turnstile AND holds a signed, unexpired session cookie. A scraper that
// just downloads index.html (or runs its JS without a real browser
// completing the Turnstile challenge) gets nothing back from here.
export async function onRequestGet(context) {
  const { request, env } = context;

  const verified = await hasValidSession(request, env.SESSION_SECRET);
  if (!verified) {
    return jsonResponse({ error: "not_verified" }, { status: 401 });
  }

  // Store your real links as JSON in the LINKS_JSON environment variable
  // (Pages > Settings > Environment variables), e.g.:
  // [{"label":"Portfolio","url":"https://..."},{"label":"Fiverr","url":"https://..."}]
  let links = [];
  try {
    links = JSON.parse(env.LINKS_JSON || "[]");
  } catch {
    links = [];
  }

  return jsonResponse({ links });
}
