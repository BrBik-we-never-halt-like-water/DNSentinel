/**
 * useScan — React port of the legacy `runLookup()` / `go()` orchestrator.
 *
 * Behaviour preserved exactly:
 *  • all 26 checks fire against the same endpoints with the same request bodies
 *  • 6 requests in flight at a time (server rate-limit friendly)
 *  • each result lands independently, so panes fill in progressively
 *  • a failed check degrades to `{ error }` in its own slot instead of aborting the run
 *  • starting a new scan aborts the previous one; late responses from a superseded
 *    run are discarded via a run token, so stale data can never overwrite fresh data
 *  • the same completion toast wording: all-ok / all-failed / partial
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHECK_ORDER, ENDPOINTS, fetchJSON, runPool } from '../utils/api.js';
import { normalizeDomain } from '../utils/format.js';
import { pushSearchHistory } from '../utils/storage.js';
import { useToasts } from './useToasts.jsx';

/** Every state slot the panes read, matching the legacy `S` object's keys. */
export const EMPTY_STATE = Object.freeze(
  Object.fromEntries(Object.keys(ENDPOINTS).map((k) => [k, null]))
);

export function useScan() {
  const { toast } = useToasts();

  const [domain, setDomain] = useState('');
  const [data, setData] = useState(EMPTY_STATE);
  const [analyzing, setAnalyzing] = useState(false);
  const [started, setStarted] = useState(false);

  // Which individual checks are still outstanding — drives per-pane spinners.
  const [pending, setPending] = useState({});

  const abortRef = useRef(null);
  const tokenRef = useRef(0);

  // Abort any in-flight scan when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (raw) => {
      const target = normalizeDomain(raw || '');
      if (!target) {
        toast('Enter a domain to analyze', 'warn');
        return;
      }

      // Supersede any running scan. The token guards against late responses.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const myToken = ++tokenRef.current;

      setDomain(target);
      setStarted(true);
      setAnalyzing(true);
      setData(EMPTY_STATE);
      setPending(Object.fromEntries(CHECK_ORDER.map(([k]) => [k, true])));
      pushSearchHistory(target);

      let failed = 0;

      const tasks = CHECK_ORDER.map(([key, extra]) => async () => {
        let d;
        try {
          d = await fetchJSON(ENDPOINTS[key], { domain: target, ...extra }, controller.signal);
        } catch (e) {
          if (e?.name === 'AbortError') return; // superseded by a newer run
          d = { error: 'Request failed — please retry.' };
        }
        if (myToken !== tokenRef.current) return; // a newer analysis owns the UI now
        if (d?.error) failed++;

        // One slot at a time so every pane renders the moment its data lands.
        setData((prev) => ({ ...prev, [key]: d }));
        setPending((prev) => ({ ...prev, [key]: false }));
      });

      await runPool(tasks, 6, controller.signal);

      if (controller.signal.aborted || myToken !== tokenRef.current) return;

      setAnalyzing(false);

      if (failed === 0) toast(`Analysis complete for ${target}`, 'ok');
      else if (failed >= tasks.length) toast(`Analysis failed — could not reach ${target}`, 'err');
      else toast(`Analysis complete · ${failed} check${failed !== 1 ? 's' : ''} unavailable`, 'warn');
    },
    [toast]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    tokenRef.current++;
    setStarted(false);
    setAnalyzing(false);
    setDomain('');
    setData(EMPTY_STATE);
    setPending({});
  }, []);

  return { domain, data, analyzing, started, pending, run, reset };
}
