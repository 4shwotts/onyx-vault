// Records the sign-up flow as an animated GIF for the README:
// sign up → check your email → verify → sign in → dashboard.
// Screenshots are taken at each step and encoded with gifenc (MIT).
// The result must stay under 200 kB (checked by src/assets.test.js).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../docs/media/signup-flow.gif');
const WIDTH = 360;
const HEIGHT = 600;
const COLOURS = 48;

test.use({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

test('record the sign-up flow', async ({ page }) => {
  const frames = [];
  const shot = async (holdMs) => frames.push({ png: await page.screenshot(), holdMs });
  const typeSlowly = async (locator, text, chunk) => {
    for (let i = chunk; i < text.length + chunk; i += chunk) {
      await locator.fill(text.slice(0, i));
      await shot(140);
    }
  };

  const email = `new.user.${Date.now()}@gmail.com`;
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(1400);

  await typeSlowly(page.getByLabel('Email'), email, 7);
  await typeSlowly(page.getByLabel('Password', { exact: true }), 'correct-horse-battery', 7);
  await shot(500);
  await page.waitForTimeout(400); // the bot check's minimum time (shortened under test)
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await shot(2200);

  // The link from the (test) email.
  const mail = await (await page.request.get(`/api/__test__/outbox?to=${encodeURIComponent(email)}`)).json();
  const link = new URL(mail.link);
  await page.goto(link.pathname + link.search);
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  await shot(1800);

  await page.getByRole('link', { name: 'Go to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await shot(900);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('No accounts yet — add one on the Accounts page.')).toBeVisible();
  await page.waitForTimeout(300);
  await shot(3000);

  // Encode. After the first frame, only pixels that changed are stored;
  // the rest are transparent, so the previous frame shows through. Most of
  // the screen (the brushed-metal background) never changes, which keeps
  // the file small.
  const gif = GIFEncoder();
  let previous = null;
  for (const { png, holdMs } of frames) {
    const { data, width, height } = PNG.sync.read(png);
    const palette = quantize(data, COLOURS - 1);
    const indexed = applyPalette(data, palette);
    const transparentIndex = palette.length;
    if (previous) {
      for (let i = 0; i < indexed.length; i += 1) {
        const p = i * 4;
        if (data[p] === previous[p] && data[p + 1] === previous[p + 1] && data[p + 2] === previous[p + 2]) {
          indexed[i] = transparentIndex;
        }
      }
    }
    gif.writeFrame(indexed, width, height, {
      palette: [...palette, [0, 0, 0]],
      delay: holdMs,
      transparent: Boolean(previous),
      transparentIndex,
      dispose: 1, // keep this frame under the next one
    });
    previous = data;
  }
  gif.finish();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, gif.bytes());
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`Wrote ${OUT} — ${frames.length} frames, ${kb} kB`);
  expect(fs.statSync(OUT).size).toBeLessThan(200 * 1024);
});
