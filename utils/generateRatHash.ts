import { createHash } from 'crypto';

/**
 * Generate a SHA256 hash from RAT components
 * @param components - Any object containing RAT component data
 * @returns 64-character hexadecimal SHA256 hash string
 */
export function generateRatHash(components: any): string {
  const normalized = JSON.stringify(components, Object.keys(components).sort());
  return createHash('sha256')
    .update(normalized)
    .digest('hex');
}
