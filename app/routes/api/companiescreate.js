import { authenticate } from "../../shopify.server";
import { companyCreate } from "../query";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.json();
    
    

    const variables = {
      input: {
        company: {
          name: formData.companyName || "Company Name",
          externalId: formData.externalId || `${Date.now()}`
        },
        companyLocation: {
          name: formData.locationName || "Main Location",
          shippingAddress: {
            firstName: formData.firstName || "First",
            lastName: formData.lastName || "Last",
            address1: formData.address1 || "123 Main St",
            address2: formData.address2 || "",
            city: formData.city || "City",
            zip: formData.zip || "12345",
            phone: formData.phone || "1234567890",
            countryCode: formData.countryCode || "US"
          },
          billingSameAsShipping: true
        }
      }
    };

    console.log("GraphQL variables:", variables);

    // Use admin.graphql on the server side
    const response = await admin.graphql(companyCreate, {
      variables: variables
    });

    const responseData = await response.json();
    console.log("GraphQL response:", responseData);

    if (responseData.data?.companyCreate?.company) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          company: responseData.data.companyCreate.company 
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else if (responseData.data?.companyCreate?.userErrors?.length > 0) {
      const errors = responseData.data.companyCreate.userErrors;
      const errorMessage = errors.map(error => `${error.field}: ${error.message}`).join(', ');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else if (responseData.errors) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.errors[0]?.message || "GraphQL error" 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Unknown error occurred" 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error("Error in company creation:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}