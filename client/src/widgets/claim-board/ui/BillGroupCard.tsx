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

  const isAuthorized = isJoined && (
    userName.trim().toLowerCase() === bill.payerName.trim().toLowerCase() ||
    userName.trim().toLowerCase() === sessionPayerName.trim().toLowerCase()
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
    if (confirm(`Are you sure you want to delete the stop "${bill.name}" and all its items?`)) {
      await deleteBill(bill.id);
    }
  };

  return (
    <GlassPanel className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-[var(--glass-border)] pb-3 md:flex-row md:items-center md:justify-between">
        {isEditing ? (
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[8px] font-bold uppercase">Stop Title</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-0.5 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[8px] font-bold uppercase">Payer Name</span>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-0.5 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[8px] font-bold uppercase">Tax (Rp)</span>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-0.5 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[8px] font-bold uppercase">Service (Rp)</span>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-0.5 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[8px] font-bold uppercase">Grand Total (Rp)</span>
              <input
                type="number"
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-0.5 text-sm focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <h3 className="text-foreground flex flex-wrap items-center gap-2 font-serif text-lg font-bold">
              <span>{bill.name}</span>
              <span className="text-foreground/40 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-0.5 font-sans text-[10px] font-normal tracking-wide uppercase">
                Paid by {bill.payerName}
              </span>
            </h3>
            <div className="text-foreground/50 mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]">
              <span>Subtotal: {formatRupiah(billSubtotal)}</span>
              <span>Tax: {formatRupiah(bill.tax)}</span>
              <span>Service Charge: {formatRupiah(bill.serviceCharge)}</span>
              <span className="text-sage font-bold">Grand Total: {formatRupiah(bill.grandTotal)}</span>
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-end gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-sage hover:bg-sage/10 cursor-pointer rounded px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
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
                className="text-foreground/40 hover:text-foreground cursor-pointer rounded px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {isAuthorized && bill.id !== "" && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-foreground/40 hover:text-foreground cursor-pointer px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="cursor-pointer px-2 py-1 text-[10px] font-bold tracking-widest text-rose-400 uppercase transition-colors hover:text-rose-500"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-foreground/40 hover:text-foreground cursor-pointer px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                {isCollapsed ? "Expand" : "Collapse"}
              </button>
            </>
          )}
        </div>
      </div>

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
              <p className="text-foreground/30 py-2 text-xs">No items in this stop.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2.5 pt-2" role="list">
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
    </GlassPanel>
  );
}

export default BillGroupCard;
