const { randomUUID } = require("node:crypto");
const { getDocument, createDocument } = require("./_lib/firestore");
const { stripeRequest, writeJson, allowPost } = require("./_lib/stripe");

function origin() {
  if (process.env.VERCEL_URL) return "https://" + process.env.VERCEL_URL;
  if (process.env.APP_BASE_URL && /^https:\/\//.test(process.env.APP_BASE_URL)) {
    return new URL(process.env.APP_BASE_URL).origin;
  }
  throw new Error("Missing trusted checkout return URL");
}

function priceInStripeMinorUnits(value) {
  // Stripe charges HUF in hundredths of a forint; HUF payouts are handled differently.
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 50000000) {
    throw new Error("Invalid product price");
  }
  return value * 100;
}

module.exports = async function handler(req, res) {
  if (!allowPost(req, res)) return;
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return writeJson(res, 503, { error: "Az online fizetés még nincs beállítva." });
    }
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const items = data?.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
      return writeJson(res, 400, { error: "Érvénytelen kosár." });
    }
    const ids = new Set();
    const lines = [];
    let total = 0;
    for (const item of items) {
      const id = item?.id, qty = item?.qty;
      if (typeof id !== "string" || !/^[\w-]{1,128}$/.test(id) ||
          !Number.isSafeInteger(qty) || qty < 1 || qty > 20 || ids.has(id)) {
        return writeJson(res, 400, { error: "Érvénytelen termék vagy mennyiség." });
      }
      ids.add(id);
      const product = await getDocument("products", id);
      if (product.shopMode !== "purchase" || product.shopVisible === false ||
          typeof product.name !== "string" || !product.name.trim()) {
        return writeJson(res, 409, { error: "Egy termék már nem rendelhető. Frissítsd a kosarat." });
      }
      if (product.stock !== null && product.stock !== undefined &&
          (!Number.isSafeInteger(product.stock) || product.stock < qty)) {
        return writeJson(res, 409, { error: "Egy termékből nincs elegendő készlet." });
      }
      const minor = priceInStripeMinorUnits(product.price);
      total += minor * qty;
      if (!Number.isSafeInteger(total) || total > 5000000000) {
        return writeJson(res, 400, { error: "A kosár végösszege túl magas." });
      }
      lines.push({ id, name: product.name.trim().slice(0, 250), qty, unitAmount: minor });
    }
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("locale", "hu");
    form.set("payment_method_types[0]", "card");
    form.set("billing_address_collection", "required");
    form.set("phone_number_collection[enabled]", "true");
    form.set("client_reference_id", randomUUID());
    form.set("metadata[fulfillment]", "personal_pickup");
    form.set("success_url", origin() + "/checkout-success.html?session_id={CHECKOUT_SESSION_ID}");
    form.set("cancel_url", origin() + "/shop.html?checkout=cancelled");
    lines.forEach((line, index) => {
      const path = "line_items[" + index + "]";
      form.set(path + "[price_data][currency]", "huf");
      form.set(path + "[price_data][unit_amount]", String(line.unitAmount));
      form.set(path + "[price_data][product_data][name]", line.name);
      form.set(path + "[quantity]", String(line.qty));
    });
    const session = await stripeRequest("POST", "/checkout/sessions", form, {
      "Idempotency-Key": randomUUID()
    });
    if (!session?.id || !session?.url || !session.url.startsWith("https://checkout.stripe.com/")) {
      throw new Error("Invalid Stripe Checkout response");
    }
    await createDocument("stripe_orders", session.id, {
      sessionId: session.id,
      status: "created",
      fulfillment: "personal_pickup",
      currency: "huf",
      totalMinor: total,
      items: lines.map(({ id, name, qty, unitAmount }) => ({ id, name, qty, unitAmount })),
      createdAt: new Date().toISOString()
    });
    return writeJson(res, 200, { url: session.url });
  } catch (error) {
    console.error("[checkout] failed", error.message);
    if (error.statusCode === 404) return writeJson(res, 409, { error: "Egy termék már nem elérhető." });
    return writeJson(res, 500, { error: "Nem sikerült elindítani a fizetést. Kérjük, próbáld újra." });
  }
};
