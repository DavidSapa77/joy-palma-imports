import { expect, test, type Page } from "@playwright/test";

import { e2eUsers, E2E_PASSWORD } from "./fixtures";

const SCREENSHOTS = process.env.E2E_SCREENSHOT_DIR ?? "test-results/screenshots";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The form's error banner (Next.js also renders an empty role=alert route announcer). */
const formAlert = (page: Page) => page.locator('[data-slot="form-alert"]');

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("login page layout", async ({ page }, testInfo) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Joy Palma Imports/ })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await expect(signInButton).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Full-width button: as wide as the email field.
  const [button, field] = await Promise.all([
    signInButton.boundingBox(),
    page.getByLabel("Email").boundingBox(),
  ]);
  expect(Math.round(button!.width)).toBe(Math.round(field!.width));
  // Touch targets ≥ 44px on phones.
  if (testInfo.project.name === "mobile-360") expect(button!.height).toBeGreaterThanOrEqual(44);

  await page.screenshot({
    path: `${SCREENSHOTS}/login-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("password show/hide toggle", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("secret-value");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("wrong password and unknown email show the same generic message", async ({
  page,
}, testInfo) => {
  await signIn(page, e2eUsers.active, "wrong-password");
  await expect(formAlert(page)).toHaveText("Email or password is incorrect");
  await expect(page.getByLabel("Email")).toHaveValue(e2eUsers.active); // email kept
  await page.screenshot({
    path: `${SCREENSHOTS}/login-error-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await signIn(page, `nobody-${testInfo.project.name}@test.local`, E2E_PASSWORD);
  await expect(formAlert(page)).toHaveText("Email or password is incorrect");
});

test("inactive user is rejected", async ({ page }) => {
  await signIn(page, e2eUsers.inactive, E2E_PASSWORD);
  await expect(formAlert(page)).toContainText("deactivated");
  await expect(page).toHaveURL(/\/login/);
});

test("rate limit message on the 6th attempt", async ({ page }, testInfo) => {
  const email = `ratelimit-${testInfo.project.name}@test.local`;
  for (let i = 0; i < 5; i++) {
    await signIn(page, email, "guess");
    await expect(formAlert(page)).toHaveText("Email or password is incorrect");
  }
  await signIn(page, email, "guess");
  await expect(formAlert(page)).toHaveText("Too many attempts, try again in 15 minutes.");
  await page.screenshot({
    path: `${SCREENSHOTS}/login-rate-limited-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("signed-out users are sent to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.goto("/set-password");
  await expect(page).toHaveURL(/\/login/);
});

test("correct login lands in the app, sign out returns to login", async ({ page }) => {
  await signIn(page, e2eUsers.active, E2E_PASSWORD);
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in as Esi Active · sales")).toBeVisible();

  await page.goto("/login"); // already signed in → back to the app
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("users who must change their password are forced to set a new one", async ({
  page,
}, testInfo) => {
  const email = e2eUsers.mustChange(testInfo.project.name);
  await signIn(page, email, E2E_PASSWORD);
  await expect(page).toHaveURL("/set-password");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `${SCREENSHOTS}/set-password-${testInfo.project.name}.png`,
    fullPage: true,
  });

  // Can't escape to other pages.
  await page.goto("/");
  await expect(page).toHaveURL("/set-password");

  const newPassword = page.getByLabel("New password", { exact: true });
  const confirm = page.getByLabel("Confirm new password");
  const save = page.getByRole("button", { name: "Save new password" });

  await newPassword.fill("different-1234");
  await confirm.fill("different-9999");
  await save.click();
  await expect(page.getByText("The passwords don't match")).toBeVisible();
  await expect(newPassword).toHaveValue("different-1234"); // nothing typed is lost
  await page.screenshot({
    path: `${SCREENSHOTS}/set-password-error-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await newPassword.fill(E2E_PASSWORD);
  await confirm.fill(E2E_PASSWORD);
  await save.click();
  await expect(page.getByText(/haven't used/)).toBeVisible();

  await newPassword.fill("A-fresh-password-1");
  await confirm.fill("A-fresh-password-1");
  await save.click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in as Nana New")).toBeVisible();

  // Sign in again with the new password: no more forced change.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, email, "A-fresh-password-1");
  await expect(page).toHaveURL("/");
});
