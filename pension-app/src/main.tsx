import React from 'react';
import ReactDOM from 'react-dom/client';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import './index.css';

const POSTHOG_TOKEN = import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ??
  'https://eu.i.posthog.com';

// Analytics must not fire until the user explicitly consents (GDPR Art. 6(1)(a) +
// ePrivacy Directive Art. 5(3)).
//
// opt_out_capturing_by_default: true — PostHog starts silent on every cold init.
//   PostHog ignores this flag on return visits where opt_in_capturing() has
//   already been stored, so returning visitors who consented are not blocked.
//
// cookieless_mode: 'on_reject' — prevents PostHog writing its own persistence
//   entry (cookie or localStorage) before the user has given consent.
if (POSTHOG_TOKEN) {
  posthog.init(POSTHOG_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: '2026-01-30',
    persistence: 'localStorage',
    opt_out_capturing_by_default: true,
    cookieless_mode: 'on_reject',
    // Session recording — only activates after the user opts in.
    // maskAllInputs: true hides every <input> / <textarea> value in replays
    // (GDPR-safe; wage slider values are never captured as text anyway).
    session_recording: {
      maskAllInputs: true,
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </React.StrictMode>
);
