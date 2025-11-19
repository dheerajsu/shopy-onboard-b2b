// app.additionalnew.jsx
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  // ... any loader logic
  return Response.json({ message: "This is the additional new page" });
};

export default function AdditionalNew() {
  const data = useLoaderData();

  return (
    <s-page>
      <s-heading>Additional New Page</s-heading>
      <s-text>This is the additional new page content.</s-text>
    </s-page>
  );
}