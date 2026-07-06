import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
}

function isUnsafeIPv4(address: string) {
  const octets = address.split('.').map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [first, second] = octets;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && (second === 0 || second === 168)) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first >= 224) return true;
  return false;
}

function isUnsafeIPv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.includes('.')) {
    const segments = normalized.split(':');
    const mappedIPv4 = segments[segments.length - 1];
    if (mappedIPv4 && isIP(mappedIPv4) === 4) return isUnsafeIPv4(mappedIPv4);
  }

  const firstSegment = Number.parseInt(normalized.split(':')[0] || '0', 16);
  if (!Number.isFinite(firstSegment)) return true;
  if ((firstSegment & 0xfe00) === 0xfc00) return true;
  if ((firstSegment & 0xffc0) === 0xfe80) return true;
  if ((firstSegment & 0xff00) === 0xff00) return true;
  return false;
}

function isUnsafeIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isUnsafeIPv4(address);
  if (version === 6) return isUnsafeIPv6(address);
  return true;
}

function isBlockedHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')
  );
}

export function normalizeUrlBase(value: string) {
  return value.replace(/\/+$/, '');
}

export function validateHttpUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  const hostname = normalizeHostname(url.hostname);
  if (isBlockedHostname(hostname) || (isIP(hostname) && isUnsafeIpAddress(hostname))) {
    throw new Error(`${label} must not target local or private network addresses`);
  }
  return url;
}

export async function assertSafeOutboundUrl(value: string, label: string) {
  const url = validateHttpUrl(value, label);
  const hostname = normalizeHostname(url.hostname);
  if (isIP(hostname)) return;

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((address) => isUnsafeIpAddress(address.address))) {
    throw new Error(`${label} must not resolve to local or private network addresses`);
  }
}
