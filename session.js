// Shared helpers for issuing and checking the short-lived "verified human" session.
// This is what stands between someone completing Turnstile and the server
// actually being willing to hand over your real links.

const SESSION_COOKIE = "ltg_session";
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes — re-verify after this

async function hmacSign(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  // base64url, no padding
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

/**
 * Build a Set-Cookie header value for a freshly verified visitor.
 */
export async function issueSessionCookie(secret) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  const signature = await hmacSign(payload, secret);
  const value = `${payload}.${signature}`;
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}`;
}

/**
 * Returns true only if the request carries a session cookie that:
 *  - is present
 *  - has a signature matching our secret (so a client can't forge one)
 *  - has not expired
 */
export async function hasValidSession(request, secret) {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = await hmacSign(payload, secret);
  if (!timingSafeEqual(expected, signature)) return false;
  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  return true;
}

export function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  // Never let this be cached anywhere between visitor and origin.
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}
