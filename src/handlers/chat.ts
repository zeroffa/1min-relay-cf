/**
 * Chat completions endpoint handler
 */

import { Env, ChatCompletionRequest } from '../types';
import { OneMinApiService } from '../services';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { extractImageFromContent, isVisionSupportedModel } from '../utils/image';
import { ALL_ONE_MIN_AVAILABLE_MODELS, DEFAULT_MODEL } from '../constants';

export class ChatHandler {
  private env: Env;
  private apiService: OneMinApiService;

  constructor(env: Env) {
    this.env = env;
    this.apiService = new OneMinApiService(env);
  }

  async handleChatCompletions(request: Request): Promise<Response> {
    try {
      const requestBody: ChatCompletionRequest = await request.json();
      return await this.handleChatCompletionsWithBody(requestBody, "");
    } catch (error) {
      console.error('Chat completion error:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }

  async handleChatCompletionsWithBody(requestBody: ChatCompletionRequest, apiKey: string): Promise<Response> {
    try {
      // Validate required fields
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        return createErrorResponse('Messages field is required and must be an array');
      }

      // Set default model if not provided
      const model = requestBody.model || DEFAULT_MODEL;

      // Validate model
      if (!ALL_ONE_MIN_AVAILABLE_MODELS.includes(model)) {
        return createErrorResponse(`The model '${model}' does not exist`, 400, 'invalid_request_error', 'model_not_found');
      }

      // Check for images and validate vision model support
      const hasImages = this.checkForImages(requestBody.messages);
      if (hasImages && !isVisionSupportedModel(model)) {
        return createErrorResponse(`Model '${model}' does not support image inputs`, 400, 'invalid_request_error', 'model_not_supported');
      }

      // Process messages and extract images if any
      const processedMessages = this.processMessages(requestBody.messages);

      // Handle streaming vs non-streaming
      if (requestBody.stream) {
        return this.handleStreamingChat(processedMessages, model, requestBody.temperature, requestBody.max_tokens, apiKey);
      } else {
        return this.handleNonStreamingChat(processedMessages, model, requestBody.temperature, requestBody.max_tokens, apiKey);
      }
    } catch (error) {
      console.error('Chat completion error:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }

  private checkForImages(messages: any[]): boolean {
    for (const message of messages) {
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private processMessages(messages: any[]): any[] {
    return messages.map(message => {
      // Handle vision inputs
      if (Array.isArray(message.content)) {
        const imageUrl = extractImageFromContent(message.content);
        if (imageUrl) {
          // Convert to format expected by 1min.ai API
          return {
            ...message,
            content: message.content.map((item: any) => {
              if (item.type === 'image_url') {
                return {
                  type: 'image_url',
                  image_url: { url: item.image_url.url }
                };
              }
              return item;
            })
          };
        }
      }
      return message;
    });
  }

  private async handleNonStreamingChat(
    messages: any[],
    model: string,
    temperature?: number,
    maxTokens?: number,
    apiKey?: string
  ): Promise<Response> {
    try {
      const requestBody = await this.apiService.buildChatRequestBody(messages, model, apiKey || '', temperature, maxTokens);

      const response = await this.apiService.sendChatRequest(requestBody, false, apiKey);
      const data = await response.json();

      // Transform response to OpenAI format
      const openAIResponse = this.transformToOpenAIFormat(data, model);
      return createSuccessResponse(openAIResponse);
    } catch (error) {
      console.error('Non-streaming chat error:', error);
      return createErrorResponse('Failed to process chat completion', 500);
    }
  }

  private async handleStreamingChat(
    messages: any[],
    model: string,
    temperature?: number,
    maxTokens?: number,
    apiKey?: string
  ): Promise<Response> {
    try {
      const requestBody = await this.apiService.buildChatRequestBody(messages, model, apiKey || '', temperature, maxTokens);

      const response = await this.apiService.sendChatRequest(requestBody, true, apiKey);

      // Create streaming response following original implementation
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // Process the stream
      const reader = response.body?.getReader();
      if (!reader) {
        await writer.close();
        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // Start streaming process (don't await, let it run in background)
      (async () => {
        try {
          let allChunks = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            allChunks += chunk;

            // Format chunk as OpenAI SSE
            const returnChunk = {
              id: `chatcmpl-${crypto.randomUUID()}`,
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

            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(returnChunk)}\n\n`));
          }

          // Send final chunk
          const finalChunk = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "stop",
              },
            ],
          };

          await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
          await writer.close();
        } catch (error) {
          console.error('Streaming error:', error);
          await writer.abort(error);
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } catch (error) {
      console.error('Streaming chat error:', error);
      return createErrorResponse('Failed to process streaming chat completion', 500);
    }
  }

  private transformToOpenAIFormat(data: any, model: string): any {
    return {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.aiRecord?.aiRecordDetail?.resultObject?.[0] || data.content || 'No response generated'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0
      }
    };
  }

  private transformStreamChunkToOpenAI(data: any, model: string): any {
    return {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: {
          content: data.content || data.aiRecord?.aiRecordDetail?.resultObject?.[0] || ''
        },
        finish_reason: data.finish_reason || null
      }]
    };
  }
}
