/**
 * Image generation endpoint handler
 */

import { Env, ImageGenerationRequest } from '../types';
import { OneMinApiService } from '../services';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { IMAGE_GENERATION_MODELS, DEFAULT_IMAGE_MODEL } from '../constants';

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

      // Set default model if not provided (matching Python version)
      const model = requestBody.model || DEFAULT_IMAGE_MODEL;

      // Validate model supports image generation
      if (!IMAGE_GENERATION_MODELS.includes(model)) {
        return createErrorResponse(`Model '${model}' does not support image generation`, 400, 'invalid_request_error', 'model_not_supported');
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
    // Use resultObject from the API response (matching Python version)
    const imageUrls = data.aiRecord?.aiRecordDetail?.resultObject;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error('No image URLs found in API response');
    }

    return {
      created: Math.floor(Date.now() / 1000),
      data: imageUrls.map(url => ({ url }))
    };
  }
}
