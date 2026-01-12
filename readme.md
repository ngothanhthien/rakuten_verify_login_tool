Summary: How Rakuten's Login Page Detects GPU Information

  The Core Technique: WebGL + WEBGL_debug_renderer_info Extension

  The website uses the WebGL API with a specific extension to collect GPU fingerprinting data:

  // What happens under the hood:
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

  // This exposes the REAL GPU info:
  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

  Key Points:

  1. WEBGL_debug_renderer_info - This is the critical extension that unblocks access to real GPU hardware info. Without it, WebGL only returns generic values like "WebKit"
  2. Data Structure - The payload you see:
  "videoCard": {
    "value": {
      "vendor": "Google Inc. (AMD)",
      "renderer": "ANGLE (AMD, AMD Radeon Graphics...)"
    },
    "duration": 22  // Time in ms to collect this data
  }
  3. The duration field - Measures how long it took to execute the GPU query, which is used for bot detection (legitimate browsers have consistent timing)
  4. The Script - r10-challenger-0.2.1.js is Rakuten's fingerprinting/challenge script that:
    - Collects device fingerprint (GPU, canvas, audio, fonts, etc.)
    - Measures execution time for anomaly detection
    - Sends everything to /v2/login/start endpoint
