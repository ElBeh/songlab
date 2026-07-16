/** ArrayBuffer → Base64 string.
 *  Converts in chunks: per-byte string concatenation creates huge numbers of
 *  intermediate strings (GP/audio files reach multi-MB sizes in export/sync),
 *  while a single String.fromCharCode(...allBytes) would overflow the
 *  argument limit. 32 KiB chunks are safe for all engines. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32 KiB
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(''));
}

/** Base64 string → ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
