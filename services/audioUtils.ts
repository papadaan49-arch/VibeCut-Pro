import { Blob } from '@google/genai';

export const PCM_SAMPLE_RATE_INPUT = 16000;
export const PCM_SAMPLE_RATE_OUTPUT = 24000;

// Convert Float32Array (from AudioContext) to PCM Int16 ArrayBuffer
export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

// Convert Int16 PCM ArrayBuffer to Float32Array (for AudioContext)
export function pcm16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32[i] = int16Array[i] / 32768.0;
  }
  return float32;
}

// Base64 Encode
export function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 Decode
export function base64Decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Create a Blob object compatible with Google GenAI Live Input
export function createPcmBlob(data: Float32Array): Blob {
  const int16Buffer = floatTo16BitPCM(data);
  const uint8 = new Uint8Array(int16Buffer);
  return {
    data: base64Encode(uint8),
    mimeType: `audio/pcm;rate=${PCM_SAMPLE_RATE_INPUT}`,
  };
}

export async function decodeAudioData(
  base64String: string,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const uint8Data = base64Decode(base64String);
  const int16Data = new Int16Array(uint8Data.buffer);
  const float32Data = pcm16ToFloat32(int16Data);
  
  const buffer = ctx.createBuffer(1, float32Data.length, PCM_SAMPLE_RATE_OUTPUT);
  buffer.getChannelData(0).set(float32Data);
  return buffer;
}