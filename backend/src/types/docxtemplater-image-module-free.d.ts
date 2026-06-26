/**
 * Ambient type declaration for `docxtemplater-image-module-free` (v1.1.1).
 *
 * The package ships as CommonJS (`module.exports = ImageModule`) without any
 * bundled `.d.ts`, so we declare the minimal surface that DocGenerator relies
 * on (§3.8, R4.8): the constructor options object with `centered`, `getImage`
 * and `getSize` callbacks. The instance is opaque — it is only ever passed to
 * Docxtemplater's `modules` option.
 */
declare module 'docxtemplater-image-module-free' {
  /** Result of a `getSize` callback: `[widthPx, heightPx]` in pixels. */
  type ImageSize = [number, number];

  interface ImageModuleOptions {
    /**
     * When `false`, only `{%%image}` tags are centered; `{%image}` tags are
     * left-aligned. DocGenerator sets this to `false` (task 9.1).
     */
    centered?: boolean;
    /** `"docx"` (default) or `"pptx"`. */
    fileType?: 'docx' | 'pptx';
    /**
     * Resolves the raw image bytes for a given tag value. In path mode the
     * `tagValue` is an absolute filesystem path (§3.8). May return a Buffer or
     * a Promise resolving to one.
     *
     * Returning `null` signals "no image for this slot" — the image module
     * already short-circuits on a falsy `tagValue` before invoking
     * `getImage`, so `null` is a defensive return that keeps slot-based
     * callbacks total (R5.4: empty slots leave `{%photo_N}` rendered as an
     * empty text run without a `<w:drawing>`).
     */
    getImage(
      tagValue: string,
      tagName: string,
    ): Buffer | Uint8Array | null | Promise<Buffer | Uint8Array | null>;
    /**
     * Returns `[widthPx, heightPx]` for the image; the module converts pixels
     * to EMU internally (9525 EMU/px). May return a Promise for async sizing.
     */
    getSize(
      img: Buffer | Uint8Array,
      tagValue: string,
      tagName: string,
    ): ImageSize | Promise<ImageSize>;
  }

  class ImageModule {
    constructor(options: ImageModuleOptions);
  }

  export = ImageModule;
}
