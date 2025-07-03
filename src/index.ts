/**
 * Main entry point for the 1min.ai API relay worker
 * Refactored for modularity and maintainability
 */

import { Env } from './types';
import { API_ENDPOINTS } from './constants';
import { calculateTokens, createErrorResponse } from './utils';
import { extractTextFromContent } from './utils/image';
import { handleCors, RateLimiter } from './middleware';
import { handleModelsEndpoint, ChatHandler, ImageHandler } from './handlers';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    const corsResponse = handleCors(request);
    if (corsResponse) {
      return corsResponse;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize rate limiter
    const rateLimiter = new RateLimiter(env);

    try {
      // Route handling
      switch (path) {
        case '/':
          return handleRootEndpoint(request);

        case API_ENDPOINTS.MODELS:
          return handleModelsEndpoint();

        case API_ENDPOINTS.CHAT_COMPLETIONS:
          return await handleChatCompletionsWithRateLimit(request, env, rateLimiter);

        case API_ENDPOINTS.IMAGES_GENERATIONS:
          return await handleImageGenerationWithRateLimit(request, env, rateLimiter);

        default:
          return createErrorResponse('Not Found', 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return createErrorResponse('Internal Server Error', 500);
    }
  },
};

function handleRootEndpoint(request: Request): Response {
  if (request.method === 'GET') {
    return new Response(
      "Congratulations! Your API is working! You can now make requests to the API.\n\nEndpoint: " +
      new URL(request.url).origin + "/v1",
      {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  }
  return createErrorResponse('Method Not Allowed', 405);
}

async function handleChatCompletionsWithRateLimit(
  request: Request,
  env: Env,
  rateLimiter: RateLimiter
): Promise<Response> {
  try {
    // Extract and validate API key
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!apiKey) {
      return createErrorResponse('API key is required', 401);
    }

    // Parse request to calculate tokens for rate limiting
    const requestBody: any = await request.json();
    const messageText = requestBody.messages
      ?.map((msg: any) => {
        if (typeof msg.content === 'string') {
          return msg.content;
        } else if (Array.isArray(msg.content)) {
          // For mixed content (text + images), only count text tokens
          return extractTextFromContent(msg.content);
        }
        return '';
      })
      .join(' ') || '';
    const tokenCount = calculateTokens(messageText, requestBody.model);

    // Check rate limit
    const rateLimitResult = await rateLimiter.middleware(request, tokenCount);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    // Pass the parsed body and API key to the handler
    const chatHandler = new ChatHandler(env);
    return await chatHandler.handleChatCompletionsWithBody(requestBody, apiKey);
  } catch (error) {
    console.error('Chat completions error:', error);
    return createErrorResponse('Failed to process chat completion', 500);
  }
}

async function handleImageGenerationWithRateLimit(
  request: Request,
  env: Env,
  rateLimiter: RateLimiter
): Promise<Response> {
  try {
    // Check rate limit (images typically count as higher token usage)
    const rateLimitResult = await rateLimiter.middleware(request, 1000);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    const imageHandler = new ImageHandler(env);
    return await imageHandler.handleImageGeneration(request, apiKey);
  } catch (error) {
    console.error('Image generation error:', error);
    return createErrorResponse('Failed to process image generation', 500);
  }
}
