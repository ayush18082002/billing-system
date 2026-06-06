"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Adjust this path if your supabase.ts is elsewhere

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_head')
        .order('name');

      // --- THE ENHANCED ERROR CATCHER ---
      if (error) {
        console.error("Supabase Error Details:", error.message, error.details, error.hint);
        alert(`Database Error: ${error.message}\n\nCheck your browser console for more details.`);
        setProducts([]);
      } else {
        setProducts(data || []);
      }
    } catch (err: any) {
      console.error("Unexpected System Error:", err);
      alert(`Unexpected Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Products Master</h1>
          <p className="text-slate-500 mt-1">Manage your enterprise inventory and tax brackets.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md transition-colors shadow-sm">
          + Add New Product
        </button>
      </div>

      {/* DATA GRID */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-4">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Product Directory</h3>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            {products.length} Items
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-semibold">Product Head</th>
                <th className="p-4 font-semibold">Product Name</th>
                <th className="p-4 font-semibold">HSN/SAC Code</th>
                <th className="p-4 font-semibold text-center">UOM</th>
                <th className="p-4 font-semibold text-center">GST Rate</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-medium">Loading inventory data...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400 italic">No products found. Add a product to get started.</td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{prod.product_head || 'N/A'}</td>
                    <td className="p-4 font-medium text-slate-700">{prod.name}</td>
                    <td className="p-4 text-slate-500 tracking-mono">{prod.hsn_code || 'N/A'}</td>
                    <td className="p-4 text-center">{prod.uom}</td>
                    <td className="p-4 text-center font-bold text-purple-600">{prod.gst_rate}%</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${prod.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {prod.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs mr-3">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}