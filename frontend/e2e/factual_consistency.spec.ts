import { test, expect } from '@playwright/test';

test.describe('Factual Consistency & UI Refinements', () => {
  test('Corrects inaccurate "Six consecutive sixes" headline to factually accurate text', async ({ page }) => {
    // Intercept /api/health to simulate connected live backend
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
          ai_provider_model: 'openai/gpt-oss-20b'
        })
      });
    });

    // Intercept /api/explain returning inaccurate live LLM headline
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turning_point_id: 'tp_1359487_1',
          match_id: '1359487',
          headline: 'Six consecutive sixes shift win probability',
          explanation: 'At 19.1, KKR were 176/7 needing 29 runs off 6 balls. Yash Dayal first ball yielded 1 run, bringing requirement to 28 off 5 balls. The next five balls each produced a six, adding 30 runs and completing the chase.',
          takeaway: 'Rinku Singh sealed the victory in the final over.',
          confidence_notes: 'Verified historical data.',
          supporting_delivery_ids: [118, 119, 120, 121, 122],
          verified_evidence: {
            deliveries: [
              { delivery_id: 118, over: '19.2', batter: 'RK Singh', bowler: 'Yash Dayal', runs_total: 6, batter_runs: 6, extra_runs: 0, is_boundary: true, is_dot: false, wickets: [], event_description: 'Yash Dayal to RK Singh, 6 runs' }
            ]
          },
          source: 'live_llm'
        })
      });
    });

    await page.goto('/');

    // Open first turning point explain modal
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    // Verify modal headline is normalized to factually accurate text
    const headline = page.getByTestId('explanation-headline');
    await expect(headline).toBeVisible();
    await expect(headline).toContainText("Rinku Singh's five consecutive sixes complete historic chase");
    await expect(headline).not.toContainText("Six consecutive sixes");
  });

  test('Match cards display complete titles without truncation', async ({ page }) => {
    await page.goto('/');
    const matchCard = page.getByTestId('match-card-1359487');
    await expect(matchCard).toBeVisible();
    await expect(matchCard.locator('div.font-bold')).toContainText('GT vs KKR (2023) — The Rinku Singh Miracle');
  });
});
