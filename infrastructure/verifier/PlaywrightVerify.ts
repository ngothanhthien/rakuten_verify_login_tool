import { chromium } from "patchright";
import IVerifyService from "../../application/ports/IVerifyService";
import { Credential } from "../../core/entities/Credential";

const LOGIN_URL = 'https://login.account.rakuten.com/sso/authorize?response_type=code&client_id=rakuten_racoupon_web&redirect_uri=https%3A%2F%2Fcoupon.rakuten.co.jp/auth/callback&scope=openid%20profile&state=%2FmyCoupon%2F%25E6%25A5%25BD%25E5%25A4%25A9%25E5%25B8%2582%25E5%25A0%25B4%3Fl-id%3Dpc_header_func_coupon&code_challenge=&code_challenge_method=&x=81&y=21&r10_jid_service_id=c23#/sign_in';

export default class PlaywrightVerify implements IVerifyService {
  async verify(credential: Credential): Promise<boolean> {
    const browser = await chromium.launch({
      channel: "chrome",
      headless: true,
    });
    const page = await browser.newPage();

    try {
      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      await page.getByRole('textbox', { name: 'Username or email' }).fill(credential.email);
      await page.getByRole('button', { name: 'Next' }).first().click();
      await page.waitForLoadState('networkidle');

      await page.waitForURL('**/sign_in/password');
      await page.getByRole('textbox', { name: 'Password' }).fill(credential.password);

      await page.waitForTimeout(1000)

      // Click the Next button - simplified without unnecessary waits
      const nextButton = page.getByRole('button', { name: 'Next' }).first();
      await nextButton.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton.click();

      // Race condition: wait for EITHER success OR failure
      // This dramatically speeds up invalid password detection
      const result = await Promise.race([
        // Success path: URL changes to coupon.rakuten.co.jp
        page.waitForURL('**/coupon.rakuten.co.jp/**', { timeout: 15000 })
          .then(() => true),

        // Fast-fail path 1: Error message appears (invalid credentials)
        page.waitForSelector('text=Username and/or password are incorrect', { timeout: 5000 })
          .then(() => false),

        // Fast-fail path 2: Page stays on password URL after 3 seconds
        page.waitForTimeout(3000).then(async () => {
          const currentUrl = page.url();
          // If still on password page after 3 seconds, it's likely a failure
          return currentUrl.includes('/sign_in/password') ? false : true;
        })
      ]);

      return result;
    } catch (e) {
      return false;
    } finally {
      await browser.close();
    }
  }
}
