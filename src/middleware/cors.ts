/**
 * CORS middleware
 */

import { CORS_HEADERS } from '../constants';
import { createCorsResponse } from '../utils';

export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return createCorsResponse();
  }
  return null;
}

export function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
