"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form State (Removed default_rate)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    product_head: "",
    name: "",
    hsn_code: "",
    uom: "NOS",
    gst_rate: "18", // Defaulting to 18%
    is_active: true
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("product_head", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const uniqueProductHeads = Array.from(
    new Set(products.map((p) => p.product_head).filter(Boolean))
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Payload (Removed default_rate)
    const payload = {
      product_head: formData.product_head,
      name: formData.name,
      hsn_code: formData.hsn_code,
      uom: formData.uom,
      gst_rate: formData.gst_rate ? Number(formData.gst_rate) : 0,
      is_active: formData.is_active
    };

    if (formData.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", formData.id);
      if (error) alert("Save Error: " + error.message);
    } else {
      const { error } = await supabase.from("products").insert([payload]);
      if (error) alert("Save Error: " + error.message);
    }
    
    setIsFormOpen(false);
    fetchProducts();
  };

  const handleEdit = (product: any) => {
    setFormData({
      id: product.id,
      product_head: product.product_head || "",
      name: product.name || "",
      hsn_code: product.hsn_code || "",
      uom: product.uom || "NOS",
      gst_rate: product.gst_rate || "18",
      is_active: product.is_active
    });
    setIsFormOpen(true);
  };

  const filteredProducts = products.filter((p) =>
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.product_head?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Products Master</h1>
        <button 
          onClick={() => {
            setFormData({ id: "", product_head: "", name: "", hsn_code: "", uom: "NOS", gst_rate: "18", is_active: true });
            setIsFormOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          + Add Product
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-8">
          <h2 className="text-lg font-bold mb-4">{formData.id ? "Edit Product" : "New Product"}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Head</label>
              <input
                list="product-heads"
                type="text"
                required
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={formData.product_head}
                onChange={(e) => setFormData({ ...formData, product_head: e.target.value })}
                placeholder="Select or type new..."
              />
              <datalist id="product-heads">
                {uniqueProductHeads.map((head, idx) => (
                  <option key={idx} value={head as string} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
              <input type="text" required className="w-full p-2 border border-slate-300 rounded-md" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">HSN Code</label>
              <input type="text" className="w-full p-2 border border-slate-300 rounded-md" value={formData.hsn_code} onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UOM</label>
              <select className="w-full p-2 border border-slate-300 rounded-md" value={formData.uom} onChange={(e) => setFormData({ ...formData, uom: e.target.value })}>
                <option value="NOS">NOS (Numbers)</option>
                <option value="KGS">KGS (Kilograms)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="SET">SET (Sets)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GST Rate (%)</label>
              <input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded-md" value={formData.gst_rate} onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })} />
            </div>

            <div className="flex items-end pb-2 md:col-span-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>

            <div className="md:col-span-3 flex justify-end space-x-3 mt-2">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-medium">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">Save Product</button>
            </div>
          </form>
        </div>
      )}

      {/* Grid Layout */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <input
            type="text"
            placeholder="Search by Product Head or Name..."
            className="w-full md:w-1/3 p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-sm">
              <tr>
                <th className="p-4 font-semibold text-slate-700">Product Head</th>
                <th className="p-4 font-semibold text-slate-700">Product Name</th>
                <th className="p-4 font-semibold text-slate-700">HSN Code</th>
                <th className="p-4 font-semibold text-slate-700">UOM</th>
                <th className="p-4 font-semibold text-slate-700">GST %</th>
                <th className="p-4 font-semibold text-slate-700">Status</th>
                <th className="p-4 font-semibold text-slate-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading records...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500 italic">No products found.</td></tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{product.product_head}</td>
                    <td className="p-4 font-medium text-slate-700">{product.name}</td>
                    <td className="p-4 text-slate-600">{product.hsn_code || '-'}</td>
                    <td className="p-4 text-slate-600">{product.uom}</td>
                    <td className="p-4 text-slate-600">{product.gst_rate}%</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
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