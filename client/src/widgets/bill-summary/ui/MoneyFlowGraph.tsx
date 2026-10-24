"use client";

import React, { useState, useMemo, useId, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { formatRupiah, getInitials } from "@/shared/lib";
import type { Transfer, BilateralTransfer } from "@/entities/session";
import { useI18n } from "@/shared/i18n";

interface Participant {
  id: number;
  name: string;
  totalOwed?: number;
}

interface MoneyFlowGraphProps {
  transfers: Transfer[];
  rawDebts: BilateralTransfer[];
  participants: Participant[];
  userName: string;
}



const INK = "var(--foreground)";
const PAPER = "var(--background)";
const ACCENT = "var(--primary-sage)";

type TabMode = "optimized" | "intuitive";


interface Edge {
  from: string;
  to: string;
  amount: number;
  label?: string;
}

interface GraphProps {
  names: string[];
  edges: Edge[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  userName: string;
  pixelScale?: number;
}

const NODE_R = 22;
const LABEL_PAD = 70;
const MAX_LABEL = 14;

function graphGeometry(n: number) {
  const R = n <= 2 ? 70 : n <= 3 ? 82 : Math.max(100, Math.round((n * 64) / (2 * Math.PI)));
  const CX = R + LABEL_PAD;
  const CY = R + LABEL_PAD - 10;
  return { R, CX, CY, width: CX * 2, height: CY * 2 + 10 };
}

function shortLabel(name: string) {
  const chars = Array.from(name);
  return chars.length > MAX_LABEL ? `${chars.slice(0, MAX_LABEL - 1).join("").trimEnd()}…` : name;
}

function FlowGraph({ names, edges, selected, onSelect, userName, pixelScale }: GraphProps) {
  const markerPrefix = useId();
  const { flow } = useI18n().m;
  const n = names.length;
  const { R, CX, CY, width, height } = graphGeometry(n);

  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    names.forEach((name, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      m[name] = { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
    });
    return m;
  }, [names, n, R, CX, CY]);

  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    names.forEach((n) => (map[n] = 0));
    edges.forEach((e) => {
      map[e.from] = (map[e.from] || 0) - e.amount;
      map[e.to] = (map[e.to] || 0) + e.amount;
    });
    return map;
  }, [edges, names]);

  const isFaded = (from: string, to: string) =>
    !!selected && from !== selected && to !== selected;
  const isMine = (name: string) => userName !== "" && name === userName;
  const edgeColor = (e: Edge) => (isMine(e.from) || isMine(e.to) ? ACCENT : INK);
  const markerId = (idx: number) => `${markerPrefix}-arrow-${idx}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={pixelScale ? width * pixelScale : undefined}
      height={pixelScale ? height * pixelScale : undefined}
      className={pixelScale ? "block max-w-none" : "w-full max-w-xs sm:max-w-sm"}
      role="group"
      aria-label={flow.graphLabel}
    >
      <defs>
        {edges.map((e, idx) => (
          <marker key={markerId(idx)} id={markerId(idx)} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" style={{ fill: edgeColor(e), opacity: isFaded(e.from, e.to) ? 0.15 : 0.8 }} />
          </marker>
        ))}
      </defs>

      {edges.map((edge, idx) => {
        const a = posMap[edge.from];
        const b = posMap[edge.to];
        if (!a || !b) return null;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len, uy = dy / len;
        const x1 = a.x + ux * NODE_R, y1 = a.y + uy * NODE_R;
        const x2 = b.x - ux * (NODE_R + 5), y2 = b.y - uy * (NODE_R + 5);
        const mx = (x1 + x2) / 2 - uy * 18, my = (y1 + y2) / 2 + ux * 18;
        const faded = isFaded(edge.from, edge.to);
        const color = edgeColor(edge);
        const lx = (x1 + 2 * mx + x2) / 4;
        const ly = (y1 + 2 * my + y2) / 4 - 5;
        return (
          <g key={`edge-${idx}`}>
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              strokeWidth={faded ? 1.5 : 2}
              markerEnd={`url(#${markerId(idx)})`}
              strokeDasharray={faded ? "3 3" : undefined}
              style={{ stroke: color, opacity: faded ? 0.15 : 0.8, transition: "opacity 0.2s ease" }}
            />
            {!faded && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                className="font-sans tabular-nums"
                style={{ fill: INK, stroke: PAPER, strokeWidth: 3, paintOrder: "stroke" }}
              >
                {formatRupiah(Math.round(edge.amount))}
              </text>
            )}
          </g>
        );
      })}

      {names.map((name) => {
        const pos = posMap[name];
        const bal = balanceMap[name] || 0;
        const isCreditor = bal > 0.5;
        const isDebtor = bal < -0.5;
        const isMe = isMine(name);
        const isSelected = name === selected;
        const toggle = () => onSelect(isSelected ? null : name);
        return (
          <g
            key={name}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={flow.nodeLabel(name, isMe)}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            }}
            className="focus-visible:outline-sage cursor-pointer focus:outline-none focus-visible:outline-2"
          >
            <title>{name}</title>
            {isSelected && (
              <circle cx={pos.x} cy={pos.y} r={28} fill="none" strokeWidth={1.5} strokeDasharray="4 2" style={{ stroke: INK, opacity: 0.6 }} />
            )}
            <circle cx={pos.x} cy={pos.y} r={NODE_R}
              strokeWidth={isMe ? 2.5 : 1.5}
              style={{ fill: PAPER, stroke: isMe ? ACCENT : INK, strokeOpacity: isMe ? 1 : 0.4 }}
            />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" className="font-sans" style={{ fill: INK }}>
              {getInitials(name)}
            </text>
            {(isCreditor || isDebtor) && (
              <circle cx={pos.x + 16} cy={pos.y - 16} r={5} fill={isCreditor ? "#4ade80" : "#f87171"} strokeWidth={1.5} style={{ stroke: PAPER }} />
            )}
            <text x={pos.x} y={pos.y + 34} textAnchor="middle" fontSize="11" fontWeight={isMe || isSelected ? "700" : "500"}
              className="font-sans" style={{ fill: INK, opacity: isMe || isSelected ? 1 : 0.8, stroke: PAPER, strokeWidth: 3, paintOrder: "stroke" }}>
              {shortLabel(name)}{isMe ? " (kamu)" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const DRAG_THRESHOLD = 6;

interface View { x: number; y: number; k: number }

function PanZoomSurface({ contentWidth, contentHeight, children }: { contentWidth: number; contentHeight: number; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const travelled = useRef(0);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const k = Math.min(width / contentWidth, height / contentHeight, MAX_ZOOM);
    setView({ k, x: (width - contentWidth * k) / 2, y: (height - contentHeight * k) / 2 });
  }, [contentWidth, contentHeight]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      const ratio = k / v.k;
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  const zoomFromCenter = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAt(width / 2, height / 2, factor);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const localPoint = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointers.current.size === 0) travelled.current = 0;
    pointers.current.set(e.pointerId, localPoint(e));
    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(p2.x - p1.x, p2.y - p1.y), mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const point = localPoint(e);
    pointers.current.set(e.pointerId, point);

    if (pointers.current.size === 1) {
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      travelled.current += Math.abs(dx) + Math.abs(dy);
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    const [p1, p2] = Array.from(pointers.current.values());
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    travelled.current += DRAG_THRESHOLD;
    if (pinch.current) {
      const factor = dist / pinch.current.dist;
      const shiftX = mid.x - pinch.current.mid.x;
      const shiftY = mid.y - pinch.current.mid.y;
      setView((v) => {
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
        const ratio = k / v.k;
        return { k, x: mid.x - (mid.x - v.x) * ratio + shiftX, y: mid.y - (mid.y - v.y) * ratio + shiftY };
      });
    }
    pinch.current = { dist, mid };
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onClickCapture={(e) => {
          if (travelled.current > DRAG_THRESHOLD) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", width: contentWidth, height: contentHeight }}>
          {children}
        </div>
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md border border-[var(--glass-border)] bg-[var(--background)] p-1 shadow-md">
        <button type="button" onClick={() => zoomFromCenter(1 / 1.3)} aria-label="Perkecil" className="text-foreground focus-visible:outline-sage flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-xl hover:bg-[var(--glass-highlight)] focus-visible:outline-2">−</button>
        <button type="button" onClick={() => zoomFromCenter(1.3)} aria-label="Perbesar" className="text-foreground focus-visible:outline-sage flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-xl hover:bg-[var(--glass-highlight)] focus-visible:outline-2">+</button>
        <button type="button" onClick={fit} className="text-foreground focus-visible:outline-sage flex h-11 cursor-pointer items-center justify-center rounded-sm px-3 font-sans text-sm font-semibold hover:bg-[var(--glass-highlight)] focus-visible:outline-2">Pas layar</button>
      </div>
    </div>
  );
}


function TabSwitcher({ tab, onChange }: { tab: TabMode; onChange: (tab: TabMode) => void }) {
  const { flow } = useI18n().m;
  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--glass-border)] font-sans text-sm font-semibold" role="group" aria-label="Tampilan alur utang">
      {(["optimized", "intuitive"] as TabMode[]).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={tab === t}
          onClick={() => onChange(t)}
          className={`focus-visible:outline-sage min-h-11 flex-1 cursor-pointer px-3 transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 ${
            tab === t
              ? "bg-sage/20 text-foreground"
              : "text-foreground/70 hover:text-foreground"
          }`}
        >
          {t === "optimized" ? flow.tabSimplified : flow.tabPerReceipt}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  const { flow } = useI18n().m;
  return (
    <div className="text-foreground/75 flex justify-center gap-5 font-sans text-xs">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#4ade80]" /> {flow.legendReceives}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f87171]" /> {flow.legendPays}
      </span>
    </div>
  );
}

interface NarrativeData {
  paying: Array<{ to: string; amount: number; billName?: string }>;
  receiving: Array<{ from: string; amount: number; billName?: string }>;
  netBal: number;
}

function CounterpartyRow({ name, billName, amount, incoming }: { name: string; billName?: string; amount: number; incoming: boolean }) {
  const { flow } = useI18n().m;
  return (
    <li className="flex items-center gap-2.5">
      <span
        className="text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] text-[10px] font-bold"
        aria-hidden="true"
      >
        {getInitials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium" title={name}>{name}</span>
        {billName && <span className="text-foreground/70 block truncate text-xs">{flow.atBill(billName)}</span>}
      </span>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${incoming ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
        {incoming ? "+" : "−"}{formatRupiah(Math.round(amount))}
      </span>
    </li>
  );
}

function Narrative({ selected, narrative, userName, tab }: { selected: string; narrative: NarrativeData; userName: string; tab: TabMode }) {
  const { m } = useI18n();
  const flow = m.flow;
  return (
    <div className="space-y-3 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 font-sans text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] text-[11px] font-bold">
          {getInitials(selected)}
        </div>
        <span className="text-foreground font-bold">{selected}</span>
        {userName !== "" && selected === userName && (
          <span className="text-foreground/70 text-xs">{m.common.youTag}</span>
        )}
        {narrative.netBal > 0.5 && (
          <span className="ml-auto text-xs font-semibold text-green-700 tabular-nums dark:text-green-400">
            {flow.net("+", Math.round(narrative.netBal))}
          </span>
        )}
        {narrative.netBal < -0.5 && (
          <span className="ml-auto text-xs font-semibold text-red-700 tabular-nums dark:text-red-400">
            {flow.net("−", Math.round(-narrative.netBal))}
          </span>
        )}
      </div>

      {narrative.receiving.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400">{flow.receivesFrom}</p>
          <ul className="space-y-2">
            {narrative.receiving.map((t, i) => (
              <CounterpartyRow key={i} name={t.from} billName={t.billName} amount={t.amount} incoming />
            ))}
          </ul>
        </div>
      )}

      {narrative.paying.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">{flow.paysTo}</p>
          <ul className="space-y-2">
            {narrative.paying.map((t, i) => (
              <CounterpartyRow key={i} name={t.to} billName={t.billName} amount={t.amount} incoming={false} />
            ))}
          </ul>
        </div>
      )}

      {narrative.receiving.length === 0 && narrative.paying.length === 0 && (
        <p className="text-foreground/75 text-xs">{flow.settled(selected)}</p>
      )}

      {(narrative.receiving.length > 0 || narrative.paying.length > 0) && (
        <div className="border-t border-[var(--glass-border)] pt-2">
          <p className="text-foreground/75 text-xs leading-relaxed">
            {tab === "optimized"
              ? narrative.netBal > 0.5
                ? flow.creditorStory(selected, Math.round(narrative.netBal))
                : narrative.netBal < -0.5
                ? flow.debtorStory(selected, Math.round(-narrative.netBal))
                : flow.balancedStory(selected)
              : flow.perReceiptHint}
          </p>
        </div>
      )}
    </div>
  );
}


const FULLSCREEN_SCALE = 1.4;

export function MoneyFlowGraph({ transfers, rawDebts, participants, userName }: MoneyFlowGraphProps) {
  const [tab, setTab] = useState<TabMode>("optimized");
  const [selected, setSelected] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenTitleId = useId();
  const { flow } = useI18n().m;

  const names = useMemo(() => participants.map((p) => p.name), [participants]);

  const optimizedEdges: Edge[] = useMemo(() =>
    transfers.map((t) => ({ from: t.from, to: t.to, amount: t.amount })),
    [transfers]
  );

  const intuitiveEdges: Edge[] = useMemo(() =>
    rawDebts.map((d) => ({ from: d.from, to: d.to, amount: d.amount, label: d.billName })),
    [rawDebts]
  );

  const activeEdges = tab === "optimized" ? optimizedEdges : intuitiveEdges;

  const involvedNames = useMemo(
    () => names.filter((n) => activeEdges.some((e) => e.from === n || e.to === n)),
    [names, activeEdges]
  );
  const isCrowded = involvedNames.length > 8;
  const geometry = graphGeometry(involvedNames.length);

  const narrative = useMemo<NarrativeData | null>(() => {
    if (!selected) return null;
    if (tab === "optimized") {
      const paying = transfers.filter((t) => t.from === selected);
      const receiving = transfers.filter((t) => t.to === selected);
      const balMap: Record<string, number> = {};
      names.forEach((n) => (balMap[n] = 0));
      transfers.forEach((t) => { balMap[t.from] -= t.amount; balMap[t.to] += t.amount; });
      return { paying, receiving, netBal: balMap[selected] || 0 };
    } else {
      const paying = rawDebts.filter((d) => d.from === selected);
      const receiving = rawDebts.filter((d) => d.to === selected);
      const net = receiving.reduce((s, d) => s + d.amount, 0) - paying.reduce((s, d) => s + d.amount, 0);
      return { paying, receiving, netBal: net };
    }
  }, [selected, tab, transfers, rawDebts, names]);

  const changeTab = (t: TabMode) => {
    setTab(t);
    setSelected(null);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  if (transfers.length === 0) return null;

  return (
    <div className="space-y-4">
      <TabSwitcher tab={tab} onChange={changeTab} />

      <p className="text-foreground/75 px-1 text-center font-sans text-xs leading-relaxed">
        {tab === "optimized"
          ? flow.simplifiedCaption
          : flow.perReceiptCaption}{" "}
        {isCrowded
          ? flow.crowdedHint(involvedNames.length)
          : flow.tapHint}
      </p>

      <div className="relative flex justify-center">
        <FlowGraph
          names={involvedNames}
          edges={activeEdges}
          selected={selected}
          onSelect={setSelected}
          userName={userName}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend />
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="text-foreground rounded-glass-sm focus-visible:outline-sage flex min-h-11 cursor-pointer items-center gap-2 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-sans text-sm font-semibold transition-colors hover:bg-[var(--glass-highlight)] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
          {flow.fullscreen}
        </button>
      </div>

      {selected && narrative && !isFullscreen && (
        <Narrative selected={selected} narrative={narrative} userName={userName} tab={tab} />
      )}

      {isFullscreen && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={fullscreenTitleId}
          className="bg-background text-foreground fixed inset-0 z-[120] flex flex-col"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <div className="min-w-0">
              <h2 id={fullscreenTitleId} className="font-serif text-xl leading-tight">{flow.fullscreenTitle}</h2>
              <p className="text-foreground/70 font-sans text-xs">{flow.fullscreenHint}</p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => setIsFullscreen(false)}
              aria-label={flow.closeFullscreen}
              className="text-foreground/80 hover:text-foreground rounded-glass-sm focus-visible:outline-sage -mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center hover:bg-[var(--glass-highlight)] focus-visible:outline-2"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="px-4 pt-3 pb-2">
            <TabSwitcher tab={tab} onChange={changeTab} />
          </div>

          <div className="relative min-h-0 flex-1">
            <PanZoomSurface
              key={tab}
              contentWidth={geometry.width * FULLSCREEN_SCALE}
              contentHeight={geometry.height * FULLSCREEN_SCALE}
            >
              <FlowGraph
                names={involvedNames}
                edges={activeEdges}
                selected={selected}
                onSelect={setSelected}
                userName={userName}
                pixelScale={FULLSCREEN_SCALE}
              />
            </PanZoomSurface>
          </div>

          <div className="space-y-3 border-t border-[var(--glass-border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {selected && narrative ? (
              <div className="max-h-[38dvh] overflow-y-auto overscroll-contain">
                <Narrative selected={selected} narrative={narrative} userName={userName} tab={tab} />
              </div>
            ) : (
              <p className="text-foreground/75 text-center font-sans text-xs">{flow.tapHint}</p>
            )}
            <Legend />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
