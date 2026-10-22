/**
 * ClearBill AI - Database & XAMPP Status Screen
 * Live diagnostic console for verifying MySQL Community Edition and local XAMPP setup.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  FileCode,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { DbStatus } from '../types.ts';

export const DatabaseStatusScreen: React.FC = () => {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSql, setCopiedSql] = useState(false);

  const checkStatus = () => {
    setLoading(true);
    fetch('/api/db/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const copySqlSnippet = () => {
    const sql = `CREATE DATABASE IF NOT EXISTS \`clearbill_ai\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nCREATE USER IF NOT EXISTS 'clearbill_app'@'127.0.0.1' IDENTIFIED BY 'ClearBill@Dev2026';\nGRANT ALL PRIVILEGES ON \`clearbill_ai\`.* TO 'clearbill_app'@'127.0.0.1';\nFLUSH PRIVILEGES;`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
              <Database className="w-5 h-5 text-[#16A34A]" />
              MySQL & XAMPP Local Database Status
            </h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                status?.isConnected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {status?.isConnected ? 'MySQL 8.0 Live' : 'Memory Repository Fallback (28 Tables)'}
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real connection diagnostic for XAMPP on 127.0.0.1:3306 via mysql2/promise driver.
          </p>
        </div>

        <button
          onClick={checkStatus}
          disabled={loading}
          className="px-3.5 py-2 bg-[#172033] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Ping Connection</span>
        </button>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Target Host</span>
          <p className="text-base font-bold text-slate-800 font-mono">
            {status?.host || '127.0.0.1'}:{status?.port || 3306}
          </p>
          <span className="text-[11px] text-slate-400">Default XAMPP Port</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Database Name</span>
          <p className="text-base font-bold text-slate-800 font-mono">
            {status?.database || 'clearbill_ai'}
          </p>
          <span className="text-[11px] text-slate-400">utf8mb4_unicode_ci</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">App DB User</span>
          <p className="text-base font-bold text-slate-800 font-mono">
            {status?.user || 'clearbill_app'}
          </p>
          <span className="text-[11px] text-slate-400">Least privilege access</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Schema Table Count</span>
          <p className="text-base font-bold text-[#16A34A] font-mono">
            {status?.tablesCount || 28} Tables
          </p>
          <span className="text-[11px] text-slate-400">Full 28 Normalized Entities</span>
        </div>
      </div>

      {/* Connection Notice Box */}
      <div
        className={`p-4 rounded-xl border text-xs ${
          status?.isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-start gap-3">
          {status?.isConnected ? (
            <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="font-bold">
              {status?.isConnected
                ? 'MySQL Database Online & Authoritative'
                : 'Local XAMPP Not Detected (Seamless In-Memory Fallback Active)'}
            </h4>
            <p className="mt-1 leading-relaxed">{status?.message}</p>
          </div>
        </div>
      </div>

      {/* Step-by-Step XAMPP Setup Checklist */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#16A34A]" />
            Local XAMPP Quick Setup Checklist
          </h3>
          <button
            onClick={copySqlSnippet}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="font-bold text-slate-900 block mb-1">
              Step 1: Start MySQL in XAMPP
            </span>
            <p className="text-slate-600">
              Open your <strong>XAMPP Control Panel</strong> and click <strong>Start</strong> next to
              MySQL (Port 3306).
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="font-bold text-slate-900 block mb-1">
              Step 2: Create Application User in phpMyAdmin or MySQL Shell
            </span>
            <pre className="bg-slate-900 text-emerald-400 p-3 rounded-md font-mono text-[11px] overflow-x-auto mt-2">
{`CREATE DATABASE IF NOT EXISTS \`clearbill_ai\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'clearbill_app'@'127.0.0.1' IDENTIFIED BY 'ClearBill@Dev2026';
GRANT ALL PRIVILEGES ON \`clearbill_ai\`.* TO 'clearbill_app'@'127.0.0.1';
FLUSH PRIVILEGES;`}
            </pre>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="font-bold text-slate-900 block mb-1">
              Step 3: Import Schema & Seeds
            </span>
            <p className="text-slate-600">
              Import <code>database/schema.sql</code> and <code>database/seeds/demo_data.sql</code> in
              phpMyAdmin. All 28 tables and test barcodes will be loaded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
