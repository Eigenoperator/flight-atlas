import airportDirectory from '../../../data/airports-global.json';
import { createAirportLookup, normaliseFlightRows } from '../../../lib/flight-data';

const airportLookup = createAirportLookup(airportDirectory);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function GET() {
  return json({
    name: 'Flight Atlas Import API',
    version: '1.0',
    storage: 'none',
    method: 'POST',
    contentType: 'application/json',
    acceptedBody: 'An array of flight rows, or { "flights": [...] }',
    requiredFields: ['date', 'origin', 'destination'],
    optionalFields: [
      'flightNumber', 'airline', 'departureTime', 'arrivalTime',
      'aircraft', 'registration', 'aircraftSerialNumber', 'aircraftFirstFlight',
    ],
    example: {
      flights: [{
        date: '2026-01-15',
        flightNumber: 'EX101',
        origin: 'LHR',
        destination: 'CDG',
        aircraft: 'A320',
        aircraftSerialNumber: '12345',
      }],
    },
  });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 5_000_000) return json({ ok: false, error: 'Request body is larger than 5 MB.' }, 413);

    const body = await request.json() as unknown;
    const rows = Array.isArray(body) ? body : (body as { flights?: unknown })?.flights;
    if (!Array.isArray(rows)) {
      return json({ ok: false, error: 'Send an array of flight rows or an object with a flights array.' }, 400);
    }
    if (rows.length > 5_000) return json({ ok: false, error: 'A maximum of 5,000 rows is accepted per request.' }, 413);

    const result = normaliseFlightRows(rows as Record<string, unknown>[], airportLookup);
    return json({
      ok: result.accepted > 0,
      dataset: result.dataset,
      meta: {
        accepted: result.accepted,
        rejected: result.rejected,
        warnings: result.warnings,
      },
    }, result.accepted > 0 ? 200 : 422);
  } catch {
    return json({ ok: false, error: 'The request body is not valid JSON.' }, 400);
  }
}
