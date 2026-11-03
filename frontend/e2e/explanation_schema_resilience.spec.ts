import { test, expect } from '@playwright/test';

test.describe('Explanation Schema Resilience & Three Response Types', () => {
  test.beforeEach(async ({ page }) => {
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
          ai_provider_model: 'openai/gpt-oss-20b',
        }),
      });
    });
  });

  test('Renders live_llm response with streamlined backend evidence schema (runs/event)', async ({ page }) => {

    // Intercept /api/explain with the streamlined live backend schema
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turning_point_id: 'tp_1359487_1',
          match_id: '1359487',
          headline: 'Rinku Singh 5 Consecutive Sixes Finish',
          explanation: 'KKR needed 29 runs off the 20th over. A single was followed by five consecutive sixes to seal victory.',
          takeaway: 'Greatest final-over chase in IPL history.',
          confidence_notes: 'Grounded in observed delivery events.',
          supporting_delivery_ids: [117, 118, 119, 120, 121, 122],
          verified_evidence: {
            match_id: '1359487',
            match_context: 'KKR chasing 205 against GT',
            venue: 'Narendra Modi Stadium, Ahmedabad',
            date: '2023-04-09',
            over_range: 'Over 19.1 - 19.6',
            score_before: '176/7 (balls bowled: 114)',
            score_after: '207/7 (balls bowled: 120)',
            target: 205,
            runs_needed_before: 29,
            runs_needed_after: 0,
            balls_remaining_before: 6,
            balls_remaining_after: 0,
            required_run_rate_before: 29.0,
            required_run_rate_after: 0.0,
            model_win_prob_before: '0.1%',
            model_win_prob_after: '100.0%',
            win_prob_shift: '+99.9%',
            runs_in_window: 31,
            wickets_in_window: 0,
            batters_involved: ['RK Singh', 'UT Yadav'],
            bowler_involved: 'Yash Dayal',
            // Streamlined delivery payload as returned by Groq backend
            deliveries: [
              {
                delivery_id: 117,
                over: '19.1',
                batter: 'UT Yadav',
                bowler: 'Yash Dayal',
                runs: 1,
                wickets: [],
                event: 'Yash Dayal to UT Yadav, 1 run'
              },
              {
                delivery_id: 118,
                over: '19.2',
                batter: 'RK Singh',
                bowler: 'Yash Dayal',
                runs: 6,
                wickets: [],
                event: 'Yash Dayal to RK Singh, 6 runs'
              },
              {
                delivery_id: 119,
                over: '19.3',
                batter: 'RK Singh',
                bowler: 'Yash Dayal',
                runs: 6,
                wickets: [],
                event: 'Yash Dayal to RK Singh, 6 runs'
              }
            ]
          },
          source: 'live_llm',
          llm_metadata: {
            provider: 'groq',
            model: 'openai/gpt-oss-20b',
            latency_ms: 1250,
          },
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByTestId('backend-status-badge')).toContainText('openai/gpt-oss-20b');

    // Click Explain on first turning point
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    // Verify modal renders smoothly without crashing
    const modal = page.getByTestId('explanation-modal-card');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('explanation-headline')).toContainText('Rinku Singh 5 Consecutive Sixes');
    await expect(page.getByTestId('explanation-source-badge')).toContainText('Live AI (openai/gpt-oss-20b)');
    await expect(page.getByTestId('explanation-text')).toBeVisible();
    await expect(page.getByTestId('explanation-takeaway')).toBeVisible();

    // Verify delivery table rendered delivery items with proper runs and text
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(page.locator('tbody tr').first()).toContainText('Yash Dayal');
    await expect(page.locator('tbody tr').first()).toContainText('+1');

    // Close modal
    await page.getByTestId('close-explanation-modal-btn').click();
    await expect(modal).not.toBeVisible();
  });

  test('Renders precomputed_llm response correctly', async ({ page }) => {
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turning_point_id: 'tp_1359487_1',
          match_id: '1359487',
          headline: 'Precomputed Grounded Analysis',
          explanation: 'Precomputed explanation for the final over.',
          takeaway: 'Decisive finish.',
          supporting_delivery_ids: [117, 118],
          verified_evidence: {
            deliveries: [
              {
                delivery_id: 117,
                over: '19.1',
                batter: 'UT Yadav',
                bowler: 'Yash Dayal',
                runs_total: 1,
                batter_runs: 1,
                extra_runs: 0,
                is_boundary: false,
                is_dot: false,
                wickets: [],
                event_description: 'Yash Dayal to UT Yadav, 1 run'
              }
            ]
          },
          source: 'precomputed_llm',
        }),
      });
    });

    await page.goto('/');
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    await expect(page.getByTestId('explanation-modal-card')).toBeVisible();
    await expect(page.getByTestId('explanation-source-badge')).toContainText('Precomputed Grounded AI');
    await page.getByTestId('close-explanation-modal-btn').click();
  });

  test('Renders deterministic_fallback response correctly', async ({ page }) => {
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turning_point_id: 'tp_1359487_1',
          match_id: '1359487',
          headline: 'Deterministic Momentum Swing',
          explanation: 'Deterministic synthesis based on verified match statistics.',
          takeaway: 'Significant probability swing.',
          supporting_delivery_ids: [117, 118],
          verified_evidence: {
            deliveries: [
              {
                delivery_id: 117,
                over: '19.1',
                batter: 'UT Yadav',
                bowler: 'Yash Dayal',
                runs: 1,
                wickets: ['Bowled'], // test string wicket
                event: 'Wicket fell'
              }
            ]
          },
          source: 'deterministic_fallback',
        }),
      });
    });

    await page.goto('/');
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    await expect(page.getByTestId('explanation-modal-card')).toBeVisible();
    await expect(page.getByTestId('explanation-source-badge')).toContainText('Deterministic Evidence Grounding');
    await page.getByTestId('close-explanation-modal-btn').click();
  });
});
