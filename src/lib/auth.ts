import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';

/**
 * Absolute lifetime of a user session, in seconds.
 * Sessions are HARD-INVALIDATED once this many seconds have elapsed since the
 * initial sign-in — NextAuth's default JWT behaviour re-issues the token on
 * every session check, which produces a sliding window; we override that
 * here so a user is always forced to re-authenticate after 24 hours.
 */
const SESSION_ABSOLUTE_LIFETIME_SECONDS = 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),

  // Use JWT for Credentials provider (stateless); database sessions for OAuth
  session: {
    strategy: 'jwt',
    maxAge: SESSION_ABSOLUTE_LIFETIME_SECONDS, // 24 hours
  },

  jwt: {
    maxAge: SESSION_ABSOLUTE_LIFETIME_SECONDS, // 24 hours — must match session maxAge
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
    // Persist role and id into the JWT and enforce a hard 24h absolute expiry.
    async jwt({ token, user, trigger, session }) {
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (user) {
        // Initial sign-in — stamp identity + absolute expiry on the token.
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? 'USER';
        token.fullName = (user as { name?: string | null }).name ?? null;
        token.absoluteExp =
          nowSeconds + SESSION_ABSOLUTE_LIFETIME_SECONDS;
      }

      // Hard-expire the session 24h after initial sign-in regardless of
      // activity. Tokens issued before this change won't have `absoluteExp`
      // — treat them as already expired so users get a fresh, properly
      // bounded session next time they sign in.
      if (
        typeof token.absoluteExp !== 'number' ||
        nowSeconds >= token.absoluteExp
      ) {
        return null;
      }

      // Allow profile updates to be reflected in token immediately
      if (trigger === 'update' && session) {
        token.fullName = session.fullName ?? token.fullName;
      }
      return token;
    },

    // Expose id and role on the client-side session object. When the jwt
    // callback returns null the token here will be null/empty — we defend
    // against that so no user data ever leaks past the absolute expiry.
    async session({ session, token }) {
      if (token && token.id && session.user) {
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
