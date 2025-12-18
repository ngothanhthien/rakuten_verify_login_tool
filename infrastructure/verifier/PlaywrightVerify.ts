import { chromium } from "patchright";
import IVerifyService from "../../application/ports/IVerifyService";
import { Credential } from "../../core/entities/Credential";
import UserAgent from "user-agents"
import { sleep } from "../../utils";
import { Page } from "patchright";
import IProxyRepository from "../../core/repositories/IProxyRepository";

const LOGIN_URL = 'https://login.account.rakuten.com/sso/authorize?r10_required_claims=r10_name&r10_audience=rae&r10_guest_login=true&r10_jid_service_id=rm001&scope=openid+memberinfo_read_safebulk+memberinfo_read_point+memberinfo_get_card_token+1Hour%40Access+90days%40Refresh&response_type=code&redirect_uri=https%3A%2F%2Fportal.mobile.rakuten.co.jp%2Fauth%2Fcallback&state=redirect_uri%3Dhttps%253A%252F%252Fportal.mobile.rakuten.co.jp%252Fdashboard%26operation%3Dlogin&client_id=rmn_app_web#/sign_in';
const TEST_ACCOUNT = {
  email: 'naito5yuki9@gmail.com',
  password: 'yuki80509'
}

export default class PlaywrightVerify implements IVerifyService {
  constructor(private readonly proxyRepository: IProxyRepository) {}

  async verify(credential: Credential): Promise<boolean> {
    if (credential.password.length < 8) {
      return false;
    }

    const isDebug = process.env.AUTOMATE_DEBUG === 'true'

    const userAgentData = new UserAgent({
      deviceCategory: 'desktop',
      platform: 'Win32'
    })

    const proxy = await this.proxyRepository.rotate();

    const browser = await chromium.launch({
      channel: "chrome",
      headless: isDebug ? false : true,
      proxy: proxy ? {
        server: proxy.server,
        username: proxy.username ?? undefined,
        password: proxy.password ?? undefined,
      } : undefined,
    })
    const context = await browser.newContext({
      screen: { width: 1920, height: 1080 },
      userAgent: userAgentData.toString(),
      locale: 'en-US',
      // timezoneId: 'Asia/Tokyo'
    })
    const page = await context.newPage();

    if (isDebug) {
      await sleep(1000000000)
    }

    try {
      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      await page.locator('#user_id').fill(isDebug ? TEST_ACCOUNT.email : credential.email);
      const nextButton1 = await page.locator('[class*="button__submit"]').first();
      await nextButton1.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton1.click();
      await page.waitForLoadState('networkidle');

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
}
