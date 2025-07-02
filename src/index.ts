/**
 * 1min-relay Cloudflare Worker
 * TypeScript implementation of the 1min.ai API relay
 */

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
  // Environment variables from wrangler.toml
  ONE_MIN_API_URL: string;
  ONE_MIN_CONVERSATION_API_URL: string;
  ONE_MIN_CONVERSATION_API_STREAMING_URL: string;
  ONE_MIN_ASSET_URL: string;
  
  // KV Namespace for rate limiting (if enabled)
  RATE_LIMIT_STORE?: KVNamespace;
}

// Define available models
const ALL_ONE_MIN_AVAILABLE_MODELS = [
  "o3-mini",
  "deepseek-chat",
  "deepseek-reasoner",
  "o1-preview",
  "o1-mini",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "claude-instant-1.2",
  "claude-2.1",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20240620",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
  "gemini-1.0-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "mistral-large-latest",
  "mistral-small-latest",
  "mistral-nemo",
  "open-mistral-7b",
  "gpt-o1-pro",
  "gpt-o4-mini",
  "gpt-4.1-nano",
  "gpt-4.1-mini",
  // Add more models as needed
];

// Define models that support vision inputs
const VISION_SUPPORTED_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo"
];

// Define models that support image generation
const IMAGE_GENERATION_MODELS = [
  "stable-image",
  "stable-diffusion-xl-1024-v1-0",
  "stable-diffusion-v1-6",
  "esrgan-v1-x2plus",
  "clipdrop",
  "midjourney",
  "midjourney_6_1",
  // Add more models as needed
];

// Helper function to generate UUID (similar to the Python uuid module)
function generateUUID(): string {
  return crypto.randomUUID();
}

// Helper function to calculate tokens (simplified version)
// Note: This is a placeholder. In a real implementation, you would need
// to use a tokenizer library or API call to calculate tokens accurately
async function calculateTokens(text: string, model: string = "DEFAULT"): Promise<number> {
  // Simplified token calculation (character count / 4 as a rough estimate)
  // In a real implementation, you would use a proper tokenizer
  return Math.ceil(text.length / 4);
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

// Format conversation history (similar to the Python function)
function formatConversationHistory(messages: any[], newInput: string): string {
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

// Transform response function (similar to the Python function)
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

// Set response headers
function setResponseHeaders(headers: Headers): void {
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Request-ID", generateUUID());
}

// Main worker fetch handler
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
    if (path === "/v1/chat/completions") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      
      try {
        const requestData = await request.json() as ChatCompletionRequest;
        
        // Check if model is valid
        const model = requestData.model || "mistral-nemo";
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
          // For streaming responses
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
          // For non-streaming responses
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
    if (path === "/v1/images/generations") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      
      try {
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
        
        // Call 1min.ai API for image generation
        const response = await fetch(env.ONE_MIN_ASSET_URL, {
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
