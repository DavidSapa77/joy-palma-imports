import type { Role } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { e2eUsers, E2E_PASSWORD, ROLE_USER_NAMES } from "./fixtures";
import { expectNoHorizontalScroll, SCREENSHOTS, signIn } from "./helpers";

/** Full navigation per role (sidebar on desktop, drawer on mobile) — UI spec §3.1. */
const NAV: Record<Role, string[]> = {
  OWNER: [
    "Dashboard",
    "New Sale",
    "Sales",
    "Products",
    "Stock-In",
    "Adjustments",
    "Movements",
    "Requests",
    "Reports",
    "Users",
    "Categories",
    "Settings",
    "Audit Log",
  ],
  MANAGER: [
    "Dashboard",
    "New Sale",
    "Sales",
    "Products",
    "Stock-In",
    "Adjustments",
    "Movements",
    "Requests",
    "Reports",
    "Audit Log",
  ],
  SALES: ["Dashboard", "New Sale", "Sales", "Products", "Requests"],
  VIEWER: [
    "Dashboard",
    "Sales",
    "Products",
    "Stock-In",
    "Adjustments",
    "Movements",
    "Requests",
    "Reports",
  ],
};

/** Mobile bottom nav per role (accessible names), Menu last. */
const BOTTOM_NAV: Record<Role, string[]> = {
  OWNER: ["Home", "Products", "New Sale", "Reports", "Menu"],
  MANAGER: ["Home", "Products", "New Sale", "Reports", "Menu"],
  SALES: ["Home", "Products", "New Sale", "Requests", "Menu"],
  VIEWER: ["Home", "Products", "Sales", "Reports", "Menu"],
};

const ROLE_BADGE: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SALES: "Sales Staff",
  VIEWER: "Viewer",
};

const ROLES = ["OWNER", "MANAGER", "SALES", "VIEWER"] as const;

const isMobile = (projectName: string) => projectName === "mobile-360";

async function signInAs(page: Page, role: Role) {
  await signIn(page, e2eUsers.role(role), E2E_PASSWORD);
  await expect(page).toHaveURL("/dashboard");
}

async function accessibleNames(items: Locator): Promise<string[]> {
  return items.evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? ""),
  );
}

for (const role of ROLES) {
  test(`${role} sees exactly its allowed navigation`, async ({ page }, testInfo) => {
    await signInAs(page, role);
    const mainNav = page.getByRole("navigation", { name: "Main" });
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
    const newSaleButton = page.getByRole("banner").getByRole("link", { name: "New Sale" });

    if (isMobile(testInfo.project.name)) {
      await expect(mainNav).toBeHidden();
      await expect(bottomNav).toBeVisible();
      const bottomItems = bottomNav.locator("a, button");
      expect(await accessibleNames(bottomItems)).toEqual(BOTTOM_NAV[role]);
      for (const box of await Promise.all((await bottomItems.all()).map((i) => i.boundingBox()))) {
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      await expect(newSaleButton).toBeHidden(); // the raised "+ Sale" replaces it on phones
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SCREENSHOTS}/shell-${role}-${testInfo.project.name}.png` });

      // Drawer holds the full role-filtered navigation.
      await bottomNav.getByRole("button", { name: "Menu" }).click();
      const drawerNav = page.getByRole("navigation", { name: "Menu" });
      await expect(drawerNav).toBeVisible();
      await expect(drawerNav.getByRole("link")).toHaveText(NAV[role]);
      await page.screenshot({ path: `${SCREENSHOTS}/drawer-${role}-${testInfo.project.name}.png` });
      // Navigating closes the drawer.
      await drawerNav.getByRole("link", { name: "Products" }).click();
      await expect(page).toHaveURL("/products");
      await expect(drawerNav).toBeHidden();
    } else {
      await expect(bottomNav).toBeHidden();
      await expect(mainNav.getByRole("link")).toHaveText(NAV[role]);
      if (role === "VIEWER") await expect(newSaleButton).toHaveCount(0);
      else await expect(newSaleButton).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SCREENSHOTS}/shell-${role}-${testInfo.project.name}.png` });
    }

    // User menu: name, role badge, change password, sign out.
    await page.getByRole("button", { name: "Account menu" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText(ROLE_USER_NAMES[role])).toBeVisible();
    await expect(menu.getByTestId("role-badge")).toHaveText(ROLE_BADGE[role]);
    await expect(menu.getByRole("menuitem", { name: "Change password" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Every nav destination exists (no 404s) and lets the role in.
    for (const href of await (
      isMobile(testInfo.project.name) ? bottomNav.getByRole("link") : mainNav.getByRole("link")
    ).evaluateAll((els) => els.map((el) => el.getAttribute("href")!))) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBe(200);
      await expect(page.getByTestId("forbidden")).toHaveCount(0);
    }
  });
}

test("Sales Staff get a friendly 403 on admin, stock and reports pages", async ({
  page,
}, testInfo) => {
  await signInAs(page, "SALES");
  for (const path of ["/admin", "/stock", "/reports", "/admin/users", "/stock/in"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(403);
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: "You don't have access" })).toBeVisible();
    // Shown inside the app shell, with a way back.
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
  }
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SCREENSHOTS}/forbidden-${testInfo.project.name}.png` });
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("Manager's Admin is the Audit Log only; Viewer can't open New Sale", async ({ page }) => {
  await signInAs(page, "MANAGER");
  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/audit");
  for (const path of ["/admin/users", "/admin/settings", "/admin/categories"]) {
    expect((await page.goto(path))?.status(), path).toBe(403);
  }

  await page.context().clearCookies();
  await signInAs(page, "VIEWER");
  expect((await page.goto("/sales/new"))?.status()).toBe(403);
  expect((await page.goto("/stock/movements"))?.status()).toBe(200);
});

test("desktop sidebar collapses to icons and remembers it", async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "sidebar is desktop-only");
  await signInAs(page, "OWNER");
  const sidebar = page
    .locator("aside")
    .filter({ has: page.getByRole("navigation", { name: "Main" }) });
  expect((await sidebar.boundingBox())!.width).toBe(240);
  await expect(sidebar.getByText("Joy Palma Imports", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72);
  await page.reload();
  expect((await sidebar.boundingBox())!.width).toBe(72);
  await page.screenshot({ path: `${SCREENSHOTS}/sidebar-collapsed-${testInfo.project.name}.png` });

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(240);
});
