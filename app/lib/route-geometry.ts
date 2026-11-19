import { geoDistance, geoInterpolate } from 'd3-geo';
import type { Airport, Flight } from './flight-data';

export type Coordinate = [number, number];

export type RouteGeometry = {
  type: 'LineString';
  coordinates: Coordinate[];
  cumulativeRadians: number[];
  totalRadians: number;
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (angle: number) => (angle * 180) / Math.PI;
const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function toVector([longitude, latitude]: Coordinate): [number, number, number] {
  const lambda = radians(longitude);
  const phi = radians(latitude);
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function toCoordinate([x, y, z]: [number, number, number]): Coordinate {
  return [degrees(Math.atan2(y, x)), degrees(Math.atan2(z, Math.hypot(x, y)))];
}

function cross(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function normalise([x, y, z]: [number, number, number]): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function offsetFromGreatCircle(
  coordinate: Coordinate,
  routeNormal: [number, number, number],
  offsetRadians: number,
): Coordinate {
  const point = toVector(coordinate);
  const cosOffset = Math.cos(offsetRadians);
  const sinOffset = Math.sin(offsetRadians);
  return toCoordinate(normalise([
    point[0] * cosOffset + routeNormal[0] * sinOffset,
    point[1] * cosOffset + routeNormal[1] * sinOffset,
    point[2] * cosOffset + routeNormal[2] * sinOffset,
  ]));
}

/**
 * Builds a smooth great-circle track with a very small deterministic lateral
 * separation. Repeated routes stay visually distinct without looking like
 * hand-drawn airway segments.
 */
export function makeRouteGeometry(
  flight: Flight,
  airports: Record<string, Airport>,
  assignedLane?: number,
): RouteGeometry {
  const origin = airports[flight.origin];
  const destination = airports[flight.destination];
  const start: Coordinate = [origin.longitude, origin.latitude];
  const end: Coordinate = [destination.longitude, destination.latitude];
  const interpolate = geoInterpolate(start, end);
  const directRadians = geoDistance(start, end);
  const routeNormalCandidate = cross(toVector(start), toVector(end));
  const routeNormalLength = Math.hypot(...routeNormalCandidate);
  const routeNormal = routeNormalLength > 0.00001
    ? normalise(routeNormalCandidate)
    : normalise(cross(toVector(start), [0, 0, 1]));

  const random = mulberry32(hashString([
    flight.id,
    flight.date,
    flight.flightNumber,
    flight.origin,
    flight.destination,
    flight.registration ?? '',
  ].join('|')));
  const dominantSide = random() < 0.5 ? -1 : 1;
  const laneStrength = assignedLane ?? dominantSide * (0.14 + random() * 0.12);
  const phase = random() * Math.PI * 2;
  const secondaryPhase = random() * Math.PI * 2;
  const directDegrees = degrees(directRadians);
  const laneSpacing = radians(clamp(0.96 + directDegrees * 0.005, 1, 1.35));
  const smoothVariationAmplitude = radians(clamp(0.035 + directDegrees * 0.0008, 0.04, 0.11));
  const sampleCount = Math.round(clamp(49 + directDegrees / 3, 49, 81));
  const coordinates = Array.from({ length: sampleCount }, (_, index): Coordinate => {
    if (index === 0) return start;
    if (index === sampleCount - 1) return end;

    const fraction = index / (sampleCount - 1);
    const corridorProfile = Math.sin(Math.PI * fraction) ** 1.18;
    const smoothVariation = Math.sin(phase + fraction * Math.PI * 2) * 0.075
      + Math.sin(secondaryPhase + fraction * Math.PI) * 0.035;
    const offset = corridorProfile * (
      laneSpacing * laneStrength + smoothVariationAmplitude * smoothVariation
    );
    return offsetFromGreatCircle(interpolate(fraction) as Coordinate, routeNormal, offset);
  });

  const cumulativeRadians = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulativeRadians.push(
      cumulativeRadians[index - 1] + geoDistance(coordinates[index - 1], coordinates[index]),
    );
  }

  return {
    type: 'LineString',
    coordinates,
    cumulativeRadians,
    totalRadians: cumulativeRadians.at(-1) ?? directRadians,
  };
}

export function coordinateAtRouteProgress(route: RouteGeometry, progress: number): Coordinate {
  const target = clamp(progress, 0, 1) * route.totalRadians;
  let segmentIndex = 1;
  while (
    segmentIndex < route.cumulativeRadians.length - 1
    && route.cumulativeRadians[segmentIndex] < target
  ) {
    segmentIndex += 1;
  }

  const segmentStartDistance = route.cumulativeRadians[segmentIndex - 1];
  const segmentEndDistance = route.cumulativeRadians[segmentIndex];
  const segmentProgress = segmentEndDistance === segmentStartDistance
    ? 0
    : (target - segmentStartDistance) / (segmentEndDistance - segmentStartDistance);
  return geoInterpolate(
    route.coordinates[segmentIndex - 1],
    route.coordinates[segmentIndex],
  )(segmentProgress) as Coordinate;
}
