/**
 * ClearBill AI - Digital Receipt & Real Machine-Readable QR Screen
 *
 * Fixes for Bug 2 & 30-Second Auto-Close:
 * 1. Solves Google 403 Forbidden Error on Mobile:
 *    - Encodes verified public HTTPS domain via buildPublicReceiptUrl().
 *    - Automatically maps restricted Google AI Studio developer URLs ('ais-dev-*.run.app'
 *      which require developer Google IAM authentication) to public shared preview
 *      URLs ('ais-pre-*.run.app') so external smartphone cameras open the receipt cleanly.
 *    - Supports custom LAN IP (e.g. http://192.168.1.X:3000) or VITE_PUBLIC_APP_URL.
 * 2. 30-Second Billing Auto-Close:
 *    - Prominent animated 30-second countdown for customer QR scan.
 *    - Automatically returns to POS / Quick Bill when 30 seconds lapse.
 *    - Includes "Close Now (Next Customer)" for rapid cashiers and "Pause Timer" if needed.
 * 3. Preserves ClearBill AI Design & Verification:
 *    - White/light background, green accents (#16A34A), signature dark navy (#172B4D).
 *    - High-contrast machine-readable PNG QR matrix.
 *    - 24-hour guest expiration enforcement & Customer Vault claiming.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Globe,
  Pause,
  Play,
  Settings2,
  CheckCircle,
} from 'lucide-react';
import { Receipt, Transaction, Company, Outlet } from '../types.ts';
import {
  buildPublicReceiptUrl,
  getPublicAppBaseUrl,
  isLocalhostOrigin,
  isAiStudioDevOrigin,
} from '../utils/urlConfig.ts';

interface DigitalReceiptScreenProps {
  receiptToken: string;
  isCashierView?: boolean;
  onBackToBilling?: () => void;
  onGoToCustomerHome?: () => void;
  onCustomerLogin?: () => void;
  onClaimSuccess?: () => void;
  onPromptAuth?: () => void;
}

export const DigitalReceiptScreen: React.FC<DigitalReceiptScreenProps> = ({
  receiptToken,
  isCashierView = false,
  onBackToBilling,
  onGoToCustomerHome,
  onCustomerLogin,
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

  // 30-Second POS Viewing & Auto-Close Timer
  const [countdown, setCountdown] = useState<number>(30);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  // Real Machine-Readable QR Code state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // URL Config Override Modal (allows setting Wi-Fi IP e.g. 192.168.1.X:3000 during local dev)
  const [showUrlConfigModal, setShowUrlConfigModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>(() => getPublicAppBaseUrl());

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

    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const customerSess = localStorage.getItem('cb_customer_session');
        if (customerSess) {
          const parsed = JSON.parse(customerSess);
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
        }
      } catch (e) {}
    }

    fetch(`/api/receipts/${receiptToken}`, { headers })
      .then(async res => {
        const data = await res.json();
        if (res.status === 410) {
          setIsExpiredError(true);
          setError(data.error || 'This receipt link has expired. Please log in to your customer account to view a receipt saved to your account.');
          return;
        }
        if (!res.ok) {
          setError(data.error || 'Receipt not found or invalid token.');
          return;
        }
        if (data.receipt && data.transaction) {
          setReceiptData(data);
          setCountdown(30);
          if (data.token?.is_claimed || data.accessedViaCustomerVault) {
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

  // Generate real machine-readable QR Code dynamically with public URL
  const generateRealQrCode = useCallback(async () => {
    if (!receiptToken) return;
    setQrGenerating(true);
    setQrError(null);

    try {
      // Use the verified public URL (never an internal restricted dev URL that causes Google 403)
      const fullReceiptUrl = buildPublicReceiptUrl(receiptToken);

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
      setActiveBaseUrl(getPublicAppBaseUrl());
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

  // 30-Second Automatic Close Timer: returns cashier back to POS / billing for next customer ONLY in cashier view
  useEffect(() => {
    if (!isCashierView) return; // NEVER run 30s auto-close on customer view!
    if (loading || error || isTimerPaused) return;

    if (countdown <= 0) {
      if (onBackToBilling) {
        onBackToBilling();
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onBackToBilling) {
            onBackToBilling();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, isTimerPaused, loading, error, onBackToBilling, isCashierView]);

  const handleClaimReceipt = async () => {
    // Check if user is logged in
    let hasSession = false;
    let customerUserId = 'usr-cus-01';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (typeof window !== 'undefined') {
      try {
        const sess = localStorage.getItem('cb_customer_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed.user?.id) {
            customerUserId = parsed.user.id;
            hasSession = true;
          }
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
        }
      } catch (e) {}
    }

    // If logged out: preserve claim context securely in sessionStorage and open login
    if (!hasSession) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cb_pending_claim_token', receiptToken);
      }
      if (onCustomerLogin) {
        onCustomerLogin();
      } else if (onPromptAuth) {
        onPromptAuth();
      }
      return;
    }

    setClaimLoading(true);
    try {
      const res = await fetch(`/api/receipts/${receiptToken}/claim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ customerUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsClaimed(true);
        if (onClaimSuccess) onClaimSuccess();
      } else {
        setError(data.error || 'Failed to claim receipt.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error claiming receipt: ' + err.message);
    } finally {
      setClaimLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getFullReceiptUrl = () => {
    return buildPublicReceiptUrl(receiptToken);
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

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrlInput.trim()) {
      localStorage.setItem('cb_public_app_url', customUrlInput.trim());
      setActiveBaseUrl(customUrlInput.trim());
      setShowUrlConfigModal(false);
      generateRealQrCode();
    }
  };

  const handleResetCustomUrl = () => {
    localStorage.removeItem('cb_public_app_url');
    setActiveBaseUrl(getPublicAppBaseUrl());
    setShowUrlConfigModal(false);
    generateRealQrCode();
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
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
            isExpiredError ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
          }`}
        >
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#172B4D]">
            {isExpiredError ? 'Receipt Link Expired' : 'Receipt Access Unavailable'}
          </h3>
          <p className="text-xs text-slate-700 mt-2 leading-relaxed font-medium">
            {isExpiredError
              ? 'This receipt link has expired. Please log in to your customer account to view a receipt saved to your account.'
              : error || 'The requested digital receipt could not be loaded.'}
          </p>
        </div>

        {isExpiredError ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                if (onCustomerLogin) {
                  onCustomerLogin();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/customer/login';
                }
              }}
              className="w-full sm:w-auto px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Customer Login
            </button>
            <button
              onClick={() => {
                if (onGoToCustomerHome) {
                  onGoToCustomerHome();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/customer/dashboard';
                }
              }}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Return to Customer Home
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {isCashierView && onBackToBilling && (
              <button
                onClick={onBackToBilling}
                className="w-full sm:w-auto px-4 py-2 bg-[#172B4D] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Return to Billing
              </button>
            )}
            <button
              onClick={() => {
                if (onGoToCustomerHome) {
                  onGoToCustomerHome();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        )}
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

  const isLocalhost = isLocalhostOrigin();
  const isAiStudio = isAiStudioDevOrigin();

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      {/* Top Controls & 30-Second Auto-Close Notification */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isCashierView && onBackToBilling ? (
          <button
            onClick={onBackToBilling}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to POS Billing</span>
          </button>
        ) : onGoToCustomerHome ? (
          <button
            onClick={onGoToCustomerHome}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Receipts</span>
          </button>
        ) : (
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            <span>ClearBill Verified Digital Receipt</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUrlConfigModal(true)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Configure public domain or Wi-Fi IP for phone scanning"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-600" />
            <span>QR URL Settings</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* 30-Second POS Auto-Close Status Banner (Cashier Station Only) */}
      {isCashierView && onBackToBilling && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              {countdown}s
            </div>
            <div>
              <span className="font-bold text-emerald-900 block">
                {isTimerPaused
                  ? 'Auto-Close Paused'
                  : `Closing automatically in ${countdown}s for next customer bill`}
              </span>
              <span className="text-[11px] text-emerald-700">
                Customer has 30 seconds to scan the digital receipt QR code.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTimerPaused(!isTimerPaused)}
              className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold rounded-md shadow-2xs hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
            >
              {isTimerPaused ? (
                <>
                  <Play className="w-3 h-3 text-emerald-600" />
                  <span>Resume Timer</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-amber-600" />
                  <span>Pause Timer</span>
                </>
              )}
            </button>

            <button
              onClick={onBackToBilling}
              className="px-3 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-bold rounded-md shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Next Bill Now</span>
            </button>
          </div>
        </div>
      )}

      {/* QR Code Domain Protection Notice (Highlights how Google 403 was solved) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 px-3 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5 truncate">
          <Globe className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
          <span className="text-slate-500">QR Scannable Domain:</span>
          <span className="font-mono text-slate-800 font-medium truncate">{activeBaseUrl}</span>
        </div>
        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full shrink-0">
          Mobile Ready
        </span>
      </div>

      {/* Main Digital Receipt Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        {/* Paperless Sustainability Ribbon */}
        <div className="bg-[#DCFCE7] border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-[#15803D]">
          <div className="flex items-center gap-2 font-medium">
            <Leaf className="w-4 h-4 text-[#16A34A]" />
            <span>Confirmed 100% Paperless Digital Receipt</span>
          </div>
          <span className="font-bold text-[11px]">+2.5g Thermal Paper Saved</span>
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
                  className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
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
              Point your smartphone camera to instantly open and view this verified receipt on any device.
            </p>
          </div>

          {/* Action Links & Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-[#172B4D] hover:bg-[#203a66] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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

      {/* QR URL Settings Dialog */}
      {showUrlConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#16A34A]" />
                <h3 className="text-base font-bold text-[#172B4D]">QR Code Public Base URL</h3>
              </div>
              <button
                onClick={() => setShowUrlConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                <strong>Why did Google 403 happen?</strong>
                <br />
                Google AI Studio’s developer URL (<code className="bg-slate-100 px-1 py-0.5 rounded">ais-dev-*.run.app</code>) requires your private Google account login.
                ClearBill AI now automatically uses the public Shared URL (<code className="bg-slate-100 px-1 py-0.5 rounded">ais-pre-*.run.app</code>) so mobile phones can scan without permissions.
              </p>

              {isLocalhost && (
                <p className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900">
                  <strong>Localhost Testing Notice:</strong> Your computer is running on <code className="font-bold">localhost</code>. Another mobile phone on the same Wi-Fi network cannot resolve "localhost". Enter your computer's local Wi-Fi IP address below (e.g. <code className="font-bold">http://192.168.1.15:3000</code>).
                </p>
              )}
            </div>

            <form onSubmit={handleSaveCustomUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Base URL (Origin)
                </label>
                <input
                  type="url"
                  placeholder="e.g. http://192.168.1.15:3000 or https://yourdomain.com"
                  value={customUrlInput || activeBaseUrl}
                  onChange={e => setCustomUrlInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetCustomUrl}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Reset to Auto-Detected
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUrlConfigModal(false)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    Apply & Regenerate QR
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
