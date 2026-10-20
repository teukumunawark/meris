"use client";

import React, { useState, useMemo } from "react";
import { formatRupiah, getInitials } from "@/shared/lib";
import { Transfer, BilateralTransfer } from "@/entities/session";

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



function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(hash) % 360;
}

function nodeColor(name: string, alpha = 1) {
  return `hsla(${nameToHue(name)}, 60%, 60%, ${alpha})`;
}

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
  }, [names, n]);

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

  const isHighlighted = (from: string, to: string) =>
    !selected || from === selected || to === selected;
  const isFaded = (from: string, to: string) =>
    !!selected && from !== selected && to !== selected;

  return (
    <svg viewBox={`0 0 ${CX * 2} ${CY * 2 + 10}`} className="w-full max-w-xs sm:max-w-sm" aria-label="Money flow graph">
      <defs>
        {edges.map((e, idx) => {
          const color = nodeColor(e.from, isFaded(e.from, e.to) ? 0.15 : 0.9);
          return (
            <marker key={`arrow-${idx}`} id={`arrow-${idx}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill={color} />
            </marker>
          );
        })}
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
        const highlighted = isHighlighted(edge.from, edge.to);
        const faded = isFaded(edge.from, edge.to);
        const color = nodeColor(edge.from, faded ? 0.12 : highlighted ? 1 : 0.6);
        // label midpoint along quadratic bezier at t=0.5
        const lx = (x1 + 2 * mx + x2) / 4;
        const ly = (y1 + 2 * my + y2) / 4 - 5;
        return (
          <g key={`edge-${idx}`}>
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={highlighted ? 2 : 1.5}
              markerEnd={`url(#arrow-${idx})`}
              strokeDasharray={faded ? "3 3" : undefined}
              style={{ transition: "all 0.25s ease" }}
            />
            {!faded && (
              <text x={lx} y={ly} textAnchor="middle" fontSize="7" fontFamily="monospace" fill={nodeColor(edge.from, 0.9)} fontWeight="bold">
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
        const isMe = name.toLowerCase() === userName.toLowerCase();
        const isSelected = name === selected;
        const hue = nameToHue(name);
        return (
          <g key={name} style={{ cursor: "pointer" }} onClick={() => onSelect(isSelected ? null : name)} role="button">
            {isSelected && (
              <circle cx={pos.x} cy={pos.y} r={28} fill="none" stroke={`hsl(${hue}, 60%, 60%)`} strokeWidth={2} opacity={0.5} strokeDasharray="4 2" />
            )}
            <circle cx={pos.x} cy={pos.y} r={22}
              fill={`hsl(${hue}, 35%, ${isSelected ? 22 : 16}%)`}
              stroke={`hsl(${hue}, 60%, ${isSelected ? 70 : 50}%)`}
              strokeWidth={isMe ? 2.5 : 1.5}
              style={{ transition: "all 0.2s ease" }}
            />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={isSelected ? "10" : "9"} fontWeight="bold" fill={`hsl(${hue}, 60%, 80%)`} fontFamily="sans-serif">
              {getInitials(name)}
            </text>
            {(isCreditor || isDebtor) && (
              <circle cx={pos.x + 16} cy={pos.y - 16} r={5} fill={isCreditor ? "#4ade80" : "#f87171"} stroke="var(--background, #0d0d0d)" strokeWidth={1.5} />
            )}
            <text x={pos.x} y={pos.y + 31} textAnchor="middle" fontSize="8" fontWeight={isMe ? "bold" : "normal"}
              fill={isSelected ? `hsl(${hue}, 60%, 75%)` : "rgba(255,255,255,0.55)"}
              fontFamily="sans-serif" style={{ transition: "fill 0.2s ease" }}>
              {name}{isMe ? " (You)" : ""}
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
      <div className="flex rounded-md overflow-hidden border border-[var(--glass-border)] text-[11px] font-bold font-sans">
        {(["optimized", "intuitive"] as TabMode[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(null); }}
            className={`flex-1 py-2 px-3 capitalize transition-colors duration-200 ${
              tab === t
                ? "bg-sage/20 text-sage"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            {t === "optimized" ? "⚡ Optimized" : "🧾 Per Bill"}
          </button>
        ))}
      </div>

      {/* Context caption */}
      <p className="text-foreground/30 text-center text-[10px] font-sans leading-relaxed px-2">
        {tab === "optimized"
          ? "Minimum transfers to settle all debts. Tap a name to see why."
          : "Actual debts per stop. Tap a name to see who they owe at each place."}
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
      <div className="flex justify-center gap-5 text-[10px] text-foreground/40 font-sans">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#4ade80]" /> Receives money
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#f87171]" /> Pays money
        </span>
      </div>

      {/* Personal narrative */}
      {selected && narrative && (
        <div
          className="rounded-md border p-4 space-y-3 text-sm font-sans"
          style={{ borderColor: nodeColor(selected, 0.3), background: `hsla(${nameToHue(selected)}, 20%, 10%, 0.5)` }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: `hsl(${nameToHue(selected)}, 35%, 18%)`, color: nodeColor(selected) }}>
              {getInitials(selected)}
            </div>
            <span className="font-bold text-foreground">{selected}</span>
            {selected.toLowerCase() === userName.toLowerCase() && (
              <span className="text-[10px] text-foreground/30">(You)</span>
            )}
            {narrative.netBal > 0.5 && (
              <span className="ml-auto text-[10px] font-bold text-green-400 uppercase tracking-wider">
                Net +{formatRupiah(Math.round(narrative.netBal))}
              </span>
            )}
            {narrative.netBal < -0.5 && (
              <span className="ml-auto text-[10px] font-bold text-red-400 uppercase tracking-wider">
                Net −{formatRupiah(Math.round(-narrative.netBal))}
              </span>
            )}
          </div>

          {narrative.receiving.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-green-400/70 font-bold tracking-widest uppercase">Receives from</p>
              {narrative.receiving.map((t, i) => (
                <div key={i} className="flex justify-between text-foreground/70 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="text-green-400">←</span>
                    <span className="font-medium text-foreground/90">{t.from}</span>
                    {"billName" in t && t.billName && (
                      <span className="text-foreground/30 text-[10px]">@ {t.billName}</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-green-400">+{formatRupiah(Math.round(t.amount))}</span>
                </div>
              ))}
            </div>
          )}

          {narrative.paying.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-red-400/70 font-bold tracking-widest uppercase">Pays to</p>
              {narrative.paying.map((t, i) => (
                <div key={i} className="flex justify-between text-foreground/70 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="text-red-400">→</span>
                    <span className="font-medium text-foreground/90">{t.to}</span>
                    {"billName" in t && t.billName && (
                      <span className="text-foreground/30 text-[10px]">@ {t.billName}</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-red-400">−{formatRupiah(Math.round(t.amount))}</span>
                </div>
              ))}
            </div>
          )}

          {narrative.receiving.length === 0 && narrative.paying.length === 0 && (
            <p className="text-foreground/30 text-xs italic">No transfers for {selected}.</p>
          )}

          {(narrative.receiving.length > 0 || narrative.paying.length > 0) && (
            <div className="border-t border-[var(--glass-border)] pt-2">
              <p className="text-[10px] text-foreground/30 leading-relaxed">
                {tab === "optimized"
                  ? narrative.netBal > 0.5
                    ? `${selected} fronted cash for the group. Others owe them ${formatRupiah(Math.round(narrative.netBal))} total.`
                    : narrative.netBal < -0.5
                    ? `${selected} consumed more than they paid upfront. They owe ${formatRupiah(Math.round(-narrative.netBal))} total.`
                    : `${selected}'s payments and consumption are balanced.`
                  : `Switch to ⚡ Optimized to see the fewest transfers needed.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
