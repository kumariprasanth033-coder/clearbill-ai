/**
 * ClearBill AI - Employee & Cashier Access Management (Manager Only)
 * Full CRUD Operations: Add, Edit, Delete, and Filter Store Employees & Cashiers.
 * Authoritative persistence via /api/employees backend endpoints.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Store,
  Phone,
  Mail,
  Shield,
  KeyRound,
} from 'lucide-react';
import { getAuthHeaders } from '../utils/authHeaders.ts';

export interface Employee {
  id: string;
  company_id?: string;
  outlet_id?: string;
  name: string;
  email: string;
  phone: string;
  role: 'Manager' | 'Cashier / Retailer';
  outlet_name: string;
  code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const EmployeesScreen: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Cashier / Retailer' as 'Manager' | 'Cashier / Retailer',
    outlet_name: 'MG Road Flagship Store (BLR-01)',
    code: '',
    is_active: true,
  });

  // Delete Confirmation State
  const [deleteCandidate, setDeleteCandidate] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Available Outlets
  const outletsList = [
    'MG Road Flagship Store (BLR-01)',
    'Indiranagar Express Outlet (BLR-02)',
    'All Outlets (Central Manager)',
  ];

  // Fetch employees from API
  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/employees', {
        headers: getAuthHeaders('manager'),
      });
      if (!res.ok) throw new Error('Failed to load employee directory.');
      const data = await res.json();
      setEmployees(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Open modal for Adding
  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'Cashier / Retailer',
      outlet_name: 'MG Road Flagship Store (BLR-01)',
      code: `EMP-00${employees.length + 1}`,
      is_active: true,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      role: emp.role,
      outlet_name: emp.outlet_name || 'MG Road Flagship Store (BLR-01)',
      code: emp.code,
      is_active: emp.is_active,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  // Save Employee (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setModalError('Name and email are required.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      if (editingEmployee) {
        // Edit / Update
        const res = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeaders('manager') as Record<string, string>),
          },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to update employee account.');
        }

        const updated = await res.json();
        setEmployees(prev => prev.map(emp => (emp.id === updated.id ? updated : emp)));
      } else {
        // Add / Create
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeaders('manager') as Record<string, string>),
          },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to create employee account.');
        }

        const created = await res.json();
        setEmployees(prev => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'Operation failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete Employee
  const handleDeleteConfirm = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/employees/${deleteCandidate.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders('manager'),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete employee.');
      }

      setEmployees(prev => prev.filter(e => e.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered list
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.phone && emp.phone.includes(searchQuery));

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'manager' && emp.role === 'Manager') ||
      (roleFilter === 'cashier' && emp.role === 'Cashier / Retailer');

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#16A34A]" />
            Employee Accounts & POS Permissions
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Full staff directory: Add, edit, or remove cashiers, assign outlet permissions, and manage terminal codes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchEmployees}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Employee</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 font-medium">Role Filter:</label>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#16A34A]"
          >
            <option value="all">All Roles ({employees.length})</option>
            <option value="manager">Managers Only</option>
            <option value="cashier">Cashiers Only</option>
          </select>
        </div>
      </div>

      {/* Employees Table Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#16A34A]" />
            <p className="text-xs">Loading staff accounts from database...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs">{error}</p>
            <button
              onClick={fetchEmployees}
              className="mt-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No employees match your search.</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or add a new team member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Employee Details</th>
                  <th className="py-3 px-4">Staff Code</th>
                  <th className="py-3 px-4">Role & Access</th>
                  <th className="py-3 px-4">Assigned Store Outlet</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#DCFCE7] text-[#16A34A] font-bold flex items-center justify-center text-xs">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{emp.name}</p>
                          <p className="text-[11px] text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {emp.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          emp.role === 'Manager'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[190px]">{emp.outlet_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{emp.phone || 'No phone set'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          emp.is_active
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          className="p-1.5 text-slate-500 hover:text-[#16A34A] hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Employee"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(emp)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#16A34A] rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">
                    {editingEmployee ? 'Edit Staff Account' : 'Add New Staff Member'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingEmployee
                      ? `Modify access permissions for ${editingEmployee.name}`
                      : 'Create a new cashier or assistant manager with POS access'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Staff Code</label>
                  <input
                    type="text"
                    placeholder="EMP-004"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@clearbill.ai"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 00000"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Role / Permissions</label>
                  <select
                    value={formData.role}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'Manager' | 'Cashier / Retailer',
                      })
                    }
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  >
                    <option value="Cashier / Retailer">Cashier / Retailer (Billing & POS)</option>
                    <option value="Manager">Store Manager (Full Admin Access)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Assigned Store Outlet</label>
                  <select
                    value={formData.outlet_name}
                    onChange={e => setFormData({ ...formData, outlet_name: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  >
                    {outletsList.map(out => (
                      <option key={out} value={out}>
                        {out}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emp_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A] h-4 w-4"
                />
                <label htmlFor="emp_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Account is Active (Can sign in & operate POS terminals)
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {modalLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingEmployee ? 'Save Changes' : 'Create Staff Account'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Employee?</h3>
                <p className="text-xs text-slate-500">This action will revoke POS access immediately.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 space-y-1">
              <p>
                <span className="font-semibold">Name:</span> {deleteCandidate.name}
              </p>
              <p>
                <span className="font-semibold">Staff Code:</span> {deleteCandidate.code}
              </p>
              <p>
                <span className="font-semibold">Email:</span> {deleteCandidate.email}
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Delete Employee</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
