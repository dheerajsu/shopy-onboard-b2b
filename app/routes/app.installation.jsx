// routes/app.installation.jsx
import { Outlet, Link, useLocation, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
  // if request url exactly /app/installation, redirect
  const url = new URL(request.url);
  if (url.pathname === "/app/installation" || url.pathname === "/app/installation/") {
    return redirect("/app/installation/application");
  }
  return Response.json({shop: session.shop});
};

export default function InstallationLayout() {
const {shop} = useLoaderData();
const storeHandle = shop.replace(".myshopify.com", "");

  const loc = useLocation();
  const pathname = loc.pathname;

  // Helper to decide active tab
  const isActive = (path) => pathname === path;

  return (
    <s-page inlineSize="base" heading="Shopy B2B Solutions" >
      <s-stack direction="block" gap="base">
        {/* Tabs header - use your s-components or s-link */}
        <s-banner heading="Information" tone="info" dismissible>
            To use the app's features, please ensure your store's native B2B access control setting has been turned off. You can find this setting in your 
            <s-link target="_top" href={`https://admin.shopify.com/store/${storeHandle}/online_store/preferences`}> Online Store Preferences</s-link>.
        </s-banner>
        <s-box padding="none" background="base" border="none" paddingBlock="base base" borderRadius="base base base large-100">
          <s-stack direction="inline" gap="small-200" alignItems="center" paddingInline="base">
            <s-link href="/app/installation/application" class={isActive("/app/installation/application") ? "active" : ""}>
              <s-button variant={isActive("/app/installation/application") ? "primary" : "tertiary"}>Company application and management</s-button>
            </s-link>

            <s-link href="/app/installation/checkout" class={isActive("/app/installation/checkout") ? "active" : ""}>
              <s-button variant={isActive("/app/installation/checkout") ? "primary" : "tertiary"}>Checkout access control</s-button>
            </s-link>

            <s-link href="/app/installation/storefront" class={isActive("/app/installation/storefront") ? "active" : ""}>
              <s-button variant={isActive("/app/installation/storefront") ? "primary" : "tertiary"}>Storefront B2B Info Form</s-button>
            </s-link>
          </s-stack>
        </s-box>

        {/* Main tab content rendered by child route file */}
        <Outlet />
      </s-stack>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
