/**
 * Environment variables interface for Cloudflare Workers
 */
export interface Env {
  // API URLs for 1min.ai services
  ONE_MIN_API_URL: string;
  ONE_MIN_CONVERSATION_API_URL: string;
  ONE_MIN_CONVERSATION_API_STREAMING_URL: string;
  ONE_MIN_ASSET_URL: string;

  // KV Namespace for rate limiting
  RATE_LIMIT_STORE?: KVNamespace;
}
