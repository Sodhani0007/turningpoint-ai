import { test, expect } from '@playwright/test';

const PROD_URL = 'https://frontend-mauve-omega-75.vercel.app';

test.describe('Production Live Deployment Verification (All 4 Matches)', () => {
  test('Verify production URL, 4 matches, replay controls, and turning points', async ({ page }) => {
    // Navigate directly to live public URL
    const response = await page.goto(PROD_URL, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    // 1. Verify Header and brand
    await expect(page.locator('h1')).toContainText('TurningPoint');
    const statusBadge = page.getByTestId('backend-status-badge');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('Historical Offline Replay');

    const matchesToTest = [
      { id: '1359487', chasingTeam: 'Kolkata Knight Riders', target: 205 },
      { id: '1181768', chasingTeam: 'Chennai Super Kings', target: 150 },
      { id: '1216527', chasingTeam: 'Rajasthan Royals', target: 224 },
      { id: '1254084', chasingTeam: 'Mumbai Indians', target: 219 },
    ];

    for (const m of matchesToTest) {
      // Select match
      const matchBtn = page.getByTestId(`match-card-${m.id}`);
      await matchBtn.click();
      await page.waitForTimeout(400);

      // Verify Scoreboard
      const scoreboard = page.getByTestId('scoreboard-card');
      await expect(scoreboard).toBeVisible();
      await expect(scoreboard.locator('h2')).toContainText(m.chasingTeam);
      await expect(page.getByTestId('runs-needed-value')).toBeVisible();
      await expect(page.getByTestId('balls-remaining-value')).toBeVisible();

      // Test Replay Controls: Play
      const playBtn = page.getByTestId('play-pause-btn');
      await playBtn.click();
      await expect(playBtn).toContainText('Pause');
      await page.waitForTimeout(500);

      // Pause
      await playBtn.click();
      await expect(playBtn).toContainText('Play Replay');

      // Step Forward & Step Backward
      const stepFwdBtn = page.getByTestId('step-forward-btn');
      const stepBackBtn = page.getByTestId('step-back-btn');
      await stepFwdBtn.click();
      await stepBackBtn.click();

      // Restart
      const restartBtn = page.getByTestId('restart-btn');
      await restartBtn.click();
      await expect(page.getByTestId('delivery-counter')).toContainText('Ball 1/');

      // Test Turning Point Navigation: Click the first turning point card's Explain button
      const explainBtn = page.locator('button:has-text("Explain")').first();
      await explainBtn.click();

      // Verify Explanation Modal opened
      const modal = page.getByTestId('explanation-modal-card');
      await expect(modal).toBeVisible();
      await expect(page.getByTestId('explanation-headline')).toBeVisible();
      await expect(page.getByTestId('explanation-text')).toBeVisible();
      await expect(page.getByTestId('explanation-takeaway')).toBeVisible();
      await expect(page.getByTestId('explanation-source-badge')).toBeVisible();

      // Close modal
      await page.getByTestId('close-explanation-modal-btn').click();
      await expect(modal).not.toBeVisible();
    }

    // Test Model Diagnostics Modal
    const metricsBtn = page.getByTestId('open-metrics-btn');
    await metricsBtn.click();
    const metricsModal = page.getByTestId('metrics-modal-card');
    await expect(metricsModal).toBeVisible();
    await expect(page.getByTestId('metric-roc-auc')).toContainText('0.887');
    await expect(page.getByTestId('metric-brier-score')).toContainText('0.1436');
    await expect(page.getByTestId('metric-log-loss')).toContainText('0.4357');

    await page.keyboard.press('Escape');
    await expect(metricsModal).not.toBeVisible();
  });
});
