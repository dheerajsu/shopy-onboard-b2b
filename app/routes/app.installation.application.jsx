import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { checkoutProfiles,customerAccountPagesQuery } from "./query";
import { useState, useEffect } from "react";
/**
 * Server loader
 * - authenticate inside loader to keep server-only modules out of client bundle
 */
export const loader = async ({ request }) => {
  // authenticate (throws / redirects if not logged in)
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  //extension id get
  let formPageUrl = "";
  let managePageUrl = "";
  try {
    const resp = await admin.graphql(customerAccountPagesQuery);
    const json = await resp.json();

    const shopGid = json.data.shop.id;                      // gid://shopify/Shop/80009855195
    const shopNumericId = shopGid.split("/").pop();         // "80009855195"

    const pages = json.data.customerAccountPages?.nodes || [];

    // Example: you distinguish pages by handle or title
    const base = `https://shopify.com/${shopNumericId}/account/pages`;

    for (const page of pages) {
      if (!page.appExtensionUuid) continue; // only app extension pages

      // You can match however you named them in the editor / TOML
      if (page.title === "b2-b-registration") {
        formPageUrl = `${base}/${page.appExtensionUuid}`;
      }

      if (page.title === "manage-team") {
        managePageUrl = `${base}/${page.appExtensionUuid}`;
      }
    }
  } catch (e) {
    console.error("Failed to fetch customer account pages", e);
  }

  //checkout profiles access
  let profiles = [];
  try {
      //const response = await admin.graphql(paymentTerms);
      const checoutresponse = await admin.graphql(checkoutProfiles);
      const cpJson = await checoutresponse.json();
      profiles = (cpJson.data?.checkoutProfiles?.edges || []).map(e => e.node);
      
    } catch (error) {
        console.error("Failed to fetch payment terms templates:", error);
    }

  // return any data you want the UI to use. Keep minimal for now.
  return Response.json({ profiles,shop, formPageUrl, managePageUrl });
};

/**
 * Page UI
 */
