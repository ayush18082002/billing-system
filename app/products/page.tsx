"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; 

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdHead, setNewProdHead] = useState("");
  const [newProdHsn, setNewProdHsn] = useState("");
  const [newProdGst, setNewProdGst] = useState("18");
  const [newProdUom, setNewProdUom] = useState("NOS");

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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName) return alert("Product Name is required.");

    const payload = {
      name: newProdName,
      product_head: newProdHead || null,
      hsn_code: newProdHsn || null,
      gst_rate: Number(newProdGst),
      uom: newProdUom || "NOS",
      is_active: true
    };

    const { error } = await supabase.from('products').insert([payload]);

    if (error) {
      console.error("Database Error:", error);
      return alert(`Error creating product: ${error.message}`);
    }

    // Reset form and close modal on success
    setNewProdName(""); 
    setNewProdHead(""); 
    setNewProdHsn("");
    setNewProdGst("18");
    setNewProdUom("NOS");
    setIsModalOpen(false);
    
    // Refresh table data
    fetchProducts(); 
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Products Master</h1>
          <p className="text-slate-500 mt-1">Manage your enterprise inventory and tax brackets.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md transition-colors shadow-sm"
        >
          + Add New Product
        </button>
      </div>

      {/* DATA GRID */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Product Directory</h3>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            {products.length} Items
          </span>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider sticky top-0">
              <tr>
                <th className="p-4 font-semibold">Product Head</th>
                <th className="p-4 font-semibold">Product Name</th>
                <th className="p-4 font-semibold text-center">HSN/SAC Code</th>
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
                    <td className="p-4 font-bold text-slate-800">{prod.product_head || '-'}</td>
                    <td className="p-4 font-medium text-slate-700">{prod.name}</td>
                    <td className="p-4 text-center text-slate-500 tracking-mono">{prod.hsn_code || '-'}</td>
                    <td className="p-4 text-center">{prod.uom}</td>
                    <td className="p-4 text-center font-bold text-purple-600">{prod.gst_rate}%</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${prod.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {prod.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Add New Product</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input type="text" required value={newProdName} onChange={e => setNewProdName(e.target.value)} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Copper Wire 5mm" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category / Head</label>
                  <input type="text" value={newProdHead} onChange={e => setNewProdHead(e.target.value)} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Raw Material" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HSN / SAC Code</label>
                  <input type="text" value={newProdHsn} onChange={e => setNewProdHsn(e.target.value)} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 74081190" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit of Measure (UOM)</label>
                  <input type="text" value={newProdUom} onChange={e => setNewProdUom(e.target.value.toUpperCase())} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase" placeholder="e.g. NOS, KG, MTR" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GST Rate (%)</label>
                  <select value={newProdGst} onChange={e => setNewProdGst(e.target.value)} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}