/**
 * ClearBill AI - Manager Defined Billing Fields Customizer
 * Toggle Visible/Hidden and Required/Optional for POS fields.
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Save,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { BillingFieldConfig } from '../types.ts';
import { getAuthHeaders } from '../utils/authHeaders.ts';

export const BillingFieldsCustomizer: React.FC = () => {
  const [configs, setConfigs] = useState<BillingFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/billing-fields', { headers: getAuthHeaders('manager') })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setConfigs(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleVisibility = (key: string) => {
    setConfigs(prev =>
      prev.map(c => {
        if (c.field_key === key) {
          // Cannot hide mandatory financial field product_name or unit_price
          if (c.field_key === 'product_name' || c.field_key === 'unit_price') return c;
          return { ...c, is_visible: !c.is_visible };
        }
        return c;
      })
    );
  };

  const toggleRequired = (key: string) => {
    setConfigs(prev =>
      prev.map(c => {
        if (c.field_key === key) {
          if (c.field_key === 'product_name' || c.field_key === 'unit_price' || c.field_key === 'quantity') {
            return c; // Immutable required fields
          }
          return { ...c, is_required: !c.is_required };
        }
        return c;
      })
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/configs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders('manager') as Record<string, string>),
        },
        body: JSON.stringify({ companyId: 'cmp-demo-01', configs }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#16A34A]" />
            Customize Cashier Billing Fields
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Configure which fields appear on your store counter's POS screen. Changes reflect in MySQL.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#16A34A]" />
          <span>Billing interface field configurations successfully updated and persisted!</span>
        </div>
      )}

      {/* Recommended Presets Card */}
      <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 text-xs text-slate-700 space-y-2">
        <span className="font-bold text-slate-800 block">Preset Profiles for Your Shop:</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="font-bold text-[#16A34A] block">Tea Stall & Bakery</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Product name, quantity, price enabled. Barcode and SKU hidden for maximum speed.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="font-bold text-slate-900 block">Grocery & Supermarket</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Barcode scanner, product name, quantity, GST %, customer phone enabled.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="font-bold text-blue-700 block">Clothing & Apparel</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              SKU, barcode, size, unit price, and discount enabled.
            </p>
          </div>
        </div>
      </div>

      {/* Field Configurations Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-[#E2E8F0] text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Field Name</th>
                <th className="py-3 px-4">Field Key</th>
                <th className="py-3 px-4">Data Type</th>
                <th className="py-3 px-4 text-center">Visibility</th>
                <th className="py-3 px-4 text-center">Validation</th>
                <th className="py-3 px-4 text-right">Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map(cfg => {
                const isPermanent =
                  cfg.field_key === 'product_name' ||
                  cfg.field_key === 'unit_price' ||
                  cfg.field_key === 'quantity';

                return (
                  <tr key={cfg.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{cfg.field_label}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{cfg.field_key}</td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">
                      {cfg.field_type}
                    </td>

                    {/* Visibility Switch */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        disabled={isPermanent}
                        onClick={() => toggleVisibility(cfg.field_key)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                          cfg.is_visible
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-slate-100 text-slate-400'
                        } ${isPermanent ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-90'}`}
                      >
                        {cfg.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{cfg.is_visible ? 'Visible' : 'Hidden'}</span>
                      </button>
                    </td>

                    {/* Requirement Switch */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        disabled={isPermanent}
                        onClick={() => toggleRequired(cfg.field_key)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                          cfg.is_required
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                        } ${isPermanent ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-90'}`}
                      >
                        <span>{cfg.is_required ? 'Required' : 'Optional'}</span>
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {isPermanent ? (
                        <span className="text-[10px] text-slate-400 font-semibold">Core Financial</span>
                      ) : (
                        <span className="text-[10px] text-[#16A34A] font-semibold">Configurable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
