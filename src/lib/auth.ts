import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),

  // Use JWT for Credentials provider (stateless); database sessions for OAuth
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours — must match session maxAge
  },

  pages: {
    signIn: '/',        // redirect here on unauthenticated, modal handles the UI
    error: '/',         // auth errors land on home
  },

  providers: [
    // ── Email + Password ──────────────────────────────────────────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: String(credentials.email) },
          });

          if (!user || !user.passwordHash) return null;

          const isValid = await bcrypt.compare(
            String(credentials.password),
            user.passwordHash,
          );

          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.fullName,
            image: user.image,
            role: user.role,
          };
        } catch (err) {
          Sentry.captureException(err, { tags: { module: 'auth', action: 'credentials_authorize' } });
          return null;
        }
      },
    }),
  ],

  callbacks: {
    // Persist role and id into the JWT
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? 'USER';
        token.fullName = (user as { name?: string | null }).name ?? null;
      }
      // Allow profile updates to be reflected in token immediately
      if (trigger === 'update' && session) {
        token.fullName = session.fullName ?? token.fullName;
      }
      return token;
    },

    // Expose id and role on the client-side session object
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? 'USER';
        session.user.fullName = (token.fullName as string | null) ?? null;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      try {
        const { captureServerEvent } = await import('@/lib/analytics/posthog-server');
        captureServerEvent(user.id ?? 'unknown', 'user_logged_in', {
          isNewUser: isNewUser ?? false,
        });
      } catch (_) {
        // PostHog is optional – never break auth
      }
    },
    async signOut() {
      // Event captured client-side in the logout handler
    },
  },

  debug: process.env.NODE_ENV === 'development',
});
