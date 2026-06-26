/**
 * Constants, types, and pure helpers backing the 6 fixed photo-slot
 * placeholders of `Docx_Template_V3` (`{%photo_1}…{%photo_6}` plus
 * `{caption_1}…{caption_6}`). The slot-based render scope replaces the
 * legacy `{#photos}…{/photos}` append-loop. See
 * `.kiro/specs/docx-photo-slots/design.md` for the full design.
 *
 * This file exposes the constants, inventory tuple (with real EMU
 * values captured from the pre-migration `Docx_Template_V2` snapshot via
 * `backend/scripts/inventory-placeholders.cjs`), `emptyPhotoSlotScope`,
 * the slot-index tag parser `parseSlotIndexFromTag`, and the pixel
 * sizing helper `computeSlotImageSizePx`.
 */

/** Number of fixed photo slots in `Docx_Template_V3`. */
export const PHOTO_SLOT_COUNT = 6 as const;

/**
 * EMU per pixel at 96 DPI (914400 EMU/inch ÷ 96 px/inch). The
 * docxtemplater image module's `getSize` callback returns dimensions in
 * **pixels**; the module multiplies by this factor internally to emit
 * the `<wp:extent>` EMU values.
 */
export const EMU_PER_PIXEL = 9525 as const;

/** EMU dimensions of one slot (English Metric Units). */
export interface SlotSizeEMU {
  readonly cx: number; // width
  readonly cy: number; // height
}

/**
 * Frozen EMU sizes of the six photo slots in `Docx_Template_V3`, in the
 * order of the original image-anchors top-to-bottom in `word/document.xml`
 * of the pre-migration `Docx_Template_V2`. Source of truth for slot
 * geometry in code; `SLOT_SIZE_INVENTORY[N - 1]` ↔ `{%photo_N}`.
 *
 * These values were captured from the V2 snapshot via
 * `backend/scripts/inventory-placeholders.cjs` (see
 * `backend/scripts/inventory-out.json#slotSizes`). All six anchors share
 * identical dimensions in the source template: `{cx: 2_988_000, cy:
 * 2_242_800}` EMU, ≈ 8.21 cm × 6.16 cm (≈ 313 × 235 px at 96 DPI). The
 * R2.3 invariant (`Number.isInteger(cx) && cx > 0 &&
 * Number.isInteger(cy) && cy > 0`) holds for every entry.
 */
export const SLOT_SIZE_INVENTORY: readonly [
  SlotSizeEMU,
  SlotSizeEMU,
  SlotSizeEMU,
  SlotSizeEMU,
  SlotSizeEMU,
  SlotSizeEMU,
] = [
  { cx: 2_988_000, cy: 2_242_800 },
  { cx: 2_988_000, cy: 2_242_800 },
  { cx: 2_988_000, cy: 2_242_800 },
  { cx: 2_988_000, cy: 2_242_800 },
  { cx: 2_988_000, cy: 2_242_800 },
  { cx: 2_988_000, cy: 2_242_800 },
] as const;

/**
 * Slot-based render scope passed (spread) into `doc.render` for the 12
 * photo/caption placeholders of `Docx_Template_V3`. All 12 keys are
 * always present: an empty slot is represented by `''`, never
 * `undefined`. The object contains no other fields (R5.1c, P1).
 */
export interface PhotoSlotScope {
  photo_1: string;
  photo_2: string;
  photo_3: string;
  photo_4: string;
  photo_5: string;
  photo_6: string;
  caption_1: string;
  caption_2: string;
  caption_3: string;
  caption_4: string;
  caption_5: string;
  caption_6: string;
}

/**
 * Returns a fresh empty {@link PhotoSlotScope}: all six `photo_N` and all
 * six `caption_N` fields equal `''`. Used as the starting point for
 * `buildPhotoScope` and as the default when no photos are provided
 * (R9.5).
 */
export function emptyPhotoSlotScope(): PhotoSlotScope {
  return {
    photo_1: '',
    photo_2: '',
    photo_3: '',
    photo_4: '',
    photo_5: '',
    photo_6: '',
    caption_1: '',
    caption_2: '',
    caption_3: '',
    caption_4: '',
    caption_5: '',
    caption_6: '',
  };
}

/**
 * Parses the slot index out of a docxtemplater tag name of the form
 * `photo_N` where `N ∈ {1..6}`. Returns the integer `N` on a successful
 * match, otherwise `null`. Used by the image module's `getSize` callback
 * to dispatch each `{%photo_N}` to `SLOT_SIZE_INVENTORY[N - 1]`.
 *
 * Tag names outside the supported set (e.g. `photo_0`, `photo_7`,
 * `caption_1`, the empty string, or anything that does not match the
 * `^photo_([1-6])$` shape) yield `null`. Receiving `null` in the image
 * module is treated as a defensive fallback by the caller rather than
 * an error.
 */
