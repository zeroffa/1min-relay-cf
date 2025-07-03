/**
 * Model definitions and supported features
 */

// Define available models (synced with utils/constants.py)
export const ALL_ONE_MIN_AVAILABLE_MODELS = [
  // OpenAI
  "gpt-o1-pro",
  "gpt-o4-mini",
  "gpt-4.1",
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
export const VISION_SUPPORTED_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo"
];

// Define models that support code interpreter
export const CODE_INTERPRETER_SUPPORTED_MODELS = [
  "gpt-4o",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-haiku-20241022",
  "deepseek-chat",
  "deepseek-reasoner"
];

// Define models that support web search (retrieval)
export const RETRIEVAL_SUPPORTED_MODELS = [
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
export const FUNCTION_CALLING_SUPPORTED_MODELS = [
  "gpt-4",
  "gpt-3.5-turbo"
];

// Define models that support image generation (synced with utils/constants.py)
export const IMAGE_GENERATION_MODELS = [
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
export const VARIATION_SUPPORTED_MODELS = [
  "midjourney",
  "midjourney_6_1",
  "dall-e-2",
  "clipdrop"
];

// Text-to-speech models
export const TEXT_TO_SPEECH_MODELS = [
  "tts-1",
  "tts-1-hd"
];

// Speech-to-text models
export const SPEECH_TO_TEXT_MODELS = [
  "whisper-1"
];
