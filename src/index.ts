/**
 * 1min-relay Cloudflare Worker
 * TypeScript implementation of the 1min.ai API relay
 * Features distributed rate limiting and accurate token counting
 */

import * as gptTokenizer from 'gpt-tokenizer';
import { getTokenizerForModel } from 'mistral-tokenizer-ts';

// Define interfaces for request and response data
interface ChatCompletionRequest {
  model?: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ImageGenerationRequest {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
}

interface OneMinResponse {
  aiRecord: {
    aiRecordDetail: {
      resultObject: string[];
    };
  };
}

interface OneMinImageResponse {
  images: string[];
}

// Define environment variables interface
interface Env {
  // API URLs for 1min.ai services (matching Python version)
  ONE_MIN_API_URL: string;
  ONE_MIN_CONVERSATION_API_URL: string;
  ONE_MIN_CONVERSATION_API_STREAMING_URL: string;
  ONE_MIN_ASSET_URL: string;

  // KV Namespace for rate limiting (if enabled)
  // Note: KV storage replaces memcached from the original Python version
  // The original project used memcached for distributed rate limiting
  // to share rate limit state across multiple app server instances
  // ensuring consistent enforcement regardless of which instance handles the request
  // In Cloudflare Workers, we use KV storage to achieve the same functionality
  RATE_LIMIT_STORE?: KVNamespace;
}

// Define available models (synced with utils/constants.py)
const ALL_ONE_MIN_AVAILABLE_MODELS = [
  // OpenAI
  "gpt-o1-pro",
  "gpt-o4-mini",
  "gpt-4.1-nano",
  "gpt-4.1-mini",
  "o3-mini",
  "o1-preview",
  "o1-mini",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "whisper-1", // Speech recognition
  "tts-1",     // Text-to-speech
  "tts-1-hd",  // Text-to-speech HD
  "dall-e-2",  // Image generation
  "dall-e-3",  // Image generation
  // Claude
  "claude-instant-1.2",
  "claude-2.1",
  "claude-3-5-sonnet-20240620",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
  "claude-3-5-haiku-20241022",
  // GoogleAI
  "gemini-1.0-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  // MistralAI
  "mistral-large-latest",
  "mistral-small-latest",
  "mistral-nemo",
  "pixtral-12b",
  "open-mixtral-8x22b",
  "open-mixtral-8x7b",
  "open-mistral-7b",
  // Replicate
  "meta/llama-2-70b-chat",
  "meta/meta-llama-3-70b-instruct",
  "meta/meta-llama-3.1-405b-instruct",
  // DeepSeek
  "deepseek-chat",
  "deepseek-reasoner",
  // Cohere
  "command",
  // xAI
  "grok-2",
  // Leonardo.ai models
  "phoenix",       // Leonardo.ai artistic model
  "lightning-xl",  // Leonardo.ai fast generation
  "anime-xl",      // Leonardo.ai anime style
  "diffusion-xl",  // Leonardo.ai diffusion model
  "kino-xl",       // Leonardo.ai cinematic style
  "vision-xl",     // Leonardo.ai vision model
  "albedo-base-xl",// Leonardo.ai base model
  // Midjourney
  "midjourney",    // Midjourney image generation
  "midjourney_6_1",// Midjourney v6.1
  // Flux models
  "flux-schnell",  // Flux fast generation
  "flux-dev",      // Flux development model
  "flux-pro",      // Flux professional model
  "flux-1.1-pro",  // Flux Pro v1.1
];

// Define models that support vision inputs (synced with utils/constants.py)
const VISION_SUPPORTED_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo"
];

// Define models that support code interpreter
const CODE_INTERPRETER_SUPPORTED_MODELS = [
  "gpt-4o",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-haiku-20241022",
  "deepseek-chat",
  "deepseek-reasoner"
];

// Define models that support web search (retrieval)
const RETRIEVAL_SUPPORTED_MODELS = [
  "gemini-1.0-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "o3-mini",
  "o1-preview",
  "o1-mini",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet-20240620",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
  "claude-3-5-haiku-20241022",
  "mistral-large-latest",
  "mistral-small-latest",
  "mistral-nemo",
  "pixtral-12b",
  "open-mixtral-8x22b",
  "open-mixtral-8x7b",
  "open-mistral-7b",
  "meta/llama-2-70b-chat",
  "meta/meta-llama-3-70b-instruct",
  "meta/meta-llama-3.1-405b-instruct",
  "command",
  "grok-2",
  "deepseek-chat",
  "deepseek-reasoner"
];

// Define models that support function calling
const FUNCTION_CALLING_SUPPORTED_MODELS = [
  "gpt-4",
  "gpt-3.5-turbo"
];

