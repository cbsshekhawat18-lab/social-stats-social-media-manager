// Drives the demo the README GIF shows, in a headless browser, and records it.
// Run by scripts/record-demo.sh; see that file for setup.
//
//   1. /login, dismiss the cookie banner, one click on the Superadmin demo button
//   2. the analytics page with the seeded data; switch to 90 days; scroll twice
//   3. the dashboard; scroll once
const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://localhost:3000";
const out = process.env.OUT_DIR || "docs/.recording";

(async () => {
  const browser = await chromium.launch();
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: out, size } });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  const open = async (name) => {
    await page.getByRole("link", { name, exact: true }).first().click();
    await page.waitForLoadState("networkidle");
  };

  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  const cookies = page.getByRole("button", { name: /Essential only/i });
  if (await cookies.count()) await cookies.first().click();
  await pause(2000);
  await page.getByRole("button", { name: /Superadmin/i }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  await pause(3500);
  await page.screenshot({ path: "docs/screenshot.png" });

  await page.getByRole("button", { name: "90d" }).click();
  await page.waitForLoadState("networkidle");
  await pause(2500);
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, 450);
  await pause(2500);
  await page.mouse.wheel(0, 450);
  await pause(2500);

  await open("Dashboard");
  await pause(2500);
  await page.mouse.wheel(0, 450);
  await pause(3000);

  await context.close();
  await browser.close();
})();
