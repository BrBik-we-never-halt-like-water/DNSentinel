/**
 * Landing page — the marketing surface plus the search entry point.
 *
 * Submitting the search navigates to /report rather than expanding results underneath,
 * so a scan is a destination with its own URL, back-button behaviour and title.
 */
import { useNavigate } from 'react-router-dom';
import { Faq, Features, Hero, Process, TrustStrip } from '../components/sections/Landing.jsx';

export function LandingPage({ onOpenCompare, onOpenMonitor, onOpenBulk }) {
  const navigate = useNavigate();

  const startScan = (domain) => {
    // useScan normalises the input again; encode here purely for the URL.
    navigate(`/report?domain=${encodeURIComponent(domain)}`);
  };

  return (
    <>
      <Hero
        onSubmit={startScan}
        analyzing={false}
        onOpenCompare={onOpenCompare}
        onOpenMonitor={onOpenMonitor}
        onOpenBulk={onOpenBulk}
      />
      <TrustStrip />
      <Features />
      <Process />
      <Faq />
    </>
  );
}
