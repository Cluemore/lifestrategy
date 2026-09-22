export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const apiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  // `.env.development` normally supplies `/api` and Vite proxies it to the
  // FastAPI service. This fallback keeps a developer-facing configuration
  // error out of production bundles rather than silently calling the Vercel
  // frontend as if it were the API.
  if (import.meta.env.DEV) return '/api';
  throw new ApiError('VITE_API_BASE_URL is required for a production build.');
};

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number };

export async function apiRequest<T>(path: string, { body, timeoutMs = 6000, headers, ...options }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof responseBody?.detail === 'string' ? responseBody.detail : `Request failed (${response.status})`;
      throw new ApiError(detail, response.status);
    }
    return responseBody as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('The save service took too long to respond.');
    throw new ApiError('The save service is currently unavailable. Your game remains available locally.');
  } finally {
    window.clearTimeout(timeout);
  }
}
