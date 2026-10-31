"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ItemCard } from "@/entities/item";
import type { Bill, BillCharges } from "@/entities/session";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah } from "@/shared/lib";
import type { ReceiptItem } from "@/shared/types";
import { useI18n } from "@/shared/i18n";
import { ReceiptViewer } from "./ReceiptViewer";

export interface BillGroupCardProps {
  bill: Bill;
  items: Array<ReceiptItem & { depth: number }>;
  isSingleBill?: boolean;
  isJoined: boolean;
  userName: string;
  sessionPayerName: string;
  addItem: (name: string, price: number, quantity: number, billId?: string) => Promise<boolean>;
  rescanBill: (billId: string) => Promise<string | null>;
  updateBill: (billId: string, name: string, payerName: string, charges: BillCharges, grandTotal: number) => Promise<boolean>;
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
  addItem,
  rescanBill,
  updateBill,
  deleteBill,
  firstUnclaimedId,
  showClaimHint,
  completeClaimHint,
  updateClaim,
  renameItem,
}: BillGroupCardProps) {
  const { m } = useI18n();
  const t = m.billCard;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [isSavingItem, setIsSavingItem] = useState(false);

  const [name, setName] = useState(bill.name);
  const [payerName, setPayerName] = useState(bill.payerName);
  const [tax, setTax] = useState(bill.tax.toString());
  const [serviceCharge, setServiceCharge] = useState(bill.serviceCharge.toString());
  const [discount, setDiscount] = useState(bill.discount.toString());
  const [otherCharges, setOtherCharges] = useState(bill.otherCharges.toString());
  const [grandTotal, setGrandTotal] = useState(bill.grandTotal.toString());
  const [isSaving, setIsSaving] = useState(false);

  const isAuthorized = isJoined && userName !== "" && (
    userName === bill.payerName ||
    userName === sessionPayerName
  );

  const billSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hasClaims = items.some((item) => item.claims.some((c) => c.shares > 0));

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateBill(
      bill.id,
      name.trim(),
      payerName.trim(),
      {
        tax: parseFloat(tax) || 0,
        serviceCharge: parseFloat(serviceCharge) || 0,
        discount: parseFloat(discount) || 0,
        otherCharges: parseFloat(otherCharges) || 0,
      },
      parseFloat(grandTotal) || 0
    );
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (confirm(t.deleteConfirm(bill.name))) {
      await deleteBill(bill.id);
    }
  };

  const handleRescan = async () => {
    if (!bill.id || isRescanning) return;
    const promptMsg = hasClaims
      ? t.rescanConfirmWithClaims(bill.name)
      : t.rescanConfirm(bill.name);
    if (!confirm(promptMsg)) return;

    setIsRescanning(true);
    setRescanError(null);
    const err = await rescanBill(bill.id);
    if (err) {
      setRescanError(err);
    }
    setIsRescanning(false);
  };

  const handleAddBillItem = async () => {
    const price = parseFloat(newItemPrice);
    const qty = parseInt(newItemQty, 10);
    if (!newItemName.trim() || isNaN(price) || isNaN(qty)) return;

    setIsSavingItem(true);
    const success = await addItem(newItemName.trim(), price, qty, bill.id || undefined);
    if (success) {
      setIsAddingItem(false);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemQty("1");
    }
    setIsSavingItem(false);
  };

  const receiptToggleBtn = bill.imageUrl ? (
    <button
      type="button"
      onClick={() => {
        setShowReceipt((prev) => !prev);
        if (isCollapsed) setIsCollapsed(false);
      }}
      className={`focus-visible:outline-sage flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
        showReceipt
          ? "border-sage/50 bg-sage/15 text-sage"
          : "text-foreground/75 hover:text-sage border-[var(--glass-border)] bg-[var(--glass-bg)]"
      }`}
    >
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M14 8H8" />
        <path d="M16 12H8" />
        <path d="M13 16H8" />
      </svg>
      <span>{showReceipt ? t.hideReceipt : t.viewReceipt}</span>
    </button>
  ) : null;

  const rescanBtn = isAuthorized && bill.id !== "" && bill.imageUrl ? (
    <button
      type="button"
      onClick={() => void handleRescan()}
      disabled={isRescanning}
      className="text-foreground/75 hover:text-sage focus-visible:outline-sage flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
    >
      <svg
        className={`h-3.5 w-3.5 shrink-0 ${isRescanning ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
      <span>{isRescanning ? t.rescanningAi : t.rescanAi}</span>
    </button>
  ) : null;

  const content = (
    <>
      {isEditing ? (
        <div className="border-sage/20 bg-sage/5 mb-3 space-y-3 rounded-xl border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.nameLabel}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.payerLabel}</span>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.taxLabel}</span>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.serviceLabel}</span>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.discountLabel}</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.otherChargesLabel}</span>
              <input
                type="number"
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/40 text-[10px] font-bold tracking-wider uppercase">{t.totalLabel}</span>
              <input
                type="number"
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value)}
                className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {receiptToggleBtn}
              {rescanBtn}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setName(bill.name);
                  setPayerName(bill.payerName);
                  setTax(bill.tax.toString());
                  setServiceCharge(bill.serviceCharge.toString());
                  setDiscount(bill.discount.toString());
                  setOtherCharges(bill.otherCharges.toString());
                  setGrandTotal(bill.grandTotal.toString());
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="text-foreground/50 hover:text-foreground cursor-pointer rounded px-3 py-1 text-xs font-semibold"
              >
                {m.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-sage text-background hover:bg-sage/90 cursor-pointer rounded-full px-4 py-1 text-xs font-semibold shadow-xs"
              >
                {isSaving ? m.common.saving : m.common.save}
              </button>
            </div>
          </div>
        </div>
      ) : !isSingleBill ? (
        <div className="flex flex-col gap-2 border-b border-[var(--glass-border)] pb-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground font-serif text-base font-semibold [overflow-wrap:anywhere] sm:text-lg">
              {bill.name}
            </h3>
            <p className="text-foreground/70 font-sans text-xs [overflow-wrap:anywhere]">{t.paidBy(bill.payerName)}</p>
            <div className="text-foreground/70 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-sans text-xs tabular-nums">
              <span>{t.subtotal(billSubtotal)}</span>
              {bill.tax > 0 && <span>{t.tax(bill.tax)}</span>}
              {bill.serviceCharge > 0 && <span>{t.service(bill.serviceCharge)}</span>}
              {bill.discount > 0 && <span>{t.discount(bill.discount)}</span>}
              {bill.otherCharges !== 0 && <span>{t.otherCharges(bill.otherCharges)}</span>}
              <span className="text-foreground font-semibold">{t.total(bill.grandTotal)}</span>
            </div>
          </div>

          <div className="-ml-2 flex flex-wrap items-center gap-1.5 sm:ml-0">
            {receiptToggleBtn}
            {rescanBtn}
            {isAuthorized && bill.id !== "" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem((prev) => !prev);
                    if (isCollapsed) setIsCollapsed(false);
                  }}
                  className="text-sage hover:bg-sage/10 min-h-11 cursor-pointer rounded-sm px-2 text-xs font-semibold transition-colors"
                >
                  + {t.addItemToBill}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-foreground/70 hover:text-sage min-h-11 cursor-pointer rounded-sm px-2 text-xs transition-colors"
                >
                  {m.common.edit}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="min-h-11 cursor-pointer rounded-sm px-2 text-xs text-rose-600 transition-colors hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                >
                  {m.common.delete}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-expanded={!isCollapsed}
              className="text-foreground/70 hover:text-foreground min-h-11 cursor-pointer rounded-sm px-2 text-xs transition-colors"
            >
              {isCollapsed ? t.show : t.hide}
            </button>
          </div>
        </div>
      ) : (bill.imageUrl || (isAuthorized && bill.id !== "")) && (
        <div className="text-foreground/60 flex flex-wrap items-center justify-between gap-2 pb-1 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            {bill.tax > 0 && <span>{t.tax(bill.tax)}</span>}
            {bill.serviceCharge > 0 && <span>{t.service(bill.serviceCharge)}</span>}
            {bill.discount > 0 && <span>{t.discount(bill.discount)}</span>}
            {bill.otherCharges !== 0 && <span>{t.otherCharges(bill.otherCharges)}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {receiptToggleBtn}
            {rescanBtn}
            {isAuthorized && bill.id !== "" && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-sage cursor-pointer text-xs font-semibold hover:underline"
              >
                {t.editDetails}
              </button>
            )}
          </div>
        </div>
      )}

      {rescanError && !showReceipt && (
        <p role="alert" className="text-xs text-rose-500 dark:text-rose-300">
          {rescanError}
        </p>
      )}

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className={showReceipt && bill.imageUrl ? "grid grid-cols-1 gap-4 pt-2 lg:grid-cols-12 lg:items-start" : ""}>
              {showReceipt && bill.imageUrl && (
                <div className="lg:sticky lg:top-6 lg:col-span-5">
                  <ReceiptViewer
                    imageUrl={bill.imageUrl}
                    billName={bill.name}
                    isAuthorized={isAuthorized && bill.id !== ""}
                    isRescanning={isRescanning}
                    rescanError={rescanError}
                    onRescan={() => void handleRescan()}
                    onClose={() => setShowReceipt(false)}
                  />
                </div>
              )}

              <div className={showReceipt && bill.imageUrl ? "space-y-3 lg:col-span-7" : "space-y-3"}>
                {isAddingItem && isAuthorized && (
                  <div className="border-sage/25 bg-sage/5 space-y-3 rounded-xl border p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder={m.claimBoard.itemNamePlaceholder}
                        className="border-foreground/20 focus:border-sage text-foreground border-b bg-transparent px-1 py-1 text-sm focus:outline-none sm:col-span-1"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/40 text-[10px] font-bold uppercase">{m.claimBoard.quantity}</span>
                        <input
                          type="number"
                          value={newItemQty}
                          onChange={(e) => setNewItemQty(e.target.value)}
                          placeholder="1"
                          className="border-foreground/20 focus:border-sage text-foreground w-16 border-b bg-transparent px-1 py-1 text-center font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/40 text-[10px] font-bold uppercase">Rp</span>
                        <input
                          type="number"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          placeholder="0"
                          className="border-foreground/20 focus:border-sage text-foreground flex-1 border-b bg-transparent px-1 py-1 font-mono text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-2">
                      <span className="text-sage font-mono text-xs font-bold">
                        {formatRupiah((parseFloat(newItemPrice) || 0) * (parseInt(newItemQty, 10) || 0))}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingItem(false)}
                          disabled={isSavingItem}
                          className="text-foreground/50 hover:text-foreground cursor-pointer px-3 py-1 text-xs font-semibold"
                        >
                          {m.common.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAddBillItem()}
                          disabled={isSavingItem}
                          className="bg-sage text-background hover:bg-sage/90 cursor-pointer rounded-full px-4 py-1 text-xs font-semibold"
                        >
                          {isSavingItem ? m.claimBoard.adding : m.claimBoard.addItemSubmit}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <p className="text-foreground/30 py-3 text-center text-xs">{t.empty}</p>
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
              </div>
            </div>
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
