import prisma from "../db.server";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function loader({ request }) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const countryCode = url.searchParams.get('countryCode');
    //console.log("get country code",countryCode);
    if (countryCode) {
      // Get states for a specific country
      const country = await prisma.country.findFirst({
        where: { 
          iso2: countryCode.toUpperCase()
        },
        include: {
          states: {
            orderBy: { name: 'asc' }
          }
        }
      });
      
      if (!country) {
        return new Response(JSON.stringify({ error: 'Country not found' }), {
          status: 404,
           headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            }
        });
      }
      
      return new Response(JSON.stringify({
        country: {
          id: country.id,
          name: country.name,
          iso2: country.iso2,
          phonecode: country.phonecode
        },
        states: country.states
      }), {
        status: 200,
        headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    } else {
      // Get all countries
      const countries = await prisma.country.findMany({
        orderBy: { name: 'asc' },
        include: {
          states: {
            orderBy: { name: 'asc' }
          }
        }
      });
      //console.log("countries collection",countries);
      return new Response(JSON.stringify({ countries }), {
        status: 200,
        headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }
  } catch (error) {
    console.error('Error fetching countries:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}