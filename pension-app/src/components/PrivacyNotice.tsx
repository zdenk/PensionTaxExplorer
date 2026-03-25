/**
 * PrivacyNotice — GDPR Art. 13 compliant privacy information modal.
 *
 * Covers: controller identity, purpose, legal basis (consent), processor,
 * retention, all Art. 15-21 data subject rights, right to withdraw consent,
 * and right to lodge a complaint with a supervisory authority.
 */

import { useState } from 'react';
import posthog from 'posthog-js';

interface Props {
  onClose: () => void;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close privacy notice"
      className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
      </svg>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-0.5">
      <span className="text-slate-500 font-medium shrink-0">{label}</span>
      <span className="text-slate-300">{children}</span>
    </div>
  );
}

export function PrivacyNotice({ onClose }: Props) {
  // Use PostHog's native consent status as single source of truth
  const [consent, setConsent] = useState<'granted' | 'denied' | 'pending'>(
    () => posthog.get_explicit_consent_status() ?? 'pending'
  );

  function handleAccept() {
    posthog.opt_in_capturing();
    if (consent === 'pending') posthog.capture('$pageview');
    posthog.startSessionRecording();
    setConsent('granted');
  }

  function handleDecline() {
    posthog.stopSessionRecording();
    posthog.opt_out_capturing();
    setConsent('denied');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        className="relative bg-slate-800 border border-slate-600 rounded-t-lg sm:rounded-lg shadow-2xl max-w-xl w-full mx-0 sm:mx-4 p-5 text-sm text-slate-300 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <CloseButton onClick={onClose} />

        <h2 id="privacy-title" className="text-base font-semibold text-slate-100 mb-4">
          Privacy &amp; Analytics — GDPR Information (Art. 13)
        </h2>

        {/* ── Controller ─────────────────────────────────────────────────── */}
        <section className="mb-4 space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Controller</h3>
          <Row label="Identity">
            EU27 Pension Tax Explorer — personal project by{' '}
            <a href="https://github.com/zdenk" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">
              github.com/zdenk
            </a>
          </Row>
          <Row label="Contact">
            <a
              href="https://github.com/zdenk/PensionTaxExplorer/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 underline hover:text-sky-300"
            >
              GitHub Issues
            </a>
            {' '}(data requests: label your issue "GDPR request")
          </Row>
        </section>

        {/* ── Processing details ─────────────────────────────────────────── */}
        <section className="mb-4 space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">What &amp; Why</h3>
          <Row label="Purpose">Anonymous usage analytics — understanding which countries are compared, which controls are adjusted, and whether JS errors occur, in order to improve the tool.</Row>
          <Row label="Data collected">Page views, button/control interactions (no financial inputs), approximate country derived from IP, browser type, screen size, JS errors, and anonymised session recordings (all form inputs masked).</Row>
          <Row label="NOT collected">Wage inputs, pension results, names, emails, or any directly identifying information.</Row>
          <Row label="Legal basis">
            <strong className="text-slate-200">Consent</strong> — Art. 6(1)(a) GDPR and Art. 5(3) ePrivacy Directive. Analytics are only active if you accept below.
          </Row>
        </section>

        {/* ── Processor / Storage ───────────────────────────────────────── */}
        <section className="mb-4 space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Processor &amp; Storage</h3>
          <Row label="Processor">
            <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">PostHog, Inc.</a>
            {' '}— acting as data processor under a{' '}
            <a href="https://posthog.com/dpa" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">Data Processing Agreement</a>.
          </Row>
          <Row label="Location">EU — PostHog EU Cloud, hosted in Frankfurt (AWS eu-central-1). Data never leaves the EU.</Row>
          <Row label="IP address">Used transiently to derive approximate country; not stored in PostHog beyond session processing.</Row>
          <Row label="Storage method">
            <code className="font-mono text-xs bg-slate-700 px-1 rounded">localStorage</code>
            {' '}in your browser (no cookies set).
          </Row>
          <Row label="Retention">Event data retained for 1 year in PostHog (default). Your consent preference stored locally until you clear browser data or change it below.</Row>
        </section>

        {/* ── Your rights ───────────────────────────────────────────────── */}
        <section className="mb-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your Rights (Art. 15–21 GDPR)</h3>
          <ul className="space-y-1 text-slate-400">
            <li><span className="text-slate-300 font-medium">Access &amp; portability</span> — request a copy of data held about your browser session.</li>
            <li><span className="text-slate-300 font-medium">Erasure</span> — request deletion of any event data linked to your session ID.</li>
            <li><span className="text-slate-300 font-medium">Restriction</span> — request that processing be limited while a dispute is resolved.</li>
            <li><span className="text-slate-300 font-medium">Withdraw consent</span> — use the button below at any time; withdrawing does not affect data already processed.</li>
            <li><span className="text-slate-300 font-medium">Lodge a complaint</span> — you may contact your national data protection authority. A list is available at{' '}
              <a href="https://www.edpb.europa.eu/about-edpb/board/members_en" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">edpb.europa.eu</a>.
            </li>
          </ul>
          <p className="mt-2 text-slate-500 text-xs">
            To exercise rights, open a{' '}
            <a href="https://github.com/zdenk/PensionTaxExplorer/issues" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">
              GitHub Issue
            </a>
            {' '}labelled "GDPR request". We will respond within 30 days.
          </p>
        </section>

        {/* ── Consent control ───────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-700 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-slate-400 text-xs">
            Analytics:{' '}
            {consent === 'pending' && <span className="text-amber-400 font-medium">no choice yet</span>}
            {consent === 'granted' && <span className="text-emerald-400 font-medium">accepted</span>}
            {consent === 'denied' && <span className="text-slate-400 font-medium">declined</span>}
          </span>
          <div className="flex gap-2">
            {consent !== 'denied' && (
              <button
                onClick={handleDecline}
                className="text-xs px-3 py-1.5 rounded border border-slate-500 bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                {consent === 'granted' ? 'Withdraw consent' : 'Decline'}
              </button>
            )}
            {consent !== 'granted' && (
              <button
                onClick={handleAccept}
                className="text-xs px-4 py-1.5 rounded border border-sky-500 bg-sky-600 text-white hover:bg-sky-500 transition-colors font-medium"
              >
                Accept
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
