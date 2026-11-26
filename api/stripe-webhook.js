const { rawBody, verifyStripeWebhook, writeJson, allowPost } = require("./_lib/stripe");
const { getDocument, updateDocument } = require("./_lib/firestore");

async function handler(req, res) {
  if (!allowPost(req, res)) return;
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return writeJson(res, 503, { error: "Webhook is not configured" });
  }
  let event;
  try {
    const body = await rawBody(req);
    event = verifyStripeWebhook(body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.warn("[stripe-webhook] invalid signature", error.message);
    return writeJson(res, 400, { error: "Invalid Stripe webhook signature" });
  }
  const relevant = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired"
  ]);
  if (!relevant.has(event.type)) return writeJson(res, 200, { received: true });
  try {
    const session = event.data?.object;
    if (session?.object !== "checkout.session" || typeof session.id !== "string") {
      return writeJson(res, 400, { error: "Invalid checkout event" });
    }
    const order = await getDocument("stripe_orders", session.id);
    const amountValid = session.amount_total === order.totalMinor && session.currency === order.currency;
    if (!amountValid) {
      console.error("[stripe-webhook] amount/currency mismatch for session", session.id);
      return writeJson(res, 400, { error: "Payment data mismatch" });
    }
    let newStatus = null;
    if (event.type === "checkout.session.completed") {
      if (session.payment_status === "paid") newStatus = "paid";
      else if (order.status === "created") newStatus = "pending";
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      newStatus = "paid";
    } else if (event.type === "checkout.session.async_payment_failed") {
      if (order.status !== "paid") newStatus = "failed";
    } else if (event.type === "checkout.session.expired") {
      if (order.status === "created" || order.status === "pending") newStatus = "expired";
    }
    if (newStatus && !(order.status === "paid" && newStatus !== "paid")) {
      await updateDocument("stripe_orders", session.id, {
        status: newStatus,
        lastStripeEvent: event.id || "",
        updatedAt: new Date().toISOString()
      });
    }
    return writeJson(res, 200, { received: true });
  } catch (error) {
    console.error("[stripe-webhook] processing failed:", error.message);
    return writeJson(res, 500, { error: "Unable to persist payment state" });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
