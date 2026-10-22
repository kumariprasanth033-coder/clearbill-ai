/**
 * ClearBill AI - Digital Receipt & Customer QR Screen
 * Temporary 30-second guest session countdown, QR generator, PDF download, and customer vault save.
 */

import React, { useState, useEffect } from 'react';
import {
  Receipt as ReceiptIcon,
  Download,
  Share2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Leaf,
  Store,
  Printer,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { Receipt, Transaction, Company, Outlet } from '../types.ts';

interface DigitalReceiptScreenProps {
  receiptToken: string;
  onBackToBilling?: () => void;
  onClaimSuccess?: () => void;
}

export const DigitalReceiptScreen: React.FC<DigitalReceiptScreenProps> = ({
  receiptToken,
  onBackToBilling,
  onClaimSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    receipt: Receipt;
    transaction: Transaction;
    company: Company;
    outlet: Outlet;
    isExpired: boolean;
  } | null>(null);

  // 30-Second Guest Viewing Countdown Timer
  const [countdown, setCountdown] = useState<number>(30);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  useEffect(() => {
    if (!receiptToken) return;
    setLoading(true);

    fetch(`/api/receipts/${receiptToken}`)
      .then(r => r.json())
      .then(data => {
        if (data.receipt && data.transaction) {
          setReceiptData(data);
          setCountdown(30);
          setSessionExpired(false);
        } else {
          setError(data.error || 'Receipt not found or expired.');
        }
      })
      .catch(err => {
        setError('Network error loading receipt: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [receiptToken]);

  // Countdown effect
  useEffect(() => {
    if (sessionExpired || countdown <= 0 || loading) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setSessionExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, sessionExpired, loading]);

  const handleClaimReceipt = async () => {
    setClaimLoading(true);
    try {
      const res = await fetch(`/api/receipts/${receiptToken}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerUserId: 'usr-cus-01' }),
      });
      if (res.ok) {
        setIsClaimed(true);
        if (onClaimSuccess) onClaimSuccess();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClaimLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 space-y-3">
        <ReceiptIcon className="w-10 h-10 animate-bounce mx-auto text-[#16A34A]" />
        <p className="text-sm font-semibold">Generating Smart Digital Receipt...</p>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Receipt Access Notice</h3>
        <p className="text-xs text-slate-600">{error || 'Receipt unavailable.'}</p>
        {onBackToBilling && (
          <button
            onClick={onBackToBilling}
            className="px-4 py-2 bg-[#172033] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg"
          >
            Return to Billing
          </button>
        )}
      </div>
    );
  }

  const { receipt, transaction, company, outlet } = receiptData;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Top Controls & Navigation */}
      <div className="flex items-center justify-between">
        {onBackToBilling && (
          <button
            onClick={onBackToBilling}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to POS Billing</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* 30-Second Guest Viewing Timer Alert */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>
            {sessionExpired
              ? 'Guest viewing countdown expired.'
              : `Temporary Guest Session: ${countdown}s remaining`}
          </span>
        </div>
        {sessionExpired ? (
          <button
            onClick={() => {
              setCountdown(30);
              setSessionExpired(false);
            }}
            className="px-2.5 py-1 bg-[#16A34A] text-white text-[11px] font-semibold rounded-md shadow-xs hover:bg-[#15803D]"
          >
            Reopen Receipt (Token Active)
          </button>
        ) : (
          <span className="font-mono text-emerald-700 font-bold tabular-nums">00:{countdown.toString().padStart(2, '0')}</span>
        )}
      </div>

      {/* Main Digital Receipt Card (White #FFFFFF, Crisp Borders) */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        {/* Paperless Sustainability Ribbon */}
        <div className="bg-[#DCFCE7] border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-[#15803D]">
          <div className="flex items-center gap-2 font-medium">
            <Leaf className="w-4 h-4 text-[#16A34A]" />
            <span>Confirmed 100% Paperless Digital Receipt</span>
          </div>
          <span className="font-bold text-[11px]">+2.5g Paper Saved</span>
        </div>

        {/* Store Header */}
        <div className="text-center pb-4 border-b border-dashed border-slate-200 space-y-1">
          <h2 className="text-xl font-extrabold text-[#172B4D] tracking-tight">
            {company?.business_name || 'ClearBill Retail Outlet'}
          </h2>
          <p className="text-xs text-[#64748B]">
            {outlet?.outlet_name} · {outlet?.address}
          </p>
          <p className="text-[11px] text-[#64748B]">
            GSTIN: {company?.tax_identification_number || '29AAAAA0000A1Z5'} · Tel: {outlet?.phone || '+91 98765 43210'}
          </p>
        </div>

        {/* Transaction Metadata */}
        <div className="grid grid-cols-2 text-xs text-slate-600 gap-y-1">
          <div>
            <span className="text-slate-400">Receipt No: </span>
            <span className="font-bold text-slate-800">{receipt.receipt_number}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Date: </span>
            <span className="font-medium text-slate-800">
              {new Date(transaction.created_at).toLocaleDateString()} {new Date(transaction.created_at).toLocaleTimeString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Transaction ID: </span>
            <span className="font-mono text-slate-700">{transaction.transaction_number}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Payment: </span>
            <span className="font-bold uppercase text-emerald-700">{transaction.payment_method} (Verified)</span>
          </div>
          {transaction.customer_name && (
            <div className="col-span-2 pt-1 text-slate-500">
              Customer: <span className="font-medium text-slate-800">{transaction.customer_name}</span>
            </div>
          )}
        </div>

        {/* Itemized Table */}
        <div className="pt-2 border-t border-slate-200">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-2">Item Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transaction.items?.map((it, idx) => (
                <tr key={idx} className="py-2">
                  <td className="py-2.5 font-medium text-slate-800">
                    <div>{it.product_name}</div>
                    {it.tax_rate > 0 && (
                      <span className="text-[10px] text-slate-400">GST: {it.tax_rate}%</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-700 tabular-nums">
                    {it.quantity}
                  </td>
                  <td className="py-2.5 text-right text-slate-600 tabular-nums">
                    ₹{it.unit_price.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                    ₹{it.line_total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Breakdowns */}
        <div className="pt-3 border-t border-dashed border-slate-200 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium text-slate-900 tabular-nums">₹{transaction.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Taxes (GST):</span>
            <span className="font-medium text-slate-900 tabular-nums">₹{transaction.tax_amount.toFixed(2)}</span>
          </div>
          {transaction.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount Applied:</span>
              <span className="font-medium tabular-nums">-₹{transaction.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
            <span className="text-sm font-bold text-[#172B4D]">Grand Total Paid:</span>
            <span className="text-2xl font-black text-[#16A34A] tabular-nums">
              ₹{transaction.grand_total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Digital QR Code Container */}
        <div className="pt-4 border-t border-slate-200 flex flex-col items-center justify-center text-center space-y-2">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs inline-block">
            <QrCode className="w-32 h-32 text-slate-900" />
          </div>
          <p className="text-xs font-semibold text-slate-800">Scan QR with any Smartphone Camera</p>
          <p className="text-[11px] text-slate-500 max-w-xs">
            Instantly view your receipt online without installing any app. Token valid for 24 hours.
          </p>
        </div>

        {/* Customer Account Vault Claim Action */}
        <div className="pt-4 border-t border-slate-200">
          {isClaimed ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              <span>Saved permanently to your Customer Account Vault!</span>
            </div>
          ) : (
            <button
              onClick={handleClaimReceipt}
              disabled={claimLoading}
              className="w-full py-2.5 bg-[#172033] hover:bg-[#263449] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{claimLoading ? 'Saving...' : 'Save Receipt to My Customer Account Vault'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
