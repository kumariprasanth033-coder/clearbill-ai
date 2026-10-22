/**
 * ClearBill AI - Landing Page
 * Clean white background, modern typography, Three.js 3D Scanner Terminal,
 * Quick launch portals for Manager, Retailer, and Customer.
 */

import React from 'react';
import {
  ShoppingBag,
  ScanLine,
  Zap,
  QrCode,
  ShieldCheck,
  Bot,
  Leaf,
  ArrowRight,
  Sparkles,
  Store,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { ThreeScannerShowcase } from '../components/ThreeScannerShowcase.tsx';

interface LandingPageProps {
  onSelectRoleLogin: (role: 'manager' | 'retailer' | 'customer') => void;
  onOpenRegister: () => void;
  onTryScanner: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectRoleLogin,
  onOpenRegister,
  onTryScanner,
}) => {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex flex-col justify-between">
      {/* Top Navigation Bar (Zone 1: Brand, Zone 2: Links, Zone 3: CTA) */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center text-white shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-[#172B4D] whitespace-nowrap">
              ClearBill AI
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Features
            </a>
            <a href="#quick-bill" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Quick Bill
            </a>
            <a href="#scanner" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Barcode Scanner
            </a>
            <a href="#receipts" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Digital Receipts
            </a>
            <a href="#sustainability" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Paperless ESG
            </a>
          </nav>

          {/* Zone 3: Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onSelectRoleLogin('retailer')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Sign In
            </button>
            <button
              onClick={onOpenRegister}
              className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs whitespace-nowrap"
            >
              Register Business
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Hero Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#DCFCE7] text-[#15803D] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Retail POS & Digital Receipts</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-[#172B4D] tracking-tight leading-tight">
              Simple Billing. <br />
              <span className="text-[#16A34A]">Fast Scanning.</span> <br />
              Smart Digital Receipts.
            </h1>

            <p className="text-sm md:text-base text-[#64748B] max-w-xl leading-relaxed">
              Designed for tea shops, bakeries, grocery stores, and modern retail chains.
              Eliminate paper waste with instant 30-second customer QR receipts, physical camera barcode scanning,
              and customizable billing fields powered by MySQL.
            </p>

            {/* Role Quick Access Portals */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => onSelectRoleLogin('manager')}
                className="px-4 py-2.5 bg-[#172033] hover:bg-[#263449] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <span>Manager Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSelectRoleLogin('retailer')}
                className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <span>Cashier POS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSelectRoleLogin('customer')}
                className="px-4 py-2.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <span>Customer / My Receipts</span>
                <QrCode className="w-3.5 h-3.5 text-[#16A34A]" />
              </button>
            </div>

            {/* Proof Points */}
            <div className="pt-4 flex items-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Zero Thermal Paper</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>EAN-13 / UPC Support</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>MySQL Community / XAMPP</span>
              </div>
            </div>
          </div>

          {/* Right Hero Column: Three.js 3D Terminal & Barcode Scanner Showcase */}
          <div className="lg:col-span-5">
            <ThreeScannerShowcase onScanSimulated={onTryScanner} />
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="py-12 bg-white border-y border-[#E2E8F0] px-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-[#172B4D]">Engineered for Speed & Clarity</h2>
            <p className="text-xs text-[#64748B]">
              From a fast 1-tap tea stall to a multi-counter supermarket with barcode inventories.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <ScanLine className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Physical Camera Barcode Scanner</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Uses the device rear camera to scan EAN-13, EAN-8, UPC, and Code 128 barcodes with duplicate scan protection and audio feedback.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Quick Bill (1-Tap Addition)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ideal for tea shops, bakeries, and juice bars. One-tap product buttons for quick checkout without scanning every individual item.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Smart Digital Receipts</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customers scan the checkout QR code with their mobile camera. Temporary 30-second guest view or save permanently to customer account.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Authoritative Backend Calculation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Server-side decimal-safe totals, itemized GST rates, discount auditing, and immutable finalized transaction ledgers.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Optional AI Assistant</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Integrated Gemini 3.8 Flash model provides concise summaries of daily sales, payment reconciliation, and customer spending habits.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <Leaf className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Paperless ESG Tracking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Directly tracks thermal paper rolls saved and carbon footprint avoided for sustainability reports and eco-conscious branding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-[#E2E8F0] px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">ClearBill AI</span>
            <span>·</span>
            <span>Simple Billing. Fast Scanning. Smart Digital Receipts.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>MySQL 8.0 & XAMPP Community Edition</span>
            <span>·</span>
            <span>Local Port 3000</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
