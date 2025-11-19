const DEFAULT_FIRST = 10;

async function graphQLRequest(ctx, query, variables = {}) {
  const { shopDomain, accessToken, apiVersion } = ctx;
  const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    const err = new Error(`Shopify GraphQL ${resp.status}: ${txt}`);
    err.status = resp.status;
    throw err;
  }

  const json = await resp.json();
  if (json.errors?.length) {
    const err = new Error(json.errors.map(e => e.message).join("; "));
    err.graphql = json.errors;
    throw err;
  }
  return json.data;
}

/**
 * Return the first company GID for the given customer GID (or null).
 * @param {Object} ctx { shopDomain, accessToken, apiVersion }
 * @param {string} customerGid "gid://shopify/Customer/..."
 * @returns {Promise<string|null>}
 */
export async function getCustomerCompanyId(ctx, customerGid) {
  if (!customerGid) throw new Error("customerGid required");
  const query = `
    query GetCustomerCompanyId($customerId: ID!) {
      customer(id: $customerId) {
        companyContactProfiles {
          id
          company {
            id
          }
        }
      }
    }`;
  const data = await graphQLRequest(ctx, query, { customerId: customerGid });
  const profiles = data?.customer?.companyContactProfiles ?? [];
  //const customerContactId = profiles?.id ?? null;
  const customerContactId = profiles.map(p => p?.id).filter(Boolean)[0] ?? null;
  const companyId = profiles.map(p => p?.company?.id).filter(Boolean)[0] ?? null;
  return {customerContactId, companyId};
}

/**
 * Return locations for the first company found for a customer.
 * If you need paging, pass `first` and optional `after`.
 * Returns { companyId, companyName, pageInfo, edges } where edges are the nodes array.
 *
 * @param {Object} ctx
 * @param {string} customerGid
 * @param {Object} opts { first = 10, after = null }
 */
export async function getCustomerCompanyLocations(ctx, customerGid, opts = {}) {
  if (!customerGid) throw new Error("customerGid required");

  // Use the full query you provided — it returns company + locations
  const query = `
    query GetCustomerCompanyId($customerId: ID!) {
      customer(id: $customerId) {
        companyContactProfiles {
          company {
            id
            name
            locations(first: 10) {
              pageInfo {
                endCursor
                hasNextPage
              }
              edges {
                node {
                  id
                  name
                  note
                  phone
                  billingAddress {
                    address1
                    address2
                    city
                    companyName
                    country
                    countryCode
                    createdAt
                    firstName
                    formattedArea
                    id
                    lastName
                    phone
                    province
                    recipient
                    updatedAt
                    zip
                    zoneCode
                  }
                }
              }
            }
          }
        }
      }
    }`;

  //const data = await graphQLRequest(ctx, query, { customerId: customerGid, first, after });
  const data = await graphQLRequest(ctx, query, { customerId: customerGid });


  const profiles = data?.customer?.companyContactProfiles ?? [];
  if (!profiles.length) return { companyId: null, companyName: null, pageInfo: null, edges: [] };

  // take first companyContactProfile -> company
  const company = profiles[0].company;
  const locations = company?.locations ?? { pageInfo: null, edges: [] };

  return {
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    pageInfo: locations.pageInfo ?? null,
    edges: locations.edges ?? [],
  };
}
