import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const airportDirectoryUrl = new URL('../app/data/airports-global.json', import.meta.url);
const demoOutputUrl = new URL('../app/data/demo-flight-data.json', import.meta.url);

const yearCounts = new Map([
  [2008, 2], [2009, 0], [2010, 2], [2011, 2], [2012, 2], [2013, 2],
  [2014, 4], [2015, 4], [2016, 4],
  [2017, 8], [2018, 8], [2019, 8],
  [2020, 2], [2021, 4],
  [2022, 8], [2023, 10], [2024, 12], [2025, 10], [2026, 8],
]);

export const lifeStages = [
  {
    from: 2008,
    to: 2013,
    period: '2008–2013',
    ages: '4–9',
    base: 'Shanghai',
    baseAirport: 'SHA',
    lifeStage: 'Childhood in Shanghai',
    reason: 'Parent-accompanied visits to relatives and one family holiday most years.',
    destinations: ['CTU', 'PEK', 'HKG', 'KIX'],
    purposes: [['Family visit', 0.65], ['Leisure', 0.35]],
  },
  {
    from: 2014,
    to: 2016,
    period: '2014–2016',
    ages: '10–12',
    base: 'Shanghai',
    baseAirport: 'SHA',
    lifeStage: 'Primary school in Shanghai',
    reason: 'School-holiday family visits, short trips in East Asia and an occasional school exchange.',
    destinations: ['CTU', 'PEK', 'HKG', 'KIX', 'TPE'],
    purposes: [['Family visit', 0.4], ['School holiday', 0.35], ['School trip', 0.25]],
  },
  {
    from: 2017,
    to: 2019,
    period: '2017–2019',
    ages: '13–15',
    base: 'Singapore',
    baseAirport: 'SIN',
    lifeStage: 'International school in Singapore',
    reason: 'Term travel home to Shanghai, school activities and family holidays around Asia-Pacific.',
    destinations: ['PVG', 'HKG', 'KUL', 'BKK', 'NRT', 'SYD'],
    purposes: [['Family visit', 0.4], ['School travel', 0.35], ['Leisure', 0.25]],
  },
  {
    from: 2020,
    to: 2020,
    period: '2020',
    ages: '16',
    base: 'Singapore to Shanghai',
    baseAirport: 'PVG',
    lifeStage: 'Return to Shanghai',
    reason: 'A two-sector relocation journey via Tokyo before international travel became heavily restricted.',
    destinations: ['NRT'],
    purposes: [['Repatriation', 1]],
  },
  {
    from: 2021,
    to: 2021,
    period: '2021',
    ages: '17',
    base: 'Shanghai',
    baseAirport: 'SHA',
    lifeStage: 'High school completion in Shanghai',
    reason: 'Two domestic round trips for family visits and university preparation.',
    destinations: ['CTU', 'PEK'],
    purposes: [['University preparation', 0.55], ['Family visit', 0.45]],
  },
  {
    from: 2022,
    to: 2026,
    period: '2022–2026',
    ages: '18–22',
    base: 'Los Angeles',
    baseAirport: 'LAX',
    lifeStage: 'University in Los Angeles',
    reason: 'Annual trips home via Tokyo, US travel, internships, academic events and personal holidays.',
    destinations: ['SFO', 'SEA', 'JFK', 'BOS', 'LAS', 'HNL', 'NRT', 'PVG'],
    purposes: [['University travel', 0.3], ['Family visit', 0.25], ['Internship', 0.2], ['Academic conference', 0.1], ['Leisure', 0.15]],
  },
];

