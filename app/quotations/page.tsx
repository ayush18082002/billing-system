"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function BillingDashboard() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    const { data, error } = await supabase
      .from('quotations')
      .select('*, customers!fk_quotation_customer(business_name)')
      .eq('is_active', true) 
      .order('bill_date', { ascending: false });

    if (error) {
      console.error("Error fetching bills:", error);
    } else if (data) {
      setQuotations(data);
    }
    setLoading(false);
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this bill? It will be hidden from the dashboard.")) {
      return;
    }

    const { error } = await supabase
      .from('quotations')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      alert("Error archiving bill: " + error.message);
    } else {
      fetchQuotations(); 
    }
  };

  const filteredQuotes = quotations.filter((q) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (q.bill_no && q.bill_no.toLowerCase().includes(searchLower)) ||
      (q.customers?.business_name && q.customers.business_name.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="flex flex-col gap-6 relative max-w-7xl mx-auto p-4 md:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-lg shadow-sm border border-slate-200 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Billing Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Manage, search, edit, and print your generated bills.</p>
        </div>
        <button 
          onClick={() => router.push('/quotations/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors shadow-sm whitespace-nowrap"
        >
          + Create New Bill
        </button>
      </div>

      {/* DATA GRID */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input 
            type="text" 
            placeholder="Search by Bill No. or Customer Name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 border border-slate-300 rounded-md p-2 pl-4 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-800">
              <tr>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold">Bill No.</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold text-right">Taxable Amount</th>
                <th className="p-4 font-semibold text-right">Grand Total</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Loading records...</td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                    {searchTerm ? "No bills found matching your search." : "No active bills found. Click 'Create New Bill' to get started."}
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700">
                      {quote.bill_date ? new Date(quote.bill_date).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td className="p-4 font-bold text-slate-800">{quote.bill_no}</td>
                    <td className="p-4 truncate max-w-[250px]">{quote.customers?.business_name || 'Unknown'}</td>
                    <td className="p-4 text-right">₹{Number(quote.subtotal).toFixed(2)}</td>
                    <td className="p-4 text-right font-bold text-blue-600">₹{Number(quote.grand_total).toFixed(2)}</td>
                    
                    {/* ACTIONS COLUMN WITH EDIT BUTTON */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => router.push(`/quotations/${quote.id}`)} 
                          className="text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          🖨️ View
                        </button>
                        
                        <button 
                          onClick={() => router.push(`/quotations/${quote.id}/edit`)} 
                          className="text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          ✏️ Edit
                        </button>

                        <button 
                          onClick={() => handleArchive(quote.id)} 
                          className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          🗑️ Archive
                        </button>
                      </div>
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