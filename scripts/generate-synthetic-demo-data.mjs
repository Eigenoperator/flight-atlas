import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const airportDirectoryUrl = new URL('../app/data/airports-global.json', import.meta.url);
const demoOutputUrl = new URL('../app/data/demo-flight-data.json', import.meta.url);

const yearCounts = new Map([
  [1984, 2], [1985, 0], [1986, 2], [1987, 0], [1988, 2], [1989, 2],
  [1990, 2], [1991, 2], [1992, 2], [1993, 2], [1994, 2], [1995, 2], [1996, 2], [1997, 4],
  [1998, 10], [1999, 10], [2000, 12], [2001, 12],
  [2002, 14], [2003, 16],
  [2004, 52], [2005, 54], [2006, 54], [2007, 56], [2008, 56], [2009, 58],
  [2010, 44], [2011, 44], [2012, 44], [2013, 44], [2014, 44], [2015, 44],
  [2016, 44], [2017, 46], [2018, 46], [2019, 44],
  [2020, 6], [2021, 12], [2022, 22], [2023, 26], [2024, 24], [2025, 22], [2026, 14],
]);

export const lifeStages = [
  {
    from: 1984,
    to: 1987,
    period: '1984–1987',
    ages: '4–7',
    base: 'Chengdu',
    baseAirport: 'CTU',
    lifeStage: 'Childhood in Chengdu',
    reason: 'Family visits to grandparents in Shanghai. Every flight was taken with a parent.',
    destinations: ['SHA'],
    purposes: [['Family visit', 1]],
  },
  {
    from: 1988,
    to: 1997,
    period: '1988–1997',
    ages: '8–17',
    base: 'Shanghai',
    baseAirport: 'SHA',
    lifeStage: 'School years in Shanghai',
    reason: 'The family moved to Shanghai. Flights were mainly school-holiday visits to relatives and a few family trips.',
    destinations: ['CTU', 'PEK', 'TAO', 'CAN'],
    purposes: [['Family visit', 0.7], ['School holiday', 0.3]],
  },
  {
    from: 1998,
    to: 2001,
    period: '1998–2001',
    ages: '18–21',
    base: 'Beijing',
    baseAirport: 'PEK',
    lifeStage: 'University in Beijing',
    reason: 'Term travel to Shanghai, internships in southern China and occasional student trips.',
    destinations: ['SHA', 'CTU', 'CAN', 'SZX', 'HKG', 'TAO', 'XIY'],
    purposes: [['University travel', 0.45], ['Family visit', 0.3], ['Internship', 0.15], ['Leisure', 0.1]],
  },
  {
    from: 2002,
    to: 2003,
    period: '2002–2003',
    ages: '22–23',
    base: 'Boston',
    baseAirport: 'BOS',
    lifeStage: 'Graduate school in Boston',
    reason: 'Study abroad, annual trips home via New York and Tokyo, academic conferences and job interviews.',
    destinations: ['JFK', 'ORD', 'SFO', 'LAX', 'IAD'],
    purposes: [['Academic conference', 0.35], ['Job interview', 0.3], ['Family visit', 0.2], ['Leisure', 0.15]],
  },
  {
    from: 2004,
    to: 2009,
    period: '2004–2009',
    ages: '24–29',
    base: 'Shanghai',
    baseAirport: 'PVG',
    lifeStage: 'Management consulting in Shanghai',
    reason: 'Frequent client work across China and East Asia, plus firm training and a small amount of personal travel.',
    destinations: ['PEK', 'CAN', 'SZX', 'HKG', 'NRT', 'KIX', 'ICN', 'SIN', 'TAO', 'XMN', 'CTU', 'WUH'],
    purposes: [['Client work', 0.72], ['Firm training', 0.12], ['Family visit', 0.08], ['Leisure', 0.08]],
  },
  {
    from: 2010,
    to: 2015,
    period: '2010–2015',
    ages: '30–35',
    base: 'Singapore',
    baseAirport: 'SIN',
    lifeStage: 'Regional operations in Singapore',
    reason: 'Asia-Pacific site launches, partner reviews, training, conferences and regular visits home.',
    destinations: ['HKG', 'PVG', 'PEK', 'NRT', 'HND', 'KIX', 'BKK', 'KUL', 'CGK', 'MNL', 'SYD', 'MEL', 'BOM', 'DEL'],
    purposes: [['Regional operations', 0.62], ['Partner meeting', 0.15], ['Conference', 0.1], ['Family visit', 0.08], ['Leisure', 0.05]],
  },
  {
    from: 2016,
    to: 2019,
    period: '2016–2019',
    ages: '36–39',
    base: 'San Francisco',
    baseAirport: 'SFO',
    lifeStage: 'Global partnerships in San Francisco',
    reason: 'US technology hubs, Asia partner visits, industry conferences and family trips to Shanghai.',
    destinations: ['LAX', 'SEA', 'ORD', 'JFK', 'AUS', 'BOS', 'LAS', 'PVG', 'NRT', 'HND', 'SIN', 'LHR'],
    purposes: [['Business development', 0.56], ['Partner meeting', 0.16], ['Conference', 0.12], ['Family visit', 0.1], ['Leisure', 0.06]],
  },
  {
    from: 2020,
    to: 2020,
    period: '2020',
    ages: '40',
    base: 'San Francisco to Shanghai',
    baseAirport: 'SHA',
    lifeStage: 'Repatriation to Shanghai',
    reason: 'One return journey to Shanghai, followed by only essential domestic travel.',
    destinations: ['CTU', 'PEK'],
    purposes: [['Repatriation', 0.34], ['Family visit', 0.33], ['Essential work', 0.33]],
  },
  {
    from: 2021,
    to: 2021,
    period: '2021',
    ages: '41',
    base: 'Shanghai',
    baseAirport: 'SHA',
    lifeStage: 'Hybrid work in Shanghai',
    reason: 'Limited domestic meetings, family visits and short breaks while international travel remained constrained.',
    destinations: ['PEK', 'CTU', 'CAN', 'SZX', 'HKG', 'XIY'],
    purposes: [['Essential work', 0.45], ['Family visit', 0.35], ['Leisure', 0.2]],
  },
  {
    from: 2022,
    to: 2026,
    period: '2022–2026',
    ages: '42–46',
    base: 'Shanghai',
    baseAirport: 'PVG',
    lifeStage: 'Independent adviser in Shanghai',
    reason: 'Board and advisory work, family visits and longer personal trips. Travel gradually declines by 2026.',
    destinations: ['HND', 'KIX', 'SIN', 'HKG', 'PEK', 'CTU', 'LAX', 'SFO', 'CDG', 'LHR', 'SYD', 'BKK'],
    purposes: [['Advisory work', 0.42], ['Board meeting', 0.16], ['Family visit', 0.14], ['Leisure', 0.28]],
  },
];

