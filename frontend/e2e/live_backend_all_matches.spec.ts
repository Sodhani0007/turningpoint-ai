import { test, expect } from '@playwright/test';

// Configure this test suite to run against localhost preview pointing to the live Render backend
test.describe('Live Render Backend Integration (All 4 IPL Matches)', () => {
  const matches = [
    { id: '1359487', name: 'GT vs KKR (2023)', chasingTeam: 'Kolkata Knight Riders' },
    { id: '1181768', name: 'MI vs CSK (2019 Final)', chasingTeam: 'Chennai Super Kings' },
    { id: '1216527', name: 'KXIP vs RR (2020)', chasingTeam: 'Rajasthan Royals' },
    { id: '1254084', name: 'CSK vs MI (2021)', chasingTeam: 'Mumbai Indians' },
  ];

  for (const m of matches) {
    test(`Verify Explain button & live API response for match ${m.name}`, async ({ page }) => {
      // Mock the API routing to redirect directly to the live Render backend
      await page.route('**/api/health', async (route) => {
        const resp = await fetch('https://turningpoint-ai-backend.onrender.com/api/health');
        const json = await resp.json();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
      });

      await page.route('**/api/matches', async (route) => {
        const resp = await fetch('https://turningpoint-ai-backend.onrender.com/api/matches');
        const json = await resp.json();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
      });

      await page.route(`**/api/matches/${m.id}/replay`, async (route) => {
        const resp = await fetch(`https://turningpoint-ai-backend.onrender.com/api/matches/${m.id}/replay`);
        const json = await resp.json();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
      });

      await page.route('**/api/explain', async (route) => {
        const reqBody = route.request().postData();
        const resp = await fetch('https://turningpoint-ai-backend.onrender.com/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: reqBody,
        });
        const json = await resp.json();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
      });

      await page.goto('/');

      // Select match
      const matchBtn = page.getByTestId(`match-card-${m.id}`);
      await matchBtn.click();
      await page.waitForTimeout(500);

      // Verify Scoreboard
      await expect(page.getByTestId('scoreboard-card').locator('h2')).toContainText(m.chasingTeam);

      // Click first turning point's Explain button
      const explainBtn = page.locator('button:has-text("Explain")').first();
      await explainBtn.click();

      // Verify Explanation Modal opens and renders cleanly
      const modal = page.getByTestId('explanation-modal-card');
      await expect(modal).toBeVisible();
      await expect(page.getByTestId('explanation-headline')).toBeVisible();
      await expect(page.getByTestId('explanation-text')).toBeVisible();
      await expect(page.getByTestId('explanation-takeaway')).toBeVisible();
      await expect(page.getByTestId('explanation-source-badge')).toBeVisible();

      // Verify delivery evidence table rows
      const rows = modal.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);

      // Close modal
      await page.getByTestId('close-explanation-modal-btn').click();
      await expect(modal).not.toBeVisible();
    });
  }
});

