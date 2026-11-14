const TOKEN_KEY = 'tehkota_auth_token';

export function getStoredAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    ...(extraHeaders || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const existingHeaders = (init.headers as Record<string, string>) || {};
  const mergedHeaders = getAuthHeaders(existingHeaders);

  return fetch(input, {
    ...init,
    cache: init.cache || 'no-store',
    headers: mergedHeaders,
  });
}
