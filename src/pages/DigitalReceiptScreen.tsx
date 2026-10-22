/**
 * ClearBill AI - Digital Receipt & Real Machine-Readable QR Screen
 * Authoritative digital invoice with dynamically generated scannable QR code,
 * 24-hour guest security expiration, customer account vault claiming, and PDF print.
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Receipt as ReceiptIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Leaf,
  Printer,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Receipt, Transaction, Company, Outlet } from '../types.ts';

interface DigitalReceiptScreenProps {
  receiptToken: string;
  onBackToBilling?: () => void;
  onClaimSuccess?: () => void;
  onPromptAuth?: () => void;
}

export const DigitalReceiptScreen: React.FC<DigitalReceiptScreenProps> = ({
  receiptToken,
  onBackToBilling,
  onClaimSuccess,
  onPromptAuth,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpiredError, setIsExpiredError] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    receipt: Receipt;
    transaction: Transaction;
    token?: {
      token: string;
      expires_at: string;
      viewing_session_seconds?: number;
      is_claimed?: boolean;
    };
    company: Company;
    outlet: Outlet;
    isExpired: boolean;
    publicOrigin?: string;
  } | null>(null);

  // 30-Second Guest Viewing Countdown Timer (session quick-view UX)
  const [countdown, setCountdown] = useState<number>(30);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  // Real Machine-Readable QR Code state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load receipt data from backend
  useEffect(() => {
    if (!receiptToken) {
      setError('No receipt access token provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsExpiredError(false);

    fetch(`/api/receipts/${receiptToken}`)
      .then(async res => {
        const data = await res.json();
        if (res.status === 410) {
          setIsExpiredError(true);
          setError(data.error || 'Receipt viewing token has expired (24-hour viewing window lapsed).');
          return;
        }
        if (!res.ok) {
          setError(data.error || 'Receipt not found or invalid token.');
          return;
        }
        if (data.receipt && data.transaction) {
          setReceiptData(data);
          setCountdown(30);
          setSessionExpired(false);
          if (data.token?.is_claimed) {
            setIsClaimed(true);
          }
        } else {
          setError('Invalid receipt data received from server.');
        }
      })
      .catch(err => {
        setError('Network error connecting to ClearBill receipt server: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [receiptToken]);

  // Generate real machine-readable QR Code dynamically
  const generateRealQrCode = React.useCallback(async () => {
    if (!receiptToken) return;
    setQrGenerating(true);
    setQrError(null);

    try {
      // Use configured application domain or active window origin
      const currentOrigin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'http://localhost:3000';

      const fullReceiptUrl = `${currentOrigin}/receipt/${receiptToken}`;

      // Generate real, machine-readable high-contrast QR code
      const dataUrl = await QRCode.toDataURL(fullReceiptUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 2,
        width: 256,
        color: {
          dark: '#172B4D', // ClearBill signature dark navy
          light: '#FFFFFF', // Pure white background
        },
      });

      setQrDataUrl(dataUrl);
    } catch (err: any) {
      console.error('[ClearBill AI] QR Code generation error:', err);
      setQrError('Failed to generate machine-readable QR code. ' + (err?.message || ''));
    } finally {
      setQrGenerating(false);
    }
  }, [receiptToken]);

  useEffect(() => {
    generateRealQrCode();
  }, [generateRealQrCode]);

  // Countdown timer for 30s guest quick session
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
      const data = await res.json();
      if (res.ok) {
        setIsClaimed(true);
        if (onClaimSuccess) onClaimSuccess();
      } else {
        alert(data.error || 'Failed to claim receipt.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error claiming receipt: ' + err.message);
    } finally {
      setClaimLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getFullReceiptUrl = () => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return `${window.location.origin}/receipt/${receiptToken}`;
    }
    return `/receipt/${receiptToken}`;
  };

  const handleCopyLink = () => {
    const url = getFullReceiptUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 space-y-4 max-w-md mx-auto">
        <ReceiptIcon className="w-12 h-12 animate-bounce mx-auto text-[#16A34A]" />
        <h3 className="text-base font-bold text-[#172B4D]">Retrieving Authoritative Digital Receipt</h3>
        <p className="text-xs text-slate-500">Validating guest token and generating dynamic scannable QR code...</p>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-4 shadow-sm mt-6">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
          isExpiredError ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
        }`}>
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#172B4D]">
            {isExpiredError ? 'Receipt Security Token Expired' : 'Receipt Access Unavailable'}
          </h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {error || 'The requested digital receipt could not be loaded.'}
          </p>
          {isExpiredError && (
            <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              For privacy and fraud prevention, unauthenticated guest tokens expire after 24 hours.
              If you claimed this receipt, please sign in to your Customer Account Vault to view it anytime.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          {onBackToBilling && (
            <button
              onClick={onBackToBilling}
              className="w-full sm:w-auto px-4 py-2 bg-[#172B4D] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Return to Billing
            </button>
          )}
          {onPromptAuth && (
            <button
              onClick={onPromptAuth}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#16A34A] border border-emerald-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Customer Vault Sign In
            </button>
          )}
        </div>
      </div>
    );
  }

  const { receipt, transaction, company, outlet, token } = receiptData;
  const fullUrl = getFullReceiptUrl();

  const formattedExpiry = token?.expires_at
    ? new Date(token.expires_at).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '24 hours from creation';

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      {/* Top Controls & Navigation */}
      <div className="flex items-center justify-between">
        {onBackToBilling ? (
          <button
            onClick={onBackToBilling}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to POS Billing</span>
          </button>
        ) : (
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            <span>ClearBill Verified Receipt</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
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
              ? 'Guest quick-view session timer concluded.'
              : `Temporary Guest Session: ${countdown}s remaining`}
          </span>
        </div>
        {sessionExpired ? (
          <button
            onClick={() => {
              setCountdown(30);
              setSessionExpired(false);
            }}
            className="px-2.5 py-1 bg-[#16A34A] text-white text-[11px] font-semibold rounded-md shadow-xs hover:bg-[#15803D] cursor-pointer"
          >
            Reopen Session (Token Active)
          </button>
        ) : (
          <span className="font-mono text-emerald-700 font-bold tabular-nums">
            00:{countdown.toString().padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Main Digital Receipt Card */}
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
        <div className="grid grid-cols-2 text-xs text-slate-600 gap-y-1.5">
          <div>
            <span className="text-slate-400">Receipt No: </span>
            <span className="font-bold text-slate-800">{receipt.receipt_number}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Date: </span>
            <span className="font-medium text-slate-800">
              {new Date(transaction.created_at).toLocaleDateString()} {new Date(transaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Invoice ID: </span>
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

        {/* Real Dynamic Machine-Readable QR Code Container */}
        <div className="pt-5 border-t border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm inline-block relative min-h-[224px] min-w-[224px] flex items-center justify-center">
            {qrGenerating ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-[#16A34A]" />
                <span className="text-xs font-semibold text-slate-600">Generating Scannable QR...</span>
              </div>
            ) : qrError ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center gap-2 text-rose-600">
                <AlertTriangle className="w-8 h-8" />
                <span className="text-xs font-medium">{qrError}</span>
                <button
                  onClick={generateRealQrCode}
                  className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Scannable QR Code for Receipt ${receipt.receipt_number}`}
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
              />
            ) : (
              <QrCode className="w-48 h-48 text-slate-300" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-[#172B4D]">Scan with your phone camera</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Point your smartphone camera to instantly view, verify, or download this receipt on any device.
            </p>
          </div>

          {/* Action Links & Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-[#172B4D] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Digital Receipt</span>
            </a>

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Receipt Link</span>
                </>
              )}
            </button>
          </div>

          {/* Security & 24h Expiry Metadata */}
          <div className="pt-2 text-[11px] text-slate-400 space-y-0.5">
            <div>
              Access Token: <span className="font-mono text-slate-600 font-medium">{receiptToken}</span>
            </div>
            <div>
              Token valid for 24 hours · Expires <span className="text-slate-600 font-medium">{formattedExpiry}</span>
            </div>
          </div>
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
              className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-emerald-100" />
              <span>{claimLoading ? 'Saving to Vault...' : 'Save Receipt to My Customer Account'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
