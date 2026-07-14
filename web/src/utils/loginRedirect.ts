const DEFAULT_LOGIN_REDIRECT = '/home';

export function isSafeLoginRedirect(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function getSafeLoginRedirect(
  search: string | URLSearchParams,
  fallback = DEFAULT_LOGIN_REDIRECT
) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const redirectTarget = params.get('redirect');
  return isSafeLoginRedirect(redirectTarget) ? redirectTarget : fallback;
}

export function getCurrentRedirectPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function isOAuthAuthorizeRedirect(value: string | null | undefined): value is string {
  if (!isSafeLoginRedirect(value)) return false;

  try {
    const redirectUrl = new URL(value, window.location.origin);
    return (
      redirectUrl.pathname === '/oauth/authorize' &&
      Boolean(redirectUrl.searchParams.get('requestId'))
    );
  } catch {
    return false;
  }
}

export function getLoginPathWithRedirect(redirectPath: string = getCurrentRedirectPath()) {
  return isSafeLoginRedirect(redirectPath)
    ? `/login?redirect=${encodeURIComponent(redirectPath)}`
    : '/login';
}
