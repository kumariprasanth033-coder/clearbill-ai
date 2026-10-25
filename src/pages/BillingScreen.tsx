/**
 * ClearBill AI - Comprehensive POS Billing Engine
 * Supports:
 * 1. Barcode Scanner Mode (Camera + Hardware GPU decoding + MySQL catalog matching)
 * 2. Complete Manual Billing Mode (Item name, qty, price, discount, tax for tea stalls, bakeries, fruit shops)
 * 3. Quick Bill 1-Tap Grid (Configurable frequently sold items like Tea ₹10, Coffee ₹15, Water ₹20)
 * 4. Shared Billing Cart with unit price editing, quantity steppers, clear confirmation,
 *    and authoritative server-side decimal calculations.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ScanLine,
  Zap,
  Search,
  Check,
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
  User as UserIcon,
  Phone,
  AlertCircle,
  Camera,
  Edit2,
  CheckCircle2,
  Volume2,
  Sparkles,
  HelpCircle,
  PlusCircle,
  X,
  FileText,
  PackagePlus,
  Tag,
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { getAuthHeaders } from '../utils/authHeaders.ts';
import { Product, CartItem, BillingFieldConfig } from '../types.ts';

interface BillingScreenProps {
  quickBillOnly?: boolean;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onOpenScanner?: () => void;
  onCheckoutSuccess: (receiptToken: string) => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  quickBillOnly = false,
  cartItems,
  setCartItems,
  onOpenScanner,
  onCheckoutSuccess,
}) => {
  // Mode selection: 'barcode' | 'manual'
  const [billingMode, setBillingMode] = useState<'barcode' | 'manual'>('manual');

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldConfigs, setFieldConfigs] = useState<BillingFieldConfig[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billingNotes, setBillingNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Clear Cart Confirmation dialog
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Price Editing state for cart item
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [tempEditedPrice, setTempEditedPrice] = useState<string>('');

  // ----------------------------------------------------
  // MANUAL BILLING FORM STATE
  // ----------------------------------------------------
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualPrice, setManualPrice] = useState<string>('10');
  const [manualDiscount, setManualDiscount] = useState<string>('0');
  const [manualTaxRate, setManualTaxRate] = useState<string>('5');
  const [manualCategory, setManualCategory] = useState<string>('General');
  const [manualFormError, setManualFormError] = useState<string | null>(null);

  // ----------------------------------------------------
  // CONFIGURE QUICK BILL ITEMS (Custom configurable buttons)
  // ----------------------------------------------------
  const [customQuickItems, setCustomQuickItems] = useState<
    { id: string; name: string; price: number; taxRate: number; category: string }[]
  >(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cb_custom_quick_items');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return [
      { id: 'qb-tea', name: 'Special Masala Tea', price: 10, taxRate: 5, category: 'Beverages' },
      { id: 'qb-coffee', name: 'Filter Coffee', price: 15, taxRate: 5, category: 'Beverages' },
      { id: 'qb-biscuit', name: 'Butter Biscuit', price: 10, taxRate: 5, category: 'Bakery' },
      { id: 'qb-water', name: 'Mineral Water Bottle 1L', price: 20, taxRate: 0, category: 'Beverages' },
      { id: 'qb-samosa', name: 'Hot Samosa (1 pc)', price: 15, taxRate: 5, category: 'Snacks' },
      { id: 'qb-bun', name: 'Bun Maska', price: 25, taxRate: 5, category: 'Bakery' },
    ];
  });

  const [addQuickItemModalOpen, setAddQuickItemModalOpen] = useState(false);
  const [newQuickName, setNewQuickName] = useState('');
  const [newQuickPrice, setNewQuickPrice] = useState('');
  const [newQuickTax, setNewQuickTax] = useState('5');
  const [newQuickCategory, setNewQuickCategory] = useState('Snacks');

  // ----------------------------------------------------
  // EMBEDDED BARCODE SCANNER STATE
  // ----------------------------------------------------
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scannerLookupMsg, setScannerLookupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string | null>(null);
  const isLookupInFlightRef = useRef<boolean>(false);

  // Fetch product list
  useEffect(() => {
    fetch('/api/products', { headers: getAuthHeaders('retailer') })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
      })
      .catch(console.error);

    fetch('/api/billing-fields', { headers: getAuthHeaders('retailer') })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setFieldConfigs(data);
      })
      .catch(console.error);
  }, []);

  // Audio Beep Feedback
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  };

  // ----------------------------------------------------
  // EMBEDDED CAMERA BARCODE ENGINE
  // ----------------------------------------------------
  const handleBarcodeDetected = useCallback(
    async (rawCode: string) => {
      const cleanBarcode = rawCode.trim();
      if (!cleanBarcode) return;

      const now = Date.now();
      if (lastScannedCodeRef.current === cleanBarcode && now - lastScanTimeRef.current < 900) {
        return; // Debounce rapid video frame repeats
      }

      if (isLookupInFlightRef.current) return;
      isLookupInFlightRef.current = true;
      lastScannedCodeRef.current = cleanBarcode;
      lastScanTimeRef.current = now;

      playBeep();
      setLastScannedCode(cleanBarcode);

      try {
        const res = await fetch(`/api/products/lookup/${encodeURIComponent(cleanBarcode)}`, {
          headers: getAuthHeaders('retailer'),
        });
        const data = await res.json();

        if (res.ok && data.found && data.product) {
          const prod: Product = data.product;
          setScannerLookupMsg({
            type: 'success',
            text: `Added: ${prod.product_name} (₹${prod.unit_price.toFixed(2)})`,
          });

          // Add to shared cart
          setCartItems(prev => {
            const existing = prev.find(item => item.product.id === prod.id || item.product.barcode === prod.barcode);
            if (existing) {
              return prev.map(item =>
                item.product.id === prod.id || item.product.barcode === prod.barcode
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              );
            }
            return [...prev, { product: prod, quantity: 1, discount: 0 }];
          });
        } else {
          setScannerLookupMsg({
            type: 'error',
            text: data.message || `Product Not Found for barcode ${cleanBarcode}`,
          });
        }
      } catch (err: any) {
        setScannerLookupMsg({
          type: 'error',
          text: `Lookup error: ${err.message}`,
        });
      } finally {
        isLookupInFlightRef.current = false;
      }
    },
    [setCartItems]
  );

  const startEmbeddedCamera = async () => {
    setCameraError(null);
    try {
      stopEmbeddedCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        // Native Shape Detection API
        if ('BarcodeDetector' in window) {
          try {
            const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];
            nativeDetectorRef.current = new (window as any).BarcodeDetector({ formats });

            const decodeLoop = () => {
              if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused) {
                nativeDetectorRef.current
                  .detect(videoRef.current)
                  .then((barcodes: any[]) => {
                    if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                      handleBarcodeDetected(barcodes[0].rawValue);
                    }
                  })
                  .catch(() => {});
              }
              animFrameIdRef.current = requestAnimationFrame(decodeLoop);
            };
            animFrameIdRef.current = requestAnimationFrame(decodeLoop);
            return;
          } catch {}
        }

        // ZXing Fallback
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        const reader = new BrowserMultiFormatReader(hints, 80);
        codeReaderRef.current = reader;
        reader.decodeFromVideoDevice(null, videoRef.current, (res, err) => {
          if (res) {
            handleBarcodeDetected(res.getText());
          }
        });
      }
    } catch (err: any) {
      console.warn('[Billing Camera Error]', err);
      setCameraError(err.message || 'Camera permission denied or camera unavailable.');
      setCameraActive(false);
    }
  };

  const stopEmbeddedCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch {}
      codeReaderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Turn off camera when switching away from barcode mode
  useEffect(() => {
    if (billingMode === 'barcode') {
      startEmbeddedCamera();
    } else {
      stopEmbeddedCamera();
    }
    return () => {
      stopEmbeddedCamera();
    };
  }, [billingMode]);

  // ----------------------------------------------------
  // MANUAL BILLING ADD HANDLER
  // ----------------------------------------------------
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    setManualFormError(null);

    const name = manualName.trim();
    if (!name) {
      setManualFormError('Please enter an item or product name.');
      return;
    }

    const qty = Number(manualQty);
    if (isNaN(qty) || qty <= 0) {
      setManualFormError('Quantity must be at least 1.');
      return;
    }

    const price = Number(manualPrice);
    if (isNaN(price) || price < 0) {
      setManualFormError('Unit price cannot be negative.');
      return;
    }

    const discount = Number(manualDiscount) || 0;
    if (discount < 0) {
      setManualFormError('Discount cannot be negative.');
      return;
    }
    if (discount > qty * price) {
      setManualFormError('Discount cannot exceed the item subtotal.');
      return;
    }

    const taxRate = Math.max(0, Number(manualTaxRate) || 0);

    // Create item representation for shared cart
    const manualProduct: Product = {
      id: `man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: 'cmp-demo-01',
      product_name: name,
      barcode: '',
      category: manualCategory,
      unit: 'pcs',
      unit_price: price,
      tax_rate: taxRate,
      is_quick_bill_item: false,
      quick_bill_order: 0,
      is_active: true,
    };

    setCartItems(prev => {
      // If an identical manual item name exists, increment
      const existing = prev.find(
        item => item.product.product_name.toLowerCase() === name.toLowerCase() && item.product.unit_price === price
      );
      if (existing) {
        return prev.map(item =>
          item.product.id === existing.product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prev, { product: manualProduct, quantity: qty, discount }];
    });

    playBeep();

    // Reset form inputs for next manual item
    setManualName('');
    setManualQty(1);
    setManualPrice('10');
    setManualDiscount('0');
  };

  // Add Quick Bill item to cart
  const handleAddQuickItem = (item: { name: string; price: number; taxRate: number; category: string }) => {
    const quickProd: Product = {
      id: `qb-prod-${item.name.replace(/\s+/g, '-').toLowerCase()}`,
      company_id: 'cmp-demo-01',
      product_name: item.name,
      barcode: '',
      category: item.category,
      unit: 'unit',
      unit_price: item.price,
      tax_rate: item.taxRate,
      is_quick_bill_item: true,
      quick_bill_order: 1,
      is_active: true,
    };

    setCartItems(prev => {
      const existing = prev.find(i => i.product.product_name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        return prev.map(i =>
          i.product.id === existing.product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: quickProd, quantity: 1, discount: 0 }];
    });

    playBeep();
  };

  // Save custom quick item
  const handleSaveCustomQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuickName.trim() || !newQuickPrice) return;

    const newItem = {
      id: `custom-qb-${Date.now()}`,
      name: newQuickName.trim(),
      price: parseFloat(newQuickPrice) || 0,
      taxRate: parseFloat(newQuickTax) || 0,
      category: newQuickCategory,
    };

    const updated = [...customQuickItems, newItem];
    setCustomQuickItems(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cb_custom_quick_items', JSON.stringify(updated));
    }

    setNewQuickName('');
    setNewQuickPrice('');
    setAddQuickItemModalOpen(false);
  };

  // ----------------------------------------------------
  // CART OPERATIONS (Shared between modes)
  // ----------------------------------------------------
  const updateQuantity = (productId: string, delta: number) => {
    setCartItems(prev =>
      prev
        .map(item => {
          if (item.product.id === productId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const setExplicitQuantity = (productId: string, qty: number) => {
    if (isNaN(qty) || qty <= 0) return;
    setCartItems(prev =>
      prev.map(item => (item.product.id === productId ? { ...item, quantity: qty } : item))
    );
  };

  const removeItem = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscountAmount(0);
    setCashTendered('');
    setCheckoutError(null);
    setConfirmClearOpen(false);
  };

  const handleStartEditPrice = (item: CartItem) => {
    setEditingPriceItemId(item.product.id);
    setTempEditedPrice(item.product.unit_price.toString());
  };

  const handleSaveEditedPrice = (productId: string) => {
    const newPrice = parseFloat(tempEditedPrice);
    if (!isNaN(newPrice) && newPrice >= 0) {
      setCartItems(prev =>
        prev.map(item =>
          item.product.id === productId
            ? { ...item, product: { ...item.product, unit_price: newPrice } }
            : item
        )
      );
    }
    setEditingPriceItemId(null);
  };

  // ----------------------------------------------------
  // TOTALS & CHECKOUT
  // ----------------------------------------------------
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.product.unit_price - (item.discount || 0),
    0
  );

  const taxTotal = cartItems.reduce((sum, item) => {
    const itemSub = item.quantity * item.product.unit_price - (item.discount || 0);
    return sum + (itemSub * item.product.tax_rate) / 100;
  }, 0);

  const grandTotal = Math.max(0, subtotal - discountAmount) + taxTotal;

  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = tenderedNum >= grandTotal ? tenderedNum - grandTotal : 0;

  const handleFinalizeBill = async () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    setCheckoutError(null);

    const payload = {
      companyId: 'cmp-demo-01',
      outletId: 'out-demo-01',
      items: cartItems.map(it => ({
        product_id: it.product.id.startsWith('man-') || it.product.id.startsWith('qb-prod-') ? undefined : it.product.id,
        product_name: it.product.product_name,
        barcode: it.product.barcode || undefined,
        quantity: it.quantity,
        unit_price: it.product.unit_price,
        tax_rate: it.product.tax_rate,
        discount_amount: it.discount || 0,
      })),
      discountAmount,
      paymentMethod,
      customerName,
      customerPhone,
      notes: billingNotes,
    };

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders('retailer') as Record<string, string>),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.receipt) {
        const guestToken = data.receipt.tokens?.[0]?.token;
        clearCart();
        onCheckoutSuccess(guestToken);
      } else {
        setCheckoutError(data.error || 'Failed to finalize bill.');
      }
    } catch (err: any) {
      setCheckoutError('Connection failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================== */}
      {/* 1. TWO BILLING MODES TOP CONTROLLER                 */}
      {/* ==================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              ClearBill POS Billing Engine
            </span>
            <h2 className="text-base font-extrabold text-[#172B4D] flex items-center gap-2">
              <span>Smart Retail & Small Stall POS</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                Shared Cart Active ({cartItems.length} items)
              </span>
            </h2>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setBillingMode('manual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                billingMode === 'manual'
                  ? 'bg-white text-[#172B4D] shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-[#16A34A]" />
              <span>Manual Billing & Quick Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setBillingMode('barcode')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                billingMode === 'barcode'
                  ? 'bg-white text-[#172B4D] shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ScanLine className="w-4 h-4 text-[#16A34A]" />
              <span>Barcode Scanner</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ==================================================== */}
        {/* LEFT COLUMN: ACTIVE BILLING INPUT MODE               */}
        {/* ==================================================== */}
        <div className="lg:col-span-7 space-y-4">
          {/* -------------------------------------------------- */}
          {/* MODE A: BARCODE SCANNER MODE                       */}
          {/* -------------------------------------------------- */}
          {billingMode === 'barcode' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between text-xs">
                  <span className="font-bold text-[#172B4D] flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#16A34A]" />
                    Continuous Barcode Scanner Viewport
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="text-[11px] text-slate-500">
                      {cameraActive ? 'Camera Active' : 'Camera Paused'}
                    </span>
                  </div>
                </div>

                {/* Video Viewport */}
                <div className="relative w-full h-64 md:h-72 bg-slate-900 flex items-center justify-center overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

                  {/* Scanning Aiming Frame */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                    <div className="relative w-56 h-36 rounded-xl border-2 border-white/70">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-[#16A34A]" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-[#16A34A]" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-[#16A34A]" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-[#16A34A]" />
                      <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    </div>
                  </div>

                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-900/90 text-white p-4 flex flex-col items-center justify-center text-center">
                      <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                      <p className="text-xs text-slate-300 max-w-sm mb-3">{cameraError}</p>
                      <button
                        onClick={startEmbeddedCamera}
                        className="px-3 py-1.5 bg-[#16A34A] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                      >
                        Retry Camera
                      </button>
                    </div>
                  )}
                </div>

                {/* Last Scan Status Banner */}
                {scannerLookupMsg && (
                  <div
                    className={`p-3 text-xs flex items-center gap-2 border-t ${
                      scannerLookupMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    {scannerLookupMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="font-medium">{scannerLookupMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Fast Barcode Test Chips (Simulate Scan on Click) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                  Tap to Simulate Barcode Scan (MySQL Registered)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { name: 'Tata Tea Gold 250g', code: '8901030383786', price: '₹165' },
                    { name: 'Amul Pure Ghee 500ml', code: '8901233024823', price: '₹315' },
                    { name: 'Parle-G Biscuits', code: '8901499026418', price: '₹120' },
                    { name: 'ClearBill Mint Tin', code: '50123456', price: '₹50' },
                    { name: 'Organic Honey (UPC-A)', code: '012345678905', price: '₹240' },
                    { name: 'Stainless Flask', code: 'CB-RETAIL-1001', price: '₹699' },
                  ].map(item => (
                    <button
                      key={item.code}
                      onClick={() => handleBarcodeDetected(item.code)}
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-[#16A34A] hover:bg-emerald-50/50 bg-white text-left transition-all group cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-800 group-hover:text-[#16A34A] block truncate">
                        {item.name}
                      </span>
                      <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 font-mono">
                        <span>{item.code}</span>
                        <span className="font-bold text-emerald-700">{item.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* -------------------------------------------------- */}
          {/* MODE B: MANUAL BILLING MODE                        */}
          {/* -------------------------------------------------- */}
          {billingMode === 'manual' && (
            <div className="space-y-4">
              {/* Form Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-[#16A34A]" />
                    <div>
                      <h3 className="text-sm font-bold text-[#172B4D]">Manual Item Entry</h3>
                      <p className="text-[11px] text-slate-500">
                        Bill tea, bakery, loose groceries, fruits, or items without barcodes
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    No Barcode Required
                  </span>
                </div>

                <form onSubmit={handleAddManualItem} className="space-y-3.5">
                  {/* Item Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product / Item Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Masala Tea, Fresh Samosa, Organic Bananas 1kg, Brown Bread"
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A] shadow-2xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantity *
                      </label>
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setManualQty(prev => Math.max(1, prev - 1))}
                          className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold border-r border-slate-200 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={manualQty}
                          onChange={e => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-center text-xs font-bold text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setManualQty(prev => prev + 1)}
                          className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold border-l border-slate-200 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Unit Price (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="0.00"
                        value={manualPrice}
                        onChange={e => setManualPrice(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>

                    {/* Discount */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Discount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="0.00"
                        value={manualDiscount}
                        onChange={e => setManualDiscount(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>

                    {/* Tax Rate */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tax Rate
                      </label>
                      <select
                        value={manualTaxRate}
                        onChange={e => setManualTaxRate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A]"
                      >
                        <option value="0">0% (Nil)</option>
                        <option value="5">5% GST</option>
                        <option value="12">12% GST</option>
                        <option value="18">18% GST</option>
                        <option value="28">28% GST</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculated Live Line Preview */}
                  {manualName.trim() && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        Line Preview: {manualQty} × ₹{(parseFloat(manualPrice) || 0).toFixed(2)}
                        {parseFloat(manualDiscount) > 0 && ` - ₹${parseFloat(manualDiscount).toFixed(2)}`}
                      </span>
                      <span className="font-extrabold text-[#16A34A] text-sm tabular-nums">
                        Total: ₹
                        {(
                          Math.max(
                            0,
                            manualQty * (parseFloat(manualPrice) || 0) - (parseFloat(manualDiscount) || 0)
                          ) *
                          (1 + (parseFloat(manualTaxRate) || 0) / 100)
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {manualFormError && (
                    <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{manualFormError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item to Bill</span>
                  </button>
                </form>
              </div>

              {/* -------------------------------------------------- */}
              {/* 4. QUICK BILL 1-TAP PANEL (Configurable)           */}
              {/* -------------------------------------------------- */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Quick Bill (1-Tap Frequently Sold Items)
                    </span>
                  </div>
                  <button
                    onClick={() => setAddQuickItemModalOpen(true)}
                    className="text-[11px] font-semibold text-[#16A34A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Add Quick Item</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {customQuickItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddQuickItem(item)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-[#16A34A] hover:bg-emerald-50/50 bg-white transition-all text-left flex flex-col justify-between group active:scale-95 shadow-xs cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-[#16A34A] block truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{item.category}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                          ₹{item.price.toFixed(2)}
                        </span>
                        <span className="w-5 h-5 rounded-full bg-slate-100 group-hover:bg-[#16A34A] group-hover:text-white flex items-center justify-center text-xs text-slate-500 font-bold">
                          +
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Registered Product Search Fallback */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  Search Registered Catalogue
                </span>
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by product name, category, or barcode..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                {searchQuery && (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {products
                      .filter(p =>
                        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.barcode.includes(searchQuery)
                      )
                      .slice(0, 5)
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setCartItems(prev => {
                              const ex = prev.find(i => i.product.id === p.id);
                              if (ex) {
                                return prev.map(i =>
                                  i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i
                                );
                              }
                              return [...prev, { product: p, quantity: 1, discount: 0 }];
                            });
                            playBeep();
                            setSearchQuery('');
                          }}
                          className="p-2 hover:bg-emerald-50 flex items-center justify-between cursor-pointer rounded"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 block">{p.product_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{p.barcode || 'No barcode'}</span>
                          </div>
                          <span className="font-bold text-emerald-700">₹{p.unit_price.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: SHARED BILLING CART & CHECKOUT        */}
        {/* ==================================================== */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#16A34A]" />
                <h3 className="text-sm font-bold text-[#172B4D]">Shared Draft Bill</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                </span>
                {cartItems.length > 0 && (
                  <button
                    onClick={() => setConfirmClearOpen(true)}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Cart Line Items */}
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-medium">Your billing cart is empty.</p>
                <p className="text-[11px] text-slate-400">
                  Scan a barcode or add an item from Manual Billing / Quick Bill above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
                {cartItems.map((item, idx) => {
                  const lineTotal =
                    (item.quantity * item.product.unit_price - (item.discount || 0)) *
                    (1 + (item.product.tax_rate || 0) / 100);

                  const isEditingPrice = editingPriceItemId === item.product.id;

                  return (
                    <div key={idx} className="py-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-800 truncate">
                            {item.product.product_name}
                          </h4>
                          {item.product.barcode ? (
                            <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
                              Barcode
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium bg-emerald-50 text-emerald-700 px-1 rounded">
                              Manual
                            </span>
                          )}
                        </div>

                        {/* Price & Editable Price Trigger */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          {isEditingPrice ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold">₹</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={tempEditedPrice}
                                onChange={e => setTempEditedPrice(e.target.value)}
                                className="w-16 bg-white border border-[#16A34A] rounded px-1.5 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditedPrice(item.product.id)}
                                className="p-1 bg-[#16A34A] text-white rounded text-[10px]"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span>₹{item.product.unit_price.toFixed(2)}</span>
                              <button
                                onClick={() => handleStartEditPrice(item)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                title="Edit unit price"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {item.product.tax_rate > 0 && (
                            <span className="text-[10px] text-slate-400">
                              · {item.product.tax_rate}% GST
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-5 h-5 rounded hover:bg-white text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => setExplicitQuantity(item.product.id, parseInt(e.target.value) || 1)}
                          className="w-7 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-5 h-5 rounded hover:bg-white text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Total & Delete */}
                      <div className="text-right shrink-0 min-w-16">
                        <span className="text-xs font-bold text-slate-900 block tabular-nums">
                          ₹{lineTotal.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5 ml-auto" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Optional Customer Information */}
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Customer Name (Opt)</label>
                  <input
                    type="text"
                    placeholder="Walk-in Customer"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-2 py-1 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Phone for Receipt</label>
                  <input
                    type="tel"
                    placeholder="+91..."
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-2 py-1 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-slate-900 tabular-nums">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Configured Taxes (GST):</span>
                <span className="font-semibold text-slate-900 tabular-nums">₹{taxTotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Special Discount:</span>
                  <span className="font-semibold tabular-nums">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-[#172B4D]">Grand Total:</span>
                <span className="text-xl font-extrabold text-[#16A34A] tabular-nums">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Select Payment Mode
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    paymentMethod === 'upi'
                      ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>UPI QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card POS</span>
                </button>
              </div>

              {/* Cash Calculator */}
              {paymentMethod === 'cash' && cartItems.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Cash Tendered:</span>
                    <input
                      type="number"
                      placeholder={`Min ₹${grandTotal.toFixed(0)}`}
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      className="w-28 text-right bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                  </div>
                  {tenderedNum > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-600">Change Due:</span>
                      <span className="font-bold text-emerald-700 tabular-nums">
                        ₹{changeDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {checkoutError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Finalize Bill Button */}
            <button
              onClick={handleFinalizeBill}
              disabled={cartItems.length === 0 || isProcessing}
              className={`mt-4 w-full py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
                cartItems.length > 0 && !isProcessing
                  ? 'bg-[#16A34A] hover:bg-[#15803D] text-white active:scale-98 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Authorizing Transaction...'
                  : `Finalize Bill & Generate Digital Receipt (₹${grandTotal.toFixed(2)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Clear Cart Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-lg">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Clear Billing Cart?</h4>
                <p className="text-xs text-slate-500">This will remove all {cartItems.length} items from the bill.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Yes, Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Quick Item Modal */}
      {addQuickItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#172B4D]">
                <Zap className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-bold">Add 1-Tap Quick Item</h4>
              </div>
              <button
                onClick={() => setAddQuickItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomQuickItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Samosa Pav, Mineral Water 500ml"
                  value={newQuickName}
                  onChange={e => setNewQuickName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="15.00"
                    value={newQuickPrice}
                    onChange={e => setNewQuickPrice(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST Rate</label>
                  <select
                    value={newQuickTax}
                    onChange={e => setNewQuickTax(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddQuickItemModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Quick Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