const chinaAirports = new Set(['SHA', 'PVG', 'PEK', 'CTU', 'CAN', 'SZX', 'TAO', 'XIY', 'WUH', 'XMN', 'CKG', 'KMG', 'HAK', 'HGH', 'NKG']);
const japanAirports = new Set(['NRT', 'HND', 'KIX', 'ITM', 'NGO', 'FUK']);
const koreaAirports = new Set(['ICN', 'GMP']);
const usAirports = new Set(['BOS', 'JFK', 'EWR', 'ORD', 'SFO', 'LAX', 'SEA', 'AUS', 'ATL', 'DTW', 'IAD', 'MIA', 'LAS', 'PDX', 'SAN']);
const australiaAirports = new Set(['SYD', 'MEL', 'BNE']);
const europeAirports = new Set(['LHR', 'CDG', 'FRA', 'AMS', 'VIE', 'FCO', 'MAD']);

const aircraftIntroduction = {
  B732: 1968, B733: 1984, B734: 1988, B737: 1968, B738: 1998, B739: 2001,
  B38M: 2017, B39M: 2018, B752: 1982, B763: 1986, B744: 1989, B772: 1995,
  B773: 1998, B77W: 2004, B788: 2011, B789: 2014, A306: 1983, A319: 1996,
  A320: 1988, A321: 1994, A20N: 2016, A21N: 2017, A332: 1998, A333: 1994,
  A339: 2018, A359: 2014, A388: 2007, MD82: 1981, C919: 2023,
};

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function choose(items, random) {
  return items[Math.floor(random() * items.length) % items.length];
}

