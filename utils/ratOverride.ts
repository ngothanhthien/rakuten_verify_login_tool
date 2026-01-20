/**
 * RatOverride Utility
 *
 * Overrides the RAT (fingerprint) field in /gc and /start requests
 * with a custom fingerprint object.
 */

export interface RatComponent {
  value: any;
  duration?: number;
}

export interface RatComponents {
  fonts?: RatComponent;
  domBlockers?: RatComponent;
  fontPreferences?: RatComponent;
  audio?: RatComponent;
  screenFrame?: RatComponent;
  osCpu?: RatComponent;
  languages?: RatComponent;
  colorDepth?: RatComponent;
  deviceMemory?: RatComponent;
  screenResolution?: RatComponent;
  hardwareConcurrency?: RatComponent;
  timezone?: RatComponent;
  sessionStorage?: RatComponent;
  localStorage?: RatComponent;
  indexedDB?: RatComponent;
  openDatabase?: RatComponent;
  cpuClass?: RatComponent;
  platform?: RatComponent;
  plugins?: RatComponent;
  touchSupport?: RatComponent;
  vendor?: RatComponent;
  vendorFlavors?: RatComponent;
  cookiesEnabled?: RatComponent;
  colorGamut?: RatComponent;
  invertedColors?: RatComponent;
  forcedColors?: RatComponent;
  monochrome?: RatComponent;
  contrast?: RatComponent;
  reducedMotion?: RatComponent;
  hdr?: RatComponent;
  math?: RatComponent;
  videoCard?: RatComponent;
  pdfViewerEnabled?: RatComponent;
  architecture?: RatComponent;
  [key: string]: RatComponent | undefined;
}

export interface CustomRat {
  components: RatComponents;
  hash: string;
  hashesOther?: {
    hashHardware?: string;
  };
}

/**
 * Generate the RatOverride injection script
 * This script is injected into the page to intercept and modify RAT requests
 */
export function createRatOverrideScript(customRat: CustomRat): string {
  return `
    (function() {
      window.RatOverride = {
        enabled: true,
        customRat: ${JSON.stringify(customRat)},
        log: false,
        requestsModified: 0,

        setCustomRat(ratObject) {
          this.customRat = ratObject;
          if (this.log) console.log('[RatOverride] Custom RAT set:', ratObject?.hash);
        },

        setEnabled(enabled) {
          this.enabled = enabled;
          if (this.log) console.log('[RatOverride] Override', enabled ? 'ENABLED' : 'DISABLED');
        },

        getStats() {
          return {
            enabled: this.enabled,
            customRatSet: !!this.customRat,
            requestsModified: this.requestsModified
          };
        },

        clear() {
          this.customRat = null;
          if (this.log) console.log('[RatOverride] Custom RAT cleared');
        }
      };

      // Intercept XMLHttpRequest
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
      let currentUrl = '';

      XMLHttpRequest.prototype.open = function(method, url) {
        currentUrl = url;
        return origOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body) {
        if (
          (currentUrl.includes('/gc') || currentUrl.includes('/start')) &&
          window.RatOverride.enabled &&
          window.RatOverride.customRat
        ) {
          try {
            const parsed = JSON.parse(body);
            const originalHash = parsed.rat?.hash;

            // Replace entire rat with custom
            parsed.rat = window.RatOverride.customRat;
            window.RatOverride.requestsModified++;

            if (window.RatOverride.log) {
              console.log('[RatOverride] Request Modified:', {
                url: currentUrl,
                originalHash: originalHash,
                newHash: parsed.rat.hash,
                totalModified: window.RatOverride.requestsModified
              });
            }

            arguments[0] = JSON.stringify(parsed);
          } catch (e) {
            // If parsing fails, continue with original
          }
        }
        return origSend.apply(this, arguments);
      };

      // Also intercept fetch API
      const origFetch = window.fetch;
      window.fetch = async function(...args) {
        const url = args[0];
        const options = args[1] || {};

        if (
          typeof url === 'string' &&
          (url.includes('/gc') || url.includes('/start')) &&
          window.RatOverride.enabled &&
          window.RatOverride.customRat &&
          options.body
        ) {
          try {
            const parsed = JSON.parse(options.body);
            const originalHash = parsed.rat?.hash;

            parsed.rat = window.RatOverride.customRat;
            options.body = JSON.stringify(parsed);
            window.RatOverride.requestsModified++;

            if (window.RatOverride.log) {
              console.log('[RatOverride] Fetch Request Modified:', {
                url: url,
                originalHash: originalHash,
                newHash: parsed.rat.hash
              });
            }
          } catch (e) {
            // If parsing fails, continue with original
          }
        }

        return origFetch.apply(this, args);
      };
    })();
  `;
}
