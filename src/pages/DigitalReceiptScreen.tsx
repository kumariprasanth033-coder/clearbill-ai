/**
 * ClearBill AI - Dynamic Digital Receipt Screen
 *
 * Implements Module 1: Dynamic Digital Receipt with Expiry:
 * 1. Railway-ticket inspired dynamic preview card:
 *    - Notched stub borders & perforated dashed divider.
 *    - ClearBill AI branding & live security validation badge.
 *    - Business name, outlet, invoice number, and purchase timestamp.
 *    - Verified payment status badge (PAID / COMPLETED).
 *    - Grand total paid prominently formatted in business currency.
 * 2. Live Dynamic Countdown Timer:
 *    - Calculated directly from server-provided `token.expires_at`.
 *    - Decrements once per second, formatted as MM:SS.
 *    - Automatically transitions to expired state upon reaching 0.
 * 3. Strict Backend Expiration & Permanent Vault Persistence:
 *    - Expired guest preview returns 410 with customer-friendly guidance.
 *    - If claimed to customer account, remains permanently accessible in My Receipts.
 * 4. Toggle between Dynamic Ticket View and Standard Printable Itemized Receipt:
 *    - Printable receipt with complete itemized table (Item, Qty, Unit Price, Tax, Line Total),
 *      financial breakdown, and print triggers.
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
  Ticket,
  FileText,
  Lock,
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
    accessedViaCustomerVault?: boolean;
    publicOrigin?: string;
  } | null>(null);

  // View Mode: 'dynamic' (Railway-ticket retail pass) vs 'printable' (Standard Itemized Invoice)
  const [viewMode, setViewMode] = useState<'dynamic' | 'printable'>('dynamic');

  // Dynamic Live Countdown Timer (Seconds remaining based on token.expires_at)
  const [dynamicSecondsRemaining, setDynamicSecondsRemaining] = useState<number | null>(null);

  // 30-Second POS Viewing Auto-Close Timer for Cashier Station
  const [cashierCountdown, setCashierCountdown] = useState<number>(30);
  const [isCashierTimerPaused, setIsCashierTimerPaused] = useState<boolean>(false);

  // Claim state
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  // Real Machine-Readable QR Code state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // URL Config Override Modal
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
          setError(
            data.error ||
              'This dynamic guest receipt preview has expired. If you previously saved this receipt to your ClearBill customer account, please log in to access your permanent record.'
          );
          return;
        }
        if (!res.ok) {
          setError(data.error || 'Receipt not found or invalid token.');
          return;
        }
        if (data.receipt && data.transaction) {
          setReceiptData(data);
          setCashierCountdown(30);

          // Calculate initial remaining seconds from token.expires_at
          if (data.token?.expires_at) {
            const expMs = new Date(data.token.expires_at).getTime();
            const nowMs = Date.now();
            const sec = Math.max(0, Math.floor((expMs - nowMs) / 1000));
            setDynamicSecondsRemaining(sec);
            if (sec <= 0 && !data.accessedViaCustomerVault) {
              setIsExpiredError(true);
              setError(
                'This dynamic guest receipt preview has expired. If you previously saved this receipt to your ClearBill customer account, please log in to access your permanent record.'
              );
            }
          }

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

  // Stable ref for onBackToBilling callback to avoid effect re-triggers and cross-component render errors
  const onBackToBillingRef = React.useRef(onBackToBilling);
  useEffect(() => {
    onBackToBillingRef.current = onBackToBilling;
  });

  // Live Dynamic Countdown Effect (decrements once per second, transitions to expired when 0)
  useEffect(() => {
    if (dynamicSecondsRemaining === null || isExpiredError) return;

    if (dynamicSecondsRemaining <= 0) {
      if (!receiptData?.accessedViaCustomerVault && !receiptData?.token?.is_claimed) {
        setIsExpiredError(true);
        setError(
          'This dynamic guest receipt preview has expired. If you previously saved this receipt to your ClearBill customer account, please log in to access your permanent record.'
        );
      }
      return;
    }

    const timer = setInterval(() => {
      setDynamicSecondsRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [dynamicSecondsRemaining, isExpiredError, receiptData]);

  // Generate real machine-readable QR Code dynamically with public URL
  const generateRealQrCode = useCallback(async () => {
    if (!receiptToken) return;
    setQrGenerating(true);
    setQrError(null);

    try {
      const fullReceiptUrl = buildPublicReceiptUrl(receiptToken);

      const dataUrl = await QRCode.toDataURL(fullReceiptUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 2,
        width: 256,
        color: {
          dark: '#172B4D',
          light: '#FFFFFF',
        },
      });

      setQrDataUrl(dataUrl);
      setActiveBaseUrl(getPublicAppBaseUrl());
    } catch (err: any) {
      console.error('[ClearBill AI] QR Code generation error:', err);
      setQrError('Failed to generate machine-readable QR code: ' + (err?.message || ''));
    } finally {
      setQrGenerating(false);
    }
  }, [receiptToken]);

  useEffect(() => {
    generateRealQrCode();
  }, [generateRealQrCode]);

  // 30-Second Cashier Auto-Close Countdown: pure decrement without side-effects in state updater
  useEffect(() => {
    if (!isCashierView || loading || error || isCashierTimerPaused) return;

    const timer = setInterval(() => {
      setCashierCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isCashierView, loading, error, isCashierTimerPaused]);

  // Handle cashier auto-close callback safely outside the render phase
  useEffect(() => {
    if (isCashierView && cashierCountdown === 0 && !loading && !error && !isCashierTimerPaused) {
      const timeout = setTimeout(() => {
        onBackToBillingRef.current?.();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [cashierCountdown, isCashierView, loading, error, isCashierTimerPaused]);

  // Format MM:SS for countdown timer
  const formatTimer = (totalSeconds: number | null): string => {
    if (totalSeconds === null || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleClaimReceipt = async () => {
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

  // Expired or Unavailable View
  if (isExpiredError || error || !receiptData) {
    return (
      <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm mt-6">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
            isExpiredError ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
          }`}
        >
          {isExpiredError ? <Clock className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
        </div>
        <div>
          <h3 className="text-base font-bold text-[#172B4D]">
            {isExpiredError ? 'Dynamic Guest Receipt Expired' : 'Receipt Access Unavailable'}
          </h3>
          <p className="text-xs text-slate-700 mt-2 leading-relaxed font-medium">
            {isExpiredError
              ? 'This dynamic guest receipt preview has expired. If you previously saved this receipt to your ClearBill customer account, please log in to access your permanent record.'
              : error || 'The requested digital receipt could not be loaded.'}
          </p>
        </div>

        {isExpiredError ? (
          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                if (onCustomerLogin) {
                  onCustomerLogin();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/customer/login';
                }
              }}
              className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Customer Sign In to View Saved Receipt
            </button>
            <button
              onClick={() => {
                if (onPromptAuth) {
                  onPromptAuth();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/customer/login';
                }
              }}
              className="w-full py-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Create Free Customer Account
            </button>
            <button
              onClick={() => {
                if (onGoToCustomerHome) {
                  onGoToCustomerHome();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/customer/dashboard';
                }
              }}
              className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs transition-colors cursor-pointer"
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

  const formattedDateTime = new Date(transaction.created_at).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const isLocalhost = isLocalhostOrigin();

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      {/* Top Header Bar & Navigation */}
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

        {/* View Mode Switcher: Railway Ticket Style Pass vs Standard Printable Receipt */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('dynamic')}
            className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'dynamic'
                ? 'bg-white text-[#172B4D] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Dynamic Pass</span>
          </button>
          <button
            onClick={() => setViewMode('printable')}
            className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'printable'
                ? 'bg-white text-[#172B4D] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-700" />
            <span>Printable Receipt</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUrlConfigModal(true)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Configure public domain or Wi-Fi IP for phone scanning"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Cashier 30-Second Return Banner */}
      {isCashierView && onBackToBilling && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              {cashierCountdown}s
            </div>
            <div>
              <span className="font-bold text-emerald-900 block">
                {isCashierTimerPaused
                  ? 'Auto-Close Paused'
                  : `Closing automatically in ${cashierCountdown}s for next customer bill`}
              </span>
              <span className="text-[11px] text-emerald-700">
                Customer has 30 seconds to scan the digital receipt QR code.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCashierTimerPaused(!isCashierTimerPaused)}
              className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold rounded-md shadow-2xs hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
            >
              {isCashierTimerPaused ? (
                <>
                  <Play className="w-3 h-3 text-emerald-600" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-amber-600" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              onClick={onBackToBilling}
              className="px-3 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-bold rounded-md shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Next Bill</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW A: DYNAMIC DIGITAL RECEIPT PASS (Railway-Ticket Inspired) */}
      {/* ===================================================================== */}
      {viewMode === 'dynamic' && (
        <div className="relative bg-white border border-[#CBD5E1] rounded-3xl shadow-lg overflow-hidden">
          {/* Ticket concave side notches */}
          <div className="absolute top-[38%] -left-3.5 w-7 h-7 rounded-full bg-[#F7F9FC] border-r border-[#CBD5E1] z-10" />
          <div className="absolute top-[38%] -right-3.5 w-7 h-7 rounded-full bg-[#F7F9FC] border-l border-[#CBD5E1] z-10" />

          {/* Top Pass Header: ClearBill Branding & Live Expiry Countdown */}
          <div className="bg-gradient-to-r from-[#172033] to-[#263449] text-white p-5 sm:p-6 relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center font-black text-white text-sm">
                  C
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                    <span>ClearBill AI</span>
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider text-emerald-300">
                      Digital Pass
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300">Verified Retail Receipt Ledger</p>
                </div>
              </div>

              {/* Dynamic Live Countdown Pill */}
              <div className="bg-black/30 backdrop-blur-xs border border-white/20 rounded-xl px-3 py-1.5 text-right">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 uppercase tracking-wider justify-end">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                  <span>Dynamic Preview</span>
                </div>
                <div className="font-mono text-base font-black text-white tracking-widest">
                  {formatTimer(dynamicSecondsRemaining)}
                </div>
              </div>
            </div>

            {/* Business & Outlet Information */}
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {company?.business_name || 'ClearBill Retail Store'}
                </h3>
                <p className="text-xs text-slate-300">
                  {outlet?.outlet_name} · {outlet?.address}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Receipt ID</span>
                <span className="font-mono font-bold text-xs text-emerald-300">{receipt.receipt_number}</span>
              </div>
            </div>
          </div>

          {/* Middle Details Section: Amount, Status, and Key Identifiers */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Amount Paid
                </span>
                <div className="text-3xl font-black text-[#16A34A] tracking-tight">
                  ₹{transaction.grand_total.toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-500">
                  {company?.currency || 'INR'} · Tax Included (GST: ₹{transaction.tax_amount.toFixed(2)})
                </span>
              </div>

              <div className="text-right space-y-1.5">
                <div className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 text-[#15803D] px-3 py-1 rounded-full text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>PAID & VERIFIED</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  via <span className="uppercase font-bold text-slate-700">{transaction.payment_method}</span>
                </div>
              </div>
            </div>

            {/* Perforated Divider Line */}
            <div className="relative py-2">
              <div className="border-b-2 border-dashed border-slate-300" />
            </div>

            {/* Scannable Machine-Readable QR Code & Instructions */}
            <div className="flex flex-col items-center justify-center text-center space-y-3 pt-1">
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
                <p className="text-sm font-bold text-[#172B4D]">Scan with Smartphone Camera</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Scan this QR code to view this receipt on your mobile browser or save it permanently to your account.
                </p>
              </div>

              {/* Quick Details Chips */}
              <div className="grid grid-cols-2 gap-2 w-full pt-1 text-left text-xs text-slate-600">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Issued On</span>
                  <span className="font-semibold text-slate-800">{formattedDateTime}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Items Purchased</span>
                  <span className="font-semibold text-slate-800">{transaction.items?.length || 0} Products</span>
                </div>
              </div>
            </div>

            {/* Customer Vault Claim Card */}
            <div className="pt-2">
              {isClaimed ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>Saved permanently to your Customer Account Vault!</span>
                </div>
              ) : (
                <button
                  onClick={handleClaimReceipt}
                  disabled={claimLoading}
                  className="w-full py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-emerald-100" />
                  <span>{claimLoading ? 'Saving to Vault...' : 'Save Receipt to My Customer Account'}</span>
                </button>
              )}
            </div>

            {/* Quick Actions & Links */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-100">
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#172B4D] hover:bg-[#203a66] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Public URL</span>
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
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Expiry metadata footer */}
            <div className="text-center text-[10px] text-slate-400 pt-1">
              <span>Token: </span>
              <span className="font-mono text-slate-600 font-semibold">{receiptToken}</span>
              <span className="mx-1">·</span>
              <span>Dynamic guest preview closes in </span>
              <span className="font-mono font-bold text-amber-600">{formatTimer(dynamicSecondsRemaining)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW B: STANDARD PRINTABLE RECEIPT (Complete Itemized Table) */}
      {/* ===================================================================== */}
      {viewMode === 'printable' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Sustainability Badge */}
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
              <span className="font-medium text-slate-800">{formattedDateTime}</span>
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

          {/* Complete Itemized Table */}
          <div className="pt-2 border-t border-slate-200">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-2">Item Description</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th>
                  <th className="pb-2 text-right">Tax</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transaction.items?.map((it, idx) => (
                  <tr key={idx} className="py-2">
                    <td className="py-2.5 font-medium text-slate-800">
                      <div>{it.product_name}</div>
                      {it.barcode && <span className="text-[10px] font-mono text-slate-400">{it.barcode}</span>}
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-700 tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 tabular-nums">
                      ₹{it.unit_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 tabular-nums">
                      {it.tax_rate > 0 ? `${it.tax_rate}% (₹${(it.tax_amount || 0).toFixed(2)})` : '0%'}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                      ₹{it.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
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

          {/* Save to Vault Action */}
          <div className="pt-3 border-t border-slate-200">
            {isClaimed ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Permanently stored in your Customer Vault</span>
              </div>
            ) : (
              <button
                onClick={handleClaimReceipt}
                disabled={claimLoading}
                className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-100" />
                <span>{claimLoading ? 'Saving...' : 'Save Receipt to Customer Account'}</span>
              </button>
            )}
          </div>
        </div>
      )}

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
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                <strong>Mobile Access Optimization:</strong>
                <br />
                ClearBill AI automatically maps Google AI Studio developer URLs to shared public URLs so smartphone cameras can scan and decode without authorization errors.
              </p>

              {isLocalhost && (
                <p className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900">
                  <strong>Localhost Testing Notice:</strong> Your computer is running on <code className="font-bold">localhost</code>. Enter your computer's local Wi-Fi IP address below (e.g. <code className="font-bold">http://192.168.1.15:3000</code>).
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
