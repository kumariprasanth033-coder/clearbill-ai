/**
 * ClearBill AI - Standard Retail Billing & Quick Bill Engine
 * Clean, bright, light theme interface with fast 1-tap buttons,
 * barcode scanning integration, and authoritative decimal-safe checkout.
 */

import React, { useState, useEffect } from 'react';
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
  Receipt,
  RotateCcw,
  User as UserIcon,
  Phone,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Product, CartItem, BillingFieldConfig } from '../types.ts';

interface BillingScreenProps {
  quickBillOnly?: boolean;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onOpenScanner: () => void;
  onCheckoutSuccess: (receiptToken: string) => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  quickBillOnly = false,
  cartItems,
  setCartItems,
  onOpenScanner,
  onCheckoutSuccess,
}) => {
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

  // Fetch product list and billing configs
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
      })
      .catch(console.error);

    fetch('/api/billing/configs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setFieldConfigs(data);
      })
      .catch(console.error);
  }, []);

  // Quick Bill tap items (tea, coffee, samosa, etc.)
  const quickBillItems = products.filter(p => p.is_quick_bill_item);
  const standardProducts = products.filter(p =>
    searchQuery
      ? p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  // Cart operations
  const addItemToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

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

  const removeItem = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscountAmount(0);
    setCashTendered('');
    setCheckoutError(null);
  };

  // Calculations
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

  // Handle Checkout
  const handleFinalizeBill = async () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    setCheckoutError(null);

    const payload = {
      companyId: 'cmp-demo-01',
      outletId: 'out-demo-01',
      items: cartItems.map(it => ({
        product_id: it.product.id,
        product_name: it.product.product_name,
        barcode: it.product.barcode,
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
        headers: { 'Content-Type': 'application/json' },
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
      {/* Top Header Mode Toggle */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
            {quickBillOnly ? <Zap className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#172B4D]">
              {quickBillOnly ? 'Quick Bill Mode (Tea Shop, Bakery & Express)' : 'Standard Retail Billing'}
            </h2>
            <p className="text-xs text-[#64748B]">
              {quickBillOnly
                ? 'High-speed one-tap billing for high-volume items with instant digital receipt.'
                : 'Barcode-integrated POS with item-level taxes, custom fields, and payment splitting.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenScanner}
            className="px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Open Barcode Scanner</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selection Area (Quick Bill tap buttons OR Catalogue) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Quick Bill 1-Tap Grid */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Quick Bill 1-Tap Items
              </span>
              <span className="text-[11px] text-slate-400">Tap to add instantly</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {quickBillItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => addItemToCart(item)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#16A34A] hover:bg-emerald-50/50 bg-white transition-all text-left flex flex-col justify-between group active:scale-95 shadow-xs"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#16A34A] block truncate">
                      {item.product_name}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{item.category}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      ₹{item.unit_price.toFixed(2)}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-slate-100 group-hover:bg-[#16A34A] group-hover:text-white flex items-center justify-center text-xs text-slate-500">
                      +
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Standard Catalogue Search Area (Hidden if Quick Bill Only) */}
          {!quickBillOnly && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Product Catalogue Search
                </span>
                <span className="text-[11px] text-slate-400">{products.length} products total</span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by product name, barcode, or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {standardProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => addItemToCart(p)}
                    className="py-2.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between transition-colors text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.product_name}</span>
                      <span className="text-[11px] text-slate-400">
                        Barcode: {p.barcode || 'N/A'} · GST: {p.tax_rate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 tabular-nums">
                        ₹{p.unit_price.toFixed(2)}
                      </span>
                      <button className="px-2.5 py-1 bg-[#DCFCE7] text-[#15803D] hover:bg-[#16A34A] hover:text-white rounded-md font-semibold text-[11px] transition-colors">
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Draft Bill Summary & Payment Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#16A34A]" />
                <h3 className="text-sm font-bold text-[#172B4D]">Current Draft Bill</h3>
              </div>
              {cartItems.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">Your draft bill is empty.</p>
                <p className="text-[11px] text-slate-400">
                  Tap any item on the left or scan a physical barcode to begin.
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-1">
                {cartItems.map(item => {
                  const lineTotal = item.quantity * item.product.unit_price - (item.discount || 0);
                  return (
                    <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-800 block truncate">
                          {item.product.product_name}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          ₹{item.product.unit_price.toFixed(2)} × {item.quantity}
                          {item.product.tax_rate > 0 && ` (GST: ${item.product.tax_rate}%)`}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-900 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="w-16 text-right shrink-0">
                        <span className="text-xs font-bold text-slate-900 tabular-nums">
                          ₹{lineTotal.toFixed(2)}
                        </span>
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
                  <label className="text-[11px] text-slate-500 block mb-0.5">Phone for SMS/QR</label>
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
                <span>Applicable GST:</span>
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
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
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
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
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
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card POS</span>
                </button>
              </div>

              {/* Cash Tendered Calculator */}
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

              {/* UPI Instant QR Simulation */}
              {paymentMethod === 'upi' && cartItems.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs">
                  <div className="w-12 h-12 bg-white p-1 rounded border border-emerald-300 flex items-center justify-center shrink-0">
                    <QrCode className="w-10 h-10 text-emerald-800" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-900 block">Dynamic UPI QR Ready</span>
                    <p className="text-[11px] text-emerald-700">
                      Accepts Google Pay, PhonePe, Paytm. Authoritative instant settlement.
                    </p>
                  </div>
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

            {/* Final Checkout Button */}
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
    </div>
  );
};
