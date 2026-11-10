// Phone and tablet checks, run in both Chromium and WebKit (Safari's
// engine) with touch: nothing runs off the side of the screen, and the
// pop-ups and command palette work with taps.
import { test, expect, seedUserWithData } from '../support.js';

// layout: which navigation should be used. The desktop bar needs 1067px,
// so anything narrower than 1100px, or a short landscape screen, gets the
// phone layout (bug 18). 1100×800 is the narrowest desktop layout.
const VIEWPORTS = [
  { name: 'small phone 320×568', width: 320, height: 568, layout: 'phone' },
  { name: 'phone 390×844', width: 390, height: 844, layout: 'phone' },
  { name: 'phone landscape 844×390', width: 844, height: 390, layout: 'phone' },
  { name: 'tablet 768×1024', width: 768, height: 1024, layout: 'phone' },
  { name: 'upright iPad Air 820×1180', width: 820, height: 1180, layout: 'phone' },
  { name: 'landscape tablet 1024×768', width: 1024, height: 768, layout: 'phone' },
  { name: 'small laptop window 1100×800', width: 1100, height: 800, layout: 'desktop' },
];

const SIGNED_OUT = ['/login', '/signup', '/forgot-password', '/verify-email', '/privacy', '/disclaimer'];
const SIGNED_IN = ['/dashboard', '/transactions', '/accounts', '/import', '/settings'];

// Anything wider than the screen: the page itself, or any visible element
// whose right edge sticks out past it. Content cut off by an
// overflow:hidden box still counts (the visitor can't see it); only boxes
// that deliberately scroll sideways are allowed to hold wider content.
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const problems = [];
    if (document.documentElement.scrollWidth > width + 1) {
      problems.push(`page is ${document.documentElement.scrollWidth}px wide on a ${width}px screen`);
    }
    const insideSideScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest('.visually-hidden, [aria-hidden="true"], .page-background')) continue;
      if (rect.right > width + 1 && !insideSideScroller(el)) {
        problems.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent || '').trim().slice(0, 30)}" ends at ${Math.round(rect.right)}px`);
      }
    }
    return problems.slice(0, 5);
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true });

    test('signed-out pages fit the screen', async ({ page }) => {
      for (const path of SIGNED_OUT) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        expect(await horizontalOverflow(page), path).toEqual([]);
      }
    });

    test(`uses the ${viewport.layout} navigation, with every link on screen`, async ({ page }) => {
      await seedUserWithData(page.request);
      await page.goto('/dashboard');
      const nav = page.getByRole('navigation', { name: 'Main' });
      // The phone tab bar labels the dashboard "Home"; the desktop bar says "Dashboard".
      await expect(nav.getByRole('link', { name: viewport.layout === 'phone' ? 'Home' : 'Dashboard' })).toBeVisible();
      for (const link of await page.getByRole('banner').getByRole('link').all()) {
        await expect(link).toBeInViewport({ ratio: 1 });
      }
      for (const button of await page.getByRole('banner').getByRole('button').all()) {
        await expect(button).toBeInViewport({ ratio: 1 });
      }
    });

    test('the demo banner and End demo fit, with every header control on screen', async ({ page }) => {
      await page.goto('/demo');
      await expect(page).toHaveURL(/\/dashboard$/);
      const banner = page.getByRole('region', { name: 'Demo mode' });
      await expect(banner).toBeVisible();
      await expect(banner.getByRole('link', { name: 'Read the disclaimer' })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('banner').getByRole('button', { name: 'End demo' })).toBeInViewport({ ratio: 1 });
      for (const control of await page.getByRole('banner').getByRole('button').all()) {
        await expect(control).toBeInViewport({ ratio: 1 });
      }
      for (const path of ['/dashboard', '/transactions', '/settings']) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        expect(await horizontalOverflow(page), path).toEqual([]);
      }
    });

    test('the header sits in exactly the same place on every signed-in page', async ({ page }) => {
      await seedUserWithData(page.request);
      const positions = {};
      for (const path of SIGNED_IN) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        const box = await page.getByRole('banner').boundingBox();
        positions[path] = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
      }
      for (const path of SIGNED_IN) expect(positions[path], path).toEqual(positions['/dashboard']);
    });

    test('signed-in pages fit the screen', async ({ page }) => {
      await seedUserWithData(page.request);
      for (const path of SIGNED_IN) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(await horizontalOverflow(page), path).toEqual([]);
      }
    });

    test('pop-ups work by touch: add form, month picker and command palette', async ({ page }) => {
      await seedUserWithData(page.request);

      // The add-transaction form opens, fits, and closes.
      await page.goto('/transactions');
      await page.getByRole('button', { name: '+ Add' }).tap();
      const form = page.getByRole('form', { name: 'Add transaction' });
      await expect(form).toBeVisible();
      await expect(form.getByLabel('Amount in pounds')).toBeInViewport();
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.getByRole('button', { name: 'Cancel' }).first().tap();
      await expect(form).toBeHidden();

      // The month picker opens, a month can be chosen, a tap outside closes it.
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /^Month:/ }).tap();
      const picker = page.getByRole('dialog', { name: 'Choose a month' });
      await expect(picker).toBeVisible();
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.getByRole('heading', { name: 'Recent Transactions' }).tap();
      await expect(picker).toBeHidden();

      // The command palette opens from the header's Search button and an
      // option can be chosen by tapping it.
      await page.getByRole('button', { name: /^Search/ }).tap();
      const palette = page.getByRole('dialog', { name: 'Search and quick actions' });
      await expect(palette).toBeVisible();
      expect(await horizontalOverflow(page)).toEqual([]);
      await palette.getByRole('option', { name: 'Go to Accounts' }).tap();
      await expect(page).toHaveURL(/\/accounts$/);
      await expect(palette).toBeHidden();
    });
  });
}
