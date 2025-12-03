import prisma from "../db.server";
import { graphQLRequest } from "./admin/utils";
import {get_customer_exist} from "./query";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

async function gettokenval(shopDomain){
  let sessionRow;
  try {
    sessionRow = await prisma.session.findFirst({
      where: { shop: shopDomain },
    });
  } catch (err) {
    console.error("Prisma lookup error:", err);
    return {
      error: new Response(
        JSON.stringify({ success: false, message: "Server error (db lookup)" }),
        { status: 500, headers: CORS }
      ),
    };
  }
  
  return sessionRow.accessToken;
}

async function checkShopifyCustomerExists(shop_domain, customer_email) {
  try {
    
    const accessToken = await gettokenval(shop_domain);
    const ctx = {shopDomain:shop_domain, accessToken}
    const variables = {
      emailid: customer_email
    };
    
    const response = await graphQLRequest(ctx, get_customer_exist, variables);

    //console.log("response is visible",response);

    if (response.customerByIdentifier == null) {
      return false;
    } else {
      return true;
    }

  } catch (error) {
    console.error('Error checking Shopify customer:', error);
    throw error; // Re-throw to handle in the main function
  }
}


export async function action({ request }) {
  
  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    //console.log("Handling OPTIONS preflight request");
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    //console.log("Method not allowed:", request.method);
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }

  try {
    // Parse the request body
    const body = await request.json();
    //console.log('Request body:', body);

    const {
      // Customer Information
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      
      // Company Information
      company_name,
      external_id,
      tax_id,
      
      // Shipping Address
      shipping_department,
      shipping_first_name,
      shipping_last_name,
      shipping_phone,
      shipping_address1,
      shipping_address2,
      shipping_country,
      shipping_province,
      shipping_city,
      shipping_zip,
      
      // Billing Address
      billing_department,
      billing_first_name,
      billing_last_name,
      billing_phone,
      billing_address1,
      billing_address2,
      billing_country,
      billing_province,
      billing_city,
      billing_zip,
      
      // Metadata
      timestamp,
      block_id,
      shop_domain,
      same_as_shipping
    } = body;

    // Validate required fields for customer and company
    const requiredFields = {
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      company_name,
      shop_domain
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return Response.json(
        { 
          success: false,
          error: "Please fill in all required fields",
          missingFields: missingFields
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate shipping address fields
    const shippingAddressFields = {
      shipping_first_name,
      shipping_last_name,
      shipping_phone,
      shipping_address1,
      shipping_country,
      shipping_province,
      shipping_city,
      shipping_zip
    };

    const missingShippingFields = Object.entries(shippingAddressFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingShippingFields.length > 0) {
      console.error('Missing shipping address fields:', missingShippingFields);
      return Response.json(
        { 
          success: false,
          error: "Please fill in all required shipping address fields",
          missingFields: missingShippingFields
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Only validate billing address if same_as_shipping is false
    if (!same_as_shipping || same_as_shipping === 'false') {
      const billingAddressFields = {
        billing_first_name,
        billing_last_name,
        billing_phone,
        billing_address1,
        billing_country,
        billing_province,
        billing_city,
        billing_zip
      };

      const missingBillingFields = Object.entries(billingAddressFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (missingBillingFields.length > 0) {
        console.error('Missing billing address fields:', missingBillingFields);
        return Response.json(
          { 
            success: false,
            error: "Please fill in all required billing address fields",
            missingFields: missingBillingFields
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email)) {
      console.error('Invalid email format:', customer_email);
      return Response.json(
        { 
          success: false,
          error: "Please enter a valid email address"
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    //const shoptoken = await gettokenval(shop_domain);

    
    

    // Check if email already exists for this specific store
    try {
      const existingSubmission = await prisma.company.findUnique({
        where: {
          unique_email_per_store: {
            customerEmail: customer_email,
            shopId: shop_domain
          }
        }
      });

      const finalexistornot = await checkShopifyCustomerExists(shop_domain, customer_email);
      //console.log("customer exist or not",finalexistornot);

      if (existingSubmission || finalexistornot === true) {
        //console.log('Email already exists for this store:', customer_email, shop_domain);
        return Response.json(
          { 
            success: false,
            error: "This email address is already registered in our system. Please use a different email address or contact support if you believe this is an error."
          },
          { status: 409, headers: CORS_HEADERS }
        );
      }
    } catch (error) {
      console.error('Error checking existing email:', error);
      // Continue with submission if check fails
    }

    // Generate a unique submission ID
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    //console.log('Creating submission with ID:', submissionId, 'for shop:', shop_domain);

    // Prepare structured address data
    const shippingAddress = {
      department: shipping_department || null,
      firstName: shipping_first_name,
      lastName: shipping_last_name,
      phone: shipping_phone,
      address1: shipping_address1,
      address2: shipping_address2 || null,
      countryCode: shipping_country,
      province: shipping_province,
      city: shipping_city,
      zip: shipping_zip
    };

    // If same as shipping, use shipping data for billing
    const billingAddress = (same_as_shipping && same_as_shipping !== 'false') ? 
      {
        department: shipping_department || null,
        firstName: shipping_first_name,
        lastName: shipping_last_name,
        phone: shipping_phone,
        address1: shipping_address1,
        address2: shipping_address2 || null,
        countryCode: shipping_country,
        province: shipping_province,
        city: shipping_city,
        zip: shipping_zip
      } : 
      {
        department: billing_department || null,
        firstName: billing_first_name,
        lastName: billing_last_name,
        phone: billing_phone,
        address1: billing_address1,
        address2: billing_address2 || null,
        countryCode: billing_country,
        province: billing_province,
        city: billing_city,
        zip: billing_zip
      };

    // Save to database with structured addresses
    const submission = await prisma.company.create({
      data: {
        //submissionId,
        shopId: shop_domain,
        
        // Customer Information
        customerFirstName: customer_first_name,
        customerLastName: customer_last_name,
        customerEmail: customer_email,
        customerPhone: customer_phone,
        
        // Company Information
        name: company_name,
        externalId: external_id || null,
        taxId: tax_id || null,
        
        // Structured Addresses
        shipping: shippingAddress,
        billing: billingAddress,
        
        billingshippingsame: same_as_shipping === 'true' || same_as_shipping === true,
        companyStatus: 'pending'
      }
    });

    //console.log('Submission saved successfully:', submissionId);

    return Response.json({
      success: true,
      submissionId: submissionId,
      message: "Company registration submitted successfully. We will review your application and contact you shortly."
    }, { status: 201, headers: CORS_HEADERS });

  } catch (error) {
      console.error('Error processing company submission:', error);
      
      // Handle Prisma unique constraint violation
      if (error.code === 'P2002') {
        return Response.json(
          { 
            success: false,
            error: "This email address is already registered in our system. Please use a different email address."
          },
          { status: 409, headers: CORS_HEADERS }
        );
      }
      
      return Response.json(
        { 
          success: false,
          error: "There was an error processing your registration. Please try again or contact support if the problem persists.",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }
}

// GET endpoint to retrieve submissions (for testing)
export async function loader({ request }) {
  try {
    const { searchParams } = new URL(request.url);
    const shopDomain = searchParams.get('shop');
    
    if (shopDomain) {
      const submissions = await prisma.company.findMany({
        where: {
          shopDomain: shopDomain
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          submissionId: true,
          customerFirstName: true,
          customerLastName: true,
          customerEmail: true,
          companyName: true,
          status: true,
          createdAt: true,
          shippingAddress: true,
          billingAddress: true
        }
      });
      
      return Response.json({
        success: true,
        data: submissions,
        count: submissions.length
      }, { headers: CORS_HEADERS });
    }
    
    return Response.json({ 
      message: "Company submissions API is working",
      note: "Add ?shop=your-store.myshopify.com to view submissions"
    }, { headers: CORS_HEADERS });
    
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return Response.json(
      { 
        success: false,
        error: "Error fetching submissions"
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}