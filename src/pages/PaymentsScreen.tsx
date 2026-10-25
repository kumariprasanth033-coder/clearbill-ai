/**
 * ClearBill AI - Payments & Gateway Settlements Console
 * Manages Cash drawer audits, dynamic UPI integration, Card terminal batches,
 * and AES-256-GCM encrypted Merchant Bank Settlement Configuration with audit logs.
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
  Building2,
  Lock,
  ArrowRight,
  Sparkles,
  History,
} from 'lucide-react';
import { DashboardMetrics } from '../types.ts';
import { getAuthHeaders } from '../utils/authHeaders.ts';

export const PaymentsScreen: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Settlement Configuration State
  const [settlementConfig, setSettlementConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [editingSettlement, setEditingSettlement] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingCode, setRoutingCode] = useState('');
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementSuccess, setSettlementSuccess] = useState<string | null>(null);

  // Verification simulation state
  const [testAmount, setTestAmount] = useState('100.00');
  const [testMethod, setTestMethod] = useState<'upi' | 'card'>('upi');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/metrics', { headers: getAuthHeaders('manager') })
      .then(r => r.json())
      .then(setMetrics)
      .finally(() => setLoading(false));

    loadSettlementConfig();
    loadAuditLogs();
  }, []);

  const loadSettlementConfig = async () => {
    try {
      const res = await fetch('/api/payments/settlement-config', {
        headers: getAuthHeaders('manager'),
      });
      if (res.ok) {
        const data = await res.json();
        setSettlementConfig(data);
        if (data.configured) {
          setBankName(data.bank_name || '');
          setAccountHolder(data.account_holder_name || '');
          setRoutingCode(data.routing_code || '');
        }
      }
    } catch (err) {
      console.warn('Failed to load settlement config:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/payments/audit-logs', {
        headers: getAuthHeaders('manager'),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAuditLogs(data);
      }
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    }
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettlementSaving(true);
    setSettlementError(null);
    setSettlementSuccess(null);

    try {
      const res = await fetch('/api/payments/settlement-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders('manager') as Record<string, string>),
        },
        body: JSON.stringify({
          bankName,
          accountHolderName: accountHolder,
          accountNumber,
          routingCode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettlementSuccess('Merchant settlement account encrypted and updated successfully.');
        setAccountNumber('');
        setEditingSettlement(false);
        loadSettlementConfig();
        loadAuditLogs();
      } else {
        setSettlementError(data.error || 'Failed to save settlement configuration.');
      }
    } catch (err: any) {
      setSettlementError('Connection error: ' + err.message);
    } finally {
      setSettlementSaving(false);
    }
  };

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
            Payment Gateways & Settlement Security
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Merchant reconciliation for Cash, dynamic UPI QR codes, and EMV Card terminals with AES-256 encrypted settlements.
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

      {/* Merchant Bank Settlement Configuration (Manager Access Only) */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#16A34A]" />
              <span>Merchant Bank Settlement Account</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Configured for daily store payouts. Encrypted with AES-256-GCM; account numbers are masked in all views.
            </p>
          </div>
          <button
            onClick={() => setEditingSettlement(!editingSettlement)}
            className="px-3 py-1.5 bg-[#172033] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            {editingSettlement ? 'Cancel Editing' : 'Update Settlement Bank'}
          </button>
        </div>

        {/* Security Policy Reminder */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <strong>Financial Security Guarantee:</strong> ClearBill AI strictly prohibits storing or collecting banking passwords, PINs, card CVVs, or OTPs. All bank account numbers are encrypted at rest with server-held keys, masked in all logs, and never exposed to retail staff or AI models.
          </div>
        </div>

        {settlementSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
            <span>{settlementSuccess}</span>
          </div>
        )}

        {settlementError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{settlementError}</span>
          </div>
        )}

        {/* Active Config Display */}
        {!editingSettlement && settlementConfig?.configured && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Bank Name</span>
              <span className="font-bold text-slate-800">{settlementConfig.bank_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Beneficiary Name</span>
              <span className="font-medium text-slate-800">{settlementConfig.account_holder_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Account Number</span>
              <span className="font-mono font-bold text-slate-900">{settlementConfig.masked_account_number}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">IFSC / Routing Code</span>
              <span className="font-mono text-slate-700">{settlementConfig.routing_code || '—'}</span>
            </div>
          </div>
        )}

        {/* Edit Settlement Form */}
        {editingSettlement && (
          <form onSubmit={handleSaveSettlement} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Settlement Bank Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank Ltd"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Beneficiary Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annapurna Retail & Tea Lounge"
                  value={accountHolder}
                  onChange={e => setAccountHolder(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">
                  Bank Account Number (Encrypted with AES-256)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter new account number"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">IFSC / Bank Routing Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={routingCode}
                  onChange={e => setRoutingCode(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={settlementSaving}
                className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                {settlementSaving ? 'Encrypting & Saving...' : 'Save & Encrypt Settlement Details'}
              </button>
              <button
                type="button"
                onClick={() => setEditingSettlement(false)}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Security Audit History */}
        {auditLogs.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Settlement Security Audit Trail</span>
            </span>
            <div className="space-y-1 text-[11px]">
              {auditLogs.slice(0, 3).map(log => (
                <div key={log.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                  <span className="font-mono text-slate-700">{log.action}: {log.details}</span>
                  <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
              className="px-3.5 py-1.5 bg-[#172033] hover:bg-[#263449] text-white font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
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
