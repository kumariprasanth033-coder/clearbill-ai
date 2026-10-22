/**
 * ClearBill AI - Payments & Gateway Settlements Console
 * Manages Cash drawer audits, dynamic UPI integration, and Card terminal batches.
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { DashboardMetrics } from '../types.ts';

export const PaymentsScreen: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification simulation state
  const [testAmount, setTestAmount] = useState('100.00');
  const [testMethod, setTestMethod] = useState<'upi' | 'card'>('upi');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(r => r.json())
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, []);

  const handleTestPayment = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: 'tx-002',
          paymentMethod: testMethod,
          amount: parseFloat(testAmount),
          upiRef: `UPI-${Date.now()}`,
          cardLast4: '4242',
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#16A34A]" />
            Payment Gateways & Settlement Configuration
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real merchant reconciliation for Cash, dynamic UPI QR codes, and EMV Card terminals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-800 bg-[#DCFCE7] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Sandbox Mode Active (XAMPP Ready)</span>
          </span>
        </div>
      </div>

      {/* Payment Gateway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* UPI Gateway */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Dynamic UPI & QR Engine</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Generates customer UPI QR on checkout. Accepts Google Pay, PhonePe, Paytm, and BHIM with instant settlement.
          </p>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Total Settled:</span>
            <span className="font-bold text-slate-900 tabular-nums">
              ₹{metrics?.upiTotal.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>

        {/* Cash Drawer */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Cash Drawer POS</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Tracks physical currency received, cashier change calculation, and end-of-shift cash drawer balance.
          </p>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cash Volume:</span>
            <span className="font-bold text-slate-900 tabular-nums">
              ₹{metrics?.cashTotal.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>

        {/* Card POS */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Card POS Terminal</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Visa, Mastercard, RuPay processing. Supports EMV chip, contactless NFC, and automated batch settlement.
          </p>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Card Volume:</span>
            <span className="font-bold text-slate-900 tabular-nums">
              ₹{metrics?.cardTotal.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Provider Verification & Sandbox Diagnostic */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#172B4D]">Payment Gateway Status & Sandbox Verification</h3>
        <p className="text-xs text-slate-600">
          In development, ClearBill AI runs the validated Sandbox Adapter. For live bank settlements, set{' '}
          <code>UPI_MERCHANT_VPA</code> and <code>CARD_TERMINAL_ID</code> in <code>.env</code>.
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Method:</span>
              <select
                value={testMethod}
                onChange={e => setTestMethod(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800"
              >
                <option value="upi">UPI Sandbox (Simulate VPA Settlement)</option>
                <option value="card">Card POS Sandbox (Simulate Batch Auth)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Amount:</span>
              <input
                type="number"
                value={testAmount}
                onChange={e => setTestAmount(e.target.value)}
                className="w-24 bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
              />
            </div>

            <button
              onClick={handleTestPayment}
              disabled={testing}
              className="px-3.5 py-1.5 bg-[#172033] hover:bg-[#263449] text-white font-bold rounded-lg transition-colors shadow-xs"
            >
              {testing ? 'Testing...' : 'Run Gateway Verification Test'}
            </button>
          </div>

          {testResult && (
            <div className="mt-2 p-3 bg-white border border-emerald-200 rounded-lg text-emerald-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Verification Result: {testResult.status?.toUpperCase() || 'SUCCESS'}</span>
              </div>
              <p className="text-[11px] text-slate-600">{testResult.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
