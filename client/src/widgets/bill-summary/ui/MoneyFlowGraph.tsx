"use client";

import React, { useState, useMemo } from "react";
import { formatRupiah, getInitials } from "@/shared/lib";
import type { Transfer, BilateralTransfer } from "@/entities/session";

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



// Theme tokens instead of per-name hues: one neutral for everyone, sage only for flows that involve you
const INK = "var(--foreground)";
const PAPER = "var(--background)";
const ACCENT = "var(--primary-sage)";

type TabMode = "optimized" | "intuitive";

// ─── Shared SVG graph ────────────────────────────────────────────────────────

interface Edge {
  from: string;
  to: string;
  amount: number;
  label?: string; // optional subtitle (bill name)
}

interface GraphProps {
  names: string[];
  edges: Edge[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  userName: string;
}

function FlowGraph({ names, edges, selected, onSelect, userName }: GraphProps) {
  const n = names.length;
  const CX = 160, CY = 155;
  const R = n <= 2 ? 70 : n <= 3 ? 82 : 100;

  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    names.forEach((name, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      m[name] = { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
    });
    return m;
  }, [names, n, R]);

  // Net balance per node from edges
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
  const isMine = (name: string) => name.toLowerCase() === userName.toLowerCase();
  const edgeColor = (e: Edge) => (isMine(e.from) || isMine(e.to) ? ACCENT : INK);

