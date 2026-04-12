/**
 * Shared streaming pipeline infrastructure
 * Eliminates duplicated TransformStream/reader/writer boilerplate across handlers
 */

import { createSSEResponse } from "./sse";
import { SimpleUTF8Decoder } from "./utf8-decoder";

export interface StreamingCallbacks {
  onStart?: (writer: WritableStreamDefaultWriter<Uint8Array>) => Promise<void>;
  onChunk: (
    writer: WritableStreamDefaultWriter<Uint8Array>,
    chunk: string,
  ) => Promise<void>;
  onEnd: (
    writer: WritableStreamDefaultWriter<Uint8Array>,
    accumulatedContent: string,
  ) => Promise<void>;
}

/**
 * Check if text looks like SSE format (contains "data: " or "event: " lines).
 */
function isSSEFormat(text: string): boolean {
  return text.includes("data: ") || text.includes("event: ");
}

/**
 * Parse SSE content events from 1min.ai streaming response.
 * Extracts text content from `data: {"content":"..."}` lines.
 * Returns null if no SSE data lines were found (caller should use raw text).
 */
function parseSSEChunks(text: string): string[] | null {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let hasDataLines = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    if (line.startsWith("data: ")) {
      hasDataLines = true;
      const dataStr = line.slice(6);
      // Skip [DONE] markers
      if (dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr) as Record<string, unknown>;
        if (typeof parsed.content === "string" && parsed.content) {
          chunks.push(parsed.content);
        }
      } catch {
        // Not JSON — treat as raw text content
        if (dataStr.trim()) {
          chunks.push(dataStr);
        }
      }
    }
  }

  return hasDataLines ? chunks : null;
}

/**
 * Execute a streaming pipeline that parses SSE events from 1min.ai.
 * The upstream response is SSE-formatted; we extract content chunks
 * and pass them to the callbacks for re-formatting into client SSE.
 */
export function executeStreamingPipeline(
  response: Response,
  callbacks: StreamingCallbacks,
): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const reader = response.body?.getReader();
  if (!reader) {
    writer.close().catch(() => {});
    return createSSEResponse(readable);
  }

  (async () => {
    try {
      const utf8Decoder = new SimpleUTF8Decoder();
      const contentChunks: string[] = [];
      let buffer = "";
      let detectedSSE: boolean | null = null; // null = not yet determined

      if (callbacks.onStart) {
        await callbacks.onStart(writer);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = utf8Decoder.decode(value, done);
        if (!decoded) continue;

        // Auto-detect format on first chunk
        if (detectedSSE === null) {
          detectedSSE = isSSEFormat(decoded);
          if (!detectedSSE) {
            console.log(
              "Streaming: raw text mode (upstream is not SSE-formatted)",
            );
          }
        }

        if (!detectedSSE) {
          // Raw text mode (legacy/fallback)
          contentChunks.push(decoded);
          await callbacks.onChunk(writer, decoded);
          continue;
        }

        // SSE mode: buffer and split on double newlines
        buffer += decoded;
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const chunks = parseSSEChunks(part);
          if (chunks) {
            for (const chunk of chunks) {
              contentChunks.push(chunk);
              await callbacks.onChunk(writer, chunk);
            }
          }
        }
      }

      // Process any remaining buffer (SSE mode only)
      if (detectedSSE && buffer.trim()) {
        const chunks = parseSSEChunks(buffer);
        if (chunks) {
          for (const chunk of chunks) {
            contentChunks.push(chunk);
            await callbacks.onChunk(writer, chunk);
          }
        }
      }

      const accumulatedContent = contentChunks.join("");
      await callbacks.onEnd(writer, accumulatedContent);
      await writer.close();
    } catch (error) {
      console.error("Streaming pipeline error:", error);
      await writer.abort(error);
    }
  })();

  return createSSEResponse(readable);
}
