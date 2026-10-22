/**
 * ClearBill AI - Customer Account & Digital Vault
 * Saved receipts, category spending breakdown, monthly budgets, warranty reminders.
 */

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Receipt,
  Download,
  Calendar,
  PieChart,
  Bell,
  Clock,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Receipt as ReceiptType } from '../types.ts';

interface CustomerPortalProps {
  onOpenReceipt: (token: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onOpenReceipt }) => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/customer/receipts?customerUserId=usr-cus-01')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setReceipts(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = receipts.reduce(
    (sum, r) => sum + (r.transaction?.grand_total || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
            Verified Customer Vault
          </span>
          <h2 className="text-lg font-bold text-[#172B4D] mt-1">My Saved Digital Receipts & Warranty Proofs</h2>
          <p className="text-xs text-[#64748B]">
            Permanent paperless invoices, tax records, and purchase history across all ClearBill merchants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-500">Vault Balance: </span>
            <span className="font-bold text-slate-900 tabular-nums">
              ₹{totalSpent.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Saved Receipts</span>
          <p className="text-2xl font-extrabold text-[#172B4D] tabular-nums">{receipts.length}</p>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            Backed up on server
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Monthly Budget</span>
          <p className="text-2xl font-extrabold text-[#172B4D] tabular-nums">₹5,000.00</p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            ₹{(5000 - totalSpent).toFixed(2)} remaining
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Active Warranties</span>
          <p className="text-2xl font-extrabold text-[#16A34A] tabular-nums">1 Active</p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Stainless Steel Flask (1 Year)
          </span>
        </div>
      </div>

      {/* Receipts List */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172B4D]">Verified Saved Receipts</h3>
          <span className="text-xs text-slate-500">{receipts.length} total</span>
        </div>

        {receipts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">No saved receipts found in this customer vault yet.</p>
            <p className="text-[11px] text-slate-500">
              Complete a bill or scan any ClearBill QR receipt to save it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {receipts.map(r => {
              const token = r.tokens?.[0]?.token;
              return (
                <div key={r.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-mono font-bold text-slate-800">{r.receipt_number}</span>
                    <span className="text-slate-400 ml-2">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {r.transaction?.items?.map((it: any) => it.product_name).join(', ') || 'Retail Items'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900 tabular-nums block">
                        ₹{r.transaction?.grand_total?.toFixed(2) || '0.00'}
                      </span>
                      <span className="text-[10px] text-emerald-700 uppercase font-semibold">
                        {r.transaction?.payment_method}
                      </span>
                    </div>

                    {token && (
                      <button
                        onClick={() => onOpenReceipt(token)}
                        className="px-3 py-1.5 bg-[#DCFCE7] hover:bg-[#16A34A] hover:text-white text-[#15803D] font-semibold rounded-lg transition-colors"
                      >
                        Open Digital View
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
