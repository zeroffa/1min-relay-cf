/**
 * Request type definitions for API endpoints
 */

export interface ChatCompletionRequest {
  model?: string;
  messages: Array<{
    role: string;
    content: string | Array<{
      type: string;
      text?: string;
      image_url?: {
        url: string;
      };
    }>;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ImageGenerationRequest {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
}
