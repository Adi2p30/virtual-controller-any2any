// Tiny client that POSTs partial controller state to the server's /api/input.
// Changes are coalesced into the next packet, but we allow a few concurrent
// in-flight POSTs so a button press never has to wait for a stick POST's
// round-trip — input latency is decoupled from network RTT. Each packet is
// stamped with a monotonic _seq; the server drops any that arrive out of order,
// so overlapping sends can't clobber newer state.

import { useCallback, useEffect, useRef, useState } from "react";

export type ConnStatus = "idle" | "ok" | "err";

// How many POSTs may be in flight at once. >1 removes the RTT coupling; small
// enough to still apply backpressure on a slow/lossy link.
const MAX_INFLIGHT = 4;

export function useSender() {
  const [serverUrl, setServerUrl] = useState("");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const inflight = useRef(0);
  const pending = useRef<Record<string, unknown> | null>(null);
  const seq = useRef(0);

  // default server base: same hostname, port 3000 (where the monitor runs)
  useEffect(() => {
    const saved = localStorage.getItem("serverUrl");
    const fallback = `${window.location.protocol}//${window.location.hostname}:3000`;
    setServerUrl(saved || fallback);
  }, []);

  const persist = useCallback((url: string) => {
    setServerUrl(url);
    localStorage.setItem("serverUrl", url);
  }, []);

  const flush = useCallback(async () => {
    if (inflight.current >= MAX_INFLIGHT || !pending.current || !serverUrl) return;
    const body = pending.current;
    pending.current = null;
    inflight.current += 1;
    // tag each packet so the server can detect dropped/out-of-order inputs
    seq.current += 1;
    body._seq = seq.current;
    body._t = Date.now();
    try {
      const res = await fetch(`${serverUrl}/api/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
      setStatus(res.ok ? "ok" : "err");
    } catch {
      setStatus("err");
    } finally {
      inflight.current -= 1;
      if (pending.current) flush();
    }
  }, [serverUrl]);

  // merge a partial update into the pending payload, then try to flush
  const send = useCallback(
    (partial: Record<string, unknown>) => {
      const prev = pending.current ?? {};
      // shallow-merge nested objects (buttons/sticks/triggers)
      for (const k of Object.keys(partial)) {
        const v = partial[k];
        if (v && typeof v === "object" && !Array.isArray(v)) {
          prev[k] = { ...(prev[k] as object), ...(v as object) };
        } else {
          prev[k] = v;
        }
      }
      pending.current = prev;
      flush();
    },
    [flush],
  );

  return { send, serverUrl, setServerUrl: persist, status };
}
