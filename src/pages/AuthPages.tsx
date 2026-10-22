/**
 * ClearBill AI - Authentication & Multi-Step Business Registration
 * Organized 5-Step Registration Wizard with Conditional Regional Tax & Currencies,
 * Password Visibility Toggles, Real-Time Input Validation, and Financial Security Disclosures.
 */

import React, { useState } from 'react';
import {
  ShoppingBag,
  Store,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  MapPin,
  Building2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  ShieldCheck,
  CreditCard,
  QrCode,
  Banknote,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { User, Company, Outlet } from '../types.ts';

interface AuthModalProps {
  initialRole?: 'manager' | 'retailer' | 'customer';
  isRegistering?: boolean;
  onSuccess: (user: User, company: Company, outlet: Outlet) => void;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialRole = 'retailer',
  isRegistering = false,
  onSuccess,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(isRegistering ? 'register' : 'login');
  const [selectedRole, setSelectedRole] = useState<'manager' | 'retailer' | 'customer'>(initialRole);

  // Login form state
  const [loginEmail, setLoginEmail] = useState(
    initialRole === 'manager'
      ? 'manager@clearbill.ai'
      : initialRole === 'customer'
      ? 'customer@clearbill.ai'
      : 'cashier@clearbill.ai'
  );
  const [loginPassword, setLoginPassword] = useState('clearbill123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // 5-Step Registration Wizard State
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Business Information
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('grocery_store');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [businessLogoUrl, setBusinessLogoUrl] = useState('');
  const [primaryOutletName, setPrimaryOutletName] = useState('');

  // Step 2: Owner and Contact Information
  const [ownerName, setOwnerName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [address, setAddress] = useState('');

  // Step 3: Currency, Tax and Regional Settings
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Karnataka');
  const [currency, setCurrency] = useState('INR');
  const [taxType, setTaxType] = useState('GST');
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState('');
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(5);

  // Step 4: Payment Configuration
  const [acceptsCash, setAcceptsCash] = useState(true);
  const [acceptsUpi, setAcceptsUpi] = useState(true);
  const [acceptsCard, setAcceptsCard] = useState(true);
  const [settlementBankName, setSettlementBankName] = useState('');
  const [settlementAccountHolder, setSettlementAccountHolder] = useState('');
  const [settlementAccountNumber, setSettlementAccountNumber] = useState('');
  const [settlementIfscRouting, setSettlementIfscRouting] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle country change and dynamically adapt currency & taxes
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    if (newCountry === 'India') {
      setCurrency('INR');
      setTaxType('GST');
      setDefaultTaxRate(5);
      setState('Karnataka');
    } else if (newCountry === 'United States') {
      setCurrency('USD');
      setTaxType('Sales Tax');
      setDefaultTaxRate(7);
      setState('California');
    } else if (newCountry === 'United Arab Emirates') {
      setCurrency('AED');
      setTaxType('VAT');
      setDefaultTaxRate(5);
      setState('Dubai');
    } else if (newCountry === 'United Kingdom') {
      setCurrency('GBP');
      setTaxType('VAT');
      setDefaultTaxRate(20);
      setState('Greater London');
    } else if (newCountry === 'Canada') {
      setCurrency('CAD');
      setTaxType('GST/HST');
      setDefaultTaxRate(13);
      setState('Ontario');
    } else if (newCountry === 'Singapore') {
      setCurrency('SGD');
      setTaxType('GST');
      setDefaultTaxRate(9);
      setState('Central');
    } else {
      setCurrency('USD');
      setTaxType('Local VAT / Sales Tax');
      setDefaultTaxRate(10);
      setState('');
    }
  };

  const handleRoleSelect = (role: 'manager' | 'retailer' | 'customer') => {
    setSelectedRole(role);
    if (role === 'manager') setLoginEmail('manager@clearbill.ai');
    else if (role === 'customer') setLoginEmail('customer@clearbill.ai');
    else setLoginEmail('cashier@clearbill.ai');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword, role: selectedRole }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onSuccess(data.user, data.company, data.outlet);
      } else {
        setError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Validate step transitions
  const validateStep = (currentStep: number): boolean => {
    setError(null);
    if (currentStep === 1) {
      if (!businessName.trim()) {
        setError('Business Name is required to proceed.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!ownerName.trim()) {
        setError("Owner's Full Name is required.");
        return false;
      }
      if (!registerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail.trim())) {
        setError('A valid business email address is required.');
        return false;
      }
      if (!registerPhone.trim()) {
        setError('Contact phone number is required.');
        return false;
      }
      if (registerPassword.length < 6) {
        setError('Password must contain at least 6 characters.');
        return false;
      }
      if (!address.trim()) {
        setError('Store physical address is required for invoices and tax compliance.');
        return false;
      }
    } else if (currentStep === 3) {
      if (country === 'India' && taxIdentificationNumber.trim()) {
        const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstPattern.test(taxIdentificationNumber.trim().toUpperCase())) {
          setError('Invalid Indian GSTIN format. Example: 29AAAAA0000A1Z5 (15 characters).');
          return false;
        }
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(prev => (Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5));
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setStep(prev => (Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5));
  };

  const handleFinalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setLoading(true);
    setError(null);

    const paymentMethods: string[] = [];
    if (acceptsCash) paymentMethods.push('cash');
    if (acceptsUpi) paymentMethods.push('upi');
    if (acceptsCard) paymentMethods.push('card');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          category: businessCategory,
          businessRegNumber: businessRegNumber.trim(),
          ownerName: ownerName.trim(),
          email: registerEmail.trim(),
          phone: registerPhone.trim(),
          password: registerPassword,
          address: address.trim(),
          country,
          state,
          currency,
          taxType,
          taxIdentificationNumber: taxIdentificationNumber.trim().toUpperCase(),
          defaultTaxRate,
          logoUrl: businessLogoUrl.trim(),
          primaryOutletName: primaryOutletName.trim() || `${businessName} Main Store`,
          paymentMethodsAccepted: paymentMethods,
          settlementBankName: settlementBankName.trim(),
          settlementAccountHolder: settlementAccountHolder.trim() || ownerName.trim(),
          settlementAccountNumber: settlementAccountNumber.trim(),
          settlementIfscRouting: settlementIfscRouting.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onSuccess(data.user, data.company, data.outlet);
      } else {
        setError(data.error || 'Registration failed. Please check form details.');
      }
    } catch (err: any) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-xl relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white flex items-center justify-center mx-auto mb-2 shadow-xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-extrabold text-[#172B4D] tracking-tight">
            {mode === 'login' ? 'Sign In to ClearBill AI' : 'Register New Business'}
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            {mode === 'login'
              ? 'Select your assigned role and log in with your credentials'
              : 'Multi-step company registration, tax configuration, and POS initialization'}
          </p>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Existing User Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register Business (5 Steps)
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-4 flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* LOGIN FORM */}
        {/* ======================================================== */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">Select Access Role</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('retailer')}
                  className={`py-2 px-2 rounded-lg font-semibold text-center border transition-all cursor-pointer ${
                    selectedRole === 'retailer'
                      ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Cashier POS
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('manager')}
                  className={`py-2 px-2 rounded-lg font-semibold text-center border transition-all cursor-pointer ${
                    selectedRole === 'manager'
                      ? 'bg-[#172033] text-white border-[#172033] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Store Manager
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('customer')}
                  className={`py-2 px-2 rounded-lg font-semibold text-center border transition-all cursor-pointer ${
                    selectedRole === 'customer'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Customer Vault
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-9 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Demo Logins */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                1-Click Quick Demo Credentials:
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    handleRoleSelect('retailer');
                    setLoginEmail('cashier@clearbill.ai');
                    setLoginPassword('clearbill123');
                  }}
                  className="text-[11px] text-[#16A34A] hover:underline font-semibold cursor-pointer"
                >
                  Cashier (Priya)
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    handleRoleSelect('manager');
                    setLoginEmail('manager@clearbill.ai');
                    setLoginPassword('clearbill123');
                  }}
                  className="text-[11px] text-[#172033] hover:underline font-bold cursor-pointer"
                >
                  Manager (Rajesh)
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    handleRoleSelect('customer');
                    setLoginEmail('customer@clearbill.ai');
                    setLoginPassword('clearbill123');
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Customer (Amit)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* MULTI-STEP REGISTRATION FORM (5 STEPS) */}
        {/* ======================================================== */}
        {mode === 'register' && (
          <div className="space-y-4">
            {/* Step Progress Indicators */}
            <div className="grid grid-cols-5 gap-1.5 pb-2 text-[10px] font-semibold text-center">
              {[
                { num: 1, label: 'Business' },
                { num: 2, label: 'Owner' },
                { num: 3, label: 'Regional' },
                { num: 4, label: 'Payments' },
                { num: 5, label: 'Review' },
              ].map(s => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num as any);
                  }}
                  className={`py-1.5 rounded-lg border transition-all ${
                    step === s.num
                      ? 'bg-[#172033] text-white border-[#172033] shadow-xs'
                      : step > s.num
                      ? 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  <span>{s.num}. {s.label}</span>
                </button>
              ))}
            </div>

            {/* STEP 1: BUSINESS INFORMATION */}
            {step === 1 && (
              <div className="space-y-3.5 text-xs">
                <div className="pb-1 border-b border-slate-100">
                  <h3 className="font-bold text-[#172B4D]">Step 1: Business Profile</h3>
                  <p className="text-[11px] text-slate-500">Provide trading name, retail category, and primary outlet details.</p>
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    Business Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annapurna Tea Lounge & Grocery"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Business Type / Category</label>
                  <select
                    value={businessCategory}
                    onChange={e => setBusinessCategory(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  >
                    <option value="tea_shop">Tea Shop & Beverage Counter</option>
                    <option value="grocery_store">Grocery Store / Kirana / Mart</option>
                    <option value="bakery">Bakery & Confectionery</option>
                    <option value="juice_shop">Fresh Juice Bar</option>
                    <option value="clothing_store">Apparel & Footwear</option>
                    <option value="electronics">Electronics & Mobile Accessories</option>
                    <option value="medical_store">Pharmacy / Medical Store</option>
                    <option value="general_retail">General Retail Business</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-medium block mb-1">
                      Business Registration / License No (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CIN / Trade License / MSME"
                      value={businessRegNumber}
                      onChange={e => setBusinessRegNumber(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-medium block mb-1">
                      Primary Outlet Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MG Road Flagship Store"
                      value={primaryOutletName}
                      onChange={e => setPrimaryOutletName(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 font-medium block mb-1">
                    Store Brand Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={businessLogoUrl}
                    onChange={e => setBusinessLogoUrl(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: OWNER AND CONTACT INFORMATION */}
            {step === 2 && (
              <div className="space-y-3.5 text-xs">
                <div className="pb-1 border-b border-slate-100">
                  <h3 className="font-bold text-[#172B4D]">Step 2: Owner & Login Credentials</h3>
                  <p className="text-[11px] text-slate-500">Authorized store manager contact details and access password.</p>
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    Owner / Manager Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">
                      Business Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="manager@store.com"
                      value={registerEmail}
                      onChange={e => setRegisterEmail(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={registerPhone}
                      onChange={e => setRegisterPhone(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    Manager Password <span className="text-rose-500">*</span> (Min 6 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={e => setRegisterPassword(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-3 pr-9 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showRegisterPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    Store Physical Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shop 14, Commercial Complex, MG Road"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: CURRENCY, TAX AND REGIONAL SETTINGS */}
            {step === 3 && (
              <div className="space-y-3.5 text-xs">
                <div className="pb-1 border-b border-slate-100">
                  <h3 className="font-bold text-[#172B4D]">Step 3: Currency, Tax & Regional Configuration</h3>
                  <p className="text-[11px] text-slate-500">Tax identification and billing currency automatically adapted to your country.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Country</label>
                    <select
                      value={country}
                      onChange={e => handleCountryChange(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    >
                      <option value="India">India (GST Standard)</option>
                      <option value="United States">United States (Sales Tax)</option>
                      <option value="United Arab Emirates">United Arab Emirates (VAT 5%)</option>
                      <option value="United Kingdom">United Kingdom (VAT 20%)</option>
                      <option value="Canada">Canada (GST/HST)</option>
                      <option value="Singapore">Singapore (GST 9%)</option>
                      <option value="Australia">Australia (GST 10%)</option>
                      <option value="Other">Other International</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Billing Currency</label>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    >
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="AED">AED (د.إ) - UAE Dirham</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                      <option value="CAD">CAD ($) - Canadian Dollar</option>
                      <option value="SGD">SGD ($) - Singapore Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Tax Fields */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span>{country} Applicable Tax Regime: {taxType}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Tax Type: {taxType}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-600 font-medium block mb-1">
                        {country === 'India'
                          ? 'GSTIN (15 characters)'
                          : country === 'United States'
                          ? 'State Tax ID / EIN'
                          : country === 'United Arab Emirates'
                          ? 'TRN (Tax Reg No)'
                          : 'Tax Identification Number'}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          country === 'India'
                            ? 'e.g. 29AAAAA0000A1Z5'
                            : country === 'United States'
                            ? 'XX-XXXXXXX'
                            : 'Tax ID'
                        }
                        value={taxIdentificationNumber}
                        onChange={e => setTaxIdentificationNumber(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-medium block mb-1">Default Tax Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultTaxRate}
                        onChange={e => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-600 font-medium block mb-1">State / Province</label>
                    <input
                      type="text"
                      placeholder="e.g. Karnataka"
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: PAYMENT CONFIGURATION & SECURITY */}
            {step === 4 && (
              <div className="space-y-3.5 text-xs">
                <div className="pb-1 border-b border-slate-100">
                  <h3 className="font-bold text-[#172B4D]">Step 4: Payment Methods & Payout Security</h3>
                  <p className="text-[11px] text-slate-500">Configure customer payment acceptance and optional bank settlement information.</p>
                </div>

                {/* Accepted Payment Modes */}
                <div>
                  <label className="text-slate-600 font-semibold block mb-1.5">
                    Accepted Payment Methods at POS
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                      acceptsCash ? 'bg-emerald-50/50 border-[#16A34A]' : 'bg-white border-slate-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={acceptsCash}
                        onChange={e => setAcceptsCash(e.target.checked)}
                        className="rounded text-[#16A34A]"
                      />
                      <Banknote className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold text-slate-800">Cash POS</span>
                    </label>

                    <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                      acceptsUpi ? 'bg-emerald-50/50 border-[#16A34A]' : 'bg-white border-slate-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={acceptsUpi}
                        onChange={e => setAcceptsUpi(e.target.checked)}
                        className="rounded text-[#16A34A]"
                      />
                      <QrCode className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold text-slate-800">Dynamic UPI</span>
                    </label>

                    <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                      acceptsCard ? 'bg-emerald-50/50 border-[#16A34A]' : 'bg-white border-slate-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={acceptsCard}
                        onChange={e => setAcceptsCard(e.target.checked)}
                        className="rounded text-[#16A34A]"
                      />
                      <CreditCard className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold text-slate-800">Card POS</span>
                    </label>
                  </div>
                </div>

                {/* Security Guarantee Box */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-[11px] text-blue-900">
                  <div className="flex items-center gap-1.5 font-bold text-blue-800">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>ClearBill Financial Data Security & Zero-Secret Policy</span>
                  </div>
                  <p className="leading-relaxed text-blue-800/90">
                    ClearBill AI <strong>never</strong> collects, stores, or requests online banking passwords, ATM PINs, OTPs, or card CVVs.
                    Settlement accounts are protected with AES-256-GCM encryption with server-side keys.
                  </p>
                </div>

                {/* Optional Settlement Bank Configuration */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Merchant Settlement Account (Optional)</span>
                    <span className="text-[10px] text-slate-500">For daily payout audits</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-slate-600 block mb-0.5">Settlement Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank / Chase"
                        value={settlementBankName}
                        onChange={e => setSettlementBankName(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-0.5">Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="Business / Owner Legal Name"
                        value={settlementAccountHolder}
                        onChange={e => setSettlementAccountHolder(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-0.5">Bank Account Number (Encrypted on Server)</label>
                      <input
                        type="text"
                        placeholder="e.g. 5010045892314589"
                        value={settlementAccountNumber}
                        onChange={e => setSettlementAccountNumber(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-0.5">IFSC / Routing / Sort Code</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0001234"
                        value={settlementIfscRouting}
                        onChange={e => setSettlementIfscRouting(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: REVIEW AND COMPLETE REGISTRATION */}
            {step === 5 && (
              <div className="space-y-3.5 text-xs">
                <div className="pb-1 border-b border-slate-100">
                  <h3 className="font-bold text-[#172B4D]">Step 5: Review & Initialize Store</h3>
                  <p className="text-[11px] text-slate-500">Verify company information, regional settings, and owner access before completing.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-y-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Business Name</span>
                      <span className="font-bold text-slate-900">{businessName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                      <span className="font-medium text-slate-800 capitalize">{businessCategory.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Store Manager</span>
                      <span className="font-medium text-slate-800">{ownerName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Email</span>
                      <span className="font-mono text-slate-800">{registerEmail || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Country & State</span>
                      <span className="font-medium text-slate-800">{country} · {state || 'All'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Currency</span>
                      <span className="font-bold text-emerald-800">{currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Tax Regime & Rate</span>
                      <span className="font-medium text-slate-800">{taxType} ({defaultTaxRate}%)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Tax ID</span>
                      <span className="font-mono text-slate-800">{taxIdentificationNumber || 'Unregistered / Exempt'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Settlement Configuration</span>
                    <span className="text-slate-700">
                      {settlementBankName && settlementAccountNumber
                        ? `${settlementBankName} (Account: •••• •••• •••• ${settlementAccountNumber.slice(-4)})`
                        : 'Standard Cashier & Digital POS (Hosted Gateway Settlement)'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                  <span>
                    Your initial flagship outlet, product catalogue, and customizable billing fields will be provisioned immediately.
                  </span>
                </div>
              </div>
            )}

            {/* Stepper Bottom Navigation Controls */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 bg-[#172033] hover:bg-[#263449] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ml-auto"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalRegister}
                  disabled={loading}
                  className="px-5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer ml-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{loading ? 'Creating Store & DB...' : 'Create Verified Business Account'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel & Return
          </button>
        )}
      </div>
    </div>
  );
};
