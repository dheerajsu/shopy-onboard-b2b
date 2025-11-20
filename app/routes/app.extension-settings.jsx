import { useState, useEffect } from "react";
import cryptoNode from "crypto";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server"

// 🧩 Load setting from DB (ensure one exists) + load existing app API key from session table
export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let setting = await prisma.setting.findUnique({
    where: { shopId: shopDomain },
  });

  if (!setting) {
    setting = await prisma.setting.create({ 
      data: {
        shopId: shopDomain,
        autoApproval: false,
      },
    });
  }

  // try to load existing app API key from session table
  let sessionRecords = await prisma.session.findMany({
      where: { shop: shopDomain },
    })
    .catch(() => []);
  const appApiKey = sessionRecords && sessionRecords.length > 0 ? sessionRecords[0].appapikey ?? "" : "";

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    setting,
    appApiKey,
  });
};

// helper to generate server key (30 hex chars when using 15 bytes)
const generateServerApiKey = () => {
  return cryptoNode.randomBytes(15).toString("hex");
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

      // Return appApiKey and mark type so front-end can distinguish this response
      return Response.json({ success: true, type: "appapikey", appApiKey: appapikey, updated: result.count });
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

  // Return type so front-end knows this is the toggle response
  return Response.json({ success: true, type: "toggle", autoApproval: enable });
};

// 🧩 UI
export default function ExtensionSettings() {
  const { apiKey, setting, appApiKey } = useLoaderData();

  // TWO separate fetchers:
  // - settingsFetcher -> used only for the toggle button
  // - keyFetcher -> used only for save/generate key actions
  const settingsFetcher = useFetcher();
  const keyFetcher = useFetcher();

  // local state for API key input
  const [key, setKey] = useState("");

  // on mount OR when keyFetcher returns data: prefer keyFetcher optimistic response if present, otherwise loader value
  useEffect(() => {
    const fromFetcher = keyFetcher.data?.appApiKey;
    const initial = fromFetcher !== undefined ? fromFetcher : appApiKey;

    setKey(initial || "");
  }, [keyFetcher.data, appApiKey]);

  // autoApproval state comes from settingsFetcher if present, else loader
  const current =
    settingsFetcher.data?.autoApproval !== undefined ? settingsFetcher.data.autoApproval : setting.autoApproval;

  const currentAppApiKey =
    keyFetcher.data?.appApiKey !== undefined ? keyFetcher.data.appApiKey : appApiKey;

  const handleToggle = () => {
    const formData = new FormData();
    formData.append("enable", (!current).toString());
    formData.append("shopId", setting.shopId);
    // use settingsFetcher (isolated)
    settingsFetcher.submit(formData, { method: "post" });
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("shopId", setting.shopId);
    const val = (formData.get("appapikey") || "").toString().replace(/\s+/g, "");
    formData.set("appapikey", val);
    // use keyFetcher (isolated)
    keyFetcher.submit(formData, { method: "post" });
  };

  // Generate key button handler — submits empty appapikey so server will generate & save it
  const handleGenerateKey = (e) => {
    e && e.preventDefault();
    const formData = new FormData();
    // sending an empty string for "appapikey" triggers server-side generation in action()
    formData.append("appapikey", "");
    formData.append("shopId", setting.shopId);
    // use keyFetcher (isolated)
    keyFetcher.submit(formData, { method: "post" });
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
              

              {/* <s-button tone={current ? "critical" : "success"} variant="primary" onClick={handleToggle}>
                {current ? "Disable" : "Enable"}
              </s-button> */}
              <s-stack direction="inline" gap="base">
                <s-switch
                  onClick={handleToggle}
                  checked={current}
                />
                <s-text tone={current ? "success" : "critical"}>
                  Auto Approval is <strong>{current ? "Enabled" : "Disabled"}</strong>
                </s-text>
              </s-stack>

              {/* Show toggle saving state from settingsFetcher only */}
              {settingsFetcher.state === "submitting" ? (
                <s-text>Updating settings…</s-text>
              ) : settingsFetcher.data?.type === "toggle" && settingsFetcher.data?.success ? (
                <s-text tone="success">Updated</s-text>
              ) : null}
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>

      {/* API Key section */}
      <s-section>
        <s-box padding="base" border="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="base">
            <s-heading>App API Key</s-heading>
            <form onSubmit={handleSaveKey}>
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                
                 <s-text-field placeholder="Api Key" 
                  onChange={onChangeHandler} 
                  value={key} 
                  onKeyDown={onKeyDownPreventSpace} 
                  onPaste={onPasteStripSpaces} 
                  autoComplete="off" />
               
                  <s-button onClick={() => navigator.clipboard.writeText(key)}>
                    <s-icon type="duplicate" title="copy key"/>
                  </s-button>
                  
                </s-stack>
              
                <s-stack direction="inline" gap="base">
                  {/* Generate Key button — will trigger server-side generation & auto-save */}
                  <s-button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateKey}
                    disabled={keyFetcher.state === "submitting"}
                  >
                    {keyFetcher.state === "submitting" ? "Generating…" : "Generate and save Key"}
                  </s-button>

                  {/* Show keyFetcher status only (isolated) */}
                  {keyFetcher.state === "submitting" ? (
                    <s-text>Saving…</s-text>
                  ) : keyFetcher.data?.type === "appapikey" && keyFetcher.data?.success ? (
                    <s-text tone="success">Saved</s-text>
                  ) : keyFetcher.data?.error ? (
                    <s-text tone="critical">{keyFetcher.data.error}</s-text>
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
