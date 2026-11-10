// Image size checks: every image and icon the app ships, and the README's
// sign-up animation, must be under 200 kB, so a phone on a slow
// connection never waits on artwork. Counted separately from the
// functional tests.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 200 * 1024;
const IMAGE = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i;
const root = path.resolve(__dirname, '..');

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listImages(full);
    return IMAGE.test(entry.name) ? [full] : [];
  });
}

const images = [
  ...listImages(path.join(root, 'public')),
  ...listImages(path.join(root, 'src')),
  ...listImages(path.resolve(root, '../docs')),
];

describe('image sizes', () => {
  it('finds the shipped images', () => {
    expect(images.length).toBeGreaterThanOrEqual(15);
    expect(images.some((f) => f.endsWith('signup-flow.gif'))).toBe(true);
  });

  it.each(images.map((file) => [path.relative(root, file).replace(/\\/g, '/'), file]))('%s is under 200 kB', (_name, file) => {
    expect(fs.statSync(file).size).toBeLessThan(MAX_BYTES);
  });
});
