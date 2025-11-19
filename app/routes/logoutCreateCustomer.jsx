import { useFetcher, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { createnewcustomer } from "../routes/query";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};


export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  return { session, admin };
}

export default function LogoutcustomerCreatecontact() {
  const { company } = useLoaderData() ?? {};
  const fetcher = useFetcher();
  
  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.success) {
      if (typeof window !== "undefined" && window.shopify?.toast?.show) {
        window.shopify.toast.show("Customer created successfully");
      } else {
        console.log("Customer created successfully");
      }
    } else if (fetcher.data.error) {
      if (typeof window !== "undefined" && window.shopify?.toast?.show) {
        window.shopify.toast.show(fetcher.data.error, { isError: true });
      } else {
        console.error(fetcher.data.error);
      }
    }
  }, [fetcher.data]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const companyform = {
      savedvalues: company
    }

    fetcher.submit(
      {
        companyform: JSON.stringify(companyform)
      },
      {
        method: "POST",
        action: "/logoutCreateCustomer"
      }
    );
  }

  return (
    <>
      <s-button variant="primary" onClick={handleSubmit}>
        Create Customer
      </s-button>
    </>
  )
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  try {
    const formData = await request.formData();
    const companyform = JSON.parse(formData.get("companyform"));
    const companyData = companyform.savedvalues;

    // Prepare customer data for Shopify
    const customerData = {
      first_name: companyData.customerFirstName || companyData.contactInfoFirstName || "",
      last_name: companyData.customerLastName || companyData.contactInfoLastName || "",
      email: companyData.customerEmail || "",
      phone: companyData.customerPhone || ""
    };

    const customervariable = {
      input: {
        email: customerData.email,
        phone: customerData.phone,
        firstName: customerData.first_name,
        lastName: customerData.last_name
      }
    };
    console.log("variables are",customervariable);

    // Execute the GraphQL mutation and capture the response
    const response = await admin.graphql(createnewcustomer, { variables: customervariable });
    const responseData = await response.json();
    
    //console.log("Customer creation response:", responseData);
    console.log("error is",responseData.data.customerCreate.userErrors);
    let errors = responseData.data.customerCreate.userErrors;
    // console.log("error is22",responseData.data.userErrors);
    // // Check if there were any errors in the GraphQL response
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }

    // Extract Shopify customer ID from response
    const shopifyCustomerId = responseData.data?.customerCreate?.customer?.id;
    if (!shopifyCustomerId) {
      throw new Error("Failed to get customer ID from Shopify response");
    }

    // 1. Create entry in companycontact table
    const companyContact = await prisma.companycontact.create({
      data: {
        baseCustomerId: shopifyCustomerId,
        customername: `${customerData.first_name} ${customerData.last_name}`.trim(),
        email: customerData.email,
        companystatus: false
      }
    });

    console.log("Company contact created:", companyContact);

    // 2. Update company table with companycontact ID and status
    if (companyData.id) {
      const updatedCompany = await prisma.company.update({
        where: { id: companyData.id },
        data: {
          customerId: companyContact.id, // Set to companycontact ID
          aurthorizedStatus: true, // Set to true
          companyStatus: 'open'
        }
      });
      console.log("Company updated:", updatedCompany);
    }

    // Return success response for the toast
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Customer created successfully and company record updated"
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );

  } catch (error) {
    console.error("Error creating customer:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to create customer" 
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}