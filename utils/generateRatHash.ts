import { createHash } from 'crypto';
import type { RatComponents } from './ratOverride.js';

/**
 * Generate a SHA256 hash from RAT components
 * @param components - RAT component data object
 * @returns 64-character hexadecimal SHA256 hash string
 */
export function generateRatHash(components: RatComponents): string {
  const normalized = JSON.stringify(components, Object.keys(components).sort());
  return createHash('sha256')
    .update(normalized)
    .digest('hex');
}
