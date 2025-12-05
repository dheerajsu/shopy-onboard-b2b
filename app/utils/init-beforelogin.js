import { authenticate } from "../shopify.server";
// init-beforelogin.js
import { createPageWithTemplate } from './beforelogincompany.js';

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  await initializeBeforeLoginPages(admin, session, request);
  //await inserCountryState();

  return json({ ok: true });
}

// Template definition for the createcompany page
const createCompanyTemplate = {
  "sections": {
    "main": {
      "type": "main-page",
      "settings": {}
    }
  },
  "order": ["main"]
};

// Initialize function
export async function initializeBeforeLoginPages(admin, session, request) {
  try {
    const result = await createPageWithTemplate(admin, session, {
      pageHandle: "createcompany",
      pageTitle: "Create Company",
      pageBody: `<div class="codebeans-create-company-page">
        <h1>Create Your Company Account</h1>
        <p>Company registration form will be displayed here.</p>
      </div>`,
      templateDefinition: createCompanyTemplate,
      apiVersion: "2025-10"
    });

    return result;
  } catch (error) {
    console.error('Failed to initialize before login pages:', error);
    throw error;
  }
}