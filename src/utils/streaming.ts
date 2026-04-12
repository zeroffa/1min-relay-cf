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
 * Parse SSE content events from 1min.ai streaming response.
 * Extracts text content from `event: content\ndata: {"content":"..."}` lines.
 * Falls back to treating raw text as content for backwards compatibility.
 */
function parseSSEChunks(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    // Parse SSE data lines
    if (line.startsWith("data: ")) {
      const dataStr = line.slice(6);
      try {
        const parsed = JSON.parse(dataStr) as Record<string, unknown>;
        if (typeof parsed.content === "string" && parsed.content) {
          chunks.push(parsed.content);
        }
      } catch {
        // Not JSON — could be raw text or [DONE] marker, skip
      }
    }
  }

  return chunks;
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

      if (callbacks.onStart) {
        await callbacks.onStart(writer);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = utf8Decoder.decode(value, done);
        if (!decoded) continue;

        buffer += decoded;

        // Process complete SSE events (separated by double newlines)
        const parts = buffer.split("\n\n");
        // Keep the last part as buffer (may be incomplete)
        buffer = parts.pop() || "";

        for (const part of parts) {
          const chunks = parseSSEChunks(part);
          for (const chunk of chunks) {
            contentChunks.push(chunk);
            await callbacks.onChunk(writer, chunk);
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const chunks = parseSSEChunks(buffer);
        for (const chunk of chunks) {
          contentChunks.push(chunk);
          await callbacks.onChunk(writer, chunk);
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
