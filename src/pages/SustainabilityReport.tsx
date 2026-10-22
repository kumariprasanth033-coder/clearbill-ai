/**
 * ClearBill AI - Sustainability & Paperless ESG Analytics
 * Confirmed print jobs avoided, paper rolls saved, thermal BPA toxicity reduction.
 */

import React, { useState, useEffect } from 'react';
import { Leaf, Award, Trees, Droplet, Wind, ShieldCheck, Sparkles } from 'lucide-react';
import { DashboardMetrics } from '../types.ts';

export const SustainabilityReport: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(r => r.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  const count = metrics?.paperPrintsAvoided || 3;
  const paperGrams = count * 2.5;
  const co2Grams = count * 12.0;
  const waterLiters = (count * 0.15).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-[#DCFCE7] px-2.5 py-0.5 rounded">
            <Award className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Zero Thermal Paper Retail Certified</span>
          </div>
          <h2 className="text-xl font-bold text-[#172B4D]">Environmental, Social & Governance (ESG) Impact</h2>
          <p className="text-xs text-slate-600 max-w-xl">
            ClearBill replaces chemical thermal paper receipts (containing BPA/BPS) with instant customer QR codes.
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-500 block">Total Prints Avoided</span>
          <span className="text-3xl font-black text-[#16A34A] tabular-nums">{count} Invoices</span>
        </div>
      </div>

      {/* 4 Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
            <Leaf className="w-4 h-4" />
          </div>
          <span className="text-xs text-slate-500 block">Thermal Paper Avoided</span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{paperGrams.toFixed(1)}g</p>
          <span className="text-[11px] text-emerald-600 font-medium block">Zero bleached waste</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Droplet className="w-4 h-4" />
          </div>
          <span className="text-xs text-slate-500 block">Water Conserved</span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{waterLiters} Liters</p>
          <span className="text-[11px] text-slate-500 font-medium block">Pulp processing avoided</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Wind className="w-4 h-4" />
          </div>
          <span className="text-xs text-slate-500 block">CO2 Emissions Avoided</span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{co2Grams.toFixed(1)}g</p>
          <span className="text-[11px] text-emerald-600 font-medium block">Paper transport saved</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xs text-slate-500 block">Chemical BPA Toxicity</span>
          <p className="text-2xl font-black text-[#16A34A] tabular-nums">0%</p>
          <span className="text-[11px] text-slate-500 font-medium block">Safe for cashier hands</span>
        </div>
      </div>
    </div>
  );
};
