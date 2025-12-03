import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Optionally fetch current checkout rule state from Shopify GraphQL or DB
  // const rule = await fetchCheckoutRule(admin);

  return Response.json({ checkoutRuleActive: false });
};

const redirectcheckoutRule = () => {
    const url = "https://admin.shopify.com/store/codb-2/settings/checkout/rules/validation/add/";
    window.open(url, "_blank")
}
export default function CheckoutTab() {
  const { checkoutRuleActive } = useLoaderData();

  return (
    <s-page inlineSize="large" heading="Installation">
      <s-stack direction="block" gap="base">
        
        {/* Two-column layout: left narrow column + right main content */}
        <s-grid gridTemplateColumns="300px 1fr" gap="base">
          {/* Left column (narrow): explanatory panel) */}
            <div>
                <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="small-100">
                    <s-heading size="small">Checkout rule configuration</s-heading>
                    <s-paragraph color="subdued" size="small">
                    You can restrict checkout by adding the app's Function to your store's checkout settings. 
                    This prevents checkout by guests who are not logged into an approved company account. 
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
                        <s-list-item>Launch Shopify checkout settings</s-list-item>
                        <s-list-item>Go to Checkout rules and click “Add rule”</s-list-item>
                        <s-list-item>Select the Company access control rule</s-list-item>
                        <s-list-item>Save and turn on the rule</s-list-item>
                    </s-ordered-list>
                    <s-button onClick={redirectcheckoutRule}>Add Checkout Rule</s-button>
                      
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
