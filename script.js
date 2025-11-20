// patchright here!
import { chromium } from 'patchright';

const LOGIN_URL = 'https://login.account.rakuten.com/sso/authorize?response_type=code&client_id=rakuten_racoupon_web&redirect_uri=https%3A%2F%2Fcoupon.rakuten.co.jp/auth/callback&scope=openid%20profile&state=%2FmyCoupon%2F%25E6%25A5%25BD%25E5%25A4%25A9%25E5%25B8%2582%25E5%25A0%25B4%3Fl-id%3Dpc_header_func_coupon&code_challenge=&code_challenge_method=&x=81&y=21&r10_jid_service_id=c23#/sign_in';

const EMAIL = 'takamure98@gmail.com';
const PASSWORD = '87268726ab';



async function checkLogin(email, password) {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    viewport: null,
  });
  const page = await browser.newPage();

  await page.goto(LOGIN_URL);
  await page.waitForLoadState('networkidle');

  await page.getByRole('textbox', { name: 'Username or email' }).fill(email);
  await page.getByRole('button', { name: 'Next' }).first().click();
  await page.waitForLoadState('networkidle');

  await page.waitForURL('**/sign_in/password');
  await page.getByRole('textbox', { name: 'Password' }).fill(password);

  await page.waitForTimeout(1000);

  try {
    const nextButton = page.getByRole('button', { name: 'Next' }).first();
    await nextButton.waitFor({ state: 'visible', timeout: 5000 });

    const isDisabled = await nextButton.isDisabled();
    if (isDisabled) {
      await page.waitForTimeout(2000);
    }

    await nextButton.click({ timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
  } catch (clickError) {
    try {
      await page.locator('button:has-text("Next")').first().click({ force: true, timeout: 5000 });
    } catch (altError) {
      await page.keyboard.press('Enter');
    }
  }

  await page.waitForURL('**/coupon.rakuten.co.jp/**', { timeout: 15000 });

  await browser.close();
}
