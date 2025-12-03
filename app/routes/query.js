export const companyCreate = `
      mutation CompanyCreate($input: CompanyCreateInput!) {
    companyCreate(input: $input) {
      company {
        id 
        name 
        externalId 
      mainContact 
      {
          id 
          customer {
            id
            email
            firstName
            lastName
          }
      }
      contacts(first: 5) {
        edges {
          node {
            id
            customer {
              email
              firstName
              lastName
            }
          }
        }
      }
        locations(first: 5) {
          edges {
            node {
              id
              name
              shippingAddress {
                firstName
                lastName
                address1
                city
                province
                zip
                country
                phone
              }
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

export const assignContactMutation = `
      mutation assignCustomerAsContact($companyId: ID!, $customerId: ID!) {
        companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
          companyContact {
            id
            customer {
              id
              email
            }
          }
          userErrors { field message code }
        }
      }`;

export const assignMainMutation = `
    mutation assignMainContact($companyId: ID!, $companyContactId: ID!) {
      companyAssignMainContact(companyId: $companyId, companyContactId: $companyContactId) {
        company {
          id
          name
          mainContact {
            id
            customer {
              id
              email
            }
          }
        }
        userErrors { field message code }
      }
    }`;

export const companyLocationCreatemutation = `
    mutation companyLocationCreate($companyId: ID!, $input: CompanyLocationInput!) {
      companyLocationCreate(companyId: $companyId, input: $input) {
        companyLocation {
          id
          name
          phone
          shippingAddress {
            address1
            city
            country
          }
        }
        userErrors {
          field
          message
        }
      }
    }`;

export const companyMainContact = `
query companyMainContact($id: ID!) {
  company(id: $id) {
    mainContact {
      id
      customer {
        id
      }
    }
  }
}`;

export const companyQuery = `
query GetCustomerCompany($customerId: ID!) {
  customer(id: $customerId) {
    id
    companyContactProfiles {
      company {
        id
        name
      }
    }
  }
}`;

export const GetCompanyLocationsByIDquery = `
    query GetCompanyLocationsByID($companyId: ID!, $first: Int!, $after: String, $query: String) {
      company(id: $companyId) {
        id
        name
        locations(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              createdAt
              currency
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
                firstName
                lastName
                phone
                province
                zip
                zoneCode
                formattedArea
              }
              shippingAddress {
                address1
                address2
                city
                companyName
                country
                countryCode
                firstName
                lastName
                phone
                province
                zip
                zoneCode
                formattedArea
              }
            }
          }
        }
      }
    }`;

export const getAllCompanysOfContact = `query ContactRoleAssignments($id: ID!, $first: Int!, $after: String, $query: String) {
  companyContact(id: $id) {
    id
    customer {
      id
      email
    }
    roleAssignments(first: $first, after: $after, query: $query) {
      nodes {
        id
        companyLocation {
          id
          name
          billingAddress {
            address1
            address2
            city
            companyName
            country
            countryCode
            createdAt
            firstName
            id
            lastName
            phone
            province
            recipient
            zip
            zoneCode
            formattedArea
          }
          shippingAddress {
            address1
            address2
            city
            companyName
            country
            countryCode
            firstName
            id
            lastName
            phone
            province
            recipient
            updatedAt
            zip
            zoneCode
            formattedArea
          }
        }
        role {
          id
          name
        }
      }
    }
  }
}`;

export const getLocationOfCustomer = 
`query CustomerContactLocations($customerId: ID!, $first: Int!, $after: String, $query: String) {
  customer(id: $customerId) {
    companyContactProfiles {
    company {
        id
        name
      }
      id
      isMainContact
      roleAssignments(first: $first, after: $after, query: $query) {
        nodes {
          id
          companyLocation {
            id
            name
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
            shippingAddress {
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
          role {
            id
            name
          }
        }
      }
    }
  }
}`;


export const companyContactUpdate = `
mutation companyContactUpdate($companyContactId: ID!, $input: CompanyContactInput!) {
    companyContactUpdate(companyContactId: $companyContactId, input: $input) {
        companyContact {
        id
        company {
            id
            name
        }
        customer {
            id
            firstName
            lastName
        }
        }
        userErrors {
        field
        message
        }
    }
    }`;

export const companyContactAssignRole = `
mutation companyContactAssignRole($companyContactId: ID!, $companyContactRoleId: ID!, $companyLocationId: ID!) {
  companyContactAssignRole(
    companyContactId: $companyContactId,
    companyContactRoleId: $companyContactRoleId,
    companyLocationId: $companyLocationId
  ) {
    userErrors {field message code }
    companyContactRoleAssignment {
      id
      companyContact { id }
      companyLocation { id }
      role { id name }
    }
  }
}`;

export const GetCompanyContactRoleAssignments = `
query GetCompanyContactRoleAssignments($id: ID!) {
  companyContact(id: $id) {
    id
    customer { id email }
    company { id name }
    roleAssignments(first: 200) {
      edges {
        node {
          id                                # <-- this is the role assignment id you need
          role { id name }                  # role = CompanyContactRole
          companyLocation { id name }
          createdAt
        }
      }
    }
  }
}`;

export const companyContactRole = `
query companyContactRole($companyId: ID!) {
  node(id: $companyId) {
    ... on Company {
      contactRoles(first: 50) {
        edges { 
          node { 
            id 
            name 
          } 
        }
      }
    }
  }
}
`;

export const companyContactRevokeRole = `
  mutation companyContactRevokeRole($companyContactId: ID!, $companyContactRoleAssignmentId: ID!) {
    companyContactRevokeRole(
      companyContactId: $companyContactId,
      companyContactRoleAssignmentId: $companyContactRoleAssignmentId
    ) {
      revokedCompanyContactRoleAssignmentId
      userErrors {
        field
        message
      }
    }
  }`;
export const locationdetails = `
  query LocationCustomers($locationId: ID!, $first: Int!, $after: String) {
    companyLocation(id: $locationId) {
      id
      name
        billingAddress {
          address1
          firstName
          lastName
          phone
          country
          city
          zoneCode
          zip
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          country
          phone
          zip
          zoneCode
        }
    }
  }
`;

export const companyLocationUpdate = `
mutation companyLocationUpdate($companyLocationId: ID!, $input: CompanyLocationUpdateInput!) {
  companyLocationUpdate(companyLocationId: $companyLocationId, input: $input) {
    companyLocation {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}`;

export const companyLocationAssignAddressExample = `
mutation companyLocationAssignAddressExample($locationId: ID!, $address: CompanyAddressInput!) {
  companyLocationAssignAddress(
    locationId: $locationId
    addressTypes: [BILLING, SHIPPING]
    address: $address
  ) {
    addresses {
      id
    }
    userErrors {
      field
      message
    }
  }
}`;

export const companyLocationAssignAddressBilling = `
mutation companyLocationAssignAddressExample($locationId: ID!, $address: CompanyAddressInput!) {
  companyLocationAssignAddress(
    locationId: $locationId
    addressTypes: [BILLING]
    address: $address
  ) {
    addresses {
      id
    }
    userErrors {
      field
      message
    }
  }
}`;

export const companyLocationAssignAddressShipping = `
mutation companyLocationAssignAddressExample($locationId: ID!, $address: CompanyAddressInput!) {
  companyLocationAssignAddress(
    locationId: $locationId
    addressTypes: [SHIPPING]
    address: $address
  ) {
    addresses {
      id
    }
    userErrors {
      field
      message
    }
  }
}`;

export const custoerCompanyContact = `
query custoerCompanyContact($CustomerId: ID!) {
  customer(id: $CustomerId) {
      displayName
      firstName
      email
      id
    }
}`;

// admin grqphql requirement
export const paymentTerms = `
query {
  paymentTermsTemplates {
    id
    name
    description
    dueInDays
    paymentTermsType
    translatedName
  }
}`;

export const shopid = `
  query MyQuery {
    shop {
      myshopifyDomain
    }
  }
`;

export const createCompanyMutation = `
    mutation CompanyContactCreate($companyId: ID!, $input: CompanyContactInput!) {
        companyContactCreate(companyId: $companyId, input: $input) {
            companyContact {
                id
                company {
                    id
                }
                customer {
                    id
                }
            }
            userErrors {
                field
                message
                code
            }
        }
    }`;

export const querygetPage = `
  query getPage($query: String!) {
    pages(first: 1, query: $query) {
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }
`;

export const mutationCreatePage = `
  mutation CreatePage($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page {
        id
        title
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;
export const mutationthemeFilesUpsert = `
    mutation themeFilesUpsert($files: [OnlineStoreThemeFilesUpsertFileInput!]!, $themeId: ID!) {
      themeFilesUpsert(files: $files, themeId: $themeId) {
        upsertedThemeFiles { filename }
        userErrors { field message }
        job { id done}
      }
    }
  `;

export const GET_THEMES_QUERY = `
    query GetThemes {
      themes(first: 10) {
        edges {
          node {
            id
            name
            role
          }
        }
      }
    }
  `;

export const get_customer_exist = `
  query get_customer_exist($emailid: String!) {
    customerByIdentifier(identifier: {emailAddress: $emailid}) {
      email
      id
    }
  }`;

export const createnewcustomer = `
mutation customerCreate($input: CustomerInput!) {
  customerCreate(input: $input) {
    userErrors {
      field
      message
    }
    customer {
      id
      email
      phone
      taxExempt
      firstName
      lastName
      amountSpent {
        amount
        currencyCode
      }
    }
  }
}
`;

export const checkoutProfiles =`
  query checkoutProfiles {
  checkoutProfiles(first: 50) {
    edges {
      node {
        id
        name
        isPublished
      }
    }
  }
}`;

export const customerAccountPagesQuery = `
  query CustomerAccountPages {
    shop {
      id
    }
    customerAccountPages(first: 50) {
      nodes {
        id
        title
        handle
        ... on CustomerAccountAppExtensionPage {
          appExtensionUuid
        }
      }
    }
  }
`;

export const queryGetAllThemes = 
`query MyQuery2 {
  themes(first: 20) {
    nodes {
      id
      name
      processing
      role
      themeStoreId
      prefix
    }
  }
}`;