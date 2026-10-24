"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ItemCard } from "@/entities/item";
import type { Bill } from "@/entities/session";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah } from "@/shared/lib";
import type { ReceiptItem } from "@/shared/types";

export interface BillGroupCardProps {
  bill: Bill;
  items: Array<ReceiptItem & { depth: number }>;
  isSingleBill?: boolean;
  isJoined: boolean;
  userName: string;
  sessionPayerName: string;
  updateBill: (billId: string, name: string, payerName: string, tax: number, serviceCharge: number, grandTotal: number) => Promise<boolean>;
  deleteBill: (billId: string) => Promise<boolean>;
  firstUnclaimedId: string | undefined;
  showClaimHint: boolean;
  completeClaimHint: () => void;
  updateClaim: (itemId: string, increment: number) => void;
  renameItem: (itemId: string, newName: string) => void;
}

export function BillGroupCard({
  bill,
  items,
  isSingleBill = false,
  isJoined,
  userName,
  sessionPayerName,
  updateBill,
  deleteBill,
  firstUnclaimedId,
  showClaimHint,
  completeClaimHint,
  updateClaim,
  renameItem
}: BillGroupCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(bill.name);
  const [payerName, setPayerName] = useState(bill.payerName);
  const [tax, setTax] = useState(bill.tax.toString());
  const [serviceCharge, setServiceCharge] = useState(bill.serviceCharge.toString());
  const [grandTotal, setGrandTotal] = useState(bill.grandTotal.toString());
  const [isSaving, setIsSaving] = useState(false);

  // Mirrors the server's canManageBill: exact names, so "budi" never gets Budi's controls
  const isAuthorized = isJoined && userName !== "" && (
    userName === bill.payerName ||
    userName === sessionPayerName
  );

  const billSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateBill(
      bill.id,
      name.trim(),
      payerName.trim(),
      parseFloat(tax) || 0,
      parseFloat(serviceCharge) || 0,
      parseFloat(grandTotal) || 0
    );
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (confirm(`Hapus daftar pesanan "${bill.name}" beserta semua menunya?`)) {
      await deleteBill(bill.id);
    }
  };

  const content = (
    <>
      {isEditing ? (
        <div className="border-sage/20 bg-sage/5 mb-3 space-y-3 rounded-xl border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">Nama Struk/Tempat</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">Nama Pembayar</span>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">Pajak (Rp)</span>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">Biaya Layanan (Rp)</span>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">Total Struk (Rp)</span>
              <input
                type="number"
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] pt-2">
            <button
              onClick={() => {
                setName(bill.name);
                setPayerName(bill.payerName);
                setTax(bill.tax.toString());
                setServiceCharge(bill.serviceCharge.toString());
                setGrandTotal(bill.grandTotal.toString());
                setIsEditing(false);
              }}
              disabled={isSaving}
              className="text-foreground/50 hover:text-foreground cursor-pointer rounded px-3 py-1 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-sage text-background hover:bg-sage/90 cursor-pointer rounded-full px-4 py-1 text-xs font-semibold shadow-xs"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      ) : !isSingleBill ? (
        /* Multiple Bills Header: shown only when there is more than 1 bill */
        <div className="flex flex-col gap-2 border-b border-[var(--glass-border)] pb-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="text-foreground flex flex-wrap items-center gap-2 font-serif text-base font-semibold sm:text-lg">
              <span>{bill.name}</span>
              <span className="text-foreground/50 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-0.5 font-sans text-[10px] font-medium">
                Dibayar oleh {bill.payerName}
              </span>
            </h3>
            <div className="text-foreground/50 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs">
              <span>Subtotal: {formatRupiah(billSubtotal)}</span>
              {bill.tax > 0 && <span>Pajak: {formatRupiah(bill.tax)}</span>}
              {bill.serviceCharge > 0 && <span>Layanan: {formatRupiah(bill.serviceCharge)}</span>}
              <span className="text-sage font-bold">Total: {formatRupiah(bill.grandTotal)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAuthorized && bill.id !== "" && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-foreground/50 hover:text-sage cursor-pointer text-xs transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="cursor-pointer text-xs text-rose-400 transition-colors hover:text-rose-500"
                >
                  Hapus
                </button>
              </>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-foreground/50 hover:text-foreground cursor-pointer text-xs transition-colors"
            >
              {isCollapsed ? "Buka" : "Tutup"}
            </button>
          </div>
        </div>
      ) : isAuthorized && bill.id !== "" && (
        /* Single Bill: Minimal Edit Strip for Payer */
        <div className="text-foreground/50 flex items-center justify-between pb-1 text-xs">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            {bill.tax > 0 && <span>Pajak: {formatRupiah(bill.tax)}</span>}
            {bill.serviceCharge > 0 && <span>Layanan: {formatRupiah(bill.serviceCharge)}</span>}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sage cursor-pointer text-[11px] font-semibold hover:underline"
          >
            Edit Rincian Tagihan
          </button>
        </div>
      )}

      {/* Item List */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {items.length === 0 ? (
              <p className="text-foreground/30 py-3 text-center text-xs">Belum ada menu di struk ini.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2.5 pt-1" role="list">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    depth={item.depth || 0}
                    isJoined={isJoined}
                    userName={userName}
                    isPayer={isAuthorized}
                    showClaimHint={showClaimHint}
                    isFirstUnclaimed={item.id === firstUnclaimedId}
                    onInteraction={completeClaimHint}
                    onUpdateClaim={updateClaim}
                    onRenameItem={renameItem}
                  />
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (isSingleBill) {
    return <div className="space-y-2.5">{content}</div>;
  }

  return (
    <GlassPanel className="space-y-3.5 p-4 sm:p-6">
      {content}
    </GlassPanel>
  );
}

export default BillGroupCard;
