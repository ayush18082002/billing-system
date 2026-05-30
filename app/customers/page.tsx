"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; 
import Select from "react-select"; 

export default function CustomersMaster() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stateMasterList, setStateMasterList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  
  const [formData, setFormData] = useState({
    business_name: "",
    contact_person: "",
    email: "",
    phone: "",
    pan: "", 
    gstin: "",
    billing_address: "", 
    state: "", 
    other_details: "" 
  });

  useEffect(() => {
    fetchStates();
    fetchCustomers();
  }, []);

  const fetchStates = async () => {
    const { data, error } = await supabase.from('state_master').select('*');
    if (data) setStateMasterList(data);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true) 
      .order('created_at', { ascending: false }); 
    
    if (error) {
      console.error("Error fetching customers:", error);
    } else if (data) {
      setCustomersList(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let value = e.target.value;
    if (e.target.name === 'pan' || e.target.name === 'gstin') {
      value = value.toUpperCase();
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleEditClick = (customer: any) => {
    setFormData({
      business_name: customer.business_name,
      contact_person: customer.contact_person || "",
      email: customer.email || "",
      phone: customer.phone || "",
      pan: customer.pan || "",
      gstin: customer.gstin || "",
      billing_address: customer.billing_address || "",
      state: customer.state, 
      other_details: customer.other_details || ""
    });
    setEditingId(customer.id); 
    setIsModalOpen(true);
  };

  const handleArchiveClick = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this customer?")) return;

    const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
    if (error) {
      alert("Database Error: " + error.message);
    } else {
      fetchCustomers(); 
    }
  };

  const resetForm = () => {
    setFormData({
      business_name: "", contact_person: "", email: "", phone: "",
      pan: "", gstin: "", billing_address: "", state: "", other_details: ""
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    
    if (!formData.state) {
      alert("Validation Error: Please select a State.");
      return;
    }
    if (formData.pan && formData.pan.length !== 10) {
      alert("Validation Error: PAN must be exactly 10 characters.");
      return; 
    }
    if (formData.gstin && formData.gstin.length !== 15) {
      alert("Validation Error: GSTIN must be exactly 15 characters.");
      return; 
    }

    if (editingId) {
      const { error } = await supabase.from('customers')
        .update({
          business_name: formData.business_name, contact_person: formData.contact_person,
          email: formData.email, phone: formData.phone, pan: formData.pan, 
          gstin: formData.gstin, billing_address: formData.billing_address, 
          state: formData.state, other_details: formData.other_details
        }).eq('id', editingId); 

      if (error) { alert("Error: " + error.message); return; }
      alert("Customer updated successfully!");
    } else {
      const { error } = await supabase.from('customers')
        .insert([{
          business_name: formData.business_name, contact_person: formData.contact_person,
          email: formData.email, phone: formData.phone, pan: formData.pan, 
          gstin: formData.gstin, billing_address: formData.billing_address, 
          state: formData.state, other_details: formData.other_details
        }]);

      if (error) { alert("Error: " + error.message); return; }
      alert("Success! Customer permanently saved to database.");
    }
    
    fetchCustomers(); 
    resetForm();
  };

  const stateOptions = stateMasterList.map((stateItem) => ({
    value: stateItem.id,
    label: stateItem.state_name
  }));

  const filteredCustomers = customersList.filter((customer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (customer.business_name && customer.business_name.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchLower)) ||
      (customer.gstin && customer.gstin.toLowerCase().includes(searchLower)) ||
      (customer.pan && customer.pan.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Customers Master</h2>
          <p className="text-slate-500 text-sm mt-1">Manage your clients, GSTINs, and billing addresses.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          + Add New Customer
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input 
            type="text" 
            placeholder="Search customers by Name, Email, Phone, PAN, or GSTIN..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 pl-4 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>

        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-800">
            <tr>
              <th className="p-4 font-semibold">Business Name</th>
              <th className="p-4 font-semibold">Contact Person</th>
              <th className="p-4 font-semibold">Email / Phone</th>
              <th className="p-4 font-semibold">PAN / GSTIN</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                  {searchTerm ? "No customers found matching your search." : "No customers found. Click 'Add New Customer' to get started."}
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{customer.business_name}</td>
                  <td className="p-4">{customer.contact_person || "-"}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span>{customer.email}</span>
                      <span className="text-xs text-slate-400">{customer.phone}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span>{customer.gstin || "-"}</span>
                      <span className="text-xs text-slate-400">PAN: {customer.pan || "-"}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleEditClick(customer)} className="text-blue-600 hover:text-blue-800 font-medium mr-4">Edit</button>
                    <button onClick={() => handleArchiveClick(customer.id)} className="text-red-600 hover:text-red-800 font-medium">Archive</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">
              {editingId ? "Edit Customer" : "Add New Customer"}
            </h3>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Business/Company Name</label>
                <input name="business_name" value={formData.business_name} onChange={handleChange} required type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input name="contact_person" value={formData.contact_person} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input name="email" value={formData.email} onChange={handleChange} type="email" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input name="phone" value={formData.phone} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <Select 
                  options={stateOptions}
                  value={stateOptions.find(option => option.value === formData.state) || null}
                  onChange={(selectedOption) => setFormData({ ...formData, state: selectedOption ? selectedOption.value : "" })}
                  placeholder="Type to search..."
                  isClearable
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: '#cbd5e1', 
                      borderRadius: '0.375rem', 
                      padding: '0.125rem',
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#94a3b8' }
                    })
                  }}
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
                <input name="pan" value={formData.pan} onChange={handleChange} type="text" maxLength={10} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., ABCDE1234F" />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                <input name="gstin" value={formData.gstin} onChange={handleChange} type="text" maxLength={15} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., 07ABCDE1234F1Z5" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Billing Address</label>
                <textarea name="billing_address" value={formData.billing_address} onChange={handleChange} rows={2} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Other Details (Terms, Notes)</label>
                <textarea name="other_details" value={formData.other_details} onChange={handleChange} rows={2} className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>

              <div className="col-span-2 mt-6 flex justify-end gap-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors">
                  {editingId ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}