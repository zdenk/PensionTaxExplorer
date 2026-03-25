/**
 * ConsentBanner — GDPR / ePrivacy opt-in banner shown on first visit.
 *
 * Uses PostHog's native consent API (get_explicit_consent_status) as the
 * single source of truth — no parallel localStorage key needed.
 */

import { useState } from 'react';
import { usePostHog } from '@posthog/react';

interface Props {
  /** Called when the user opens the full privacy notice modal. */
  onShowPrivacy: () => void;
}

export function ConsentBanner({ onShowPrivacy }: Props) {
  const posthog = usePostHog();

  // 'pending' = no decision yet; 'granted' | 'denied' = already decided
  const [status, setStatus] = useState(() => posthog?.get_explicit_consent_status() ?? 'pending');

  // Only show when no choice has been stored
  if (status !== 'pending') return null;

  function handleAccept() {
    posthog?.opt_in_capturing();
    // Fire the pageview that was suppressed while consent was pending
    posthog?.capture('$pageview');
    posthog?.startSessionRecording();
    setStatus('granted');
  }

  function handleDecline() {
    posthog?.stopSessionRecording();
    posthog?.opt_out_capturing();
    setStatus('denied');
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Analytics consent"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t border-slate-600 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <p className="text-xs text-slate-300 leading-relaxed flex-1 min-w-[260px]">
          <span className="font-medium text-slate-100">We use analytics</span>
          {' '}to understand how this free tool is used (e.g. which countries you compare).
          No personal data or financial inputs are collected.
          {' '}
          <button
            onClick={onShowPrivacy}
            className="underline text-sky-400 hover:text-sky-300 transition-colors"
          >
            Full details &amp; your rights →
          </button>
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="text-xs px-3 py-1.5 rounded border border-slate-500 bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="text-xs px-4 py-1.5 rounded border border-sky-500 bg-sky-600 text-white hover:bg-sky-500 transition-colors font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
