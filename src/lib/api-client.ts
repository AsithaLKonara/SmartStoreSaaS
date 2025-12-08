/**
 * API Client with retry logic and timeout handling
 * 
 * This utility provides a robust fetch wrapper that:
 * - Retries failed requests automatically
 * - Handles timeouts gracefully
 * - Includes credentials for authenticated requests
 * - Provides better error messages
 */

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Fetch with retry logic and timeout
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout and retries
 * @returns Promise<Response>
 * @throws Error if all retries fail
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 10000, // 10 seconds default timeout
    retries = 3, // 3 retries by default
    retryDelay = 1000, // 1 second delay between retries
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          credentials: 'include', // Ensure cookies are sent for authentication
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If response is OK, return it
        if (response.ok) {
          return response;
        }

        // If it's a 401/403, don't retry (auth issue)
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
        }

        // For other errors, throw to trigger retry
        if (attempt < retries - 1) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Last attempt, return the response even if not OK
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // If it's an abort (timeout), throw immediately
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        
        throw error;
      }
    } catch (error: any) {
      lastError = error;

      // Don't retry on authentication errors
      if (error.message?.includes('Authentication failed')) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === retries - 1) {
        throw new Error(
          `Failed to fetch ${url} after ${retries} attempts: ${error.message}`
        );
      }

      // Wait before retrying (exponential backoff)
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error(`Failed to fetch ${url}`);
}

/**
 * Fetch JSON with retry logic
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise<T> - Parsed JSON response
 */
export async function fetchJSON<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}

/**
 * Fetch with error handling wrapper
 * 
 * Wraps fetchWithRetry with better error messages and logging
 */
export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  try {
    return await fetchWithRetry(url, options);
  } catch (error: any) {
    console.error(`[API Client] Failed to fetch ${url}:`, error.message);
    throw error;
  }
}

