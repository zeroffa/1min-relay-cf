/**
 * Configuration constants
 */

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000,      // 1 minute window
  maxRequests: 60,          // Maximum 60 requests per minute
  maxTokens: 100000,        // Maximum 100k tokens per minute
};

// Default model configuration
export const DEFAULT_MODEL = "gpt-3.5-turbo";

// CORS configuration
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// API endpoints
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/v1/chat/completions',
  IMAGES_GENERATIONS: '/v1/images/generations',
  MODELS: '/v1/models',
} as const;
