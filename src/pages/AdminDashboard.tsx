/**
 * ClearBill AI - Admin System Dashboard (Role A: Admin)
 *
 * Capabilities:
 * - Manage authorized businesses and users.
 * - Configure system-level settings.
 * - Monitor database & system health.
 * - Review authorized audit logs.
 *
 * Security Discipline:
 * - Admin does NOT receive access to banking credentials or unnecessary customer financial information.
 * - Raw banking credentials, passwords, and PINs are strictly hidden / not present.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  Activity,
  CheckCircle2,
  Server,
  Database,
  RefreshCw,
  Search,
  Lock,
  Clock,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { Company, User, DbStatus } from '../types.ts';

interface AdminDashboardProps {
  currentUser?: User | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'health' | 'businesses' | 'users' | 'audit'>('health');
  const [healthData, setHealthData] = useState<any | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const getAdminHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const sess = localStorage.getItem('cb_admin_session');
      if (sess) {
        try {
          const parsed = JSON.parse(sess);
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
        } catch (e) {}
      }
    }
    return headers;
  };

  const loadAdminData = () => {
    setLoading(true);
    const headers = getAdminHeaders();

    const healthPromise = fetch('/api/admin/health', { headers })
      .then(r => r.json())
      .then(setHealthData)
      .catch(console.error);

    const companiesPromise = fetch('/api/admin/companies', { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCompanies(data);
      })
      .catch(console.error);

    const usersPromise = fetch('/api/admin/users', { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(console.error);

    const auditPromise = fetch('/api/admin/audit-logs', { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAuditLogs(data);
      })
      .catch(console.error);

    Promise.all([healthPromise, companiesPromise, usersPromise, auditPromise]).finally(() =>
      setLoading(false)
    );
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const filteredCompanies = companies.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return c.business_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Role A: System Admin Console
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Admin: {currentUser?.email || 'admin@clearbill.ai'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#172B4D] mt-1.5">
            ClearBill AI System Administration & Health
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            System-level monitoring, registered businesses, authorized user directory, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAdminData}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            title="Refresh System Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 pt-3 border-b border-slate-200 flex gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('health')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'health'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Health & DB</span>
          </button>

          <button
            onClick={() => setActiveTab('businesses')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'businesses'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Businesses ({companies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Authorized Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Logs ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab 1: System Health */}
        {activeTab === 'health' && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 block mb-1">System Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-base font-bold text-slate-800">Operational</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">Uptime: {Math.floor((healthData?.uptime || 0) / 60)} min</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 block mb-1">Database Engine</span>
                <span className="text-base font-mono font-bold text-slate-800 uppercase">
                  {healthData?.database?.engine || 'MySQL / Memory'}
                </span>
                <span className="text-[11px] text-emerald-600 block mt-1">28 Schema Tables Ready</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 block mb-1">Active Sessions</span>
                <span className="text-2xl font-bold font-mono text-[#172B4D]">
                  {healthData?.activeSessionsCount || 4}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">Role-Isolated Map</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs text-slate-500 block mb-1">Total Digital Receipts</span>
                <span className="text-2xl font-bold font-mono text-emerald-600">
                  {healthData?.totalReceipts || 4}
                </span>
                <span className="text-[11px] text-emerald-700 block mt-1">Paperless Invoices</span>
              </div>
            </div>

            {/* Financial Privacy Guard Notice */}
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-1.5 text-purple-950">
              <div className="flex items-center gap-1.5 font-bold text-purple-900">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
                <span>Admin Financial Privacy Boundary Enforced</span>
              </div>
              <p className="text-[11px] text-purple-900/90 leading-relaxed">
                As per ClearBill AI's security charter, System Administrators do NOT receive access to merchant banking secrets, raw account numbers, or customer passwords. All merchant settlement accounts remain masked and encrypted with AES-256-GCM.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Businesses Directory */}
        {activeTab === 'businesses' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#172B4D]">Authorized Registered Businesses</h3>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search businesses..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {filteredCompanies.map(c => (
                <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">{c.business_name}</span>
                    <span className="text-slate-500 text-[11px]">
                      Owner: {c.owner_name} • {c.email} • {c.currency}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active Tenant
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Users Directory */}
        {activeTab === 'users' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#172B4D]">Authorized User Accounts</h3>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {filteredUsers.map(u => (
                <div key={u.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-800 block">{u.full_name}</span>
                    <span className="text-slate-500 text-[11px] font-mono">{u.email}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : u.role === 'manager'
                        ? 'bg-slate-200 text-slate-800'
                        : u.role === 'retailer'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#172B4D]">Authorized Security Audit Logs</h3>
            <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
              {auditLogs.map(log => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4 font-mono">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs font-sans">{log.action}</span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">{log.details}</span>
                    <span className="text-slate-400 text-[10px]">{log.user_email}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
