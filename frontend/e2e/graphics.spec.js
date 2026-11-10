// The WebGL background and gem: still versions when WebGL is missing or
// reduced motion is preferred, and no errors either way.
import { test, expect } from './support.js';

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

test.describe('with WebGL switched off', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the page renders with the still background and gem, and no errors', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
        if (/webgl/i.test(type)) return null;
        return original.call(this, type, ...rest);
      };
    });
    const errors = collectErrors(page);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('page-background')).toHaveAttribute('data-mode', 'static');
    await expect(page.getByTestId('gem-static')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('with reduced motion preferred', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing animates: still background and gem, no canvas', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/login');
    await expect(page.getByTestId('page-background')).toHaveAttribute('data-mode', 'static');
    await expect(page.getByTestId('gem-static')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('with WebGL available and motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('uses the animated versions when the browser supports WebGL, without errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/login');
    const webgl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
    });
    test.skip(!webgl, 'This browser build has no WebGL; the fallback is covered above.');

    await expect(page.getByTestId('page-background')).toHaveAttribute('data-mode', 'animated');
    await expect(page.getByTestId('gem-animated')).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
    expect(errors.filter((e) => !/GPU stall|WebGL: CONTEXT_LOST/i.test(e))).toEqual([]);
  });
});
