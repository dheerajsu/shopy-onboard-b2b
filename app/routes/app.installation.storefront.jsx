import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";
import {queryGetAllThemes} from "./query"
import { useState } from "react";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const shopHandle = shop.replace(".myshopify.com", "");
  //checkout profiles access
    let themes = [];
    try {
        //const response = await admin.graphql(paymentTerms);
        const themesresponse = await admin.graphql(queryGetAllThemes);
        const cpJson = await themesresponse.json();
        themes = (cpJson.data?.themes?.nodes || []);
    } catch (error) {
        console.error("Failed to fetch themes:", error);
    }

  return Response.json({themes, shopHandle });
};

export default function CheckoutTab() {
  const { themes = [], shopHandle } = useLoaderData();
  // MAIN (live) first, then others
  const sortedThemes = [...themes].sort((a, b) => {
    const order = {
      MAIN: 0,         // live
      UNPUBLISHED: 1,
      DEVELOPMENT: 2,
      DEMO: 3,
    };
    return (order[a.role] ?? 99) - (order[b.role] ?? 99);
  });

  const [selectedThemeId, setSelectedThemeId] = useState(
    sortedThemes[0]?.id || ""
  );

  const launchThemeEditor = () => {
    if (!selectedThemeId) return;
    const numericId = selectedThemeId.split("/").pop();
    const url = `https://admin.shopify.com/store/${shopHandle}/themes/${numericId}/editor?context=apps`;
    window.open(url, "_blank");
  };

  return (
    <s-page inlineSize="large" heading="Installation">
      <s-stack direction="block" gap="base">
        
        {/* Two-column layout: left narrow column + right main content */}
        <s-grid gridTemplateColumns="300px 1fr" gap="base">
          {/* Left column (narrow): explanatory panel) */}
            <div>
                <s-box padding="base" border="base" borderRadius="base" background="base">
                    <s-stack direction="block" gap="small-100">
                        <s-heading size="small">App embed activation</s-heading>
                        <s-paragraph color="subdued" size="small">
                            You can restrict storefront access to B2B customers only by activating the app embed. 
                            This locks the storefront from guests who are not logged into an approved company account.  
                        </s-paragraph>
                    </s-stack>
                </s-box>
            </div>
          

          {/* Right column (main content): multiple setting cards */}
          
            <s-stack direction="block" gap="base">
              {/* Extensions overview */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="small-100">
                  <s-heading size="small">Extensions overview</s-heading>

                  <s-box padding="small-100" border="none" background="transparent">
                    <s-stack direction="block" gap="small-100">
                    <s-ordered-list>
                        <s-list-item>Create a New Page (Optional but Recommended)</s-list-item>
                        <s-list-item>Open the Theme Editor for That Page</s-list-item>
                        <s-list-item>Add the Form to the Page</s-list-item>
                        <s-list-item>Customize the Form (Optional)
                            <s-ordered-list>
                                <s-list-item>Change the form title</s-list-item>
                                <s-list-item>Update the description</s-list-item>
                                <s-list-item>Adjust background color</s-list-item>
                            </s-ordered-list>
                        </s-list-item>
                    </s-ordered-list>

                    <s-text weight="bold">Choose a theme</s-text>
                    <s-select
                        value={selectedThemeId}
                        onChange={(e) => setSelectedThemeId(e.target.value)}
                    >
                        {sortedThemes.map((t) => (
                        <s-option key={t.id} value={t.id}>
                            {t.name} {t.role === "MAIN" ? "(live)" : ""}
                        </s-option>
                        ))}
                    </s-select>
                    <s-button onClick={launchThemeEditor}>Launch theme editor</s-button>
                      
                    </s-stack>
                  </s-box>
                </s-stack>
              </s-box>

            </s-stack>
          
        </s-grid>
      </s-stack>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
