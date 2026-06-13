import posthog from 'posthog-js';
import type { Properties } from 'posthog-js';

const LOCAL_USER_KEY = 'tcg_uid';

function buildLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `tcg-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateLocalUserId() {
  if (typeof window === 'undefined') return 'anonymous';

  const current = window.localStorage.getItem(LOCAL_USER_KEY);
  if (current) return current;

  const next = buildLocalId();
  window.localStorage.setItem(LOCAL_USER_KEY, next);
  return next;
}

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key || !host) return false;

  posthog.init(key, {
    api_host: host,
    persistence: 'localStorage+cookie',
    capture_pageview: false,
    autocapture: true,
    person_profiles: 'identified_only',
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
      },
    },
  });

  // Ensure capturing is enabled — a previous session may have opted out via
  // shutdownPostHog() which is now cleaned up on re-acceptance of consent.
  posthog.opt_in_capturing();

  const userId = getOrCreateLocalUserId();
  posthog.identify(userId);
  posthog.setPersonPropertiesForFlags({
    userId,
    userType: 'shopper',
  });

  return true;
}

export function shutdownPostHog() {
  try {
    // Reset identity only. We do NOT call opt_out_capturing() here because that
    // writes a persistent flag into PostHog's own localStorage key that survives
    // re-init and would silently block future events when consent is re-granted.
    posthog.reset();
  } catch {
    // Ignore PostHog teardown errors.
  }
}

export function getPostHogSessionId() {
  return posthog.get_session_id() ?? undefined;
}

export function capturePostHogEvent(event: string, properties: Properties) {
  // Do not check posthog.__loaded — PostHog queues events internally before the
  // SDK finishes bootstrapping, so the guard is unnecessary and drops events
  // fired in the same render cycle that called initPostHog().
  if (posthog.has_opted_out_capturing()) return;

  posthog.capture(event, properties);
}
