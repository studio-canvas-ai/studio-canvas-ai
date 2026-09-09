import {
  PARTNER_REF_COOKIE_MAX_AGE,
} from "@/lib/partners/constants";
import { useSecureAuthCookies } from "@/lib/authCookies";

export function partnerRefCookieOptions(maxAge = PARTNER_REF_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureAuthCookies(),
    maxAge,
  };
}