// Define models that support image generation (synced with utils/constants.py)
const IMAGE_GENERATION_MODELS = [
  "dall-e-3",
  "dall-e-2",
  "stable-diffusion-xl-1024-v1-0",
  "stable-diffusion-v1-6",
  "midjourney",
  "midjourney_6_1",
  "phoenix",
  "lightning-xl",
  "anime-xl",
  "diffusion-xl",
  "kino-xl",
  "vision-xl",
  "albedo-base-xl",
  "flux-schnell",
  "flux-dev",
  "flux-pro",
  "flux-1.1-pro"
];

// Models that support image variations
const VARIATION_SUPPORTED_MODELS = [
  "midjourney",
  "midjourney_6_1",
  "dall-e-2",
  "clipdrop"
];

// Text-to-speech models
const TEXT_TO_SPEECH_MODELS = [
  "tts-1",
  "tts-1-hd"
];

// Speech-to-text models
const SPEECH_TO_TEXT_MODELS = [
  "whisper-1"
];

// Helper function to generate UUID (similar to the Python uuid module)
function generateUUID(): string {
  return crypto.randomUUID();
}

// Rate limiting related interfaces and types
interface RateLimitRecord {
  timestamps: number[];
  tokenCount: number;
}

interface RateLimitConfig {
  windowMs: number;     // Time window (milliseconds)
  maxRequests: number;  // Maximum requests
  maxTokens?: number;   // Maximum tokens (optional)
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Chat completion endpoint rate limiting
  'chat': {
    windowMs: 60 * 1000,    // 1-minute window
    maxRequests: 60,         // Maximum 60 requests per minute
    maxTokens: 100000        // Maximum 100,000 tokens per minute
  },
  // Image generation endpoint rate limiting
  'image': {
    windowMs: 60 * 1000,    // 1-minute window
    maxRequests: 30          // Maximum 30 requests per minute
  },
  // Default rate limiting
  'default': {
    windowMs: 60 * 1000,    // 1-minute window
    maxRequests: 100         // Maximum 100 requests per minute
  }
};

// Helper function to calculate tokens for a given text and model
// Uses appropriate tokenizer based on model type
function calculateTokens(text: string, model: string = "DEFAULT"): number {
  try {
    // Use Mistral tokenizer for Mistral models
    if (model.includes('mistral') || model.includes('mixtral') || model.includes('pixtral')) {
      const tokenizer = getTokenizerForModel('open-mistral-7b'); // Default Mistral model
      const tokens = tokenizer.encode(text);
      return tokens.length;
    }

    // Use GPT tokenizer for all other models
    const tokens = gptTokenizer.encode(text);
    return tokens.length;
  } catch (error) {
    // Fallback to simple character-based estimation if tokenization fails
    console.error('Token calculation failed:', error);
    return Math.ceil(text.length / 4); // Rough estimate: ~4 characters per token
  }
}

// Rate limiting middleware using Cloudflare KV
// Implements distributed rate limiting with per-minute request and token limits
async function rateLimitMiddleware(
  request: Request,
  env: Env,
  endpoint: string
): Promise<Response | null> {
  if (!env.RATE_LIMIT_STORE) {
    // Skip rate limiting if KV is not configured
    return null;
  }

  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const windowStart = Math.floor(currentTime / 60) * 60; // Start of current minute

  // Create different rate limit keys for different endpoints
  const requestKey = `rate_limit:${clientIP}:${endpoint}:requests:${windowStart}`;
  const tokenKey = `rate_limit:${clientIP}:${endpoint}:tokens:${windowStart}`;

  // Rate limit configuration
  const REQUESTS_PER_MINUTE = 60;
  const TOKENS_PER_MINUTE = 10000;

  try {
    // Get current request count
    const currentRequests = parseInt(await env.RATE_LIMIT_STORE.get(requestKey) || '0');

    // Check request rate limit
    if (currentRequests >= REQUESTS_PER_MINUTE) {
      return new Response(JSON.stringify({
        error: {
          message: 'Rate limit exceeded for requests per minute',
          type: 'rate_limit_exceeded',
          code: 'requests_per_minute_exceeded'
        }
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit-Requests': REQUESTS_PER_MINUTE.toString(),
          'X-RateLimit-Remaining-Requests': '0',
          'X-RateLimit-Reset': (windowStart + 60).toString(),
          'Retry-After': '60'
        }
      });
    }

    // For chat completion requests, also check token limits
    if (endpoint === 'chat') {
      const requestBody = await request.clone().json() as ChatCompletionRequest;
      const messages = requestBody.messages || [];
      const totalTokens = messages.reduce((sum, msg) => {
        return sum + calculateTokens(msg.content, requestBody.model);
      }, 0);

      // Get current token count
      const currentTokens = parseInt(await env.RATE_LIMIT_STORE.get(tokenKey) || '0');

      // Check token rate limit
      if (currentTokens + totalTokens > TOKENS_PER_MINUTE) {
        return new Response(JSON.stringify({
          error: {
            message: 'Rate limit exceeded for tokens per minute',
            type: 'rate_limit_exceeded',
            code: 'tokens_per_minute_exceeded'
          }
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit-Tokens': TOKENS_PER_MINUTE.toString(),
            'X-RateLimit-Remaining-Tokens': Math.max(0, TOKENS_PER_MINUTE - currentTokens - totalTokens).toString(),
            'X-RateLimit-Reset': (windowStart + 60).toString(),
            'Retry-After': '60'
          }
        });
      }

      // Update token count
      await env.RATE_LIMIT_STORE.put(tokenKey, (currentTokens + totalTokens).toString(), {
        expirationTtl: 120 // Expire after 2 minutes
      });
    }

    // Update request count
    await env.RATE_LIMIT_STORE.put(requestKey, (currentRequests + 1).toString(), {
      expirationTtl: 120 // Expire after 2 minutes
    });

    return null; // No rate limit reached, continue processing request
  } catch (error) {
    console.error('Rate limiting error:', error);
    return null; // If rate limit check fails, allow request to continue
  }
}

