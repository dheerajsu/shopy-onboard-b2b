// routes/api/states.js
import prisma from "../db.server";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function loader({ request }) {
  if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

  try {
    const url = new URL(request.url);
    const countryId = url.searchParams.get('countryId');
    const countryCode = url.searchParams.get('countryCode');
    
    let whereClause = {};
    
    if (countryId) {
      whereClause.country_id = parseInt(countryId);
    } else if (countryCode) {
      // Find country first, then get its states
      const country = await prisma.country.findFirst({
        where: { 
          iso2: countryCode.toUpperCase()
        }
      });
      
      if (country) {
        whereClause.country_id = country.id;
      } else {
        return new Response(JSON.stringify({ states: [] }), {
          status: 200,
           headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            }
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'countryId or countryCode parameter is required' }), {
        status: 400,
         headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          }
      });
    }
    
    const states = await prisma.state.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        country: {
          select: {
            name: true,
            iso2: true
          }
        }
      }
    });
    
    return new Response(JSON.stringify({ states }), {
      status: 200,
       headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
    });
  } catch (error) {
    console.error('Error fetching states:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}