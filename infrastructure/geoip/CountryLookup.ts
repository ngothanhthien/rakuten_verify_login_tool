/**
 * CountryLookup utility with fallback chain for detecting country from IP.
 *
 * Fallback chain:
 * 1. country.is - Free Cloudflare Workers API
 * 2. ipapi.co - Free API with daily limit
 * 3. geoip-lite - Local database (final fallback)
 */

const geoip = require('geoip-lite');

export interface CountryResult {
  country: string | null; // ISO 3166-1 alpha-2 code or null if all fail
  ip?: string; // The IP that was looked up (optional)
}

interface CountryIsResponse {
  country?: string;
  ip?: string;
}

interface IpapiCoResponse {
  country?: string;
  ip?: string;
}

const TIMEOUT_MS = 8000; // 8 seconds timeout for HTTP requests

export class CountryLookup {
  /**
   * Look up country for an IP address using the fallback chain.
   *
   * @param ip - IP address to look up
   * @returns Country result with ISO 3166-1 alpha-2 code or null if all fail
   */
  async lookupCountry(ip: string): Promise<CountryResult> {
    // Try country.is first
    const countryIsResult = await this.lookupCountryIs(ip);
    if (countryIsResult) {
      return countryIsResult;
    }

    // Try ipapi.co second
    const ipapiResult = await this.lookupIpapiCo(ip);
    if (ipapiResult) {
      return ipapiResult;
    }

    // Fall back to geoip-lite local database
    const geoipResult = this.lookupGeoipLite(ip);
    if (geoipResult) {
      return geoipResult;
    }

    // All methods failed
    console.warn(`[CountryLookup] All lookup methods failed for IP: ${ip}`);
    return { country: null, ip };
  }

  /**
   * Try to lookup country using country.is API.
   */
  private async lookupCountryIs(ip: string): Promise<CountryResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`https://country.is/${ip}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[CountryLookup] country.is returned status ${response.status} for IP: ${ip}`);
        return null;
      }

      const data = (await response.json()) as CountryIsResponse;
      const country = data.country || null;

      if (country) {
        console.log(`[CountryLookup] country.is success for ${ip}: ${country}`);
        return { country, ip: data.ip || ip };
      }

      console.warn(`[CountryLookup] country.is returned no country for IP: ${ip}`);
      return null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.warn(`[CountryLookup] country.is timed out for IP: ${ip}`);
      } else {
        console.warn(`[CountryLookup] country.is failed for IP ${ip}:`, (error as Error).message);
      }
      return null;
    }
  }

  /**
   * Try to lookup country using ipapi.co API.
   */
  private async lookupIpapiCo(ip: string): Promise<CountryResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[CountryLookup] ipapi.co returned status ${response.status} for IP: ${ip}`);
        return null;
      }

      const data = (await response.json()) as IpapiCoResponse;
      const country = data.country || null;

      if (country) {
        console.log(`[CountryLookup] ipapi.co success for ${ip}: ${country}`);
        return { country, ip: data.ip || ip };
      }

      console.warn(`[CountryLookup] ipapi.co returned no country for IP: ${ip}`);
      return null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.warn(`[CountryLookup] ipapi.co timed out for IP: ${ip}`);
      } else {
        console.warn(`[CountryLookup] ipapi.co failed for IP ${ip}:`, (error as Error).message);
      }
      return null;
    }
  }

  /**
   * Try to lookup country using geoip-lite local database.
   */
  private lookupGeoipLite(ip: string): CountryResult | null {
    try {
      const geo = geoip.lookup(ip);

      if (geo && geo.country) {
        console.log(`[CountryLookup] geoip-lite success for ${ip}: ${geo.country}`);
        return { country: geo.country, ip };
      }

      console.warn(`[CountryLookup] geoip-lite returned no country for IP: ${ip}`);
      return null;
    } catch (error) {
      console.warn(`[CountryLookup] geoip-lite failed for IP ${ip}:`, (error as Error).message);
      return null;
    }
  }
}

// Export singleton instance
export const countryLookup = new CountryLookup();
