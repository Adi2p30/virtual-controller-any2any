"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ButtonName,
  ControllerState,
  LogEntry,
  Metrics,
  emptyMetrics,
  emptyState,
} from "@/lib/types";
import { APP_VERSION } from "@/lib/version";
import MappingPanel from "./MappingPanel";

const FACE = new Set<ButtonName>(["A", "B", "X", "Y"]);

export default function Page() {
  const [state, setState] = useState<ControllerState>(emptyState);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [origin, setOrigin] = useState("");
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [latency, setLatency] = useState<number | null>(null);
  const [refreshHz, setRefreshHz] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const eventTs = useRef<number[]>([]); // arrival times of update events

  useEffect(() => {
    setOrigin(window.location.origin);
    const es = new EventSource("/api/stream");

    es.addEventListener("snapshot", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setState(d.state);
      setLog(d.log);
      if (d.metrics) setMetrics(d.metrics);
      setConnected(true);
    });

    es.addEventListener("update", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as {
        state: ControllerState;
        logs: LogEntry[];
        metrics: Metrics;
      };
      setState(d.state);
      if (d.metrics) setMetrics(d.metrics);
      // measure how fast updates actually arrive at the monitor
      const now = performance.now();
      const arr = eventTs.current;
      arr.push(now);
      while (arr.length && now - arr[0] > 1000) arr.shift();
      setRefreshHz(arr.length);
      if (d.logs.length) {
        setLog((prev) => [...prev, ...d.logs].slice(-200));
      }
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // ping the server for round-trip latency, and decay the refresh rate when idle
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch("/api/ping", { cache: "no-store" });
        await res.json();
        if (alive) setLatency(Math.round(performance.now() - t0));
      } catch {
        if (alive) setLatency(null);
      }
    };
    ping();
    const pid = setInterval(ping, 2000);
    // recompute Hz on a timer so it falls back to 0 when no inputs arrive
    const hid = setInterval(() => {
      const now = performance.now();
      const arr = eventTs.current;
      while (arr.length && now - arr[0] > 1000) arr.shift();
      setRefreshHz(arr.length);
    }, 500);
    return () => {
      alive = false;
      clearInterval(pid);
      clearInterval(hid);
    };
  }, []);

  const errorRate =
    metrics.received + metrics.errors > 0
      ? (metrics.errors / (metrics.received + metrics.errors)) * 100
      : 0;

  // auto-scroll the log
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const reset = useCallback(() => {
    fetch("/api/reset", { method: "POST" });
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <div className="title">
          VIRTUAL <span>CONTROLLER</span> · LIVE MONITOR
          <span className="ver"> v{APP_VERSION}</span>
        </div>
        <div className="status">
          <span className={`dot ${connected ? "live" : ""}`} />
          {connected ? "stream connected" : "disconnected"}
        </div>
      </div>

      <div className="metrics">
        <Metric
          label="Ping"
          value={latency === null ? "—" : `${latency} ms`}
          tone={latency === null ? "bad" : latency < 60 ? "good" : latency < 150 ? "warn" : "bad"}
        />
        <Metric
          label="Refresh rate"
          value={`${refreshHz} Hz`}
          tone={refreshHz >= 20 ? "good" : refreshHz > 0 ? "warn" : "idle"}
        />
        <Metric
          label="Input rate"
          value={`${metrics.inputHz} Hz`}
          tone={metrics.inputHz > 0 ? "good" : "idle"}
        />
        <Metric label="Inputs" value={metrics.received.toLocaleString()} tone="idle" />
        <Metric
          label="Missed"
          value={metrics.missed.toLocaleString()}
          tone={metrics.missed === 0 ? "good" : "warn"}
        />
        <Metric
          label="Errors"
          value={metrics.errors.toLocaleString()}
          tone={metrics.errors === 0 ? "good" : "bad"}
        />
        <Metric
          label="Error rate"
          value={`${errorRate.toFixed(1)}%`}
          tone={errorRate === 0 ? "good" : errorRate < 5 ? "warn" : "bad"}
        />
      </div>

      <div className="grid">
        {/* LEFT: sticks + triggers */}
        <div className="panel">
          <h2>Analog</h2>
          <div className="stick-row">
            <Stick label="LEFT" v={state.leftStick} />
            <Stick label="RIGHT" v={state.rightStick} />
          </div>
          <div style={{ height: 18 }} />
          <Trigger label="LT" value={state.triggers.LT} />
          <Trigger label="RT" value={state.triggers.RT} />
        </div>

        {/* CENTER: log */}
        <div className="panel">
          <h2>Event Log</h2>
          <div className="toolbar">
            <button className="tbtn" onClick={() => setLog([])}>
              Clear view
            </button>
            <button className="tbtn" onClick={reset}>
              Reset controller
            </button>
            <button className="tbtn" onClick={runDemo}>
              Run demo input
            </button>
          </div>
          <div className="log" ref={logRef}>
            {log.length === 0 ? (
              <div className="log-empty">
                Waiting for controller input…
                <br />
                Move a stick or press a button on your phone.
              </div>
            ) : (
              log.map((l) => (
                <div className="log-row" key={l.id}>
                  <span className="log-time">{fmt(l.ts)}</span>
                  <span className={`log-tag ${l.kind}`}>{l.kind}</span>
                  <span className="log-msg">{l.message}</span>
                </div>
              ))
            )}
          </div>
          <div className="endpoint">
            POST controller state to{" "}
            <code>{origin}/api/input</code>
          </div>
        </div>

        {/* RIGHT: buttons */}
        <div className="panel">
          <h2>Buttons</h2>
          <div className="btn-cluster">
            <div className="btn-grid">
              {(["A", "B", "X", "Y"] as ButtonName[]).map((b) => (
                <Pill key={b} name={b} on={state.buttons[b]} face />
              ))}
            </div>
            <div className="btn-grid">
              {(["LB", "RB", "LS", "RS"] as ButtonName[]).map((b) => (
                <Pill key={b} name={b} on={state.buttons[b]} />
              ))}
            </div>
            <div className="btn-grid">
              {(["Back", "Start", "Guide"] as ButtonName[]).map((b) => (
                <Pill key={b} name={b} on={state.buttons[b]} />
              ))}
            </div>
            <div className="btn-grid">
              {(
                ["DPadUp", "DPadDown", "DPadLeft", "DPadRight"] as ButtonName[]
              ).map((b) => (
                <Pill key={b} name={b} on={state.buttons[b]} label={dpad(b)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <MappingPanel />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "idle";
}) {
  return (
    <div className={`metric ${tone}`}>
      <div className="metric-val">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function Stick({
  label,
  v,
}: {
  label: string;
  v: { x: number; y: number };
}) {
  const active = Math.hypot(v.x, v.y) > 0.08;
  // y is inverted for screen coords (up = negative on most pads → move knob up)
  const px = v.x * 70;
  const py = v.y * 70;
  return (
    <div className="stick-col">
      <div className="stick-pad">
        <div className="stick-cross h" />
        <div className="stick-cross v" />
        <div
          className={`stick-knob ${active ? "active" : ""}`}
          style={{ transform: `translate(${px}px, ${py}px)` }}
        />
      </div>
      <div className="stick-readout">
        {label} · X <b>{v.x.toFixed(2)}</b> &nbsp; Y <b>{v.y.toFixed(2)}</b>
      </div>
    </div>
  );
}

function Trigger({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="trigger">
      <div className="trigger-label">
        <span>{label}</span>
        <b>{pct}%</b>
      </div>
      <div className="trigger-bar">
        <div className="trigger-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Pill({
  name,
  on,
  face,
  label,
}: {
  name: ButtonName;
  on: boolean;
  face?: boolean;
  label?: string;
}) {
  const cls = ["pill", on ? "on" : "", face ? "face" : "", FACE.has(name) ? name : ""]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{label ?? name}</div>;
}

function dpad(b: ButtonName) {
  return (
    { DPadUp: "▲", DPadDown: "▼", DPadLeft: "◀", DPadRight: "▶" } as Record<
      string,
      string
    >
  )[b];
}

function fmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false }) +
    "." +
    String(d.getMilliseconds()).padStart(3, "0");
}

// Fire a scripted sequence of inputs at /api/input so you can see the monitor
// react without the phone connected yet.
async function runDemo() {
  const post = (body: unknown) =>
    fetch("/api/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await post({ buttons: { A: true } });
  await wait(180);
  await post({ buttons: { A: false } });
  await wait(120);
  await post({ leftStick: { x: 0.9, y: -0.3 } });
  await wait(220);
  await post({ rightStick: { x: -0.6, y: 0.6 } });
  await wait(220);
  await post({ triggers: { RT: 1 } });
  await wait(200);
  await post({ buttons: { X: true, Y: true } });
  await wait(180);
  await post({
    buttons: { X: false, Y: false },
    triggers: { RT: 0 },
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
  });
}
