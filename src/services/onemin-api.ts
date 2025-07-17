/**
 * 1min.ai API service layer
 */

import { Env, OneMinImageResponse } from '../types';
import { processImageUrl, uploadImageToAsset, isVisionSupportedModel } from '../utils/image';

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

  async buildChatRequestBody(messages: any[], model: string, apiKey: string, temperature?: number, maxTokens?: number): Promise<any> {
    // Process images and check for vision model support
    const imagePaths: string[] = [];
    let hasImageRequests = false;
    let allImagesUploaded = true;

    // Process messages to extract images and check for vision support
    for (const message of messages || []) {
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            hasImageRequests = true;

            // Check if model supports vision inputs
            if (!isVisionSupportedModel(model)) {
              throw new Error(`Model '${model}' does not support image inputs`);
            }

            try {
              // Process and upload image
              console.log('Processing image URL:', item.image_url.url.substring(0, 50) + '...');
              const imageData = await processImageUrl(item.image_url.url);
              console.log('Image data processed, size:', imageData.byteLength);
              const imagePath = await uploadImageToAsset(imageData, apiKey, this.env.ONE_MIN_ASSET_URL);
              console.log('Image uploaded successfully, path:', imagePath);
              imagePaths.push(imagePath);
            } catch (error) {
              console.error('Error processing image:', error);
              allImagesUploaded = false;
              // Continue processing other images
            }
          }
        }
      }
    }

    // Format messages for the API call
    const formattedHistory = formatConversationHistory(messages, "");

    console.log('Image processing summary:', {
      hasImageRequests,
      allImagesUploaded,
      imagePathsCount: imagePaths.length,
      requestType: hasImageRequests && allImagesUploaded && imagePaths.length > 0 ? 'CHAT_WITH_IMAGE' : 'CHAT_WITH_AI'
    });

    // Only use CHAT_WITH_IMAGE if we have image requests AND all images were successfully uploaded
    if (hasImageRequests && allImagesUploaded && imagePaths.length > 0) {
      return {
        type: "CHAT_WITH_IMAGE",
        model: model,
        promptObject: {
          prompt: formattedHistory,
          isMixed: false,
          imageList: imagePaths
        }
      };
    } else {
      return {
        type: "CHAT_WITH_AI",
        model: model,
        promptObject: {
          prompt: formattedHistory,
          isMixed: false,
          webSearch: false
        }
      };
    }
  }

  async buildStreamingChatRequestBody(messages: any[], model: string, apiKey: string, temperature?: number, maxTokens?: number): Promise<any> {
    // Process images and check for vision model support
    const imagePaths: string[] = [];
    let hasImageRequests = false;
    let allImagesUploaded = true;

    // Process messages to extract images and check for vision support
    for (const message of messages || []) {
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            hasImageRequests = true;

            // Check if model supports vision inputs
            if (!isVisionSupportedModel(model)) {
              throw new Error(`Model '${model}' does not support image inputs`);
            }

            try {
              // Process and upload image
              const imageData = await processImageUrl(item.image_url.url);
              const imagePath = await uploadImageToAsset(imageData, apiKey, this.env.ONE_MIN_ASSET_URL);
              imagePaths.push(imagePath);
            } catch (error) {
              console.error('Error processing image:', error);
              allImagesUploaded = false;
              // Continue processing other images
            }
          }
        }
      }
    }

    // Format messages for the API call
    const formattedHistory = formatConversationHistory(messages, "");

    // Only use CHAT_WITH_IMAGE if we have image requests AND all images were successfully uploaded
    if (hasImageRequests && allImagesUploaded && imagePaths.length > 0) {
      return {
        type: "CHAT_WITH_IMAGE",
        model: model,
        promptObject: {
          prompt: formattedHistory,
          isMixed: false,
          imageList: imagePaths
        }
      };
    } else {
      return {
        type: "CHAT_WITH_AI",
        model: model,
        promptObject: {
          prompt: formattedHistory,
          isMixed: false,
          webSearch: false
        }
      };
    }
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
