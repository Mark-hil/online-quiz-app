export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(statusCode: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  skipAuthRedirect?: boolean;
}

async function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    try {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        headers.set('Authorization', `Bearer ${storedToken}`);
      }
    } catch {}
  }

  // Include httpOnly session cookie
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  const response = await fetch(url, fetchOptions);

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || response.statusText || 'An unexpected error occurred';

    // Handle 401 session expiration
    if (response.status === 401 && !options.skipAuthRedirect && typeof window !== 'undefined') {
      const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
      const currentPath = window.location.pathname;
      const isPublic = publicPaths.some(p => currentPath.startsWith(p));

      if (!isPublic) {
        window.dispatchEvent(new CustomEvent('auth:session_expired'));
        // Optional redirect to login
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    throw new ApiError(response.status, errorMessage, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),

  put: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),

  patch: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),

  delete: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};
