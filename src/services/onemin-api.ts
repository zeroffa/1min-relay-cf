/**
 * 1min.ai API service layer
 */

import { Env, OneMinResponse, OneMinImageResponse } from '../types';
import { generateUUID } from '../utils';

// Helper function to extract text content from message content (string or array)
function extractTextFromContent(content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>): string {
  if (typeof content === 'string') {
    return content;
  }

  // Extract text from array content
  const textParts: string[] = [];
  for (const item of content) {
    if (item.type === 'text' && item.text) {
      textParts.push(item.text);
    }
  }
  return textParts.join('\n');
}

// Helper function to format conversation for the API
// Converts message array to format expected by 1min.ai API
function formatConversationHistory(messages: any[], newInput: string = ''): string {
  let formattedHistory = "";

  for (const message of messages) {
    const role = message.role;
    const content = extractTextFromContent(message.content);

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

export class OneMinApiService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async sendChatRequest(requestBody: any, isStreaming: boolean = false, apiKey?: string): Promise<Response> {
    const apiUrl = isStreaming 
      ? this.env.ONE_MIN_CONVERSATION_API_STREAMING_URL
      : this.env.ONE_MIN_API_URL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided
    if (apiKey) {
      headers['API-KEY'] = apiKey;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`1min.ai API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async sendImageRequest(requestBody: any, apiKey?: string): Promise<OneMinImageResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided
    if (apiKey) {
      headers['API-KEY'] = apiKey;
    }

    const response = await fetch(this.env.ONE_MIN_API_URL + "?isStreaming=false", {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`1min.ai API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as OneMinImageResponse;
  }

  buildChatRequestBody(messages: any[], model: string, temperature?: number, maxTokens?: number): any {
    // Process images and check for vision model support
    const imagePaths: string[] = [];
    let hasImages = false;

    for (const message of messages || []) {
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            hasImages = true;
            // Note: Image processing would need to be implemented here
            // For now, we'll just mark that images are present
          }
        }
      }
    }

    // Format messages for the API call
    const formattedHistory = formatConversationHistory(messages, "");

    // Prepare request to 1min.ai API
    return {
      type: "CHAT_WITH_AI",
      model: model,
      promptObject: {
        prompt: formattedHistory,
        isMixed: hasImages,
        webSearch: false,
        ...(hasImages && imagePaths.length > 0 && { imagePaths })
      }
    };
  }

  buildStreamingChatRequestBody(messages: any[], model: string, temperature?: number, maxTokens?: number): any {
    // Process images and check for vision model support
    const imagePaths: string[] = [];
    let hasImages = false;

    for (const message of messages || []) {
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            hasImages = true;
            // Note: Image processing would need to be implemented here
            // For now, we'll just mark that images are present
          }
        }
      }
    }

    // Format messages for the API call
    const formattedHistory = formatConversationHistory(messages, "");

    // Prepare request to 1min.ai API
    return {
      type: "CHAT_WITH_AI",
      model: model,
      promptObject: {
        prompt: formattedHistory,
        isMixed: hasImages,
        webSearch: false,
        ...(hasImages && imagePaths.length > 0 && { imagePaths })
      }
    };
  }

  buildImageRequestBody(prompt: string, model: string, n?: number, size?: string): any {
    return {
      type: "IMAGE_GENERATOR",
      model: model,
      promptObject: {
        prompt: prompt,
        n: n ?? 1,
        size: size ?? "1024x1024"
      }
    };
  }
}
