/**
 * ClearBill AI - Authentication & Company Registration Pages
 * Crisp white centered card, light theme, dark navy titles, green action buttons.
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
  AlertCircle,
  CheckCircle2,
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

  // Register form state
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('grocery_store');
  const [ownerName, setOwnerName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('INR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          category: businessCategory,
          ownerName,
          email: registerEmail,
          phone: registerPhone,
          password: registerPassword,
          address,
          currency,
        }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        // Automatically sign in
        onSuccess(data.user, data.company, {
          id: `out-${Date.now()}`,
          company_id: data.company.id,
          outlet_name: `${businessName} Main Store`,
          outlet_code: 'OUT-01',
        });
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-lg relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white flex items-center justify-center mx-auto mb-2 shadow-xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-[#172B4D]">
            {mode === 'login' ? 'Sign In to ClearBill AI' : 'Register New Store / Business'}
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            {mode === 'login'
              ? 'Select your role and log in with your credentials'
              : 'Configure your company profile and default billing interface'}
          </p>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div className="flex p-1 bg-slate-100 rounded-lg mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Existing User Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register Business
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg mb-4 flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {/* Role Selector Tabs */}
            <div>
              <label className="text-slate-600 font-medium block mb-1">Select Access Role</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('retailer')}
                  className={`py-2 px-2 rounded-lg font-semibold text-center border transition-all ${
                    selectedRole === 'retailer'
                      ? 'bg-[#16A34A] text-white border-[#16A34A]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Cashier POS
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('manager')}
                  className={`py-2 px-2 rounded-lg font-semibold text-center border transition-all ${
                    selectedRole === 'manager'
                      ? 'bg-[#172033] text-white border-[#172033]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Store Manager
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('customer')}
                  className={`py-2 px-2 rounded-lg font-semibold text-center border transition-all ${
                    selectedRole === 'customer'
                      ? 'bg-blue-600 text-white border-blue-600'
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
                  type="password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            {/* Quick 1-Click Demo Buttons */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 block">Quick Demo Logins:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleRoleSelect('retailer');
                    setLoginEmail('cashier@clearbill.ai');
                    setLoginPassword('clearbill123');
                  }}
                  className="text-[11px] text-[#16A34A] hover:underline"
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
                  className="text-[11px] text-[#172033] hover:underline font-semibold"
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
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Customer (Amit)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg transition-colors shadow-xs"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">Business Category / Type</label>
              <select
                value={businessCategory}
                onChange={e => setBusinessCategory(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
              >
                <option value="tea_shop">Tea Shop & Beverage Bar</option>
                <option value="grocery_store">Grocery Store / Kirana</option>
                <option value="bakery">Bakery & Confectionery</option>
                <option value="juice_shop">Fresh Juice Shop</option>
                <option value="clothing_store">Clothing & Apparel Store</option>
                <option value="general_retail">General Retail Business</option>
                <option value="supermarket">Supermarket & Mart</option>
                <option value="medical_store">Pharmacy / Medical Store</option>
                <option value="other">Other Retail Business</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chai Point Express"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Owner / Manager Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Kumar"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Email</label>
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
                <label className="text-slate-600 font-medium block mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="+91..."
                  value={registerPhone}
                  onChange={e => setRegisterPhone(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Store Address</label>
              <input
                type="text"
                placeholder="e.g. Shop 4, Market Road, Bengaluru"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg transition-colors shadow-xs"
            >
              {loading ? 'Registering...' : 'Register Business & Initialize POS'}
            </button>
          </form>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel & Return
          </button>
        )}
      </div>
    </div>
  );
};