// Helper function to format conversation for the API
// Converts message array to format expected by 1min.ai API
function formatConversationHistory(messages: any[], newInput: string = ''): string {
  let formattedHistory = "";

  for (const message of messages) {
    const role = message.role;
    const content = message.content;

    if (role === "system") {
      formattedHistory += `System: ${content}\n\n`;
    } else if (role === "user") {
      formattedHistory += `Human: ${content}\n\n`;
    } else if (role === "assistant") {
      formattedHistory += `Assistant: ${content}\n\n`;
    }
  }

  // Add the new input if provided
  if (newInput) {
    formattedHistory += `Human: ${newInput}\n\n`;
  }

  return formattedHistory;
}

// Helper function to transform the response from 1min.ai API to OpenAI format
// Converts 1min.ai response format to standard OpenAI format
function transformResponse(oneMinResponse: OneMinResponse, requestData: ChatCompletionRequest, promptTokens: number): any {
  const completionTokens = Math.ceil(oneMinResponse.aiRecord.aiRecordDetail.resultObject[0].length / 4);

  return {
    id: `chatcmpl-${generateUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestData.model || "mistral-nemo",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: oneMinResponse.aiRecord.aiRecordDetail.resultObject[0],
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}

// Helper function to handle streaming responses
// Processes streaming responses, converting 1min.ai stream data to OpenAI format
function handleStreamingResponse(response: Response, requestData: ChatCompletionRequest): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process the streaming response
  (async () => {
    try {
      const reader = response.body?.getReader();
      if (!reader) {
        await writer.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Parse each line of data
          if (line.trim() === '' || !line.startsWith('data: ')) {
            // Skip empty lines and non-data lines
            continue;
          }

          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            break;
          }

          try {
            // Parse JSON data
            const parsed = JSON.parse(data);

            // Convert to OpenAI format and send
            const openAIChunk = {
              id: `chatcmpl-${generateUUID()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: requestData.model || "mistral-nemo",
              choices: [{
                index: 0,
                delta: {
                  content: parsed.aiRecord?.aiRecordDetail?.resultObject?.[0] || ''
                },
                finish_reason: null
              }]
            };

            await writer.write(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
          } catch (e) {
            console.error('Error parsing streaming data:', e);
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Error handler function
function errorHandler(code: number, model: string | null = null, key: string | null = null): Response {
  const errors: Record<number, string> = {
    1001: "Invalid API key",
    1002: "Invalid model",
    1003: "Rate limit exceeded",
    1044: "Image generation error",
    // Add more error codes as needed
  };

  const message = errors[code] || "Unknown error";
  return new Response(JSON.stringify({ error: { message, code } }), {
    status: code === 1001 ? 401 : 400,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Set response headers
function setResponseHeaders(headers: Headers): void {
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Request-ID", generateUUID());
}

// Main request handler
// Main request processing function that routes to different handlers based on path
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle OPTIONS requests (CORS preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    // Handle root endpoint
    if (path === "/" || path === "/v1") {
      return new Response(JSON.stringify({
        status: "ok",
        message: "1min-relay Worker is running",
        version: "1.0.0",
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle models endpoint
    if (path === "/v1/models") {
      return new Response(JSON.stringify({
        object: "list",
        data: ALL_ONE_MIN_AVAILABLE_MODELS.map(model => ({
          id: model,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "1min-relay",
        })),
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle chat completions endpoint
    if (url.pathname === '/v1/chat/completions') {
      try {
        // Parse the request body
        const requestData = await request.json() as ChatCompletionRequest;
        const model = requestData.model || 'DEFAULT';
        const stream = requestData.stream || false;

        // Calculate tokens for the request (all messages)
        let totalTokens = 0;
        if (requestData.messages) {
          for (const message of requestData.messages) {
            totalTokens += calculateTokens(message.content || '', model);
          }
        }

        // Check rate limiting
        const rateLimitResponse = await rateLimitMiddleware(request, env, 'chat');
        if (rateLimitResponse) {
          return rateLimitResponse;
        }

        // Check if model is valid
        if (!ALL_ONE_MIN_AVAILABLE_MODELS.includes(model)) {
          return errorHandler(1002, model);
        }

        // Check if API key is provided
        const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
        if (!apiKey) {
          return errorHandler(1001);
        }

        // Format messages for the API call
        const messages = requestData.messages || [];
        const formattedHistory = formatConversationHistory(messages, "");

        // Calculate prompt tokens
        const promptTokens = await calculateTokens(formattedHistory, model);

        // Prepare request to 1min.ai API
        const oneMinRequest = {
          model: model,
          prompt: formattedHistory,
          temperature: requestData.temperature || 0.7,
          max_tokens: requestData.max_tokens || 1024,
          stream: requestData.stream || false,
        };

        // Handle streaming vs non-streaming requests
        if (requestData.stream) {
          // For streaming responses (matching Python version)
          const response = await fetch(env.ONE_MIN_CONVERSATION_API_STREAMING_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(oneMinRequest),
          });

          // Create a TransformStream to handle the streaming response
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();

          // Process the stream
          const reader = response.body?.getReader();
          if (!reader) {
            return errorHandler(1003);
          }

          // Start streaming process
          ctx.waitUntil((async () => {
            try {
              let allChunks = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                allChunks += chunk;

                // Format chunk as SSE
                const returnChunk = {
                  id: `chatcmpl-${generateUUID()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: chunk,
                      },
                      finish_reason: null,
                    },
                  ],
                };

                // Write the chunk to the output stream
                await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(returnChunk)}\n\n`));
              }

              // Calculate completion tokens
              const completionTokens = await calculateTokens(allChunks, model);

              // Send final chunk
              const finalChunk = {
                id: `chatcmpl-${generateUUID()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: "",
                    },
                    finish_reason: "stop",
                  },
                ],
                usage: {
                  prompt_tokens: promptTokens,
                  completion_tokens: completionTokens,
                  total_tokens: promptTokens + completionTokens,
                },
              };

              await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
              await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
              await writer.close();
            } catch (error) {
              await writer.abort(error);
            }
          })());

          // Return the readable stream as a streaming response
          return new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else {
          // For non-streaming responses (matching Python version)
          const response = await fetch(env.ONE_MIN_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(oneMinRequest),
          });

          if (!response.ok) {
            return errorHandler(response.status === 401 ? 1001 : 1003);
          }

          const oneMinResponse = await response.json() as OneMinResponse;
          const transformedResponse = transformResponse(oneMinResponse, requestData, promptTokens);

          const headers = new Headers();
          setResponseHeaders(headers);

          return new Response(JSON.stringify(transformedResponse), {
            headers,
          });
        }
      } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({ error: { message: "Internal server error", code: 500 } }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // Handle image generation endpoint
    if (url.pathname === '/v1/images/generations') {
      try {
        // Check rate limiting
        const rateLimitResponse = await rateLimitMiddleware(request, env, 'image');
        if (rateLimitResponse) {
          return rateLimitResponse;
        }

        // Parse the request body
        const requestData = await request.json() as ImageGenerationRequest;

        // Check if model is valid
        const model = requestData.model || "stable-image";
        if (!IMAGE_GENERATION_MODELS.includes(model)) {
          return errorHandler(1002, model);
        }

        // Check if API key is provided
        const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
        if (!apiKey) {
          return errorHandler(1001);
        }

        // Prepare request to 1min.ai API
        const oneMinRequest = {
          model: model,
          prompt: requestData.prompt,
          n: requestData.n || 1,
          size: requestData.size || "1024x1024",
        };

        // Call 1min.ai API for image generation (matching Python version)
        const response = await fetch(env.ONE_MIN_API_URL + "?isStreaming=false", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(oneMinRequest),
        });

        if (!response.ok) {
          return errorHandler(response.status === 401 ? 1001 : 1044);
        }

        const oneMinResponse = await response.json() as OneMinImageResponse;

        // Transform the response to match OpenAI format
        const transformedResponse = {
          created: Math.floor(Date.now() / 1000),
          data: oneMinResponse.images.map((image: string) => ({
            url: image,
            b64_json: null,
          })),
        };

        const headers = new Headers();
        setResponseHeaders(headers);

        return new Response(JSON.stringify(transformedResponse), {
          headers,
        });
      } catch (error) {
        console.error("Error processing image generation:", error);
        return new Response(JSON.stringify({ error: { message: "Internal server error", code: 500 } }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // Handle 404 for all other paths
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
