import { test, expect } from '@playwright/test';

test.describe('TurningPoint AI — User Journey & Production Verification', () => {
  test('Complete replay experience, match switching, and controls', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Header and brand
    await expect(page.locator('h1')).toContainText('TurningPoint');
    await expect(page.getByTestId('backend-status-badge')).toBeVisible();

    // 2. Verify Initial Match Loaded (GT vs KKR)
    await expect(page.getByTestId('scoreboard-card')).toBeVisible();
    await expect(page.getByTestId('scoreboard-card').locator('h2')).toContainText('Kolkata Knight Riders');
    await expect(page.getByTestId('win-probability-value')).toBeVisible();

    // 3. Test Replay Controls: Play / Pause / Step
    const playBtn = page.getByTestId('play-pause-btn');
    await expect(playBtn).toContainText('Play Replay');
    
    // Start play
    await playBtn.click();
    await expect(playBtn).toContainText('Pause');
    await page.waitForTimeout(1200);

    // Pause play
    await playBtn.click();
    await expect(playBtn).toContainText('Play Replay');

    // Step Forward & Backward
    const stepFwdBtn = page.getByTestId('step-forward-btn');
    const stepBackBtn = page.getByTestId('step-back-btn');
    await stepFwdBtn.click();
    await stepBackBtn.click();

    // Restart
    const restartBtn = page.getByTestId('restart-btn');
    await restartBtn.click();
    await expect(page.getByTestId('delivery-counter')).toContainText('Ball 1/');

    // Test Playback Speed selector
    const speed4xBtn = page.getByTestId('speed-btn-4x');
    await speed4xBtn.click();
    await expect(speed4xBtn).toHaveClass(/border-emerald-500/);

    // 4. Test Match Switching to MI vs CSK (1181768)
    const matchBtn = page.getByTestId('match-card-1181768');
    await matchBtn.click();
    await expect(page.getByTestId('scoreboard-card').locator('h2')).toContainText('Chennai Super Kings');
    await expect(page.getByTestId('scoreboard-runs')).toBeVisible();

    // 5. Test Turning Point Navigation & Explanation Modal
    // Click on the first turning point card's "Explain" button
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    // Verify Explanation Modal opened
    await expect(page.getByTestId('explanation-modal-card')).toBeVisible();
    await expect(page.getByTestId('explanation-headline')).toBeVisible();
    await expect(page.getByTestId('explanation-text')).toBeVisible();
    await expect(page.getByTestId('explanation-takeaway')).toBeVisible();
    await expect(page.getByTestId('explanation-source-badge')).toBeVisible();

    // Test Escape key closes modal
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('explanation-modal-card')).not.toBeVisible();

    // 6. Test Model Diagnostics Modal
    const metricsBtn = page.getByTestId('open-metrics-btn');
    await metricsBtn.click();
    await expect(page.getByTestId('metrics-modal-card')).toBeVisible();
    await expect(page.getByTestId('metric-roc-auc')).toContainText('0.887');
    await expect(page.getByTestId('metric-brier-score')).toContainText('0.1436');
    await expect(page.getByTestId('metric-log-loss')).toContainText('0.4357');

    // Close via close button
    await page.getByTestId('close-metrics-modal-btn').click();
    await expect(page.getByTestId('metrics-modal-card')).not.toBeVisible();

    // 7. Test Keyboard Shortcuts: Spacebar to Play/Pause, R to Restart
    await page.keyboard.press('Space');
    await expect(playBtn).toContainText('Pause');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await expect(playBtn).toContainText('Play Replay');

    await page.keyboard.press('KeyR');
    await expect(page.getByTestId('delivery-counter')).toContainText('Ball 1/');
  });

  test('Backend live simulation & AI source attribution', async ({ page }) => {
    // Intercept /api/health with live AI provider metadata
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          service: 'TurningPoint AI Backend',
          model_loaded: true,
          available_matches_count: 4,
          ai_provider_status: 'available',
          ai_provider_name: 'groq',
          ai_provider_model: 'llama-3.3-70b-versatile',
          model_evaluation_metrics: {
            roc_auc: 0.887,
            brier_score: 0.1436,
            log_loss: 0.4357,
          },
        }),
      });
    });

    // Intercept /api/explain returning live_llm attribution
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turning_point_id: 'tp_1359487_1',
          match_id: '1359487',
          headline: 'Live LLM: Rinku Singh Historic 5 Consecutive Sixes',
          explanation: 'Live model inference: Rinku Singh struck 5 consecutive sixes off Yash Dayal to achieve an improbable victory.',
          takeaway: 'Live model confirms 30 runs in the 20th over completely reversed the win probability.',
          confidence_notes: 'Real-time Groq llama-3.3-70b-versatile verification.',
          supporting_delivery_ids: [118, 119, 120, 121, 122],
          verified_evidence: {
            deliveries: [
              { delivery_id: 118, over: '19.2', batter: 'RK Singh', bowler: 'Yash Dayal', runs_total: 6, batter_runs: 6, extra_runs: 0, is_boundary: true, is_dot: false, wickets: [], event_description: 'Yash Dayal to RK Singh, 6 runs' }
            ]
          },
          source: 'live_llm',
          llm_metadata: {
            provider: 'groq',
            model: 'llama-3.3-70b-versatile',
            latency_ms: 380,
          },
        }),
      });
    });

    await page.goto('/');

    // Check Header badge updated to show Live AI status
    const statusBadge = page.getByTestId('backend-status-badge');
    await expect(statusBadge).toContainText('Connected API (AI Live: llama-3.3-70b-versatile)');

    // Trigger explanation
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    // Verify modal has live AI badge
    const sourceBadge = page.getByTestId('explanation-source-badge');
    await expect(sourceBadge).toContainText('Live AI (llama-3.3-70b-versatile)');
    await expect(page.getByTestId('explanation-headline')).toContainText('Live LLM: Rinku Singh');
  });

  test('Offline fallback simulation with complete functional replay', async ({ page }) => {
    // Intercept /api/health to fail network connection
    await page.route('**/api/health', (route) => route.abort('failed'));
    await page.route('**/api/explain', (route) => route.abort('failed'));

    await page.goto('/');

    // Header must show Historical Offline Replay
    const statusBadge = page.getByTestId('backend-status-badge');
    await expect(statusBadge).toContainText('Historical Offline Replay');

    // Replay controls still work smoothly from precomputed bundle
    const playBtn = page.getByTestId('play-pause-btn');
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await page.waitForTimeout(600);
    await playBtn.click();

    // Explanation modal still works from precomputed bundle
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    await expect(page.getByTestId('explanation-modal-card')).toBeVisible();
    await expect(page.getByTestId('explanation-source-badge')).toBeVisible();
  });
});
