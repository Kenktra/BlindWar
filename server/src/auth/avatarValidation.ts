/**
 * Strict validation for uploaded profile avatar images.
 *
 * Security checks (§4.1 & §8):
 * - Allows strictly raster base64 data URLs (`image/png`, `image/jpeg`, `image/webp`).
 * - Blocks SVG, HTML, scripts, external URLs, or unrecognized MIME types.
 * - Limits decoded byte size to 256 KB (262,144 bytes).
 * - Inspects decoded binary magic bytes to defeat MIME spoofing.
 */

export const MAX_AVATAR_BYTES = 256 * 1024;
const ALLOWED_MIME_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i;

function hasValidMagicSignature(mimeSubType: string, buf: Buffer): boolean {
  if (mimeSubType === 'png') {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (mimeSubType === 'jpeg' || mimeSubType === 'jpg') {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeSubType === 'webp') {
    return (
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

/**
 * Validate an incoming avatar data URL.
 * Returns normalized `data:image/<mime>;base64,<clean>` string, or throws a French Error.
 */
export function validateAvatarImageDataUrl(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('Format d’image de profil invalide.');
  }
  const trimmed = raw.trim();
  const match = ALLOWED_MIME_REGEX.exec(trimmed);
  if (!match) {
    throw new Error(
      'Format non autorisé : importez uniquement une image PNG, JPEG ou WebP (SVG interdit).'
    );
  }

  const subType = match[1].toLowerCase();
  const cleanB64 = match[2].replace(/\s+/g, '');
  if (!cleanB64) {
    throw new Error('Image vide ou corrompue.');
  }

  // Reject clearly oversized payloads before decoding
  if (cleanB64.length > Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 16) {
    throw new Error('L’image de profil dépasse la limite maximale autorisée de 256 Ko.');
  }

  const decoded = Buffer.from(cleanB64, 'base64');
  if (decoded.length === 0 || decoded.length > MAX_AVATAR_BYTES) {
    throw new Error('L’image de profil dépasse la limite maximale autorisée de 256 Ko.');
  }

  if (!hasValidMagicSignature(subType, decoded)) {
    throw new Error(
      'Le fichier ne correspond pas à une image PNG, JPEG ou WebP authentique (signature invalide).'
    );
  }

  const canonicalMime = subType === 'jpg' ? 'jpeg' : subType;
  return `data:image/${canonicalMime};base64,${cleanB64}`;
}