const chinaAirports = new Set(['SHA', 'PVG', 'PEK', 'CTU', 'CAN', 'SZX', 'TAO', 'XIY', 'WUH', 'XMN', 'CKG', 'KMG', 'HAK', 'HGH', 'NKG']);
const japanAirports = new Set(['NRT', 'HND', 'KIX', 'ITM', 'NGO', 'FUK']);
const koreaAirports = new Set(['ICN', 'GMP']);
const taiwanAirports = new Set(['TPE', 'TSA', 'KHH']);
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
  if ((chinaAirports.has(origin) && taiwanAirports.has(destination)) || (taiwanAirports.has(origin) && chinaAirports.has(destination))) return choose(['CI', 'MU', 'CA'], random);
  if ((chinaAirports.has(origin) && japanAirports.has(destination)) || (japanAirports.has(origin) && chinaAirports.has(destination))) return choose(['JL', 'NH', 'MU', 'CA'], random);
  if ((chinaAirports.has(origin) && koreaAirports.has(destination)) || (koreaAirports.has(origin) && chinaAirports.has(destination))) return choose(['MU', 'CA', 'CZ'], random);
  if ((chinaAirports.has(origin) && usAirports.has(destination)) || (usAirports.has(origin) && chinaAirports.has(destination))) return choose(['UA', 'MU', 'CA'], random);
  if ((japanAirports.has(origin) && usAirports.has(destination)) || (usAirports.has(origin) && japanAirports.has(destination))) return choose(['JL', 'NH', 'UA'], random);
  if ((europeAirports.has(origin) && usAirports.has(destination)) || (usAirports.has(origin) && europeAirports.has(destination))) return choose(['BA', 'UA', 'AA'], random);
  if ((europeAirports.has(origin) && chinaAirports.has(destination)) || (chinaAirports.has(origin) && europeAirports.has(destination))) {
    return origin === 'LHR' || destination === 'LHR' ? choose(['BA', 'CA', 'MU'], random) : choose(['CA', 'MU'], random);
  }
  if (origin === 'SIN' || destination === 'SIN') {
    if (australiaAirports.has(origin) || australiaAirports.has(destination)) return 'SQ';
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
  if (mediumHaul) return choose(year >= 2018 ? ['A333', 'B789', 'A21N'] : ['A333'], random);
  const modernShortHaul = year >= 2024 ? ['A20N', 'A21N', 'B738', 'B38M', 'C919']
    : year >= 2018 ? ['A20N', 'A21N', 'B738', 'B38M']
      : year >= 2017 ? ['A20N', 'B738']
        : ['A320', 'A321', 'B738'];
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
  if (['MU', 'FM', 'CA', 'CZ', '3U', 'CI'].includes(airline)) return `B-${String(1000 + seed % 9000)}`;
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
  const cityAliases = {
    KUL: 'Kuala Lumpur', NRT: 'Tokyo', HND: 'Tokyo', PVG: 'Shanghai', SHA: 'Shanghai', TPE: 'Taipei',
  };
  const city = cityAliases[destination]
    ?? airportLookup[destination].city.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();
  const contexts = {
    'Family visit': `Visit family in ${city}`,
    'School holiday': `School-holiday trip to ${city}`,
    'School trip': `School exchange in ${city}`,
    'School travel': `School activity in ${city}`,
    'University preparation': `University preparation visit in ${city}`,
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
  const random = mulberry32(20040100);
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
    if (year >= 2017 && year <= 2019) {
      addItinerary({
        stage,
        purpose: 'Family visit',
        airports: ['SIN', 'PVG', 'SIN'],
        dates: [dateFromDay(year, 165), dateFromDay(year, 205)],
        context: 'Summer break at home in Shanghai',
      });
      addRoundTrips(year, stage, count - 2, [35, 110, 285]);
      continue;
    }
    if (year === 2020) {
      addItinerary({
        stage,
        purpose: 'Repatriation',
        airports: ['SIN', 'NRT', 'PVG'],
        dates: [dateFromDay(2020, 24), dateFromDay(2020, 25)],
        context: 'Return from Singapore to Shanghai via Tokyo',
      });
      continue;
    }
    if (year === 2022) {
      addItinerary({
        stage,
        purpose: 'University travel',
        airports: ['PVG', 'NRT', 'LAX'],
        dates: [dateFromDay(2022, 230), dateFromDay(2022, 231)],
        context: 'Move from Shanghai to Los Angeles for university via Tokyo',
      });
      addRoundTrips(year, stage, count - 2, [255, 295, 335]);
      continue;
    }
    if (year >= 2023) {
      addItinerary({
        stage,
        purpose: 'Family visit',
        airports: ['LAX', 'NRT', 'PVG', 'NRT', 'LAX'],
        dates: [dateFromDay(year, 150), dateFromDay(year, 151), dateFromDay(year, 195), dateFromDay(year, 196)],
        context: 'Summer break at home in Shanghai via Tokyo',
      });
      if (year === 2024) {
        addItinerary({
          stage,
          purpose: 'Academic conference',
          airports: ['LAX', 'BOS', 'LAX'],
          dates: [dateFromDay(2024, 90), dateFromDay(2024, 95)],
          context: 'Student conference in Boston',
        });
      }
      const otherTripDays = year === 2024 ? [30, 245, 320]
        : year === 2026 ? [55, 275]
          : [35, 255, 325];
      addRoundTrips(year, stage, count - (year === 2024 ? 6 : 4), otherTripDays);
      continue;
    }
    addRoundTrips(year, stage, count);
  }

  flights.sort((left, right) => `${left.date}${left.departureTime}`.localeCompare(`${right.date}${right.departureTime}`));
  flights.forEach((flight, index) => { flight.id = index + 1; });
  if (flights.length !== 100) throw new Error(`Expected 100 flights, generated ${flights.length}`);

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
