import { querygetPage, mutationCreatePage, mutationthemeFilesUpsert, GET_THEMES_QUERY } from "../routes/query"

export async function getPageByHandle(admin, handle) {
    try {
        const variables = { query: `handle:${handle}` };
        const response = await admin.graphql(querygetPage, { variables });
        const json = await response.json();

        if (json.errors) {
            return null;
        }

        return json?.data?.pages?.edges?.[0]?.node || null;
    } catch (error) {
        return null;
    }
}

// export async function createcountrystate() {
//     try {
//         console.log('Starting countries and states data import...');
        
//         // Check if data already exists
//         const existingCountries = await prisma.country.count();
//         if (existingCountries > 0) {
//             console.log('Countries and states data already exists, skipping import.');
//             return { success: true, message: 'Data already exists' };
//         }

//         // Import countries data
//         const countriesResponse = await fetch('https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/contributions/countries/countries.json');
//         const countries = await countriesResponse.json();
        
//         let countriesCount = 0;
//         for (const countryData of countries) {
//             await prisma.country.upsert({
//                 where: { name: countryData.name },
//                 update: {
//                     iso2: countryData.iso2,
//                     phonecode: countryData.phonecode
//                 },
//                 create: {
//                     name: countryData.name,
//                     iso2: countryData.iso2,
//                     phonecode: countryData.phonecode
//                 }
//             });
//             countriesCount++;
            
//             if (countriesCount % 50 === 0) {
//                 console.log(`Imported ${countriesCount} countries...`);
//             }
//         }

//         // Import states data
//         const statesResponse = await fetch('https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/contributions/states/states.json');
//         const states = await statesResponse.json();
        
//         let statesCount = 0;
//         let errorsCount = 0;
        
//         for (const stateData of states) {
//             try {
//                 // Find the country
//                 const country = await prisma.country.findFirst({
//                     where: { 
//                         OR: [
//                             { iso2: stateData.country_code }
//                         ]
//                     }
//                 });
                
//                 if (country) {
//                     await prisma.state.upsert({
//                         where: {
//                             country_id_name: {
//                                 country_id: country.id,
//                                 name: stateData.name
//                             }
//                         },
//                         update: {
//                             country_code: stateData.country_code,
//                             iso2: stateData.iso2,
//                             type: stateData.type
//                         },
//                         create: {
//                             name: stateData.name,
//                             country_id: country.id,
//                             country_code: stateData.country_code,
//                             iso2: stateData.iso2,
//                             type: stateData.type
//                         }
//                     });
//                     statesCount++;
//                 } else {
//                     console.log(`Country not found for state: ${stateData.name} (${stateData.country_name})`);
//                     errorsCount++;
//                 }
                
//                 if (statesCount % 500 === 0) {
//                     console.log(`Imported ${statesCount} states...`);
//                 }
//             } catch (error) {
//                 console.error(`Error importing state ${stateData.name}:`, error.message);
//                 errorsCount++;
//             }
//         }

//         console.log(`✅ Successfully imported ${countriesCount} countries and ${statesCount} states`);
        
//         return { 
//             success: true, 
//             message: 'Countries and states imported successfully',
//             data: {
//                 countries: countriesCount,
//                 states: statesCount,
//                 errors: errorsCount
//             }
//         };
//     } catch (error) {
//         console.error('Error in createcountrystate:', error);
//         return { 
//             success: false, 
//             error: error.message 
//         };
//     }
// }

// Helper function to create page
export async function createPage(admin, pageConfig = {}) {
    try {
        const variables = {
            page: {
                title: pageConfig.title || "createcompany",
                handle: pageConfig.handle || "createcompany",
                body: pageConfig.body || `<span class='createcompanypage'></span>`,
            },
        };
        const response = await admin.graphql(mutationCreatePage, { variables });
        const json = await response.json();

        if (json.errors) {
            throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
        }

        return json?.data?.pageCreate;
    } catch (error) {
        throw error;
    }
}

// Upload page template definition JSON


export async function uploadThemeTemplateDefUsingAdmin(admin, themeId, templateDefinition) {
    const filename = "templates/page.createcompany-page.json";

    // templateDefinition may be an object or a string (JSON). Normalize to string.
    const templateJson =
        typeof templateDefinition === "string"
            ? templateDefinition
            : JSON.stringify(
                templateDefinition ?? { sections: { main: { type: "main-page" } }, order: ["main"] },
                null,
                2
            );

    const tempvariables = {
        themeId,
        files: [
            {
                filename,
                body: { type: "TEXT", value: templateJson },
            },
        ],
    };

    // Call admin.graphql in the same style you use elsewhere
    const response = await admin.graphql(mutationthemeFilesUpsert, { variables: tempvariables });

    const json = await response.json();

    const upsert = json?.data?.themeFilesUpsert;
    if (!upsert) {
        console.error("Unexpected response shape:", json);
        throw new Error("Unexpected response from themeFilesUpsert");
    }

    // Mutation-level/validation user errors
    if (Array.isArray(upsert.userErrors) && upsert.userErrors.length > 0) {
        console.error("Shopify userErrors:", upsert.userErrors);
        throw new Error(`Shopify userErrors: ${JSON.stringify(upsert.userErrors)}`);
    }

    // Success — return the upsert block (or the whole json if you prefer)
    return upsert;
}


// Get active/main theme ID
export async function getActiveThemeId(admin) {


    const response = await admin.graphql(GET_THEMES_QUERY);
    const json = await response.json();

    if (json.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
    }

    const themes = json.data.themes.edges.map(edge => edge.node);
    const mainTheme = themes.find(t => t.role === "MAIN");

    if (!mainTheme) {
        throw new Error("No active theme found");
    }

    // Extract numeric ID from GID (gid://shopify/Theme/123456789)
    const themeGidId = mainTheme.id;
    const themeIdNumeric = mainTheme.id.split("/").pop();
    return { themeId: mainTheme.id, themeIdNumeric, themeName: mainTheme.name, themeGidId };
}

// Main function to create page and assign template
export async function createPageWithTemplate(admin, session, options = {}) {
    const {
        pageHandle = "createcompany",
        pageTitle = "createcompany",
        pageBody = `<span class='createcompanypage'></span>`,
        templateDefinition,
        apiVersion = "2025-10",
    } = options;
    
    // Step 1: Check if page already exists
    let page = await getPageByHandle(admin, pageHandle);
    let pageCreated = false;

    
    // Step 2: Create page if it doesn't exist
    if (!page) {
        //await createcountrystate();    
        const pageCreateResult = await createPage(admin, {
            title: pageTitle,
            handle: pageHandle,
            body: pageBody,
        });

        if (pageCreateResult?.userErrors?.length > 0) {
            throw new Error(`Failed to create page: ${JSON.stringify(pageCreateResult.userErrors)}`);
        }

        if (!pageCreateResult?.page) {
            throw new Error("Page creation failed - no page returned");
        }

        page = pageCreateResult.page;
        pageCreated = true;
    }

    if (!page || !page.id) {
        throw new Error("Failed to create or find page - Page object is null or missing required ID");
    }

    // Step 3: Get active theme ID
    const themeInfo = await getActiveThemeId(admin);
    const { themeIdNumeric, themeGidId } = themeInfo;

    // Step 4: Upload page template definition if provided
    let templateDefUploadResult = null;
    if (templateDefinition) {
        templateDefUploadResult = await uploadThemeTemplateDefUsingAdmin
            (admin, themeGidId, templateDefinition);
    }
    return {
        page,
        pageCreated,
        themeId: themeIdNumeric,
        themeName: themeInfo.themeName,
        templateDefUploadResult,
    };
}

