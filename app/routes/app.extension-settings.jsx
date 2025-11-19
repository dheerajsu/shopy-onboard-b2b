import { useState, useEffect } from "react";
import cryptoNode from "crypto";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server"

// 🧩 Load setting from DB (ensure one exists) + load existing app API key from session table
export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // find setting for this shop
  // If shopId is not unique in your schema, consider using findFirst instead of findUnique
  let setting = await prisma.setting.findUnique({
    where: { shopId: shopDomain },
  });

  // if not found, create a default one
  if (!setting) {
    setting = await prisma.setting.create({ 
      data: {
        shopId: shopDomain,
        autoApproval: false,
      },
    });
  }

  // try to load existing app API key from session table
  let sessionRecords = await prisma.session
    .findMany({
      where: { shop: shopDomain },
    })
    .catch(() => []);
  const appApiKey =
    sessionRecords && sessionRecords.length > 0
      ? sessionRecords[0].appapikey ?? ""
      : "";

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    setting,
    appApiKey,
  });
};

// helper to generate server key (48 hex chars)
const generateServerApiKey = () => {
  return cryptoNode.randomBytes(24).toString("hex");
};

// 🧩 Action handles both toggle and saving app API key
export const action = async ({ request }) => {
  const formData = await request.formData();

  // handle saving the app API key
  if (formData.has("appapikey")) {
    let appapikey = formData.get("appapikey")?.toString() ?? "";
    const shopId = formData.get("shopId")?.toString();

    if (!shopId) {
      return Response.json({ success: false, error: "missing shopId" }, { status: 400 });
    }

    // If client didn't send a value (or sent empty string), generate server-side
    if (!appapikey || appapikey.trim() === "") {
      appapikey = generateServerApiKey();
    } else {
      // make sure no whitespace sneaked in
      appapikey = appapikey.replace(/\s+/g, "");
    }

    try {
      // Update all sessions for shop (your schema has non-unique shop)
      const result = await prisma.session.updateMany({
        where: { shop: shopId },
        data: { appapikey },
      });

      if (result.count === 0) {
        return Response.json(
          { success: false, error: `No session found for shop "${shopId}"` },
          { status: 404 }
        );
      }

      return Response.json({ success: true, appApiKey: appapikey, updated: result.count });
    } catch (err) {
      console.error("Error updating appapikey:", err);
      return Response.json({ success: false, error: err?.message ?? "unknown error" }, { status: 500 });
    }
  }

  // 🧩 Toggle setting (existing behavior)
  const enable = formData.get("enable") === "true";
  const shopId = formData.get("shopId");

  // ensure the record exists
  let existing = await prisma.setting.findUnique({
    where: { shopId },
  });

  if (!existing) {
    await prisma.setting.create({
      data: { shopId, autoApproval: enable },
    });
  } else {
    await prisma.setting.update({
      where: { shopId },
      data: { autoApproval: enable },
    });
  }

  return Response.json({ success: true, autoApproval: enable });
};

// 🧩 UI
export default function ExtensionSettings() {
  const { apiKey, setting, appApiKey } = useLoaderData();
  const fetcher = useFetcher();

  // local state for API key input
  const [key, setKey] = useState("");

  // on mount: prefer fetcher optimistic response if present, otherwise loader value
  useEffect(() => {
    const fromFetcher = fetcher.data?.appApiKey;
    const initial = fromFetcher !== undefined ? fromFetcher : appApiKey;

    if (initial && initial.trim() !== "") {
      setKey(initial);
      return;
    }

    // if no key present, generate client-side key (UUID without dashes) for immediate UX
    try {
      const clientKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "")
          : [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      setKey(clientKey);
    } catch (e) {
      setKey(Math.random().toString(36).slice(2, 18));
    }
  }, [fetcher.data, appApiKey]);

  const current =
    fetcher.data?.autoApproval !== undefined ? fetcher.data.autoApproval : setting.autoApproval;

  const currentAppApiKey =
    fetcher.data?.appApiKey !== undefined ? fetcher.data.appApiKey : appApiKey;

  const handleToggle = () => {
    console.log("handle working");
    const formData = new FormData();
    formData.append("enable", (!current).toString());
    formData.append("shopId", setting.shopId);
    fetcher.submit(formData, { method: "post" });
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("shopId", setting.shopId);
    const val = (formData.get("appapikey") || "").toString().replace(/\s+/g, "");
    formData.set("appapikey", val);
    fetcher.submit(formData, { method: "post" });
  };

  const onKeyDownPreventSpace = (ev) => {
    if (ev.key === " ") {
      ev.preventDefault();
    }
  };
  const onPasteStripSpaces = (ev) => {
    ev.preventDefault();
    const text = (ev.clipboardData || window.clipboardData).getData("text");
    const stripped = text.replace(/\s+/g, "");
    const input = ev.target;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = input.value.slice(0, start) + stripped + input.value.slice(end);
    setKey(newValue);
    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + stripped.length;
    });
  };

  const onChangeHandler = (ev) => {
    const value = ev.target.value.replace(/\s+/g, "");
    setKey(value);
  };

  return (
    // NOTE: Do NOT re-wrap this route in AppProvider. AppProvider is already provided at top level (app.jsx).
    <s-page title="Extension Configuration">
      <s-section>
        <s-box padding="base" border="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="base">
            <s-heading>Auto Approval Settings</s-heading>
            <s-text>
              Control whether new company applications are automatically approved or require
              manual review.
            </s-text>

            <s-stack direction="block" gap="base">
              <s-text tone={current ? "success" : "critical"}>
                Auto Approval is <strong>{current ? "Enabled" : "Disabled"}</strong>
              </s-text>

              <s-button tone={current ? "critical" : "success"} variant="primary" onClick={handleToggle}>
                {current ? "Disable" : "Enable"}
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>

      {/* API Key section */}
      <s-section>
        <s-box padding="base" border="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="base">
            <s-heading>App API Key</s-heading>
            <s-text>
              Store a custom API key for your app for this shop. This value is saved to the
              session table under <code>appapikey</code>. Spaces are not allowed in this key.
            </s-text>

            <form onSubmit={handleSaveKey}>
              <s-stack direction="block" gap="base">
                <s-field>
                  <label>API Key</label>
                  <input
                    name="appapikey"
                    value={key}
                    onChange={onChangeHandler}
                    onKeyDown={onKeyDownPreventSpace}
                    onPaste={onPasteStripSpaces}
                    placeholder="Auto-generated API Key"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                    }}
                    autoComplete="off"
                  />
                </s-field>

                <s-stack direction="inline" gap="base">
                  <s-button
                    type="submit"
                    variant="primary"
                    onClick={() => {
                      setKey((k) => (k ? k.replace(/\s+/g, "") : k));
                    }}
                  >
                    Save API Key
                  </s-button>

                  {fetcher.state === "submitting" ? (
                    <s-text>Saving…</s-text>
                  ) : fetcher.data?.success ? (
                    <s-text tone="success">Saved</s-text>
                  ) : fetcher.data?.error ? (
                    <s-text tone="critical">{fetcher.data.error}</s-text>
                  ) : null}
                </s-stack>

                <s-text size="small">
                  Current stored key: <code>{currentAppApiKey || "(none yet)"}</code>
                </s-text>
              </s-stack>
            </form>
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}
