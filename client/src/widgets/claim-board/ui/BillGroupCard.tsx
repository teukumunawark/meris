"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ItemCard } from "@/entities/item";
import { Bill } from "@/entities/session";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah } from "@/shared/lib";
import { ReceiptItem } from "@/shared/types";

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
    <GlassPanel className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-[var(--glass-border)] pb-3">
        {isEditing ? (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-foreground/40 uppercase">Stop Title</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-transparent border-b border-foreground/20 focus:border-sage focus:outline-none text-sm text-foreground px-1 py-0.5"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-foreground/40 uppercase">Payer Name</span>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="bg-transparent border-b border-foreground/20 focus:border-sage focus:outline-none text-sm text-foreground px-1 py-0.5"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-foreground/40 uppercase">Tax (Rp)</span>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="bg-transparent border-b border-foreground/20 focus:border-sage focus:outline-none text-sm text-foreground px-1 py-0.5"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-foreground/40 uppercase">Service (Rp)</span>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="bg-transparent border-b border-foreground/20 focus:border-sage focus:outline-none text-sm text-foreground px-1 py-0.5"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-foreground/40 uppercase">Grand Total (Rp)</span>
              <input
                type="number"
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value)}
                className="bg-transparent border-b border-foreground/20 focus:border-sage focus:outline-none text-sm text-foreground px-1 py-0.5"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <h3 className="text-foreground font-serif text-lg font-bold flex flex-wrap items-center gap-2">
              <span>{bill.name}</span>
              <span className="text-foreground/40 font-sans text-[10px] font-normal tracking-wide uppercase px-2 py-0.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]">
                Paid by {bill.payerName}
              </span>
            </h3>
            <div className="text-[10px] font-mono text-foreground/50 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>Subtotal: {formatRupiah(billSubtotal)}</span>
              <span>Tax: {formatRupiah(bill.tax)}</span>
              <span>Service Charge: {formatRupiah(bill.serviceCharge)}</span>
              <span className="text-sage font-bold">Grand Total: {formatRupiah(bill.grandTotal)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-[10px] font-bold tracking-widest uppercase text-sage hover:bg-sage/10 rounded px-2.5 py-1.5 transition-colors cursor-pointer"
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
                className="text-[10px] font-bold tracking-widest uppercase text-foreground/40 hover:text-foreground rounded px-2.5 py-1.5 transition-colors cursor-pointer"
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
                    className="text-foreground/40 hover:text-foreground text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-rose-400 hover:text-rose-500 text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-foreground/40 hover:text-foreground text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors cursor-pointer"
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
              <p className="text-xs text-foreground/30 py-2">No items in this stop.</p>
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
