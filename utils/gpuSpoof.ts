/**
 * GPU Fingerprinting Spoofing Utility
 * For security research and educational purposes
 */

export type IPhoneDevice =
  | 'iphone-11'
  | 'iphone-12'
  | 'iphone-12-pro'
  | 'iphone-13'
  | 'iphone-13-pro'
  | 'iphone-13-pro-max'
  | 'iphone-14'
  | 'iphone-14-pro'
  | 'iphone-14-pro-max'
  | 'iphone-15'
  | 'iphone-15-pro'
  | 'iphone-15-pro-max'
  | 'custom';

export interface GPUSpec {
  vendor: string;
  renderer: string;
  vendorMasked: string;
  rendererMasked: string;
  webglVendor: string;
  webglRenderer: string;
}

export interface CustomGPUSpec extends GPUSpec {
  maxTextureSize?: number;
  maxViewportDims?: [number, number];
}

/**
 * iPhone GPU specifications based on actual device hardware
 */
const IPHONE_GPU_PROFILES: Record<Exclude<IPhoneDevice, 'custom'>, GPUSpec> = {
  'iphone-11': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-12': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A14 Bionic)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-12-pro': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A14 Bionic)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-13': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A15 Bionic)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-13-pro': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A15 Bionic - 5-core GPU)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-13-pro-max': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A15 Bionic - 5-core GPU)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-14': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A15 Bionic)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-14-pro': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A16 Bionic - 5-core GPU)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-14-pro-max': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A16 Bionic - 5-core GPU)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-15': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A16 Bionic)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-15-pro': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A17 Pro - 6-core GPU)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  },

  'iphone-15-pro-max': {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU (A17 Pro - 6-core GPU)',
    vendorMasked: 'Apple',
    rendererMasked: 'Apple GPU',
    webglVendor: 'Apple',
    webglRenderer: 'Apple GPU'
  }
};

/**
 * Generate GPU spoofing script for Playwright
 * @param device - iPhone device type or 'custom' with custom spec
 * @param customSpec - Custom GPU spec (only used when device='custom')
 */
export function createGPUSpoofScript(
  device: IPhoneDevice = 'iphone-13',
  customSpec?: CustomGPUSpec
): string {
  const spec = device === 'custom' ? customSpec! : IPHONE_GPU_PROFILES[device];

  if (!spec) {
    throw new Error(`Unknown device: ${device}`);
  }

  return `
    (function() {
      'use strict';

      // Store original functions
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      const originalGetExtension = WebGLRenderingContext.prototype.getExtension;

      // GPU spoofing data
      const SPOOF_GPU = ${JSON.stringify(spec)};

      // Override getParameter to return fake GPU info
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL = 37445
        if (parameter === 37445) {
          return SPOOF_GPU.vendor;
        }
        // UNMASKED_RENDERER_WEBGL = 37446
        if (parameter === 37446) {
          return SPOOF_GPU.renderer;
        }
        // VENDOR = 7937
        if (parameter === 7937) {
          return SPOOF_GPU.vendorMasked;
        }
        // RENDERER = 7938
        if (parameter === 7938) {
          return SPOOF_GPU.rendererMasked;
        }
        // WEBGL_VENDOR = 7936 (some implementations)
        if (parameter === 7936) {
          return SPOOF_GPU.webglVendor;
        }
        // WEBGL_RENDERER = 7937 (some implementations)
        if (parameter === 7937 && this.VENDOR === 7936) {
          return SPOOF_GPU.webglRenderer;
        }

        // Return original for other parameters
        return originalGetParameter.call(this, parameter);
      };

      // Override getExtension to provide WEBGL_debug_renderer_info
      WebGLRenderingContext.prototype.getExtension = function(name) {
        if (name === 'WEBGL_debug_renderer_info') {
          return {
            UNMASKED_VENDOR_WEBGL: 37445,
            UNMASKED_RENDERER_WEBGL: 37446
          };
        }
        return originalGetExtension.call(this, name);
      };

      // Apply same overrides to WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getExtension = WebGLRenderingContext.prototype.getExtension;
      }

      // Additional anti-detection: hide that we've modified the prototype
      Object.defineProperty(WebGLRenderingContext.prototype.getParameter, 'name', {
        value: 'getParameter',
        writable: false,
        configurable: false
      });

      Object.defineProperty(WebGLRenderingContext.prototype.getExtension, 'name', {
        value: 'getExtension',
        writable: false,
        configurable: false
      });

    })();
  `.trim();
}

/**
 * List all available device profiles
 */
export function listAvailableDevices(): IPhoneDevice[] {
  return Object.keys(IPHONE_GPU_PROFILES) as IPhoneDevice[];
}

/**
 * Get GPU spec for a device without generating script
 */
export function getDeviceGPUSpec(device: IPhoneDevice): GPUSpec | null {
  if (device === 'custom') {
    return null;
  }
  return IPHONE_GPU_PROFILES[device] || null;
}

export default {
  createGPUSpoofScript,
  listAvailableDevices,
  getDeviceGPUSpec
};
