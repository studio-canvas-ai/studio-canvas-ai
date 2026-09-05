/**
 * Shared UI bus so Screen 26 bottom "내갤러리불러오기" opens the same
 * gallery vault popover as top-left "내 갤러리 저장".
 */

export const SCA_GALLERY_VAULT_EVENT = "sca-gallery-vault";

export type ScaGalleryVaultDetail = {
  action: "toggle" | "open" | "close";
  /** Position the menu next to this element (e.g. bottom trigger). */
  anchor?: HTMLElement | null;
};

export function dispatchScaGalleryVault(detail: ScaGalleryVaultDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ScaGalleryVaultDetail>(SCA_GALLERY_VAULT_EVENT, { detail })
  );
}
