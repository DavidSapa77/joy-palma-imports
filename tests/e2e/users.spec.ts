import { expect, test, type Page } from "@playwright/test";

import { e2eUsers, E2E_PASSWORD } from "./fixtures";
import { expectNoHorizontalScroll, SCREENSHOTS, signIn, signOut } from "./helpers";

const SALES_NAV = ["Dashboard", "New Sale", "Sales", "Products", "Requests"];

const isMobile = (projectName: string) => projectName === "mobile-360";

/** The visible table row (desktop) or card (phone) for a user. */
function userEntry(page: Page, projectName: string, email: string) {
  const testId = isMobile(projectName) ? "user-card" : "user-row";
  return page.locator(`[data-testid="${testId}"][data-email="${email}"]`);
}

test("Owner adds a Sales user who signs in with the temporary password", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(150_000);
  const project = testInfo.project.name;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const name = `Ama Newhire ${project}`;
  const email = `e2e-hire-${project}-${Date.now()}@test.local`;

  // --- Owner adds the user --------------------------------------------------
  await signIn(page, e2eUsers.role("OWNER"), E2E_PASSWORD);
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(userEntry(page, project, e2eUsers.role("OWNER"))).toContainText("(you)");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SCREENSHOTS}/users-${project}.png`, fullPage: true });

  await page.getByRole("button", { name: "Add user" }).click();
  const form = page.getByRole("dialog", { name: "Add user" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Email").fill(`  ${email.toUpperCase()}  `);
  await form.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "Sales Staff" }).click();
  await page.screenshot({ path: `${SCREENSHOTS}/users-add-${project}.png` });
  await form.getByRole("button", { name: "Add user" }).click();

  // Temporary password, shown once.
  const shown = page.getByRole("dialog", { name: "User added" });
  await expect(shown).toBeVisible();
  await expect(shown).toContainText("You won't see this password again.");
  const temporaryPassword = (await shown.getByTestId("temporary-password").textContent())!.trim();
  expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  await shown.getByRole("button", { name: "Copy password" }).click();
  await expect(shown.getByRole("button", { name: "Copy password" })).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(temporaryPassword);
  await page.keyboard.press("Escape"); // can't be dismissed by accident
  await expect(shown).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SCREENSHOTS}/users-temp-password-${project}.png` });
  await shown.getByRole("button", { name: /I've copied it/ }).click();
  await expect(shown).toBeHidden();

  const entry = userEntry(page, project, email);
  await expect(entry).toContainText(name);
  await expect(entry.getByTestId("user-role")).toHaveText("Sales Staff");
  await expect(entry.getByTestId("user-status")).toHaveText(/Active\s*Temporary password/);

  // Same email again (different case) is refused with a friendly message.
  await page.getByRole("button", { name: "Add user" }).click();
  await form.getByLabel("Name").fill("Duplicate");
  await form.getByLabel("Email").fill(email.toUpperCase());
  await form.getByRole("button", { name: "Add user" }).click();
  await expect(form.getByText(/already exists/)).toBeVisible();
  await form.getByRole("button", { name: "Cancel" }).click();

  await signOut(page);

  // --- New user signs in, must set a password, sees the Sales menu ----------
  await signIn(page, email, temporaryPassword);
  await expect(page).toHaveURL("/set-password");
  await page.getByLabel("New password", { exact: true }).fill("Brand-New-Pass-9");
  await page.getByLabel("Confirm new password").fill("Brand-New-Pass-9");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/dashboard");

  if (isMobile(project)) {
    await page
      .getByRole("navigation", { name: "Bottom navigation" })
      .getByRole("button", { name: "Menu" })
      .click();
    await expect(page.getByRole("navigation", { name: "Menu" }).getByRole("link")).toHaveText(
      SALES_NAV,
    );
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveText(
      SALES_NAV,
    );
  }
  expect((await page.goto("/admin/users"))?.status()).toBe(403);
  await page.goto("/dashboard");
  await signOut(page);

  // --- Owner deactivates them; they can no longer sign in --------------------
  await signIn(page, e2eUsers.role("OWNER"), E2E_PASSWORD);
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/admin/users");
  await expect(entry.getByTestId("user-status")).toHaveText("Active"); // password changed
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Deactivate user?" });
  await expect(confirm).toBeVisible();
  await page.screenshot({ path: `${SCREENSHOTS}/users-deactivate-${project}.png` });
  await confirm.getByRole("button", { name: "Deactivate" }).click();
  await expect(confirm).toBeHidden();
  await expect(entry.getByTestId("user-status")).toHaveText("Deactivated");
  await signOut(page);

  await signIn(page, email, "Brand-New-Pass-9");
  await expect(page.locator('[data-slot="form-alert"]')).toContainText("deactivated");
});
