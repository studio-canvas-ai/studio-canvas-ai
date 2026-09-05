/**
 * Shared lookbook framing / scale constants — keep subject prominent, never miniature.
 */

/** Forced into every subject generate / inpaint prompt. */
export const LOOKBOOK_PORTRAIT_FRAMING =
  "Medium-to-full body portrait shot, prominent subject in the foreground, highly detailed facial features";

/** Anti wide-landscape miniature subject. */
export const LOOKBOOK_SCALE_LOCK = [
  "NOT a wide establishing landscape shot",
  "NOT a distant tiny figure",
  "Subject fills most of the frame height",
  "editorial lookbook portrait scale",
  "grand scenery may appear behind but the person remains the clear focal point and large in frame",
].join(". ");

/**
 * Subject cutouts are always generated at a portrait aspect so the model
 * does not invent a wide scenic plate with a miniature person — even when
 * the canvas format is 16:9 / 4:3.
 */
export const LOOKBOOK_SUBJECT_GEN_ASPECT = "3:4";

/** Target subject bbox height as fraction of stage (portrait scale). */
export const LOOKBOOK_SUBJECT_HEIGHT_TARGET = 0.72;

/** Hard floor: subject must occupy at least this fraction of stage height. */
export const LOOKBOOK_SUBJECT_HEIGHT_MIN = 0.5;

/** Max subject width as fraction of stage. */
export const LOOKBOOK_SUBJECT_WIDTH_MAX = 0.88;
