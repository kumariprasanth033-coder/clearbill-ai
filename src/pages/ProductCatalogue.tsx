/**
 * ClearBill AI - Product Catalogue & Price Management
 * Search by barcode/name, CSV import, Add/Edit products, Quick Bill toggles.
 */

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Upload,
  Search,
  Filter,
  Check,
  Zap,
  Edit2,
  Trash2,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { Product } from '../types.ts';

export const ProductCatalogue: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Add/Edit Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState('');
  const [taxRate, setTaxRate] = useState('5');
  const [isQuickBill, setIsQuickBill] = useState(false);

  // CSV Import State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  const loadProducts = () => {
    setLoading(true);
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setBarcode('');
    setSku('');
    setCategory('Groceries');
    setUnit('pcs');
    setPrice('');
    setTaxRate('5');
    setIsQuickBill(false);
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.product_name);
    setBarcode(p.barcode || '');
    setSku(p.sku || '');
    setCategory(p.category);
    setUnit(p.unit);
    setPrice(p.unit_price.toString());
    setTaxRate(p.tax_rate.toString());
    setIsQuickBill(p.is_quick_bill_item);
    setShowModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      product_name: name,
      barcode: barcode.trim(),
      sku,
      category,
      unit,
      unit_price: parseFloat(price) || 0,
      tax_rate: parseFloat(taxRate) || 0,
      is_quick_bill_item: isQuickBill,
    };

    if (editingProduct) {
      await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setShowModal(false);
    loadProducts();
  };

  const handleImportCsv = async () => {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) return;

    const items = lines.slice(1).map(line => {
      const parts = line.split(',').map(s => s.trim());
      return {
        product_name: parts[0] || 'Imported Product',
        barcode: parts[1] || '',
        category: parts[2] || 'General',
        unit_price: parseFloat(parts[3]) || 0,
        tax_rate: parseFloat(parts[4]) || 0,
        unit: parts[5] || 'pcs',
      };
    });

    await fetch('/api/products/import-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    setShowCsvModal(false);
    setCsvText('');
    loadProducts();
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'Product Name,Barcode,Category,Price,TaxRate,Unit\n' +
      'Ginger Cardamom Tea,TEA-002,Beverages,20,5,cup\n' +
      'Almond Milk 500ml,8901233099999,Dairy,90,5,pack\n' +
      'Oats Biscuit Box,8901030999991,Snacks,65,5,pack';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearbill_products_template.csv';
    a.click();
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const filtered = products.filter(p => {
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesSearch =
      search === '' ||
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D]">Product Catalogue Management</h2>
          <p className="text-xs text-[#64748B]">
            Maintain prices, standard barcodes (EAN/UPC), and 1-tap Quick Bill presets in MySQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by product name, EAN barcode, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
          >
            {categories.map(c => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product List Table (Clean White Card) */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-[#E2E8F0] text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4 text-right">Price (₹)</th>
                <th className="py-3 px-4 text-right">GST (%)</th>
                <th className="py-3 px-4 text-center">Quick Bill</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">{p.product_name}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{p.barcode || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{p.category}</td>
                  <td className="py-3 px-4 text-slate-500">{p.unit}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                    ₹{p.unit_price.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{p.tax_rate}%</td>
                  <td className="py-3 px-4 text-center">
                    {p.is_quick_bill_item ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        <Zap className="w-3 h-3 text-amber-500" />
                        1-Tap
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1 text-slate-500 hover:text-[#16A34A] rounded"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-base font-bold text-[#172B4D] mb-4">
              {editingProduct ? 'Edit Product Details' : 'Add New Product to Catalogue'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masala Tea"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-medium block mb-1">Barcode (EAN/UPC)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8901030383786"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-medium block mb-1">SKU Code</label>
                  <input
                    type="text"
                    placeholder="e.g. TEA-MAS-01"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-medium block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Beverages / Dairy"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-medium block mb-1">Unit of Measurement</label>
                  <input
                    type="text"
                    placeholder="cup / pack / pcs"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-medium block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="15.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-medium block mb-1">GST Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="5"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isQuickBill}
                    onChange={e => setIsQuickBill(e.target.checked)}
                    className="rounded text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <span className="font-semibold text-slate-800">
                    Pin as 1-Tap Quick Bill Item (For Tea / Bakery counter)
                  </span>
                </label>
              </div>

              <div className="pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-lg w-full shadow-lg space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Import Products via CSV</h3>
              <button
                onClick={downloadSampleCsv}
                className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>

            <p className="text-slate-600">
              Paste CSV contents below (Headers: Product Name, Barcode, Category, Price, TaxRate, Unit):
            </p>

            <textarea
              rows={8}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="Product Name,Barcode,Category,Price,TaxRate,Unit&#10;Ginger Tea,TEA-002,Beverages,20,5,cup"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-slate-800 focus:outline-none focus:border-[#16A34A]"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={!csvText.trim()}
                className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg font-semibold shadow-xs"
              >
                Process & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