  return (
    <svg viewBox={`0 0 ${CX * 2} ${CY * 2 + 10}`} className="w-full max-w-xs sm:max-w-sm" role="group" aria-label="Alur transfer antar peserta">
      <defs>
        {edges.map((e, idx) => (
          <marker key={`arrow-${idx}`} id={`arrow-${idx}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" style={{ fill: edgeColor(e), opacity: isFaded(e.from, e.to) ? 0.15 : 0.8 }} />
          </marker>
        ))}
      </defs>

      {/* Edges */}
      {edges.map((edge, idx) => {
        const a = posMap[edge.from];
        const b = posMap[edge.to];
        if (!a || !b) return null;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len, uy = dy / len;
        const nodeR = 22;
        const x1 = a.x + ux * nodeR, y1 = a.y + uy * nodeR;
        const x2 = b.x - ux * (nodeR + 5), y2 = b.y - uy * (nodeR + 5);
        const mx = (x1 + x2) / 2 - uy * 18, my = (y1 + y2) / 2 + ux * 18;
        const faded = isFaded(edge.from, edge.to);
        const color = edgeColor(edge);
        // label midpoint along quadratic bezier at t=0.5
        const lx = (x1 + 2 * mx + x2) / 4;
        const ly = (y1 + 2 * my + y2) / 4 - 5;
        return (
          <g key={`edge-${idx}`}>
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              strokeWidth={faded ? 1.5 : 2}
              markerEnd={`url(#arrow-${idx})`}
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
                // Background-colored halo keeps the amount readable where it crosses a line
                style={{ fill: INK, stroke: PAPER, strokeWidth: 3, paintOrder: "stroke" }}
              >
                {formatRupiah(Math.round(edge.amount))}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
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
            aria-label={`${name}${isMe ? " (kamu)" : ""}, lihat rincian`}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            }}
            className="focus-visible:outline-sage cursor-pointer focus:outline-none focus-visible:outline-2"
          >
            {isSelected && (
              <circle cx={pos.x} cy={pos.y} r={28} fill="none" strokeWidth={1.5} strokeDasharray="4 2" style={{ stroke: INK, opacity: 0.6 }} />
            )}
            <circle cx={pos.x} cy={pos.y} r={22}
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
              {name}{isMe ? " (kamu)" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MoneyFlowGraph({ transfers, rawDebts, participants, userName }: MoneyFlowGraphProps) {
  const [tab, setTab] = useState<TabMode>("optimized");
  const [selected, setSelected] = useState<string | null>(null);

  const names = useMemo(() => participants.map((p) => p.name), [participants]);

  // Edges for each view
  const optimizedEdges: Edge[] = useMemo(() =>
    transfers.map((t) => ({ from: t.from, to: t.to, amount: t.amount })),
    [transfers]
  );

  // Intuitive: aggregate bilateral per from→to (there can be multiple bills)
  // We keep them separate so each edge shows the bill name
  const intuitiveEdges: Edge[] = useMemo(() =>
    rawDebts.map((d) => ({ from: d.from, to: d.to, amount: d.amount, label: d.billName })),
    [rawDebts]
  );

  const activeEdges = tab === "optimized" ? optimizedEdges : intuitiveEdges;

  // Personal narrative
  const narrative = useMemo(() => {
    if (!selected) return null;
    if (tab === "optimized") {
      const paying = transfers.filter((t) => t.from === selected);
      const receiving = transfers.filter((t) => t.to === selected);
      const balMap: Record<string, number> = {};
      names.forEach((n) => (balMap[n] = 0));
      transfers.forEach((t) => { balMap[t.from] -= t.amount; balMap[t.to] += t.amount; });
      return { paying: paying.map(t => ({ ...t, billName: "" })), receiving: receiving.map(t => ({ ...t, billName: "" })), netBal: balMap[selected] || 0 };
    } else {
      const paying = rawDebts.filter((d) => d.from === selected);
      const receiving = rawDebts.filter((d) => d.to === selected);
      const net = receiving.reduce((s, d) => s + d.amount, 0) - paying.reduce((s, d) => s + d.amount, 0);
      return { paying, receiving, netBal: net };
    }
  }, [selected, tab, transfers, rawDebts, names]);

  if (transfers.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex overflow-hidden rounded-md border border-[var(--glass-border)] font-sans text-sm font-semibold" role="group" aria-label="Tampilan alur utang">
        {(["optimized", "intuitive"] as TabMode[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => { setTab(t); setSelected(null); }}
            className={`focus-visible:outline-sage min-h-11 flex-1 cursor-pointer px-3 transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 ${
              tab === t
                ? "bg-sage/20 text-foreground"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {t === "optimized" ? "Setelah diringkas" : "Per struk"}
          </button>
        ))}
      </div>

      {/* Context caption */}
      <p className="text-foreground/75 px-1 text-center font-sans text-xs leading-relaxed">
        {tab === "optimized"
          ? "Utang digabung supaya jumlah transfer paling sedikit. Ketuk nama untuk melihat rinciannya."
          : "Utang asli di tiap struk sebelum diringkas. Ketuk nama untuk melihat ke siapa saja dia berutang."}
      </p>

      {/* Graph */}
      <div className="flex justify-center">
        <FlowGraph
          names={names}
          edges={activeEdges}
          selected={selected}
          onSelect={setSelected}
          userName={userName}
        />
      </div>

      {/* Legend */}
      <div className="text-foreground/75 flex justify-center gap-5 font-sans text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#4ade80]" /> Menerima uang
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f87171]" /> Membayar
        </span>
      </div>

      {/* Personal narrative */}
      {selected && narrative && (
        <div className="space-y-3 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 font-sans text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] text-[11px] font-bold">
              {getInitials(selected)}
            </div>
            <span className="text-foreground font-bold">{selected}</span>
            {selected.toLowerCase() === userName.toLowerCase() && (
              <span className="text-foreground/70 text-xs">(kamu)</span>
            )}
            {narrative.netBal > 0.5 && (
              <span className="ml-auto text-xs font-semibold text-green-700 tabular-nums dark:text-green-400">
                Bersih +{formatRupiah(Math.round(narrative.netBal))}
              </span>
            )}
            {narrative.netBal < -0.5 && (
              <span className="ml-auto text-xs font-semibold text-red-700 tabular-nums dark:text-red-400">
                Bersih −{formatRupiah(Math.round(-narrative.netBal))}
              </span>
            )}
          </div>

          {narrative.receiving.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Menerima dari</p>
              {narrative.receiving.map((t, i) => (
                <div key={i} className="text-foreground/70 flex justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="text-green-700 dark:text-green-400">←</span>
                    <span className="text-foreground/90 font-medium">{t.from}</span>
                    {"billName" in t && t.billName && (
                      <span className="text-foreground/70 text-xs">di {t.billName}</span>
                    )}
                  </span>
                  <span className="font-semibold text-green-700 tabular-nums dark:text-green-400">+{formatRupiah(Math.round(t.amount))}</span>
                </div>
              ))}
            </div>
          )}

          {narrative.paying.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Membayar ke</p>
              {narrative.paying.map((t, i) => (
                <div key={i} className="text-foreground/70 flex justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="text-red-700 dark:text-red-400">→</span>
                    <span className="text-foreground/90 font-medium">{t.to}</span>
                    {"billName" in t && t.billName && (
                      <span className="text-foreground/70 text-xs">di {t.billName}</span>
                    )}
                  </span>
                  <span className="font-semibold text-red-700 tabular-nums dark:text-red-400">−{formatRupiah(Math.round(t.amount))}</span>
                </div>
              ))}
            </div>
          )}

          {narrative.receiving.length === 0 && narrative.paying.length === 0 && (
            <p className="text-foreground/75 text-xs">{selected} tidak perlu transfer atau menerima apa pun.</p>
          )}

          {(narrative.receiving.length > 0 || narrative.paying.length > 0) && (
            <div className="border-t border-[var(--glass-border)] pt-2">
              <p className="text-foreground/75 text-xs leading-relaxed">
                {tab === "optimized"
                  ? narrative.netBal > 0.5
                    ? `${selected} menalangi pembayaran grup. Yang lain berutang ${formatRupiah(Math.round(narrative.netBal))} ke ${selected}.`
                    : narrative.netBal < -0.5
                    ? `${selected} memesan lebih banyak dari yang dia bayar di awal, jadi berutang ${formatRupiah(Math.round(-narrative.netBal))}.`
                    : `Pembayaran dan pesanan ${selected} sudah seimbang.`
                  : `Pilih "Setelah diringkas" untuk melihat jumlah transfer paling sedikit.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
