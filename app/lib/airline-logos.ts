const vectorLogoCodes = new Set([
  '3U', 'AA', 'BA', 'CA', 'CX', 'CZ', 'DL', 'F9', 'HO', 'JL', 'JT',
  'JX', 'KN', 'MH', 'MM', 'MU', 'NH', 'OS', 'SC', 'SQ', 'U2', 'VA', 'WN',
  'DEMO',
]);

export function airlineLogoUrl(code: string) {
  const normalisedCode = code.toUpperCase();
  if (normalisedCode === '9C') return '/airline-logos/9C-mark.png?v=flighty-6';
  const extension = vectorLogoCodes.has(normalisedCode) ? 'svg' : 'png';
  return `/airline-logos/${encodeURIComponent(normalisedCode)}.${extension}?v=flighty-6`;
}
