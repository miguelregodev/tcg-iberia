import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
      fullName?: string | null;
    };
  }

  interface JWT {
    id: string;
    role?: string;
    fullName?: string | null;
    /**
     * Unix timestamp (seconds) at which the session must be invalidated,
     * regardless of activity. Enforces a hard 24h cap (no sliding renewal).
     */
    absoluteExp?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    fullName?: string | null;
    /** See `next-auth` JWT interface – absolute expiry timestamp (seconds). */
    absoluteExp?: number;
  }
}
