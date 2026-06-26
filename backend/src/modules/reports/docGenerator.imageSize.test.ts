import { describe, expect, it } from 'vitest';
import {
  computeImageSizePx,
  createPhotoImageModule,
  MAX_IMAGE_WIDTH_EMU,
  MAX_IMAGE_WIDTH_PX,
} from './docGenerator.js';

describe('computeImageSizePx (R4.8 — bound width to 14 cm, preserve aspect)', () => {
  it('bounds the 14 cm constant to whole pixels at 9525 EMU/px', () => {
    expect(MAX_IMAGE_WIDTH_EMU).toBe(5_300_000);
    expect(MAX_IMAGE_WIDTH_PX).toBe(Math.floor(5_300_000 / 9525));
    // sanity: rendered width never exceeds the 14 cm EMU bound
    expect(MAX_IMAGE_WIDTH_PX * 9525).toBeLessThanOrEqual(MAX_IMAGE_WIDTH_EMU);
  });

  it('leaves images narrower than the bound unchanged (no upscaling)', () => {
    const [w, h] = computeImageSizePx(200, 100);
    expect(w).toBe(200);
    expect(h).toBe(100);
  });

  it('scales a too-wide image down to the bound, preserving aspect ratio', () => {
    const srcWidth = MAX_IMAGE_WIDTH_PX * 2;
    const srcHeight = MAX_IMAGE_WIDTH_PX; // 2:1 aspect
    const [w, h] = computeImageSizePx(srcWidth, srcHeight);
    expect(w).toBe(MAX_IMAGE_WIDTH_PX);
    // height halved to preserve the 2:1 ratio
    expect(h).toBe(Math.round(MAX_IMAGE_WIDTH_PX / 2));
    expect(w / h).toBeCloseTo(srcWidth / srcHeight, 1);
  });

  it('returns width exactly at the bound when source width equals the bound', () => {
    const [w, h] = computeImageSizePx(MAX_IMAGE_WIDTH_PX, 300);
    expect(w).toBe(MAX_IMAGE_WIDTH_PX);
    expect(h).toBe(300);
  });

  it('falls back to a max-width square for non-positive / non-finite dimensions', () => {
    expect(computeImageSizePx(0, 0)).toEqual([
      MAX_IMAGE_WIDTH_PX,
      MAX_IMAGE_WIDTH_PX,
    ]);
    expect(computeImageSizePx(Number.NaN, 100)).toEqual([
      MAX_IMAGE_WIDTH_PX,
      MAX_IMAGE_WIDTH_PX,
    ]);
    expect(computeImageSizePx(-5, -5)).toEqual([
      MAX_IMAGE_WIDTH_PX,
      MAX_IMAGE_WIDTH_PX,
    ]);
  });

  it('never returns a zero height for a valid but extreme aspect ratio', () => {
    const [, h] = computeImageSizePx(MAX_IMAGE_WIDTH_PX * 1000, 1);
    expect(h).toBeGreaterThanOrEqual(1);
  });
});

describe('createPhotoImageModule (configuration readiness)', () => {
  it('constructs the image module without throwing', () => {
    expect(() => createPhotoImageModule()).not.toThrow();
  });
});
