import { test, expect } from '@playwright/test';

test.describe('TurningPoint AI — Ask AI Custom Question Precision & UI Separation', () => {
  test('Accurately answers three distinct questions with clear Q&A separation', async ({ page }) => {
    // Intercept health check as connected
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

    const capturedRequests: Array<{ match_id: string; turning_point_id: string; custom_prompt?: string }> = [];

    // Route /api/explain to simulate dynamic backend handling for each question
    await page.route('**/api/explain', async (route) => {
      const data = JSON.parse(route.request().postData() || '{}');
      capturedRequests.push(data);

      const q = data.custom_prompt;
      let headline = 'Momentum Shift in Over 19.1 - 19.6';
      let explanation = 'Default turning point explanation for Over 19.';
      let takeaway = 'Historic final over.';

      if (q === "Why did KKR's win probability increase in the final over?") {
        headline = 'Five Consecutive Sixes Drove Comeback';
        explanation = 'KKR entered the over needing 29 runs off 6 balls with a 0.1% win probability. After a single on 19.1, Rinku Singh struck 5 consecutive sixes off Yash Dayal, adding 30 runs in 5 balls and raising the win probability from 0.1% to 100.0%.';
        takeaway = 'Unprecedented 31-run 20th over.';
      } else if (q === 'How many sixes did Rinku Singh hit in the final five balls?') {
        headline = 'Rinku Singh Hit 5 Consecutive Sixes';
        explanation = 'Rinku Singh struck 5 consecutive sixes on deliveries 19.2, 19.3, 19.4, 19.5, and 19.6 off bowler Yash Dayal, scoring 30 runs off the final 5 balls.';
        takeaway = 'Five maximums in five deliveries.';
      } else if (q === 'Who was bowling the final over?') {
        headline = 'Yash Dayal Bowled Final Over';
        explanation = 'Yash Dayal was bowling the 20th over (Over 19.1 - 19.6) for Gujarat Titans, delivering to Umesh Yadav on 19.1 and Rinku Singh on 19.2 through 19.6.';
        takeaway = 'Yash Dayal delivered all 6 balls.';
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turning_point_id: data.turning_point_id,
          match_id: data.match_id,
          headline: headline,
          explanation: explanation,
          takeaway: takeaway,
          confidence_notes: 'Verified from match delivery events.',
          supporting_delivery_ids: [117, 118, 119, 120, 121, 122],
          verified_evidence: {
            deliveries: [
              {
                delivery_id: 117,
                over: '19.1',
                batter: 'UT Yadav',
                bowler: 'Yash Dayal',
                runs: 1,
                runs_total: 1,
                event: 'Yash Dayal to UT Yadav, 1 run'
              },
              {
                delivery_id: 118,
                over: '19.2',
                batter: 'RK Singh',
                bowler: 'Yash Dayal',
                runs: 6,
                runs_total: 6,
                event: 'Yash Dayal to RK Singh, SIX!'
              }
            ]
          },
          source: 'live_llm',
          llm_metadata: {
            provider: 'groq',
            model: 'openai/gpt-oss-20b',
            latency_ms: 850
          },
          user_question: q
        })
      });
    });

    await page.goto('/');

    // 1. First verify default Explain button works without custom prompt
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    const modal = page.getByTestId('explanation-modal-card');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('explanation-text')).toBeVisible();
    // In default mode, user-qa-card should NOT be visible
    await expect(page.getByTestId('user-qa-card')).not.toBeVisible();

    expect(capturedRequests[0].custom_prompt).toBeUndefined();

    // 2. Test Question 1: "Why did KKR's win probability increase in the final over?"
    const input = page.getByTestId('custom-prompt-input');
    const submitBtn = page.getByTestId('submit-custom-prompt-btn');

    const q1 = "Why did KKR's win probability increase in the final over?";
    await input.fill(q1);
    await submitBtn.click();

    await expect(page.getByTestId('user-qa-card')).toBeVisible();
    await expect(page.getByTestId('user-question-text')).toContainText(q1);
    await expect(page.getByTestId('user-answer-text')).toContainText('0.1% to 100.0%');
    await expect(page.getByTestId('explanation-headline')).toContainText('Five Consecutive Sixes Drove Comeback');

    expect(capturedRequests[1].custom_prompt).toBe(q1);

    // 3. Test Question 2: "How many sixes did Rinku Singh hit in the final five balls?"
    const q2 = 'How many sixes did Rinku Singh hit in the final five balls?';
    await input.fill(q2);
    await submitBtn.click();

    await expect(page.getByTestId('user-question-text')).toContainText(q2);
    await expect(page.getByTestId('user-answer-text')).toContainText('5 consecutive sixes on deliveries 19.2, 19.3, 19.4, 19.5, and 19.6');
    await expect(page.getByTestId('explanation-headline')).toContainText('Rinku Singh Hit 5 Consecutive Sixes');

    expect(capturedRequests[2].custom_prompt).toBe(q2);

    // 4. Test Question 3: "Who was bowling the final over?"
    const q3 = 'Who was bowling the final over?';
    await input.fill(q3);
    await submitBtn.click();

    await expect(page.getByTestId('user-question-text')).toContainText(q3);
    await expect(page.getByTestId('user-answer-text')).toContainText('Yash Dayal was bowling the 20th over');
    await expect(page.getByTestId('explanation-headline')).toContainText('Yash Dayal Bowled Final Over');

    expect(capturedRequests[3].custom_prompt).toBe(q3);

    // Verify all 3 questions produced completely distinct headlines and explanations
    const headlines = [
      await page.getByTestId('explanation-headline').innerText()
    ];
    expect(headlines[0]).toContain('Yash Dayal');

    // Close modal
    await page.getByTestId('close-explanation-modal-btn').click();
    await expect(modal).not.toBeVisible();
  });

  test('Gracefully displays error message if custom question inference fails', async ({ page }) => {
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
        }),
      });
    });

    let callCount = 0;
    await page.route('**/api/explain', async (route) => {
      callCount++;
      if (callCount === 1) {
        // Initial default explain works
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            turning_point_id: 'tp_1359487_1',
            match_id: '1359487',
            headline: 'Initial Shift',
            explanation: 'Initial default explanation.',
            takeaway: 'Initial takeaway.',
            supporting_delivery_ids: [117],
            verified_evidence: { deliveries: [] },
            source: 'live_llm'
          })
        });
      } else {
        // Custom prompt fails with HTTP 500
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'Rate limit or provider timeout'
        });
      }
    });

    await page.goto('/');
    const explainBtn = page.locator('button:has-text("Explain")').first();
    await explainBtn.click();

    await expect(page.getByTestId('explanation-modal-card')).toBeVisible();

    // Ask a question that fails
    const input = page.getByTestId('custom-prompt-input');
    await input.fill('Will this fail?');
    await page.getByTestId('submit-custom-prompt-btn').click();

    // Error alert must be shown without crashing
    const errAlert = page.getByTestId('qa-error-alert');
    await expect(errAlert).toBeVisible();
    await expect(errAlert).toContainText('AI service returned HTTP 500');

    // Modal is still intact and operable
    await page.getByTestId('close-explanation-modal-btn').click();
  });
});