export function parseSlotIndexFromTag(tagName: string): number | null {
  const match = /^photo_([1-6])$/.exec(tagName);
  if (match === null) return null;
  return Number.parseInt(match[1] as string, 10);
}

/**
 * Computes the pixel dimensions to pass back from the docxtemplater image
 * module's `getSize` callback for `{%photo_N}` (slot `N`), fitting the
 * source image into `SLOT_SIZE_INVENTORY[slotIndex - 1]` with aspect
 * ratio preserved and **no upscaling**.
 *
 * Algorithm (mirrors `design.md`):
 *
 * ```
 * slot     = SLOT_SIZE_INVENTORY[slotIndex - 1]
 * slotWPx  = max(1, floor(slot.cx / EMU_PER_PIXEL))
 * slotHPx  = max(1, floor(slot.cy / EMU_PER_PIXEL))
 *
 * if !isFinite(srcW) || !isFinite(srcH) || srcW <= 0 || srcH <= 0:
 *     return [slotWPx, slotHPx]                         // R7.6 fallback
 *
 * srcWInt = round(srcW); srcHInt = round(srcH)
 * if srcWInt <= slotWPx && srcHInt <= slotHPx:
 *     return [max(1, srcWInt), max(1, srcHInt)]         // R7.5 no upscaling
 *
 * scale = min(slotWPx / srcW, slotHPx / srcH)           // fit-in
 * wPx   = max(1, floor(srcW * scale))
 * hPx   = max(1, floor(srcH * scale))
 * return [wPx, hPx]
 * ```
 *
 * Contract (closes Property 10–12):
 *
 *   * `wPx * EMU_PER_PIXEL ≤ slot.cx`
 *   * `hPx * EMU_PER_PIXEL ≤ slot.cy`
 *   * `wPx ≥ 1`, `hPx ≥ 1`
 *   * When `round(srcW) ≤ slotWPx && round(srcH) ≤ slotHPx`, returns
 *     exactly `[max(1, round(srcW)), max(1, round(srcH))]` — no
 *     upscaling, no rescaling on the rounding axis.
 *
 * `slotIndex` is expected to be an integer in `{1..6}`. As a defensive
 * fallback (mirroring the `parseSlotIndexFromTag(...) ?? 1` discipline
 * in `createPhotoImageModule`), values outside that range collapse to
 * slot 1. `floor` is used in the downscale branch instead of `round` to
 * guarantee the EMU-bound inequalities hold strictly without a
 * post-clamp.
 */
export function computeSlotImageSizePx(
  srcWidth: number,
  srcHeight: number,
  slotIndex: number,
): [number, number] {
  const safeIndex =
    Number.isInteger(slotIndex) &&
    slotIndex >= 1 &&
    slotIndex <= PHOTO_SLOT_COUNT
      ? slotIndex
      : 1;
  const slot = SLOT_SIZE_INVENTORY[safeIndex - 1] as SlotSizeEMU;

  // Slot pixel bounds; clamp to ≥ 1 so that fallback / downscale paths
  // never return zero dimensions even for a pathologically tiny slot
  // (`slot.cx < EMU_PER_PIXEL`).
  const slotWPx = Math.max(1, Math.floor(slot.cx / EMU_PER_PIXEL));
  const slotHPx = Math.max(1, Math.floor(slot.cy / EMU_PER_PIXEL));

  // R7.6 fallback: non-finite or non-positive source dimensions.
  if (
    !Number.isFinite(srcWidth) ||
    !Number.isFinite(srcHeight) ||
    srcWidth <= 0 ||
    srcHeight <= 0
  ) {
    return [slotWPx, slotHPx];
  }

  const srcWInt = Math.round(srcWidth);
  const srcHInt = Math.round(srcHeight);

  // R7.5 no-upscaling: source already fits inside the slot in pixels.
  // `max(1, …)` guards against sub-pixel sources that round to 0.
  if (srcWInt <= slotWPx && srcHInt <= slotHPx) {
    return [Math.max(1, srcWInt), Math.max(1, srcHInt)];
  }

  // Fit-in downscale: preserve aspect ratio, floor to keep
  // `wPx * EMU_PER_PIXEL ≤ slot.cx` and `hPx * EMU_PER_PIXEL ≤ slot.cy`.
  const scale = Math.min(slotWPx / srcWidth, slotHPx / srcHeight);
  const wPx = Math.max(1, Math.floor(srcWidth * scale));
  const hPx = Math.max(1, Math.floor(srcHeight * scale));
  return [wPx, hPx];
}
