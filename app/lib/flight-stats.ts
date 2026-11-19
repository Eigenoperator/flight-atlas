import type { Flight } from './flight-data';

const hourInMilliseconds = 60 * 60 * 1000;

export type FlightTrip = {
  id: string;
  flights: Flight[];
  origin: string;
  destination: string;
  airportCodes: string[];
  startDate: string;
  endDate: string;
  distanceKm: number;
};

function localTimestamp(date: string, time: string | null) {
  if (!time) return null;
  const clock = time.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!clock) return null;
  const dayOffset = Number(time.match(/\+\s*(\d+)/)?.[1] ?? 0);
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return timestamp
    + dayOffset * 24 * hourInMilliseconds
    + Number(clock[1]) * hourInMilliseconds
    + Number(clock[2]) * 60 * 1000;
}

/**
 * Counts airport visits using Flighty's published connection convention:
 * an arrival and the next departure at the same airport merge when the
 * scheduled ground time is under 8 hours. Different airports never merge.
 */
export function countAirportVisits(flights: Flight[]) {
  const counts = new Map<string, number>();
  const increment = (airport: string, amount: number) => {
    counts.set(airport, (counts.get(airport) ?? 0) + amount);
  };

  flights.forEach((flight) => {
    increment(flight.origin, 1);
    increment(flight.destination, 1);
  });

  for (let index = 0; index < flights.length - 1; index += 1) {
    const arrivingFlight = flights[index];
    const departingFlight = flights[index + 1];
    if (arrivingFlight.destination !== departingFlight.origin) continue;

    const arrival = localTimestamp(arrivingFlight.date, arrivingFlight.arrivalTime);
    const departure = localTimestamp(departingFlight.date, departingFlight.departureTime);
    if (arrival === null || departure === null) continue;
    const groundTime = departure - arrival;
    const isConnection = groundTime >= 0 && groundTime < 8 * hourInMilliseconds;
    if (isConnection) {
      increment(arrivingFlight.destination, -1);
    }
  }

  return [...counts.entries()]
    .filter(([, visits]) => visits > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Groups consecutive flights into journeys using the same-airport,
 * under-eight-hour connection rule. Roundtrips stay together as one trip.
 */
export function groupFlightsIntoTrips(flights: Flight[]): FlightTrip[] {
  if (!flights.length) return [];
  const groups: Flight[][] = [];

  flights.forEach((flight) => {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (!current || !previous) {
      groups.push([flight]);
      return;
    }

    const arrival = localTimestamp(previous.date, previous.arrivalTime);
    const departure = localTimestamp(flight.date, flight.departureTime);
    const groundTime = arrival === null || departure === null ? null : departure - arrival;
    const isConnection = previous.destination === flight.origin
      && groundTime !== null
      && groundTime >= 0
      && groundTime < 8 * hourInMilliseconds;

    if (isConnection) current.push(flight);
    else groups.push([flight]);
  });

  return groups.map((tripFlights) => {
    const first = tripFlights[0];
    const last = tripFlights.at(-1)!;
    return {
      id: tripFlights.map((flight) => flight.id).join('-'),
      flights: tripFlights,
      origin: first.origin,
      destination: last.destination,
      airportCodes: [first.origin, ...tripFlights.map((flight) => flight.destination)],
      startDate: first.date,
      endDate: last.date,
      distanceKm: tripFlights.reduce((sum, flight) => sum + flight.distanceKm, 0),
    };
  });
}
