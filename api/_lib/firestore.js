const crypto = require("node:crypto");

const EXPECTED_PROJECT = "flymeto-696d0";
const DOCUMENTS = "https://firestore.googleapis.com/v1/projects/" + EXPECTED_PROJECT + "/databases/(default)/documents";
let cachedToken = null;

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const credentials = JSON.parse(raw);
  if (credentials.project_id !== EXPECTED_PROJECT || !credentials.client_email || !credentials.private_key) {
    throw new Error("Firebase service account does not match the product database");
  }
  return credentials;
}

function base64url(input) { return Buffer.from(input).toString("base64url"); }

async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.token;
  const account = serviceAccount();
  const issued = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: issued, exp: issued + 3600
  }));
  const unsigned = header + "." + claims;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + signature
    })
  });
  if (!response.ok) throw new Error("Firebase server authorization failed");
  const data = await response.json();
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, firestoreValue(v)])) } };
  }
  throw new Error("Unsupported Firestore field type");
}

function decodeField(value) {
  if (!value || "nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decodeField(v)]));
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeField);
  return null;
}

async function firestoreRequest(method, path, data = undefined) {
  const token = await accessToken();
  const response = await fetch(DOCUMENTS + path, {
    method,
    headers: { Authorization: "Bearer " + token, ...(data ? { "Content-Type": "application/json" } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  if (!response.ok) {
    const err = new Error("Firestore server request failed (" + response.status + ")");
    err.statusCode = response.status;
    throw err;
  }
  return response.json().catch(() => ({}));
}

function documentId(id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) {
    throw new Error("Invalid Firestore document ID");
  }
  return encodeURIComponent(id);
}

async function getDocument(collection, id) {
  const doc = await firestoreRequest("GET", "/" + encodeURIComponent(collection) + "/" + documentId(id));
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decodeField(v)]));
}

async function createDocument(collection, id, fields) {
  const encoded = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValue(v)]));
  return firestoreRequest("POST", "/" + encodeURIComponent(collection) + "?documentId=" + documentId(id), { fields: encoded });
}

async function updateDocument(collection, id, patch) {
  const qs = new URLSearchParams();
  for (const field of Object.keys(patch)) qs.append("updateMask.fieldPaths", field);
  const fields = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, firestoreValue(v)]));
  return firestoreRequest("PATCH", "/" + encodeURIComponent(collection) + "/" + documentId(id) + "?" + qs, { fields });
}

module.exports = { getDocument, createDocument, updateDocument };
