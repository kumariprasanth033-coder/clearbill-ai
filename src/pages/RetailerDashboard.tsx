/**
 * ClearBill AI - Retailer Cashier Dashboard
 * Fast touch-friendly actions: New Bill, Quick Bill, Scan Barcode, shift metrics.
 */

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  ScanLine,
  Zap,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  QrCode,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { DashboardMetrics } from '../types.ts';
import { getAuthHeaders } from '../utils/authHeaders.ts';

interface RetailerDashboardProps {
  onNavigate: (tab: string) => void;
}

export const RetailerDashboard: React.FC<RetailerDashboardProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics', { headers: getAuthHeaders('retailer') })
      .then(r => r.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      {/* Cashier Shift Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-emerald-800 bg-[#DCFCE7] px-2 py-0.5 rounded uppercase tracking-wider">
            Active Cashier Terminal · Counter #1
          </span>
          <h2 className="text-lg font-bold text-[#172B4D] mt-1">Retail POS Workstation</h2>
          <p className="text-xs text-[#64748B]">
            Speed billing enabled. Camera scanner active for instant physical barcode additions.
          </p>
        </div>

        {/* Big Frequent Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('quick-bill')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
          >
            <Zap className="w-4 h-4" />
            <span>Quick Bill (1-Tap)</span>
          </button>
          <button
            onClick={() => onNavigate('barcode-scanner')}
            className="px-4 py-2.5 bg-[#172033] hover:bg-[#263449] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>Scan Barcode</span>
          </button>
          <button
            onClick={() => onNavigate('new-bill')}
            className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
          >
            <Receipt className="w-4 h-4" />
            <span>+ New Bill</span>
          </button>
        </div>
      </div>

      {/* 4 White KPI Cards for Current Shift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Today's Sales</span>
          <p className="text-2xl font-extrabold text-[#172B4D] tabular-nums">
            ₹{metrics?.totalSales.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            Current Counter Volume
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Bills Created</span>
          <p className="text-2xl font-extrabold text-[#172B4D] tabular-nums">
            {metrics?.transactionsCount || 0}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            100% Finalized Invoices
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Completed Transactions</span>
          <p className="text-2xl font-extrabold text-[#16A34A] tabular-nums">
            {metrics?.completedCount || 0}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            Zero Payment Rejections
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Digital Receipts Handed</span>
          <p className="text-2xl font-extrabold text-[#172B4D] tabular-nums">
            {metrics?.digitalReceiptsCount || 0}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Customer QR Scanned
          </span>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => onNavigate('quick-bill')}
          className="cursor-pointer bg-white border border-[#E2E8F0] hover:border-amber-400 rounded-xl p-5 shadow-xs transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Quick Bill (Tea Shop & Express)</h3>
          <p className="text-xs text-slate-500 mt-1">
            One-tap addition of tea, coffee, samosa, buns with automatic total calculation.
          </p>
        </div>

        <div
          onClick={() => onNavigate('barcode-scanner')}
          className="cursor-pointer bg-white border border-[#E2E8F0] hover:border-[#16A34A] rounded-xl p-5 shadow-xs transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#16A34A] group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Rear-Facing Camera Barcode Scanner</h3>
          <p className="text-xs text-slate-500 mt-1">
            Continuous decoding for EAN-13, EAN-8, UPC, and Code 128 items into the draft bill.
          </p>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172B4D]">Recent Counter Invoices</h3>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-semibold text-[#16A34A] hover:underline"
          >
            View Full Ledger
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {metrics?.recentTransactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="py-3 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-slate-800">{tx.transaction_number}</span>
                <span className="text-slate-400 ml-2">
                  {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {tx.customer_name || 'Walk-in'} · {tx.payment_method.toUpperCase()}
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  ₹{tx.grand_total.toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-700 block font-semibold">Verified</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
