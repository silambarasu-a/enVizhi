import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      baseCurrency: string;
    };
    expires: string;
  }

  interface User {
    baseCurrency?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    baseCurrency?: string;
  }
}
