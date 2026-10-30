import { test, expect } from '@playwright/test';

test.describe('StudyAI Smoke Flow', () => {
  test('login -> add study material -> generate quiz flow', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/');

    // Verify redirected or displaying login
    await expect(page.locator('text=StudyAI')).toBeVisible();

    // 2. Perform 1-Click Demo Login
    const demoBtn = page.locator('text=1-Click Demo Login');
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
    } else {
      // Direct form fill
      await page.fill('input[type="email"]', 'student.demo@studyai.app');
      await page.fill('input[type="password"]', 'StudyAIDemoPassword2026!');
      await page.click('button[type="submit"]');
    }

    // 3. Navigate to Dashboard
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });

    // 4. Go to Study Materials page
    await page.click('text=Study Materials');
    await expect(page.locator('text=Add New Material')).toBeVisible();

    // 5. Add a test material
    await page.fill('input[placeholder*="Title"]', 'Mitochondria and Cellular Energy');
    await page.fill('input[placeholder*="Subject"]', 'Biology');
    await page.fill('textarea', 'Mitochondria are double-membraned organelles that produce adenosine triphosphate (ATP) through oxidative phosphorylation and the Krebs cycle.');
    await page.click('button:has-text("Save Material")');

    // 6. Verify Material appears in list
    await expect(page.locator('text=Mitochondria and Cellular Energy')).toBeVisible({ timeout: 5000 });

    // 7. Click "Quiz Me" on the newly created material
    const quizMeBtn = page.locator('button:has-text("Quiz Me")').first();
    await quizMeBtn.click();

    // 8. On Quiz page, trigger quiz generation
    await expect(page.locator('text=Quiz Generator')).toBeVisible();
    await page.click('button:has-text("Generate Quiz")');

    // 9. Verify questions or quiz interface rendered
    await expect(page.locator('text=Active Quiz, text=Quiz').first()).toBeVisible({ timeout: 15000 });
  });
});

