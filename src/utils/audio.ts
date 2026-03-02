/**
 * Audio file processing utilities for Whisper API support
 */

import {
  MAX_AUDIO_FILE_SIZE,
  SUPPORTED_AUDIO_MIME_TYPES,
} from "../constants/config";
import type { AudioResponseFormat, ParsedAudioFormData } from "../types";
import { ApiError, ValidationError } from "./errors";

export interface AudioData {
  data: ArrayBuffer;
  mimeType: string;
  filename: string;
}

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac",
};

const VALID_RESPONSE_FORMATS = new Set<string>([
  "json",
  "text",
  "srt",
  "verbose_json",
  "vtt",
]);

export function audioMimeToExtension(mimeType: string): string {
  const ext = AUDIO_MIME_TO_EXT[mimeType];
  if (!ext) {
    console.warn(`Unknown audio MIME type "${mimeType}", defaulting to .mp3`);
  }
  return ext ?? ".mp3";
}

/**
 * Validates an audio file's size and MIME type
 */
export function validateAudioFile(file: File): void {
  if (file.size > MAX_AUDIO_FILE_SIZE) {
    throw new ValidationError(
      `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum of 25MB`,
      "file",
    );
  }

  // Check MIME type if available (some clients may not set it)
  if (file.type && !SUPPORTED_AUDIO_MIME_TYPES.has(file.type)) {
    throw new ValidationError(
      `Unsupported audio format: ${file.type}. Supported formats: mp3, mp4, m4a, wav, webm, ogg, flac`,
      "file",
    );
  }
}

/**
 * Uploads audio file to 1min.ai asset API
 * Follows the same pattern as uploadImageToAsset in image.ts
 */
export async function uploadAudioToAsset(
  audioData: AudioData,
  apiKey: string,
  assetUrl: string,
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([audioData.data], { type: audioData.mimeType });

  formData.append("asset", blob, audioData.filename);

  const response = await fetch(assetUrl, {
    method: "POST",
    headers: {
      "API-KEY": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const rawError = await response.text().catch(() => "(unreadable)");
    console.error(
      "Audio upload failed:",
      response.status,
      rawError.slice(0, 500),
    );
    throw new ApiError("Failed to upload audio file", response.status);
  }

  const result = (await response.json()) as { fileContent?: { path: string } };

  if (!result.fileContent?.path) {
    throw new Error("No audio path returned from asset API");
  }

  return result.fileContent.path;
}

/**
 * Parses multipart/form-data from an audio transcription/translation request
 */
export async function parseAudioFormData(
  request: Request,
): Promise<ParsedAudioFormData> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ValidationError(
      "Request body must be multipart/form-data",
      "file",
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    throw new ValidationError(
      "file is required and must be an audio file",
      "file",
    );
  }

  const model = formData.get("model");
  if (!model || typeof model !== "string") {
    throw new ValidationError("model is required", "model");
  }

  const language = formData.get("language");
  const prompt = formData.get("prompt");
  const responseFormat = formData.get("response_format");
  const temperature = formData.get("temperature");

  // Validate response_format
  if (
    responseFormat &&
    typeof responseFormat === "string" &&
    !VALID_RESPONSE_FORMATS.has(responseFormat)
  ) {
    throw new ValidationError(
      `Invalid response_format: ${responseFormat}. Must be one of: json, text, srt, verbose_json, vtt`,
      "response_format",
    );
  }

  // Validate temperature range (skip empty string from form submissions)
  const temperatureStr =
    typeof temperature === "string" && temperature !== "" ? temperature : null;
  if (temperatureStr !== null) {
    const tempNum = Number(temperatureStr);
    if (Number.isNaN(tempNum) || tempNum < 0 || tempNum > 1) {
      throw new ValidationError(
        "temperature must be a number between 0 and 1",
        "temperature",
      );
    }
  }

  return {
    file,
    model: model.trim(),
    language:
      language && typeof language === "string" ? language.trim() : undefined,
    prompt: prompt && typeof prompt === "string" ? prompt.trim() : undefined,
    responseFormat:
      responseFormat && typeof responseFormat === "string"
        ? (responseFormat as AudioResponseFormat)
        : "json",
    temperature: temperatureStr !== null ? Number(temperatureStr) : undefined,
  };
}
