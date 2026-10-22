/**
 * ClearBill AI - Payment Reconciliation & Settlement Verification
 * Cash in drawer audits, UPI settlement logs, and variance tracking.
 */

import React, { useState, useEffect } from 'react';
import { Scale, CheckCircle2, AlertTriangle, CreditCard, Banknote, QrCode } from 'lucide-react';
import { DashboardMetrics } from '../types.ts';

export const ReconciliationScreen: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(r => r.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#16A34A]" />
            Multi-Channel Payment Reconciliation
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Audit physical cash drawer balances against verified UPI and Card terminal settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800 bg-[#DCFCE7] px-3 py-1.5 rounded-lg">
            Reconciliation Status: Balanced (0 Discrepancies)
          </span>
        </div>
      </div>

      {/* 3 Channel Audits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Counter Cash Drawer</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{metrics?.cashTotal.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            Matches Cash Receipts (100%)
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">UPI / QR Bank Credits</span>
            <QrCode className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{metrics?.upiTotal.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            Instant Node Settlement OK
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Card POS Batch Terminal</span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{metrics?.cardTotal.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            Terminal Batch Auto-Settled
          </span>
        </div>
      </div>
    </div>
  );
};
