import { jwtVerify } from "jose";
import prisma from "../../db.server";
import {apiVersion} from "../../shopify.server";


// A helper to send JSON responses with CORS headers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export const DEFAULT_FIRST = 10;
const DEFAULT_CLOCK_TOLERANCE = 120;

async function verifySessionTokenFromRequest(request) {
  const auth =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    console.warn("Missing Bearer token on request");
    return {
      errorResponse: new Response(
        JSON.stringify({ success: false, message: "Missing Bearer token" }),
        { status: 401, headers: CORS }
      ),
    };
  }

  const token = auth.replace(/^Bearer\s+/i, "");

  if (!process.env.SHOPIFY_API_SECRET) {
    console.error("Missing SHOPIFY_API_SECRET env var");
    return {
      errorResponse: new Response(
        JSON.stringify({ success: false, message: "Server misconfiguration" }),
        { status: 500, headers: CORS }
      ),
    };
  }

  const secret = new TextEncoder().encode(process.env.SHOPIFY_API_SECRET);

  // Light decode to inspect claims for diagnostics (no verification)
  let payloadCandidate = null;
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      payloadCandidate = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    }
  } catch (e) {
    // ignore decode error
  }

  const serverNowSec = Math.floor(Date.now() / 1000);
  //console.log("verifySessionToken: serverNow (sec) =", serverNowSec);
  if (payloadCandidate) {
    // console.log("token claims sample:", {
    //   iat: payloadCandidate.iat,
    //   nbf: payloadCandidate.nbf,
    //   exp: payloadCandidate.exp,
    //   sub: payloadCandidate.sub,
    // });
    if (typeof payloadCandidate.nbf === "number") {
      //console.log("nbf - now (sec) =", payloadCandidate.nbf - serverNowSec);
    }
  }

  // Primary verification attempt (strict)
  try {
    const verified = await jwtVerify(token, secret);
    return { payload: verified.payload };
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    console.warn("jwtVerify first attempt failed:", message);

    // If failure is related to time-based claim validation, try again with small tolerance
    const isClaimError = /nbf|iat|exp|claim|timestamp/i.test(message);
    if (isClaimError) {
      try {
        const verified = await jwtVerify(token, secret, { clockTolerance: DEFAULT_CLOCK_TOLERANCE });
        console.warn(`jwtVerify succeeded with clockTolerance=${DEFAULT_CLOCK_TOLERANCE}s`);
        return { payload: verified.payload };
      } catch (err2) {
        console.error("jwtVerify failed even with clockTolerance:", String(err2));
        const errMsg = /exp|expired/i.test(String(err2.message || err2))
          ? "Session token expired"
          : /nbf|not before/i.test(String(err2.message || err2))
            ? "Session token not yet valid (nbf)"
            : "Invalid session token";
        return {
          errorResponse: new Response(
            JSON.stringify({ success: false, message: errMsg }),
            { status: 401, headers: CORS }
          ),
        };
      }
    }

    // Not a time-claim issue — return invalid token
    return {
      errorResponse: new Response(
        JSON.stringify({ success: false, message: "Invalid session token" }),
        { status: 401, headers: CORS }
      ),
    };
  }
}



export async function getShopifyAdminContext(request) {
  // 1) Verify & decode the session token (robust)
  const { payload, errorResponse } = await verifySessionTokenFromRequest(request);
  if (errorResponse) {
    return { error: errorResponse };
  }

  // payload is verified
  // 2) Extract shop domain from payload
  let shopDomain;
  try {
    if (payload.dest) {
      shopDomain = payload.dest; // e.g. "codebeansdevd.myshopify.com"
    } else {
      throw new Error("no shop info in token payload");
    }
  } catch (err) {
    console.error("Unable to extract shop domain from token payload:", payload, err);
    return {
      error: new Response(
        JSON.stringify({ success: false, message: "Invalid token payload" }),
        { status: 400, headers: CORS }
      ),
    };
  }

  // 3) Find the stored OAuth session / access token for this shop in your DB (Prisma)
  let sessionRow;
  try {
    sessionRow = await prisma.session.findFirst({
      where: { shop: shopDomain },
    });
  } catch (err) {
    console.error("Prisma lookup error:", err);
    return {
      error: new Response(
        JSON.stringify({ success: false, message: "Server error (db lookup)" }),
        { status: 500, headers: CORS }
      ),
    };
  }
  if (!sessionRow) {
    console.error("No session found for shop:", shopDomain);
    return {
      error: new Response(
        JSON.stringify({ success: false, message: "No OAuth session found for shop" }),
        { status: 404, headers: CORS }
      ),
    };
  }

  const accessToken = sessionRow.accessToken;
  if (!accessToken) {
    console.error("No accessToken in session for shop:", shopDomain);
    return {
      error: new Response(
        JSON.stringify({ success: false, message: "No access token in session" }),
        { status: 500, headers: CORS }
      ),
    };
  }

  //const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-07";

  return { shopDomain, accessToken, apiVersion};
}

export async function graphQLRequest(ctx, query, variables = {}) {
  const { shopDomain, accessToken} = ctx;
  if (!shopDomain || !accessToken) throw new Error("Missing Shopify admin context (shopDomain/accessToken)");

  const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    const err = new Error(`Shopify GraphQL ${resp.status}: ${txt}`);
    err.status = resp.status;
    throw err;
  }

  const json = await resp.json();
  // GraphQL top-level errors
  if (json.errors?.length) {
    const err = new Error(json.errors.map(e => e.message).join("; "));
    err.graphql = json.errors;
    throw err;
  }

  // return the "data" object for convenience
  return json.data;
}