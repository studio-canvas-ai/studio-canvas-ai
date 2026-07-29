import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    credits?: number;
    planId?: string;
    authProvider?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    credits?: number;
    planId?: string;
    authProvider?: string;
  }
}