function weightedChoice(items, random) {
  const point = random() * items.reduce((sum, [, weight]) => sum + weight, 0);
  let cumulative = 0;
  for (const [value, weight] of items) {
    cumulative += weight;
    if (point <= cumulative) return value;
  }
  return items.at(-1)[0];
}

function stageForYear(year) {
  const stage = lifeStages.find((candidate) => year >= candidate.from && year <= candidate.to);
  if (!stage) throw new Error(`No life stage configured for ${year}`);
  return stage;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateFromDay(year, dayOfYear) {
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(Math.max(1, Math.floor(dayOfYear)));
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function greatCircleDistance(origin, destination) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = radians(destination.latitude - origin.latitude);
  const deltaLongitude = radians(destination.longitude - origin.longitude);
  const latitudeA = radians(origin.latitude);
  const latitudeB = radians(destination.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(6_371.0088 * 2 * Math.asin(Math.sqrt(haversine)));
}

function chooseAirline(origin, destination, year, random) {
  if (year < 1988 && chinaAirports.has(origin) && chinaAirports.has(destination)) return 'CA';
  if (chinaAirports.has(origin) && chinaAirports.has(destination)) {
    if (origin === 'CTU' || destination === 'CTU') return choose(['3U', 'CA', 'MU'], random);
    if (origin === 'SHA' || origin === 'PVG' || destination === 'SHA' || destination === 'PVG') return choose(['MU', 'FM', 'CA'], random);
    return choose(['CA', 'MU', 'CZ'], random);
  }
  if (usAirports.has(origin) && usAirports.has(destination)) {
    if ((origin === 'BOS' && destination === 'JFK') || (origin === 'JFK' && destination === 'BOS')) return choose(['AA', 'DL'], random);
    if (origin === 'SEA' || destination === 'SEA') return choose(['AS', 'DL', 'UA'], random);
    if ((origin === 'SFO' || origin === 'LAX') && (destination === 'LAS' || destination === 'SAN')) return choose(['WN', 'UA', 'AS'], random);
    return choose(['UA', 'AA', 'DL'], random);
  }
  if (japanAirports.has(origin) && japanAirports.has(destination)) return choose(['JL', 'NH'], random);
  if ((chinaAirports.has(origin) && destination === 'HKG') || (origin === 'HKG' && chinaAirports.has(destination))) return choose(['CX', 'MU', 'CA'], random);
  if ((chinaAirports.has(origin) && japanAirports.has(destination)) || (japanAirports.has(origin) && chinaAirports.has(destination))) return choose(['JL', 'NH', 'MU', 'CA'], random);
  if ((chinaAirports.has(origin) && koreaAirports.has(destination)) || (koreaAirports.has(origin) && chinaAirports.has(destination))) return choose(['MU', 'CA', 'CZ'], random);
  if ((chinaAirports.has(origin) && usAirports.has(destination)) || (usAirports.has(origin) && chinaAirports.has(destination))) return choose(['UA', 'MU', 'CA'], random);
  if ((japanAirports.has(origin) && usAirports.has(destination)) || (usAirports.has(origin) && japanAirports.has(destination))) return choose(['JL', 'NH', 'UA'], random);
  if ((europeAirports.has(origin) && usAirports.has(destination)) || (usAirports.has(origin) && europeAirports.has(destination))) return choose(['BA', 'UA', 'AA'], random);
  if ((europeAirports.has(origin) && chinaAirports.has(destination)) || (chinaAirports.has(origin) && europeAirports.has(destination))) {
    return origin === 'LHR' || destination === 'LHR' ? choose(['BA', 'CA', 'MU'], random) : choose(['CA', 'MU'], random);
  }
  if (origin === 'SIN' || destination === 'SIN') {
    if (australiaAirports.has(origin) || australiaAirports.has(destination)) return choose(['SQ', 'VA'], random);
    if (origin === 'KUL' || destination === 'KUL') return choose(['SQ', 'MH'], random);
    if (origin === 'HKG' || destination === 'HKG') return choose(['SQ', 'CX'], random);
    if (japanAirports.has(origin) || japanAirports.has(destination)) return choose(['SQ', 'JL', 'NH'], random);
    if (chinaAirports.has(origin) || chinaAirports.has(destination)) return choose(['SQ', 'MU', 'CA'], random);
    return 'SQ';
  }
  if (australiaAirports.has(origin) || australiaAirports.has(destination)) return choose(['SQ', 'VA', 'MH', 'CX'], random);
  if (origin === 'HKG' || destination === 'HKG') return choose(['CX', 'SQ', 'MU'], random);
  if (origin === 'KUL' || destination === 'KUL') return choose(['MH', 'SQ'], random);
  return choose(['UA', 'CA', 'MU', 'SQ'], random);
}

function chooseAircraft(airline, year, distanceKm, random) {
  const longHaul = distanceKm >= 5_500;
  const mediumHaul = distanceKm >= 2_500;
  if (airline === 'AS' || airline === 'WN') return choose(year >= 2018 ? ['B738', 'B38M'] : ['B737', 'B738'], random);
  if (['UA', 'AA', 'DL'].includes(airline)) {
    if (longHaul) return choose(year >= 2014 ? ['B789', 'B772', 'B77W'] : ['B763', 'B772'], random);
    if (year < 1990) return choose(['B732', 'B733', 'B752'], random);
    if (year < 2005) return choose(['B733', 'B752', 'B763', 'A320'], random);
    return choose(year >= 2018 ? ['A319', 'A320', 'B738', 'B739', 'B38M'] : ['A319', 'A320', 'B738', 'B752'], random);
  }
  if (['JL', 'NH'].includes(airline)) {
    if (longHaul) return choose(year >= 2014 ? ['B788', 'B789', 'B77W'] : ['B744', 'B772', 'B77W'], random);
    return choose(year >= 2008 ? ['B738', 'B763', 'B788', 'A320'] : ['B763', 'B772', 'A320'], random);
  }
  if (airline === 'SQ') {
    if (longHaul) return choose(year >= 2015 ? ['A359', 'A388', 'B77W', 'B789'] : ['B772', 'B77W', 'A388'], random);
    return choose(['A333', 'B772'], random);
  }
  if (airline === 'MH') return choose(longHaul ? ['B772', 'A333'] : year < 2005 ? ['B734', 'B772'] : ['B738', 'A333'], random);
  if (airline === 'CX') return choose(longHaul ? year >= 2016 ? ['A359', 'B77W'] : ['B773', 'B77W'] : ['A333', 'B773'], random);
  if (airline === 'BA') return choose(longHaul ? year >= 2014 ? ['B789', 'B77W', 'A359'] : ['B744', 'B772'] : ['A320', 'A321'], random);
  if (airline === 'VA') return choose(longHaul ? ['B77W', 'A333'] : ['B737', 'B738'], random);
  if (year < 1988) return choose(['B732', 'B733'], random);
  if (year < 1996) return choose(mediumHaul ? ['A306', 'B752'] : ['MD82', 'B733'], random);
  if (year < 2006) return choose(longHaul ? ['B744', 'B772', 'A332'] : mediumHaul ? ['B763', 'A321'] : ['A320', 'A321', 'B738'], random);
  if (year < 2016) return choose(longHaul ? ['A332', 'A333', 'B77W'] : mediumHaul ? ['A332', 'B763'] : ['A320', 'A321', 'B738'], random);
  if (longHaul) return choose(['A359', 'B77W', 'B789', 'A333'], random);
  if (mediumHaul) return choose(['A333', 'B789', 'A21N'], random);
  const modernShortHaul = year >= 2024 ? ['A20N', 'A21N', 'B738', 'B38M', 'C919'] : ['A20N', 'A21N', 'B738', 'B38M'];
  return choose(modernShortHaul, random);
}

function letters(seed, count) {
  let value = seed;
  let result = '';
  for (let index = 0; index < count; index += 1) {
    result += String.fromCharCode(65 + value % 26);
    value = Math.floor(value / 26) + 7;
  }
  return result;
}

function registrationFor(airline, seed) {
  if (['MU', 'FM', 'CA', 'CZ', '3U'].includes(airline)) return `B-${String(1000 + seed % 9000)}`;
  if (['UA', 'AA', 'DL', 'AS', 'WN'].includes(airline)) return `N${String(100 + seed % 900)}${letters(seed, 2)}`;
  if (airline === 'JL') return `JA${String(100 + seed % 900)}J`;
  if (airline === 'NH') return `JA${String(100 + seed % 900)}A`;
  if (airline === 'SQ') return `9V-S${letters(seed, 3)}`;
  if (airline === 'MH') return `9M-M${letters(seed, 2)}`;
  if (airline === 'CX') return `B-H${letters(seed, 2)}`;
  if (airline === 'BA') return `G-${letters(seed, 4)}`;
  if (airline === 'VA') return `VH-${letters(seed, 3)}`;
  return `SYN-${String(seed % 10000).padStart(4, '0')}`;
}

function formatTime(minutes) {
  const dayOffset = Math.floor(minutes / 1_440);
  const normalized = ((Math.round(minutes) % 1_440) + 1_440) % 1_440;
  const time = `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  return dayOffset > 0 ? `${time}(+${Math.min(dayOffset, 2)})` : time;
}

function flightNumberFor(airline, origin, destination, date, legIndex) {
  const number = 20 + hash(`${airline}|${origin}|${destination}|${date}|${legIndex}`) % 9780;
  return `${airline}${number}`;
}

function tripContext(purpose, destination, airportLookup) {
  const city = airportLookup[destination].city.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();
  const contexts = {
    'Family visit': `Visit family in ${city}`,
    'School holiday': `School-holiday trip to ${city}`,
    'University travel': `Travel between university and home via ${city}`,
    Internship: `Student internship in ${city}`,
    Leisure: `Personal trip to ${city}`,
    'Academic conference': `Academic conference in ${city}`,
    'Job interview': `Graduate job interview in ${city}`,
    'Client work': `Client engagement in ${city}`,
    'Firm training': `Firm training in ${city}`,
    'Regional operations': `Regional operations visit in ${city}`,
    'Partner meeting': `Partner meeting in ${city}`,
    Conference: `Industry conference in ${city}`,
    'Business development': `Business development visit in ${city}`,
    Repatriation: `Relocation journey through ${city}`,
    'Essential work': `Essential work trip to ${city}`,
    'Advisory work': `Advisory engagement in ${city}`,
    'Board meeting': `Board meeting in ${city}`,
  };
  return contexts[purpose] ?? `${purpose} in ${city}`;
}

export async function generateSyntheticLife() {
  const airports = JSON.parse(await readFile(airportDirectoryUrl, 'utf8'));
  const airportLookup = Object.fromEntries(airports.map((airport) => [airport.code, {
    ...airport,
    city: airport.city.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim(),
  }]));
  const random = mulberry32(19801000);
  const flights = [];
  const airframes = new Map();
  let tripSequence = 0;

  const ensureAirport = (code) => {
    if (!airportLookup[code]) throw new Error(`Unknown airport in synthetic plan: ${code}`);
  };

  function airframeFor(airline, aircraft, year, date, routeKey) {
    const availability = year < 1990 ? 0.25 : year < 2000 ? 0.55 : year < 2010 ? 0.78 : 0.94;
    if (random() > availability) return { registration: null, aircraftSerialNumber: null, aircraftFirstFlight: null };
    const poolIndex = hash(`${routeKey}|${year}`) % 7;
    const key = `${airline}|${aircraft}|${poolIndex}`;
    if (!airframes.has(key)) {
      const seed = hash(key);
      const introduction = aircraftIntroduction[aircraft] ?? 1975;
      const firstYear = Math.min(year - 1, Math.max(introduction, year - (1 + seed % 12)));
      const month = 1 + seed % 12;
      const day = 1 + Math.floor(seed / 13) % 25;
      airframes.set(key, {
        registration: registrationFor(airline, seed),
        aircraftSerialNumber: String(10_000 + seed % 89_000),
        aircraftFirstFlight: `${firstYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }
    const record = airframes.get(key);
    if (record.aircraftFirstFlight >= date) throw new Error(`Invalid first flight date for ${record.registration}`);
    return record;
  }

  function addFlight({ date, origin, destination, purpose, stage, context, tripId, legIndex }) {
    ensureAirport(origin);
    ensureAirport(destination);
    const year = Number(date.slice(0, 4));
    const distanceKm = greatCircleDistance(airportLookup[origin], airportLookup[destination]);
    const airline = chooseAirline(origin, destination, year, random);
    const aircraft = chooseAircraft(airline, year, distanceKm, random);
    const longHaul = distanceKm >= 5_500;
    const departureChoices = longHaul ? [570, 760, 1_030, 1_350] : [400, 495, 650, 800, 945, 1_110, 1_230];
    const departureMinutes = choose(departureChoices, random) + (hash(`${tripId}|${legIndex}`) % 16 - 8);
    const durationHours = Math.max(0.7, Math.min(16.5, distanceKm / 820 + 0.45));
    const timezoneDifference = (airportLookup[destination].longitude - airportLookup[origin].longitude) / 15;
    const arrivalMinutes = departureMinutes + durationHours * 60 + timezoneDifference * 60;
    const airframe = airframeFor(airline, aircraft, year, date, `${origin}-${destination}-${tripId}`);
    flights.push({
      id: 0,
      date,
      year,
      flightNumber: flightNumberFor(airline, origin, destination, date, legIndex),
      airline,
      origin,
      destination,
      departureTime: formatTime(departureMinutes),
      arrivalTime: formatTime(arrivalMinutes),
      aircraft,
      registration: airframe.registration,
      aircraftSerialNumber: airframe.aircraftSerialNumber,
      aircraftFirstFlight: airframe.aircraftFirstFlight,
      distanceKm,
      lifeStage: stage.lifeStage,
      tripPurpose: purpose,
      tripContext: context,
      tripId,
    });
  }

  function addItinerary({ stage, purpose, airports: itinerary, dates, context }) {
    const tripId = `TRIP-${String(++tripSequence).padStart(4, '0')}`;
    for (let index = 0; index < itinerary.length - 1; index += 1) {
      addFlight({
        date: formatDate(dates[index]),
        origin: itinerary[index],
        destination: itinerary[index + 1],
        purpose,
        stage,
        context,
        tripId,
        legIndex: index + 1,
      });
    }
  }

  function addRoundTrips(year, stage, sectors, startDaysOverride = null) {
    if (sectors % 2 !== 0) throw new Error(`Round-trip sector count must be even for ${year}`);
    const tripCount = sectors / 2;
    const endDay = year === 2026 ? 315 : 350;
    const span = endDay - 18;
    const approximateGap = span / Math.max(1, tripCount);
    for (let tripIndex = 0; tripIndex < tripCount; tripIndex += 1) {
      const purpose = weightedChoice(stage.purposes, random);
      const destination = choose(stage.destinations, random);
      const startDay = startDaysOverride?.[tripIndex]
        ?? Math.min(endDay - 2, 18 + Math.floor((tripIndex + 0.35) * span / tripCount) + Math.floor(random() * 5) - 2);
      const desiredStay = purpose.includes('Family') || purpose.includes('holiday') ? 7 + Math.floor(random() * 4)
        : purpose === 'Leisure' ? 4 + Math.floor(random() * 5)
          : 1 + Math.floor(random() * 4);
      const stayDays = Math.max(1, Math.min(desiredStay, Math.max(2, Math.floor(approximateGap) - 2), endDay - startDay));
      const startDate = dateFromDay(year, startDay);
      const context = tripContext(purpose, destination, airportLookup);
      addItinerary({
        stage,
        purpose,
        airports: [stage.baseAirport, destination, stage.baseAirport],
        dates: [startDate, addDays(startDate, stayDays)],
        context,
      });
    }
  }

  for (const [year, count] of yearCounts) {
    if (count === 0) continue;
    const stage = stageForYear(year);
    if (year === 2002 || year === 2003) {
      const startDate = dateFromDay(year, year === 2002 ? 153 : 160);
      addItinerary({
        stage,
        purpose: 'Family visit',
        airports: ['BOS', 'JFK', 'NRT', 'PVG', 'NRT', 'JFK', 'BOS'],
        dates: [startDate, startDate, addDays(startDate, 1), addDays(startDate, 15), addDays(startDate, 16), addDays(startDate, 16)],
        context: 'Annual trip home to Shanghai via New York and Tokyo',
      });
      const startDays = year === 2002 ? [35, 85, 230, 300] : [30, 75, 115, 230, 300];
      addRoundTrips(year, stage, count - 6, startDays);
      continue;
    }
    if (year === 2020) {
      addItinerary({
        stage,
        purpose: 'Repatriation',
        airports: ['SFO', 'HND', 'PVG'],
        dates: [dateFromDay(2020, 25), dateFromDay(2020, 26)],
        context: 'Relocation from San Francisco to Shanghai via Tokyo',
      });
      addItinerary({
        stage,
        purpose: 'Family visit',
        airports: ['SHA', 'CTU', 'SHA'],
        dates: [dateFromDay(2020, 190), dateFromDay(2020, 197)],
        context: 'Visit family in Chengdu after returning to China',
      });
      addItinerary({
        stage,
        purpose: 'Essential work',
        airports: ['SHA', 'PEK', 'SHA'],
        dates: [dateFromDay(2020, 294), dateFromDay(2020, 297)],
        context: 'Essential work meeting in Beijing',
      });
      continue;
    }
    addRoundTrips(year, stage, count);
  }

  flights.sort((left, right) => `${left.date}${left.departureTime}`.localeCompare(`${right.date}${right.departureTime}`));
  flights.forEach((flight, index) => { flight.id = index + 1; });
  if (flights.length !== 1_000) throw new Error(`Expected 1000 flights, generated ${flights.length}`);

  const usedAirportCodes = [...new Set(flights.flatMap((flight) => [flight.origin, flight.destination]))].sort();
  const dataset = {
    airports: Object.fromEntries(usedAirportCodes.map((code) => [code, airportLookup[code]])),
    flights,
  };
  const stageSummaries = lifeStages.map((stage) => ({
    ...stage,
    flights: flights.filter((flight) => flight.year >= stage.from && flight.year <= stage.to).length,
  }));
  const yearSummaries = [...yearCounts].map(([year, flightCount]) => ({
    year,
    flightCount,
    base: stageForYear(year).base,
  }));
  const purposeCounts = Object.entries(flights.reduce((counts, flight) => {
    counts[flight.tripPurpose] = (counts[flight.tripPurpose] ?? 0) + 1;
    return counts;
  }, {})).sort((left, right) => right[1] - left[1]);

  return { dataset, flights, stageSummaries, yearSummaries, purposeCounts };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await generateSyntheticLife();
  await writeFile(demoOutputUrl, `${JSON.stringify(result.dataset, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${result.flights.length} synthetic flights to ${fileURLToPath(demoOutputUrl)}`);
  console.log(`Coverage: ${result.flights[0].date} to ${result.flights.at(-1).date}`);
  console.log(`Airports: ${Object.keys(result.dataset.airports).length}; airframes with registrations: ${result.flights.filter((flight) => flight.registration).length}`);
}
