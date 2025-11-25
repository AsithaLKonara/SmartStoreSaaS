// import NextAuth from "next-auth" // Unused import removed

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique id. */
      id: string
      /** The user's name. */
      name?: string | null
      /** The user's email address. */
      email?: string | null
      /** The user's image. */
      image?: string | null
      /** The user's organization ID. */
      organizationId?: string | null
      /** The user's role. */
      role?: string | null
    }
  }

  interface User {
    /** The user's unique id. */
    id: string
    /** The user's name. */
    name?: string | null
    /** The user's email address. */
    email?: string | null
    /** The user's image. */
    image?: string | null
    /** The user's organization ID. */
    organizationId?: string | null
    /** The user's role. */
    role?: string | null
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's unique id. */
    id: string
    /** The user's organization ID. */
    organizationId?: string | null
    /** The user's role. */
    role?: string | null
  }
}
