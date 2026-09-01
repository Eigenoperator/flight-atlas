import airportDirectory from '../data/airports-global.json';
import { createAirportLookup, normaliseFlightRows } from './flight-data';

const airportLookup = createAirportLookup(airportDirectory);

export async function importFlightFile(file: File) {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  let rows: Record<string, unknown>[];

  if (extension === 'json') {
    const parsed = JSON.parse(await file.text()) as unknown;
    const candidate = Array.isArray(parsed)
      ? parsed
      : (parsed as { flights?: unknown })?.flights;
    if (!Array.isArray(candidate)) throw new Error('JSON must be an array of flights or an object with a flights array.');
    rows = candidate as Record<string, unknown>[];
  } else {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('The workbook does not contain a worksheet.');
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
      defval: null,
      raw: true,
    });
  }

  if (!rows.length) throw new Error('No flight rows were found in this file.');
  const result = normaliseFlightRows(rows, airportLookup);
  if (!result.accepted) {
    throw new Error(result.warnings[0] ?? 'No valid flight rows were found. Check the template columns and IATA codes.');
  }
  return result;
}
