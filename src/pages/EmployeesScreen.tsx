/**
 * ClearBill AI - Employee & Cashier Access Management (Manager Only)
 * Add employees, assign outlet PINs, configure role permissions.
 */

import React, { useState } from 'react';
import { Users, Plus, ShieldCheck, Store, KeyRound, Check } from 'lucide-react';

export const EmployeesScreen: React.FC = () => {
  const [employees, setEmployees] = useState([
    {
      id: 'emp-01',
      name: 'Rajesh Sharma',
      email: 'manager@clearbill.ai',
      role: 'Manager',
      outlet: 'MG Road Flagship Store (BLR-01)',
      code: 'EMP-001',
      active: true,
    },
    {
      id: 'emp-02',
      name: 'Priya Patel',
      email: 'cashier@clearbill.ai',
      role: 'Cashier / Retailer',
      outlet: 'MG Road Flagship Store (BLR-01)',
      code: 'EMP-002',
      active: true,
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('retailer');
  const [outlet, setOutlet] = useState('MG Road Flagship Store (BLR-01)');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setEmployees(prev => [
      ...prev,
      {
        id: `emp-${Date.now()}`,
        name,
        email,
        role: role === 'manager' ? 'Manager' : 'Cashier / Retailer',
        outlet,
        code: `EMP-00${prev.length + 1}`,
        active: true,
      },
    ]);
    setShowAddModal(false);
    setName('');
    setEmail('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#16A34A]" />
            Employee Accounts & POS Permissions
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage cashier terminals, employee codes, and authorized outlet locations.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Employee</span>
        </button>
      </div>

      {/* Employees Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-[#E2E8F0] text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Outlet</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">{emp.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{emp.code}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        emp.role === 'Manager'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {emp.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{emp.outlet}</td>
                  <td className="py-3 px-4 text-slate-500">{emp.email}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-base font-bold text-slate-900 mb-4">Add Store Employee</h3>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-600 font-medium block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-600 font-medium block mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900"
                >
                  <option value="retailer">Cashier / Retailer</option>
                  <option value="manager">Assistant Manager</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16A34A] text-white rounded-lg font-bold"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
