"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; 

export default function ProductsMaster() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // UPDATED: New Form State structure
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    utility: "", 
    hsn_code: "",
    uom: "PCS",       
    gst_rate: "18"    
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true) 
      .order('created_at', { ascending: false }); 
    
    if (error) {
      console.error("Error fetching products:", error);
    } else if (data) {
      setProductsList(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditClick = (product: any) => {
    setFormData({
      name: product.name || "",
      description: product.description || "",
      utility: product.utility || "",
      hsn_code: product.hsn_code || "",
      uom: product.uom || "PCS",
      gst_rate: product.gst_rate || "18"
    });
    setEditingId(product.id); 
    setIsModalOpen(true);
  };

  const handleArchiveClick = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this product?")) return;

    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) {
      alert("Database Error: " + error.message);
    } else {
      fetchProducts(); 
    }
  };

  const resetForm = () => {
    setFormData({
      name: "", description: "", utility: "", hsn_code: "", uom: "PCS", gst_rate: "18"
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    
    // UPDATED: Duplicate check now looks at the Product Name
    const isDuplicate = productsList.some(
      (p) => (p.name || "").toLowerCase() === (formData.name || "").toLowerCase() && p.id !== editingId
    );

    if (isDuplicate) {
      alert("Validation Error: A product with this name already exists.");
      return; 
    }

    if (editingId) {
      const { error } = await supabase.from('products')
        .update({
          name: formData.name,
          description: formData.description,
          utility: formData.utility,
          hsn_code: formData.hsn_code,
          uom: formData.uom,
          gst_rate: formData.gst_rate
        }).eq('id', editingId); 

      if (error) { alert("Error: " + error.message); return; }
      alert("Product updated successfully!");
    } else {
      const { error } = await supabase.from('products')
        .insert([{
          name: formData.name,
          description: formData.description,
          utility: formData.utility,
          hsn_code: formData.hsn_code,
          uom: formData.uom,
          gst_rate: formData.gst_rate
        }]);

      if (error) { alert("Error: " + error.message); return; }
      alert("Success! Product permanently saved to database.");
    }
    
    fetchProducts(); 
    resetForm();
  };

  // UPDATED: Search checks Name, Description, HSN, and Utility
  const filteredProducts = productsList.filter((product) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (product.name && product.name.toLowerCase().includes(searchLower)) ||
      (product.description && product.description.toLowerCase().includes(searchLower)) ||
      (product.hsn_code && product.hsn_code.toLowerCase().includes(searchLower)) ||
      (product.utility && product.utility.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Products Master</h2>
          <p className="text-slate-500 text-sm mt-1">Manage your inventory, categories, HSN codes, and tax rates.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          + Add New Product
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input 
            type="text" 
            placeholder="Search by Name, Description, Category, or HSN Code..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 pl-4 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-800">
              <tr>
                <th className="p-4 font-semibold">Product Name</th>
                <th className="p-4 font-semibold min-w-[200px]">Description</th>
                <th className="p-4 font-semibold">Category (Utility)</th>
                <th className="p-4 font-semibold">HSN Code</th>
                <th className="p-4 font-semibold">UoM</th>
                <th className="p-4 font-semibold">GST %</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    {searchTerm ? "No products found matching your search." : "No products found. Click 'Add New Product' to get started."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{product.name}</td>
                    <td className="p-4 truncate max-w-xs" title={product.description}>{product.description}</td>
                    <td className="p-4">
                      {product.utility && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {product.utility}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-500">{product.hsn_code || '-'}</td>
                    <td className="p-4">{product.uom}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.gst_rate}%
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleEditClick(product)} className="text-blue-600 hover:text-blue-800 font-medium mr-4">Edit</button>
                      <button onClick={() => handleArchiveClick(product.id)} className="text-red-600 hover:text-red-800 font-medium">Archive</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">
              {editingId ? "Edit Product" : "Add New Product"}
            </h3>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input name="name" value={formData.name} onChange={handleChange} required type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Premium Bearing 50mm" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Detailed specifications, brand, dimensions, etc." />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category (Utility Parent)</label>
                <input name="utility" value={formData.utility} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., HVAC, Refrigerator, Auto" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">HSN / SAC Code</label>
                <input name="hsn_code" value={formData.hsn_code} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., 8415" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit of Measure (UoM)</label>
                <select name="uom" value={formData.uom} onChange={handleChange} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="NOS">NOS (Numbers)</option>
                  <option value="KGS">KGS (Kilograms)</option>
                  <option value="LTR">LTR (Liters)</option>
                  <option value="MTR">MTR (Meters)</option>
                  <option value="HRS">HRS (Hours)</option>
                  <option value="DOZ">DOZ (Dozen)</option>
                  <option value="SET">SET (Sets)</option>
                  <option value="BOX">BOX (Boxes)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GST Rate (%)</label>
                <select name="gst_rate" value={formData.gst_rate} onChange={handleChange} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div className="md:col-span-2 mt-6 flex justify-end gap-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm">
                  {editingId ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}