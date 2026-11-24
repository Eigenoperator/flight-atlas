export type SpecialLiveryReference = {
  registration: string;
  type: string;
  name: string;
  note: string;
};

// This is intentionally a starter collection catalogue rather than a live fleet database.
// Airlines move aircraft between fleets frequently, while a personal logbook is permanent.
// Logged aircraft are therefore always shown even when they sit outside this reference set.
export const airlineTypeCatalog: Record<string, string[]> = {
  '3U': ['A319', 'A320', 'A20N', 'A321', 'A21N', 'A332', 'A333', 'A359'],
  '9C': ['A320', 'A20N', 'A321', 'A21N'],
  AA: ['A319', 'A320', 'A20N', 'A321', 'A21N', 'B738', 'B38M', 'B788', 'B789', 'B77W'],
  AS: ['B717', 'B737', 'B738', 'B739', 'B38M', 'B39M', 'E75W'],
  BA: ['A319', 'A320', 'A20N', 'A321', 'A21N', 'A35K', 'A388', 'B772', 'B77W', 'B788', 'B789', 'B78X'],
  BC: ['B738', 'B38M'],
  CA: ['A319', 'A320', 'A20N', 'A321', 'A21N', 'A332', 'A333', 'A359', 'B737', 'B738', 'B38M', 'B744', 'B748', 'B77W', 'B789', 'C919'],
  CI: ['A21N', 'A333', 'A359', 'B738', 'B744', 'B77W'],
  CX: ['A21N', 'A321', 'A333', 'A359', 'A35K', 'B744', 'B77W'],
  CZ: ['A319', 'A320', 'A20N', 'A321', 'A21N', 'A332', 'A333', 'A359', 'B738', 'B38M', 'B77W', 'B788', 'B789', 'C919'],
  DL: ['A319', 'A320', 'A20N', 'A321', 'A21N', 'A332', 'A333', 'A339', 'A359', 'B717', 'B738', 'B739', 'B752', 'B753', 'B763', 'B764', 'CRJ7', 'E75W'],
  F9: ['A320', 'A20N', 'A321', 'A21N'],
  FM: ['B738', 'B763', 'B789'],
  HO: ['A320', 'A20N', 'A321', 'A21N', 'B789'],
  JL: ['A359', 'A35K', 'B738', 'B763', 'B772', 'B77W', 'B788', 'B789'],
  JT: ['A333', 'B738', 'B739', 'B38M', 'B39M'],
  JX: ['A21N', 'A339', 'A359'],
  KN: ['B738', 'B38M', 'C909'],
  MH: ['A332', 'A333', 'A359', 'B738', 'B744', 'B772'],
  MM: ['A20N', 'A21N'],
  MU: ['A306', 'A319', 'A320', 'A20N', 'A321', 'A21N', 'A332', 'A333', 'A359', 'B737', 'B738', 'B789', 'B77W', 'C919'],
  NH: ['A20N', 'A321', 'A21N', 'A388', 'B738', 'B763', 'B772', 'B77W', 'B788', 'B789', 'B78X'],
  OS: ['A320', 'A20N', 'A321', 'B763', 'B772', 'B789'],
  SC: ['B738', 'B38M'],
  SQ: ['A359', 'A388', 'B738', 'B77W', 'B788', 'B789', 'B78X'],
  U2: ['A319', 'A320', 'A20N', 'A321', 'A21N'],
  UA: ['A319', 'A320', 'A21N', 'B737', 'B738', 'B739', 'B38M', 'B39M', 'B752', 'B753', 'B763', 'B772', 'B77W', 'B788', 'B789', 'B78X', 'E75W'],
  VA: ['B737', 'B738', 'B38M'],
  WN: ['B737', 'B738', 'B38M'],
  XE: ['AT46', 'E75W'],
};

export const specialLiveryCatalog: Record<string, SpecialLiveryReference[]> = {
  CI: [
    { registration: 'B-18101', type: 'A21N', name: 'Pikachu Jet CI', note: 'Pokémon Air Adventures' },
  ],
  CZ: [
    { registration: 'B-1625', type: 'A321', name: 'Consumer Expo', note: 'China International Consumer Products Expo' },
  ],
  HO: [
    { registration: 'B-209R', type: 'B789', name: 'Genshin Impact', note: 'Genshin Impact themed Boeing 787-9' },
  ],
  JL: [
    { registration: 'JA615J', type: 'B763', name: 'JAL Dream Express Disney100', note: 'Walt Disney Company 100th anniversary' },
  ],
  MU: [
    { registration: 'B-5976', type: 'A333', name: 'Toy Story · Happy Holiday', note: 'Disney · Pixar themed aircraft' },
    { registration: 'B-7882', type: 'B77W', name: 'National Museum of China', note: 'National Museum of China themed aircraft' },
  ],
  NH: [
    { registration: 'JA381A', type: 'A388', name: 'FLYING HONU · Lani', note: 'Blue Hawaiian sky' },
    { registration: 'JA382A', type: 'A388', name: 'FLYING HONU · Kai', note: 'Emerald Hawaiian ocean' },
    { registration: 'JA383A', type: 'A388', name: 'FLYING HONU · La', note: 'Orange Hawaiian sunset' },
  ],
};

export const canonicalAircraftType: Record<string, string> = {
  A32N: 'A20N',
  B7M8: 'B38M',
};

export function passportAircraftType(code: string) {
  return canonicalAircraftType[code] ?? code;
}
