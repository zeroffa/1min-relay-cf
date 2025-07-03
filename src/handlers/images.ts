/**
 * Image generation endpoint handler
 */

import { Env, ImageGenerationRequest } from '../types';
import { OneMinApiService } from '../services';
import { generateUUID, createErrorResponse, createSuccessResponse } from '../utils';
import { IMAGE_GENERATION_MODELS, DEFAULT_MODEL } from '../constants';

export class ImageHandler {
  private env: Env;
  private apiService: OneMinApiService;

  constructor(env: Env) {
    this.env = env;
    this.apiService = new OneMinApiService(env);
  }

  async handleImageGeneration(request: Request, apiKey?: string): Promise<Response> {
    try {
      const requestBody: ImageGenerationRequest = await request.json();
      
      // Validate required fields
      if (!requestBody.prompt) {
        return createErrorResponse('Prompt field is required');
      }

      // Set default model if not provided
      const model = requestBody.model || 'dall-e-3';
      
      // Validate model supports image generation
      if (!IMAGE_GENERATION_MODELS.includes(model)) {
        return createErrorResponse(`Model '${model}' does not support image generation`);
      }

      const requestBodyForAPI = this.apiService.buildImageRequestBody(
        requestBody.prompt,
        model,
        requestBody.n,
        requestBody.size
      );

      try {
        const data = await this.apiService.sendImageRequest(requestBodyForAPI, apiKey);
        
        // Transform response to OpenAI format
        const openAIResponse = this.transformToOpenAIFormat(data, requestBody);
        return createSuccessResponse(openAIResponse);
      } catch (error) {
        console.error('Image generation API error:', error);
        return createErrorResponse('Failed to generate image', 500);
      }
    } catch (error) {
      console.error('Image generation error:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }

  private transformToOpenAIFormat(data: any, originalRequest: ImageGenerationRequest): any {
    // Use temporaryUrl from the API response (as per memory)
    const imageUrl = data.aiRecord?.temporaryUrl;
    
    if (!imageUrl) {
      throw new Error('No image URL found in API response');
    }

    return {
      created: Math.floor(Date.now() / 1000),
      data: [{
        url: imageUrl,
        revised_prompt: originalRequest.prompt
      }]
    };
  }
}