export default function ApplicationTab() {
  // loader data (currently empty, could hold form-links/config)
  const { profiles = [], shop , formPageUrl, managePageUrl} = useLoaderData();
  // live first, then drafts
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.isPublished === b.isPublished) return 0;
    return a.isPublished ? -1 : 1; // true first
  });
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || "");
//   const [selectedThemeId, setSelectedThemeId] = useState(themes[0]?.id || "");
  const shopHandle = shop.replace(".myshopify.com", "");
  const launchEditor = () => {
    if (!selectedProfileId) return;
    // selectedProfileId is "gid://shopify/CheckoutProfile/4779311253"
    const numericId = selectedProfileId.split("/").pop();
    const url = `https://admin.shopify.com/store/${shopHandle}/settings/checkout/editor/profiles/${numericId}?page=profile&context=apps`;
    window.open(url, "_blank");
  };

  const copy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      // Optional: show toast to user
      console.log("Copied:", value);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <s-page inlineSize="large" heading="Installation">
      <s-stack direction="block" gap="base">
        {/* Section header row (optional) */}
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading>Company application and management</s-heading>
        </s-stack>

        {/* Two-column layout: left narrow column + right main content */}
        <s-grid gridTemplateColumns="300px 1fr" gap="base">
          {/* Left column (narrow): explanatory panel) */}
          <div>
            <s-box padding="base" border="base" borderRadius="base" background="base">
              <s-stack direction="block" gap="small-100">
                <s-heading size="small">Full-page activation</s-heading>
                <s-paragraph color="subdued" size="small">
                  You can allow B2B customers to apply for access by adding a new page to your Customer Account Portal. 
                  You can also use a new page to allow approved B2B customers to manage their Company contacts. 
                </s-paragraph>
              </s-stack>
            </s-box>
          </div>

          {/* Right column (main content): multiple setting cards */}
          <div>
            <s-stack direction="block" gap="base">
              {/* Choose checkout configuration */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="small-100">
                <s-text weight="bold">Choose a checkout configuration</s-text>
                <s-select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
                    {sortedProfiles.map((p) => (
                        <s-option value={p.id} key={p.id}>
                            {p.name} {p.isPublished ? "(live)" : ""}
                        </s-option>
                    ))}
                </s-select>
                <s-button onClick={launchEditor}>Launch editor</s-button>
                {/* <s-button onClick={launchEditor}>Launch editor</s-button> */}
                </s-stack>
              </s-box>

              {/* Extensions overview */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="small-100">
                  <s-heading size="small">Extensions overview</s-heading>

                  <s-box padding="small-100" border="none" background="transparent">
                    <s-stack direction="block" gap="small-100">
                      
                      <s-stack gap="small-100" alignItems="center">
                        <s-stack direction="block" gap="small">
                          <s-stack direction="inline" gap="base">
                            <s-icon type="bag" />
                            <s-text weight="bold">Company application form</s-text>
                          </s-stack>
                          <s-stack paddingInline="large-400">
                            <s-paragraph color="subdued">
                                Allow potential B2B customers to apply for access by adding a new page to your Customer Account Portal.
                            </s-paragraph>
                          </s-stack>
                        </s-stack>
                      </s-stack>

                      <s-divider />

                      <s-stack direction="inline" gap="small-100" alignItems="center">
                        <s-stack direction="block" gap="small">
                          <s-stack direction="inline" gap="base">
                            <s-icon type="person-list" />
                            <s-text weight="bold">Manage contacts page</s-text>
                          </s-stack>
                          <s-stack paddingInline="large-400">
                            <s-paragraph color="subdued">
                                Allow approved B2B customers to manage their Company contacts.
                            </s-paragraph>
                          </s-stack>
                        </s-stack>

                      </s-stack>

                      <s-divider />

                      <s-stack direction="inline" gap="small-100" alignItems="center">
                        <s-stack direction="block" gap="small">
                          <s-stack direction="inline" gap="base">
                            <s-icon type="book-open" />
                            <s-text weight="bold">Account page banner</s-text>
                          </s-stack>
                          <s-stack paddingInline="large-400">
                            <s-paragraph color="subdued">
                                Let customers know they need to apply for access by adding a banner to customer account pages.
                            </s-paragraph>
                          </s-stack>
                        </s-stack>

                      </s-stack>
                    </s-stack>
                  </s-box>
                </s-stack>
              </s-box>

              {/* Page links card */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="small-100">
                  <s-heading size="small">Page links</s-heading>
                  <s-paragraph tone="subdued" size="small">
                    You can copy links for the Customer Account Portal pages to add them to emails, popups, etc.
                  </s-paragraph>

                  <s-stack direction="block" gap="small-100">
                    <s-stack direction="inline" gap="small-100" justifyContent="space-between" alignItems="center">
                      <s-text>Company application form page link</s-text>
                      <s-button variant="secondary" onClick={() => copy(formPageUrl)}
          disabled={!formPageUrl} >
                        Copy form page link
                      </s-button>
                    </s-stack>
                    
                    <s-stack direction="inline" gap="small-100" justifyContent="space-between" alignItems="center">
                      <s-text>Company management page link</s-text>
                      <s-button variant="secondary" onClick={() => copy(managePageUrl)}
          disabled={!managePageUrl}>Copy management page link</s-button>
                    </s-stack>
                  </s-stack>

                  <s-text tone="subdued" size="small">
                    These links are based on the app extension's location in the Customer Account Portal. Make sure you have activated the app extensions for the links to work.
                  </s-text>
                </s-stack>
              </s-box>
            </s-stack>
          </div>
        </s-grid>
      </s-stack>
    </s-page>
  );
}

/**
 * headers forwarding for Shopify react-router boundary
 * keep server-only reference inside the function
 */
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
