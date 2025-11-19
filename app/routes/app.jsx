import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
//import { initializeBeforeLoginPages } from '../utils/init-beforelogin';

export const loader = async ({ request }) => {
  const { admin , session} = await authenticate.admin(request);
  //await authenticate.admin(request);
  // try {
  //   await initializeBeforeLoginPages(admin, session);
  // } catch (err) {
  //   console.error("initializeBeforeLoginPages (top-level) failed:", err);
  // }
  //await initializeBeforeLoginPages(admin, session);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app/companies">Applications</s-link>
        <s-link href="/app/extension-settings">Configuration</s-link>
        <s-link href="/app/additional">Additional page</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
