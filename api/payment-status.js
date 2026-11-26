const { stripeRequest, writeJson } = require("./_lib/stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return writeJson(res, 405, { error: "Method not allowed" });
  }
  const sessionId = req.query?.session_id;
  if (typeof sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9_]{10,220}$/.test(sessionId)) {
    return writeJson(res, 400, { error: "Érvénytelen fizetési azonosító." });
  }
  try {
    const session = await stripeRequest("GET", "/checkout/sessions/" + encodeURIComponent(sessionId));
    return writeJson(res, 200, {
      status: session.status === "complete" && session.payment_status === "paid"
        ? "paid"
        : (session.status === "expired" ? "expired" : "pending")
    });
  } catch (error) {
    console.error("[payment-status] error:", error.message);
    return writeJson(res, 502, { error: "A fizetés állapota nem ellenőrizhető." });
  }
};
