// app._index.jsx

import {useEffect} from "react";
import prisma from "../db.server";
import {useLoaderData, useFetcher, useNavigate} from "react-router";
import {useAppBridge} from "@shopify/app-bridge-react";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {authenticate} from "../shopify.server";

// Protect the route (adjust if your template already has a loader)
export const loader = async ({ request }) => {
 const { session } = await authenticate.admin(request);
  const shop = session.shop;
  // Build base where clause
  //let where = { shopId: shop };
  const pendingCount = await prisma.company.count({
    where: {
      shopId: shop,
      companyStatus: "open", // pending
    },
  });
  
  return Response.json({ pendingCount });
};

export default function Index() {
  const { pendingCount } = useLoaderData();
  const navigate = useNavigate();
  const app = useAppBridge();
  const fetcher = useFetcher();

  useEffect(() => {
    // you can hook app bridge, analytics, etc. here
  }, [app]);

  const handleReviewClick = () => {
     navigate(`/app/companies?status=open&page=1`);
  };

  return (
    <s-page inlineSize="base" heading="Shopy B2B Solutions" >
      {/* SETUP ESSENTIALS CARD */}
      <s-section heading="Setup essentials">
        <s-stack gap="base">
          <s-divider/>
          <SetupRow
            label="Customize the application form"
            actionLabel="View form editor"
            href="javascript:void(0)"
          />
          <s-divider/>
          <SetupRow
            label="Review approval preset"
            actionLabel="Manage preset"
            href="/app/approval_presets"
          />
          <s-divider/>
          <SetupRow
            label="Activate app extensions"
            actionLabel="Manage installation"
            href="/app/installation"
          />
          <s-divider/>
          <SetupRow
            label="Configure email notifications"
            actionLabel="Manage notifications"
            href="/app/notifications"
          />
          <s-divider/>
        </s-stack>
        
      </s-section>

      {/* WELCOME + INNER CARDS */}
      <s-section heading="Welcome" borderRadius="base">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          {/* Pending applications */}
          <s-box heading="Pending applications" borderRadius="base"
  borderWidth="base"
  padding="base">
            <s-stack gap="base large">
              <s-stack direction="inline" gap="base">
                <s-icon type="profile" size="base" />
                <s-heading>Pending applications</s-heading>
              </s-stack>
              <s-heading>{pendingCount}</s-heading>
              <s-button disabled={pendingCount === 0}
                onClick={handleReviewClick}
              >Review applications</s-button>
            </s-stack>
          </s-box>

          {/* Company import */}
          <s-box heading="Company import" borderRadius="base"
  borderWidth="base"
  padding="base">
            <s-paragraph>
              Use the app to bulk create or update companies, locations, and
              contacts.
            </s-paragraph>
            <s-button variant="secondary">View import tool</s-button>
          </s-box>
        </s-grid>
      </s-section>

      {/* EXTENSION STATUS CARD */}
      <s-section heading="Extension status">
        <s-stack gap="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="lock" />
            <s-text>Storefront lock</s-text>
            <s-badge tone="info" color="subdued">
              Not live
            </s-badge>
          </s-stack>

          <s-button variant="secondary">View installation settings</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

/**
 * Single checklist row used in "Setup essentials"
 */
function SetupRow({label, actionLabel, href }) {
  return (
    <s-stack
      direction="inline"
      gap="base"
      alignItems="center"
      justifyContent="space-between"
    >
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-icon type="check-circle-filled" tone="success" />
        <s-text>{label}</s-text>
      </s-stack>

      <s-link href={href}>{actionLabel}</s-link>
    </s-stack>
  );
}


export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
