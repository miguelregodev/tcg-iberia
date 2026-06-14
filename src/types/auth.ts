import 'next-auth';

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
  }
}
