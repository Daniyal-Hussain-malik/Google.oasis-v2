import { expect, test } from '@playwright/test';

test.describe('Guest Booking -> Admin Check-in E2E', () => {
  test('allows a guest to book a hut online and staff to initialize admin access and check the guest in', async ({ page }) => {
    // 1. Guest books a room on /book
    await page.goto('/book');
    await expect(page.getByRole('heading', { name: /Reserve your hut/i })).toBeVisible();

    const continueBtn = page.getByRole('button', { name: /Continue to Guest Details/i });
    await expect(continueBtn).toBeEnabled({ timeout: 15000 });
    await continueBtn.click();

    await page.getByPlaceholder('Zainab').fill('Sana');
    await page.getByPlaceholder('Mansoor').fill('Tariq');
    await page.getByPlaceholder('03XX-XXXXXXX').fill('0300-7778899');
    await page.getByPlaceholder('guest@example.com').fill('sana.tariq@example.com');

    await page.getByRole('button', { name: /Confirm Reservation/i }).click();

    // 2. Assert confirmation page and capture booking reference
    await expect(page).toHaveURL(/\/confirmed/);
    await expect(page.getByRole('heading', { name: /Your hut is reserved/i })).toBeVisible();
    const bookingRefLocator = page.locator('p').filter({ hasText: /^OAS\d{6,}$/ }).first();
    await expect(bookingRefLocator).toBeVisible();
    const bookingNumber = (await bookingRefLocator.innerText()).trim();
    expect(bookingNumber).toMatch(/^OAS\d+/);

    // 3. Staff opens /admin and initializes first Super Admin on the clean test DB
    await page.goto('/admin');
    await expect(page.getByText(/Initialize Super Admin/i)).toBeVisible({ timeout: 15000 });

    await page.getByPlaceholder('e.g. Kashif Hassan').fill('Playwright Manager');
    await page.getByPlaceholder('admin@oasisresort.pk').fill('e2e-admin@oasisresort.pk');
    await page.getByPlaceholder('••••••••••••').fill('PlaywrightStrongPass!99');
    await page.getByRole('button', { name: /Create Super Admin/i }).click();

    await expect(page.getByText(/Oasis Staff Desk/i)).toBeVisible({ timeout: 15000 });

    // 4. Navigate to Reservations ledger, search booking, open drawer, and Check In
    await page.goto('/admin/reservations');
    await expect(page.getByRole('heading', { name: /Reservations Ledger/i })).toBeVisible();

    const searchInput = page.getByPlaceholder(/Search booking #, guest, phone/i);
    await searchInput.fill(bookingNumber);

    const row = page.locator('tbody tr').filter({ hasText: bookingNumber }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    const checkInBtn = page.getByRole('button', { name: /^Check In$/ });
    await expect(checkInBtn).toBeVisible({ timeout: 10000 });
    await checkInBtn.click();

    await expect(page.getByText(/checked in/i).first()).toBeVisible({ timeout: 10000 });

    // Reload reservations ledger and verify checked_in persists
    await page.reload();
    await page.getByPlaceholder(/Search booking #, guest, phone/i).fill(bookingNumber);
    await expect(page.locator('tbody tr').filter({ hasText: bookingNumber }).first()).toContainText(/checked in/i);
  });
});
