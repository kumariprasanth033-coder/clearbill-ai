/**
 * ClearBill AI - Landing Page
 * Clean white background, modern typography, Three.js 3D Scanner Terminal,
 * Anchor sections for Features, Quick Bill, Barcode Scanner, Digital Receipts, and Paperless ESG.
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
  Camera,
  Receipt,
  BarChart3,
  CreditCard,
  Lock,
} from 'lucide-react';
import { ThreeScannerShowcase } from '../components/ThreeScannerShowcase.tsx';

interface LandingPageProps {
  onSelectRoleLogin: (role: 'manager' | 'retailer' | 'customer') => void;
  onOpenRegister: () => void;
  onTryScanner: () => void;
  onTryQuickBill?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectRoleLogin,
  onOpenRegister,
  onTryScanner,
  onTryQuickBill,
}) => {
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex flex-col justify-between">
      {/* Top Navigation Bar */}
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

          {/* Zone 2: Navigation Links (Smooth Anchor Scrolling) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a
              href="#features"
              onClick={e => handleNavClick(e, 'features')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Features
            </a>
            <a
              href="#quick-bill"
              onClick={e => handleNavClick(e, 'quick-bill')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Quick Bill
            </a>
            <a
              href="#scanner"
              onClick={e => handleNavClick(e, 'scanner')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Barcode Scanner
            </a>
            <a
              href="#receipts"
              onClick={e => handleNavClick(e, 'receipts')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Digital Receipts
            </a>
            <a
              href="#sustainability"
              onClick={e => handleNavClick(e, 'sustainability')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Paperless ESG
            </a>
          </nav>

          {/* Zone 3: Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onSelectRoleLogin('retailer')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={onOpenRegister}
              className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs whitespace-nowrap cursor-pointer"
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
              <span>Next-Gen Retail POS & Smart Digital Invoices</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-[#172B4D] tracking-tight leading-tight">
              Simple Billing. <br />
              <span className="text-[#16A34A]">Fast Scanning.</span> <br />
              Smart Digital Receipts.
            </h1>

            <p className="text-sm md:text-base text-[#64748B] max-w-xl leading-relaxed">
              Designed for tea shops, bakeries, grocery stores, and modern retail chains.
              Eliminate paper waste with instant 30-second customer QR receipts, camera barcode scanning,
              and authoritative decimal-safe financial ledgers backed by MySQL.
            </p>

            {/* Role Quick Access Portals */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => onSelectRoleLogin('manager')}
                className="px-4 py-2.5 bg-[#172033] hover:bg-[#263449] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Manager Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSelectRoleLogin('retailer')}
                className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Cashier POS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSelectRoleLogin('customer')}
                className="px-4 py-2.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
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
                <span>EAN-13 / UPC-A Camera Scan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>MySQL & XAMPP Community</span>
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
      <section id="features" className="py-16 bg-white border-y border-[#E2E8F0] px-6 scroll-mt-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-[#172B4D]">Engineered for Speed, Precision & Clarity</h2>
            <p className="text-xs text-[#64748B]">
              From a fast 1-tap tea stall to a multi-counter supermarket with barcode inventories.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <ScanLine className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Physical Camera Barcode Scanner</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Uses the device rear camera to scan EAN-13, EAN-8, UPC, and Code 128 barcodes with duplicate scan protection and audio feedback.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Quick Bill (1-Tap Addition)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ideal for tea shops, bakeries, and juice bars. One-tap product buttons for quick checkout without scanning every individual item.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Smart Scannable QR Receipts</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customers scan the checkout QR code with their mobile camera. Temporary 24-hour guest view or save permanently to customer account.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Authoritative Backend Calculations</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Server-side decimal-safe totals, itemized GST rates, discount auditing, and immutable finalized transaction ledgers.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Personalized Real-Time AI Assistant</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Integrated Gemini 3.8 Flash model provides concise summaries of daily sales, payment reconciliation, and customer spending habits.
              </p>
            </div>

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

      {/* Quick Bill Section */}
      <section id="quick-bill" className="py-16 bg-[#F7F9FC] px-6 scroll-mt-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
              High-Speed Express Mode
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#172B4D]">
              Quick Bill for Fast-Casual, Cafes & Bakeries
            </h2>
            <p className="text-xs md:text-sm text-[#64748B] leading-relaxed">
              No barcodes needed for high-frequency items. Tap hot samosas, special masala tea, or bun maska with automatic quantity aggregation, real-time GST computation, and instant QR generation.
            </p>
            <div className="pt-2">
              <button
                onClick={onTryQuickBill || onTryScanner}
                className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Launch Quick Bill POS Demo</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">1-Tap Fast Selection Preview</span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Active Items</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">Special Masala Tea</span>
                <span className="text-emerald-700 font-bold">₹15.00</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">Hot Samosa (2 pcs)</span>
                <span className="text-emerald-700 font-bold">₹30.00</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">Filter Coffee</span>
                <span className="text-emerald-700 font-bold">₹20.00</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">Bun Maska</span>
                <span className="text-emerald-700 font-bold">₹35.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Barcode Scanner Section */}
      <section id="scanner" className="py-16 bg-white border-y border-[#E2E8F0] px-6 scroll-mt-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Camera className="w-4 h-4 text-[#16A34A]" />
              <span>Multi-Format Optical Hardware Decoding</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Compatible with laptop webcams, desktop USB scanners, and iOS / Android smartphone cameras with zero app installation.
            </p>
            <ul className="space-y-1.5 text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>EAN-13 Indian FMCG Packaged Goods (e.g. Tata Tea 8901030383786)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>UPC-A with Leading Zero Preservation (012345678905)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>EAN-8 Compact Confectionery Barcodes (50123456)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Code 128 Alphanumeric Warehouse Tags (CB-RETAIL-1001)</span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
              Camera-Ready Scanning
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#172B4D]">
              Physical Camera Barcode Scanning
            </h2>
            <p className="text-xs md:text-sm text-[#64748B] leading-relaxed">
              Equipped with a 1800ms debounce filter, auto-add to cart, quantity correction, and sound feedback. Point any rear camera at a product barcode to register the item instantly.
            </p>
            <div className="pt-2">
              <button
                onClick={onTryScanner}
                className="px-4 py-2.5 bg-[#172033] hover:bg-[#263449] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <ScanLine className="w-4 h-4 text-[#16A34A]" />
                <span>Open Live Camera Barcode Scanner</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Digital Receipts Section */}
      <section id="receipts" className="py-16 bg-[#F7F9FC] px-6 scroll-mt-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
              Scannable QR Technology
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#172B4D]">
              Real Machine-Readable Dynamic QR Receipts
            </h2>
            <p className="text-xs md:text-sm text-[#64748B] leading-relaxed">
              Every checkout generates an authoritative digital invoice paired with a secure, 24-hour scannable QR code. Customers simply point their phone camera to view, print, or save the receipt into their personal vault.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => onSelectRoleLogin('customer')}
                className="px-4 py-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-[#16A34A]" />
                <span>Explore Customer Receipt Vault</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
            <div className="w-32 h-32 mx-auto bg-slate-50 border-2 border-slate-200 rounded-xl flex items-center justify-center p-2">
              <QrCode className="w-24 h-24 text-[#172B4D]" />
            </div>
            <p className="text-xs font-bold text-slate-800">Scan with your phone camera</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Dynamic PNG QR codes generated in real-time. Unpredictable guest tokens expire in 24 hours for fraud prevention.
            </p>
          </div>
        </div>
      </section>

      {/* Paperless ESG Section */}
      <section id="sustainability" className="py-16 bg-white border-t border-[#E2E8F0] px-6 scroll-mt-16">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#DCFCE7] text-[#15803D] text-xs font-semibold mx-auto">
            <Leaf className="w-3.5 h-3.5" />
            <span>100% Paperless Commitment</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#172B4D]">
            Eliminate Toxic Thermal Paper Waste
          </h2>
          <p className="text-xs md:text-sm text-[#64748B] max-w-2xl mx-auto leading-relaxed">
            Standard thermal receipts contain BPA/BPS and cannot be recycled. ClearBill AI tracks every single avoided paper print, translating each transaction into grams of paper and carbon emissions saved.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-2xl font-black text-[#16A34A] block">2.5g</span>
              <span className="text-slate-600 font-medium">Thermal Paper Saved per Bill</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-2xl font-black text-slate-900 block">100%</span>
              <span className="text-slate-600 font-medium">Zero Environmental Waste</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-2xl font-black text-blue-600 block">24h</span>
              <span className="text-slate-600 font-medium">Secure Guest Viewing Window</span>
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
