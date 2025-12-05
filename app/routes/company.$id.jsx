import prisma from "../db.server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData, useNavigate, useParams } from "react-router";
import { authenticate } from "../shopify.server";
import  EditAddressesForm  from "./appeditAddress";
import  LogoutcustomerCreatecontact  from "./logoutCreateCustomer";
import {boundary} from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return new Response("Invalid id", { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id },
    include: { companycontact: true },
  });

  if (!company) {
    return new Response("Not found", { status: 404 });
  }

  const serialized = {
    ...company,
    createdAt: company.createdAt?.toISOString() ?? null,
    updatedAt: company.updatedAt?.toISOString() ?? null,
    companycontact: company.companycontact ?? null,
    companytabletada: company
  };

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    company: serialized,
  });
};

export default function CompanyDetailRoute() {
  const { apiKey, company } = useLoaderData();
  const navigate = useNavigate();

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "-");

  const contact = company.companycontact ?? {};
  const contactdata = company.companytabletada ?? {};
  // Helper: get a usable id (handles array / null / non-string)
  const headNonEmpty = (val) => {
    if (val == null) return null;
    // if it's an array, pick first truthy element
    if (Array.isArray(val)) {
      const found = val.find(v => v != null && String(v).trim() !== '');
      if (!found) return null;
      return String(found);
    }
    // otherwise coerce to string
    const s = String(val);
    return s.trim() === '' ? null : s;
  };
  // CUSTOMER ID
  const rawCustomerGid = headNonEmpty(contact.baseCustomerId);
  const mainCustomerid = rawCustomerGid ? rawCustomerGid.split('/').pop() : null;

  // COMPANY ID
  const rawCompanyGid = headNonEmpty(contactdata.companyGid);
  const mainCompanyid = rawCompanyGid ? rawCompanyGid.split('/').pop() : null;

  // const customGid = contact.baseCustomerId;
  // const mainCustomerid = customGid.split('/').pop();
  
  // const companyGid = contactdata.companyGid;
  // const mainCompanyid = companyGid.split('/').pop();

  contactdata

  const startApproval = () => {
    navigate(`/${company.id}/approval`);
  };
  
  const backpage = () => {
    navigate(`/app/companies`);
  } ;

  const moreActions = () => {
    // show popover/menu - placeholder
    alert("More actions clicked");
  };

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-page>
      <s-stack direction="block" gap="base" padding="">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" >
          <s-stack direction="inline" alignItems="center" gap="small-200">
            {/* <s-button icon="arrowLeft" variant="primary" onClick={() => navigate(-1)}>
              <s-icon type="arrow-left" />
            </s-button> */}
            <s-button icon="arrowLeft" variant="primary" onClick={backpage}>
              <s-icon type="arrow-left" />
            </s-button>
            <s-heading>{company.name ?? "Company"}</s-heading>
            <s-badge tone={
                            contactdata.companyStatus === 'approved' ? "success" 
                            : contactdata.companyStatus === 'open' ? "warning" 
                            : contactdata.companyStatus === 'autoApprove' ? "info" 
                            : "subdued"
                          }
            >
              {contactdata.companyStatus === 'approved' ? "success" 
                : contactdata.companyStatus === 'open' ? "Pending" 
                : contactdata.companyStatus === 'autoApprove' ? "Auto Approved"
                : contactdata.companyStatus === 'pending' ? "pending" 
                : "subdued"
              }
            </s-badge>
            <s-tooltip>
              <s-icon label="info" />
            </s-tooltip>
          </s-stack>

          <s-stack direction="inline" gap="base">
            {/* <s-button variant="secondary" commandFor="moreactions">More actions</s-button>
            <s-popover id="moreactions">
              <s-stack direction="block" gap="base" alignItems="first baseline">
                <s-button tone="auto">Reject Application</s-button>
                <s-button tone="critical">Delete Application</s-button>
              </s-stack>
            </s-popover> */}
            
            {contactdata.companyStatus === 'approved' || contactdata.companyStatus === 'autoApprove' ? (
              <s-button href={`shopify://admin/companies/${mainCompanyid}`}>View Company Details</s-button>
            ) : (
                company.aurthorizedStatus === true  ? (
                    <s-button variant="primary" onClick={startApproval}>
                      Start approval
                    </s-button>
                    ) :(
                      <s-text></s-text>
                    )
                
                )
            }
            
            
          </s-stack>
        </s-grid>

        {/* Alert box like your screenshot */}
        <s-box border="base" padding="base" borderRadius="base" background="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon  tone="warning" type="exchange" size="base"/>
            <s-text>This B2B application needs to be approved or rejected.</s-text>
          </s-stack>
        </s-box>

        {/* Grid with main details on left and contact card on right */}
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <s-stack gap="base">
            {/* Addresses card */}
            <s-box heading="Addresses" padding="base" border="base" borderRadius="base" background="base">
              <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                <s-stack>
                  <s-text weight="bold">Shipping address</s-text>
                  {/* Assuming your company has shipping stored somewhere in JSON fields */}
                  {company.shipping?.address1 ? (
                    <>
                      <s-text>{company.shipping.firstName} {company.shipping.lastName}</s-text>
                      <s-text>{company.shipping.phone ?? ""}</s-text>
                      <s-text>{company.shipping.address1}</s-text>
                      <s-text>{company.shipping.zip}</s-text>
                      <s-text>{company.shipping.country}</s-text>
                      <s-text>{company.shipping.province}</s-text>
                      <s-text>{company.shipping.city}</s-text>
                    </>
                  ) : (
                    <s-text tone="subtle">No shipping address provided</s-text>
                  )}
                </s-stack>

                <s-stack>
                  <s-text weight="bold">Billing address</s-text>
                  {company.billing ? (
                    <>
                      <s-text>{company.billing.firstName ?? company.shipping.firstName ?? "-"}</s-text>
                      <s-text>{company.billing.phone ?? company.shipping?.phone ?? ""}</s-text>
                      <s-text>{company.billing.address1 ?? company.shipping?.address1}</s-text>
                      <s-text>{company.billing.zip ?? company.shipping?.zip} </s-text>
                      <s-text>{company.billing.country ?? company.shipping?.country}</s-text>
                      <s-text>{company.billing.province ?? company.shipping?.province}</s-text>
                      <s-text>{company.billing.city ?? company.shipping?.city}</s-text>
                    </>
                  ) : (
                    <s-text tone="subtle">Same as shipping address</s-text>
                  )}
                </s-stack>
                
                <s-stack>
                  
                  {company.customerEmail !== null  ? (
                    <s-text weight="bold">Email ID    
                      <s-badge>{company.customerEmail}</s-badge>
                    </s-text>
                    
                  ) : (
                    <s-text weight="bold">Email ID    
                      <s-badge>{contact.email}</s-badge>
                    </s-text>
                  )}
                  
                </s-stack>
                  
                <s-stack direction="inline" gap="base" alignContent="center">
                    {contactdata.companyStatus === 'approved' || contactdata.companyStatus === 'autoApprove' ? (
                    <s-text></s-text>
                  ) :(
                    <EditAddressesForm/>
                  )}
                  {company.aurthorizedStatus === false  ? (
                  <LogoutcustomerCreatecontact/>
                  ) :(
                    <s-text></s-text>
                  )}
                </s-stack>
                  
              </s-grid>
               
            </s-box>

            {/* Tax registration (example) */}
            <s-box heading="Tax registration ID" padding="base" border="base" borderRadius="base" background="base">
              <s-heading accessibilityRole="heading">Tax registration ID</s-heading>    
              <s-text>{company.externalId ?? "-"}</s-text>
            </s-box>
          </s-stack>

          {/* Contact information card on right */}
          <s-box heading="Contact information" padding="base" border="base" borderRadius="base" background="base">
            <s-stack gap="small-100">
              <s-text weight="bold">
                {company.contactInfoFirstName !== null ? company.contactInfoFirstName : 
                 company.customerFirstName !== null ? company.customerFirstName :
                ""
                }
              </s-text>
              <s-text>
                {
                  company.contactInfoLastName !== null ? company.contactInfoLastName :
                  company.customerLastName !== null ? company.customerLastName :
                  ""
                }
              </s-text>
              <s-text>
                {
                  company.customerPhone !== null ? company.customerPhone :
                  ""
                }
              </s-text>
              <s-text>
                {company.contactInfoJob == "-" ? "" : company.contactInfoJob}
              </s-text>
              <s-text tone="subtle">{contact.email ?? contact.phone ?? "-"}</s-text>
              
              {/* <s-link href={`shopify://admin/customers/${mainCustomerid}`}>
                View customer
              </s-link> */}
              {mainCustomerid ? (
                <s-link href={`shopify://admin/customers/${mainCustomerid}`}>
                  View customer
                </s-link>
              ) : (
                <s-text tone="subtle">No customer linked</s-text>
              )}
            
            </s-stack>
          </s-box>
        </s-grid>
      </s-stack>
      </s-page>
    </AppProvider>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
