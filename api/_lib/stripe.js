const crypto = require("node:crypto");

const API_BASE = "https://api.stripe.com/v1";
const MAX_BODY = 1024 * 1024;

async function stripeRequest(method, path, params = null, extraHeaders = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^sk_(test|live)_/.test(key)) throw new Error("Stripe server configuration missing");
  const response = await fetch(API_BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + key,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...extraHeaders
    },
    ...(params ? { body: params.toString() } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error?.message || "Stripe API error");
    err.statusCode = response.status;
    throw err;
  }
  return payload;
}

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body && typeof req.body === "object") {
    throw new Error("Webhook request was parsed before signature verification");
  }
  const buffers = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("Request body is too large");
    buffers.push(buffer);
  }
  return Buffer.concat(buffers);
}

function verifyStripeWebhook(body, header, secret) {
  if (!secret || !/^whsec_/.test(secret) || !header) throw new Error("Webhook signature configuration missing");
  const parts = String(header).split(",").map(x => x.trim());
  const timestamp = parts.find(p => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter(p => p.startsWith("v1=")).map(p => p.slice(3));
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300 || !signatures.length) {
    throw new Error("Invalid webhook timestamp");
  }
  const expected = crypto.createHmac("sha256", secret)
    .update(String(timestamp) + ".", "utf8").update(body).digest();
  const valid = signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), expected);
  });
  if (!valid) throw new Error("Stripe signature verification failed");
  return JSON.parse(body.toString("utf8"));
}

function writeJson(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).end(JSON.stringify(data));
}

function allowPost(req, res) {
  if (req.method === "POST") return true;
  res.setHeader("Allow", "POST");
  writeJson(res, 405, { error: "Method not allowed" });
  return false;
}

module.exports = { stripeRequest, rawBody, verifyStripeWebhook, writeJson, allowPost };
