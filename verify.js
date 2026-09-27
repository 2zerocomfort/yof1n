import { issueSessionCookie, jsonResponse } from "../_lib/session.js";

// POST /api/verify   { token: "<turnstile response token>" }
//
// This is the ONLY place Turnstile's secret key is used, and it only ever
// runs on Cloudflare's servers — never shipped to the browser.
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "bad_request" }, { status: 400 });
  }

  const token = body && body.token;
  if (!token || typeof token !== "string") {
    return jsonResponse({ success: false, error: "missing_token" }, { status: 400 });
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";

  const verifyBody = new FormData();
  verifyBody.append("secret", env.TURNSTILE_SECRET_KEY);
  verifyBody.append("response", token);
  if (ip) verifyBody.append("remoteip", ip);

  const cfRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: verifyBody }
  );
  const outcome = await cfRes.json();

  if (!outcome.success) {
    return jsonResponse(
      { success: false, error: "turnstile_failed", codes: outcome["error-codes"] || [] },
      { status: 403 }
    );
  }

  const cookie = await issueSessionCookie(env.SESSION_SECRET);
  return jsonResponse(
    { success: true },
    { headers: { "Set-Cookie": cookie } }
  );
}

// Reject anything that isn't a POST.
export async function onRequestGet() {
  return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
}
