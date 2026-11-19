export type Airport = {
  code: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type Flight = {
  id: number;
  date: string;
  year: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  arrivalTime: string | null;
  aircraft: string;
  registration: string | null;
  aircraftSerialNumber?: string | null;
  aircraftFirstFlight: string | null;
  distanceKm: number;
};

export type FlightDataset = {
  airports: Record<string, Airport>;
  flights: Flight[];
};

export type ImportResult = {
  dataset: FlightDataset;
  accepted: number;
  rejected: number;
  warnings: string[];
};

const airportCityOverrides: Record<string, string> = {
  NGO: 'Nagoya',
};

export function displayAirportCity(airport: Airport | undefined) {
  if (!airport) return 'Unknown';
  return airportCityOverrides[airport.code]
    ?? airport.city.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();
}

type AirportLookup = Record<string, Airport>;
type Row = Record<string, unknown>;

const aliases = {
  date: ['date', 'flightdate', '日期', '飞行日期', '航班日期'],
  flightNumber: ['flight', 'flightnumber', 'flightno', '航班', '航班号'],
  airline: ['airline', 'airlinecode', 'carrier', '航空公司', '航司'],
  origin: ['origin', 'from', 'departureairport', 'originairport', '起飞地', '出发地', '始发机场'],
  destination: ['destination', 'to', 'arrivalairport', 'destinationairport', '降落地', '目的地', '到达机场'],
  departureTime: ['departure', 'departuretime', 'deptime', '起飞时间', '出发时间'],
  arrivalTime: ['arrival', 'arrivaltime', 'arrtime', '降落时间', '到达时间'],
  aircraft: ['aircraft', 'aircrafttype', 'equipment', 'type', '机型', '飞机型号'],
  registration: ['registration', 'aircraftregistration', 'tailnumber', 'tailno', '注册号', '飞机注册号'],
  aircraftSerialNumber: ['aircraftserialnumber', 'airframeserialnumber', 'manufacturerserialnumber', 'serialnumber', 'serialno', 'msn', 'potentialserialnumber', '飞机序列号', '机身序列号', '制造序列号'],
  aircraftFirstFlight: ['aircraftfirstflight', 'firstflight', 'firstflightdate', '首飞时间', '首飞日期'],
} as const;

function normaliseHeader(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]/g, '');
}
function rowValue(row: Row, field: keyof typeof aliases) {
  const values = new Map(
    Object.entries(row).map(([key, value]) => [normaliseHeader(key), value]),
  );
  for (const alias of aliases[field]) {
    const value = values.get(normaliseHeader(alias));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function textValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function formatDatePart(date: Date) {
  if (Number.isNaN(date.getTime())) return null;
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) return formatDatePart(value);
  if (typeof value === 'number' && Number.isFinite(value) && value > 1000) {
    const compact = String(Math.trunc(value));
    if (/^\d{8}$/.test(compact)) {
      const candidate = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
      const parsed = new Date(`${candidate}T00:00:00Z`);
      return Number.isNaN(parsed.getTime()) ? null : candidate;
    }
    const excelEpoch = Date.UTC(1899, 11, 30);
    return formatDatePart(new Date(excelEpoch + Math.floor(value) * 86_400_000));
  }
  const raw = textValue(value);
  if (!raw) return null;
  const compact = raw.replace(/\D/g, '');
  if (compact.length === 8) {
    const candidate = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
    const parsed = new Date(`${candidate}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : candidate;
  }
  return formatDatePart(new Date(raw));
}

function parseTime(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fraction = ((value % 1) + 1) % 1;
    const minutes = Math.round(fraction * 1_440) % 1_440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  const raw = textValue(value);
  const dayOffset = Number(raw.match(/\+\s*(\d+)/)?.[1] ?? 0);
  const suffix = dayOffset > 0 ? `(+${dayOffset})` : '';
  const matched = raw.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (matched) return `${matched[1].padStart(2, '0')}:${matched[2]}${suffix}`;
  const compact = raw.replace(/\D/g, '');
  if (compact.length === 3 || compact.length === 4) {
    return `${compact.slice(0, -2).padStart(2, '0')}:${compact.slice(-2)}${suffix}`;
  }
  return raw;
}

function clockMinutes(time: string | null) {
  const matched = time?.match(/(\d{1,2}):(\d{2})/);
  return matched ? Number(matched[1]) * 60 + Number(matched[2]) : null;
}

function dayOffset(time: string | null) {
  return Number(time?.match(/\+\s*(\d+)/)?.[1] ?? 0);
}

function withDayOffset(time: string, offset: number) {
  const clock = time.match(/(\d{1,2}):(\d{2})/);
  if (!clock) return time;
  const base = `${clock[1].padStart(2, '0')}:${clock[2]}`;
  return offset > 0 ? `${base}(+${offset})` : base;
}

function normaliseScheduleTimes(
  departureTime: string | null,
  arrivalTime: string | null,
  origin: Airport,
  destination: Airport,
  distanceKm: number,
) {
  const departureMinutes = clockMinutes(departureTime);
  const arrivalMinutes = clockMinutes(arrivalTime);
  if (departureMinutes === null || arrivalMinutes === null || !departureTime || !arrivalTime) {
    return { departureTime, arrivalTime, swapped: false };
  }

  const timezoneDifference = (destination.longitude - origin.longitude) / 15;
  const estimatedDuration = Math.max(0.75, Math.min(18, distanceKm / 850 + 0.45));
  const inferredOffset = (departures: number, arrivals: number) => Math.max(
    0,
    Math.min(2, Math.round((departures / 60 + estimatedDuration + timezoneDifference - arrivals / 60) / 24)),
  );
  const impliedDuration = (departures: number, arrivals: number, offset: number) => (
    arrivals / 60 + offset * 24 - departures / 60 - timezoneDifference
  );

  const explicitOffset = dayOffset(arrivalTime);
  const arrivalOffset = explicitOffset || inferredOffset(departureMinutes, arrivalMinutes);
  const originalDuration = impliedDuration(departureMinutes, arrivalMinutes, arrivalOffset);

  if (!explicitOffset && originalDuration < 0.5) {
    const swappedOffset = inferredOffset(arrivalMinutes, departureMinutes);
    const swappedDuration = impliedDuration(arrivalMinutes, departureMinutes, swappedOffset);
    const originalError = Math.abs(originalDuration - estimatedDuration);
    const swappedError = Math.abs(swappedDuration - estimatedDuration);
    if (swappedDuration >= 0.5 && swappedDuration <= 18 && swappedError + 1 < originalError) {
      return {
        departureTime: withDayOffset(arrivalTime, 0),
        arrivalTime: withDayOffset(departureTime, swappedOffset),
        swapped: true,
      };
    }
  }

  return {
    departureTime: withDayOffset(departureTime, 0),
    arrivalTime: withDayOffset(arrivalTime, arrivalOffset),
    swapped: false,
  };
}

function airportCode(value: unknown) {
  return textValue(value).toUpperCase().match(/([A-Z]{3})/)?.[1] ?? '';
}

function greatCircleDistance(a: Airport, b: Airport) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const radiusKm = 6_371.0088;
  const deltaLatitude = radians(b.latitude - a.latitude);
  const deltaLongitude = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.asin(Math.sqrt(haversine)));
}

export function createAirportLookup(airports: Airport[]) {
  return Object.fromEntries(airports.map((airport) => [airport.code, {
    ...airport,
    city: displayAirportCity(airport),
  }]));
}

export function normaliseFlightRows(rows: Row[], airportLookup: AirportLookup): ImportResult {
  const flights: Flight[] = [];
  const usedAirports = new Set<string>();
  const warnings: string[] = [];
  let rejected = 0;

  rows.forEach((row, index) => {
    const date = parseDate(rowValue(row, 'date'));
    const origin = airportCode(rowValue(row, 'origin'));
    const destination = airportCode(rowValue(row, 'destination'));
    const missing = [origin, destination].filter((code) => code && !airportLookup[code]);

    if (!date || !origin || !destination || missing.length) {
      rejected += 1;
      const reason = missing.length
        ? `unknown airport ${missing.join(', ')}`
        : 'missing date, origin or destination';
      warnings.push(`Row ${index + 2}: ${reason}.`);
      return;
    }

    const flightNumber = textValue(rowValue(row, 'flightNumber')).toUpperCase().replace(/\s+/g, '');
    const suppliedAirline = textValue(rowValue(row, 'airline')).toUpperCase();
    const airline = suppliedAirline || flightNumber.match(/^[A-Z0-9]{2}/)?.[0] || '—';
    const distanceKm = greatCircleDistance(airportLookup[origin], airportLookup[destination]);
    const schedule = normaliseScheduleTimes(
      parseTime(rowValue(row, 'departureTime')),
      parseTime(rowValue(row, 'arrivalTime')),
      airportLookup[origin],
      airportLookup[destination],
      distanceKm,
    );
    if (schedule.swapped) warnings.push(`Row ${index + 2}: departure and arrival times were reversed and have been normalized.`);

    usedAirports.add(origin);
    usedAirports.add(destination);
    flights.push({
      id: 0,
      date,
      year: Number(date.slice(0, 4)),
      flightNumber: flightNumber || '—',
      airline,
      origin,
      destination,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      aircraft: textValue(rowValue(row, 'aircraft')).toUpperCase() || 'UNKNOWN',
      registration: textValue(rowValue(row, 'registration')).toUpperCase() || null,
      aircraftSerialNumber: textValue(rowValue(row, 'aircraftSerialNumber')).toUpperCase() || null,
      aircraftFirstFlight: parseDate(rowValue(row, 'aircraftFirstFlight')),
      distanceKm,
    });
  });

  flights.sort((a, b) => `${a.date}${a.departureTime ?? ''}`.localeCompare(`${b.date}${b.departureTime ?? ''}`));
  flights.forEach((flight, index) => { flight.id = index + 1; });

  return {
    dataset: {
      airports: Object.fromEntries([...usedAirports].sort().map((code) => [code, airportLookup[code]])),
      flights,
    },
    accepted: flights.length,
    rejected,
    warnings: [...new Set(warnings)].slice(0, 25),
  };
}
