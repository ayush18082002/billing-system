"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Select from "react-select";
import * as XLSX from "xlsx"; 

export default function DashboardAndReport() {
  const [activeModule, setActiveModule] = useState<"customer" | "gst" | "item_price" | "products">("customer");

  const [customers, setCustomers] = useState<any[]>([]);
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [sharedDates, setSharedDates] = useState({
    startDate: firstDay.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  });

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerSalesData, setCustomerSalesData] = useState<any[]>([]);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const [selectedGstRate, setSelectedGstRate] = useState<string | null>("18");
  const [gstProductData, setGstProductData] = useState<any[]>([]);
  const [loadingGst, setLoadingGst] = useState(false);

  const [topItems, setTopItems] = useState<any[]>([]);
  const [bottomItems, setBottomItems] = useState<any[]>([]);
  const [loadingItemPrice, setLoadingItemPrice] = useState(false);

  const [productsReportData, setProductsReportData] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetchCustomers();
    generateCustomerReport(); 
    generateGstReport();
    generateItemPriceReport();
    generateProductsReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    generateGstReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGstRate]);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('business_name');
    if (data) setCustomers(data);
  };

  const fetchSalesDataInRange = async (startDate: string, endDate: string, customerId: string | null = null) => {
    let query = supabase
      .from('quotations')
      .select('id, bill_no, bill_date, customer_id, customers!fk_quotation_customer(business_name)')
      .eq('is_active', true)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    if (customerId) query = query.eq('customer_id', customerId);

    const { data: bills, error: billsError } = await query;
    if (billsError || !bills || bills.length === 0) return { bills: [], lineItems: [] };

    const billIds = bills.map(b => b.id);
    const { data: lineItems } = await supabase
      .from('quotation_line_items')
      .select('*, products(product_head, name)')
      .in('quotation_id', billIds);

    return { bills, lineItems: lineItems || [] };
  };

  const generateCustomerReport = async () => {
    setLoadingCustomer(true);
    const { bills, lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate, selectedCustomer);

    const combinedData = lineItems.map(item => {
      const parentBill = bills.find(b => b.id === item.quotation_id);
      
      // FIXED: Safely extract customer name whether it's an array or an object
      let cName = 'Unknown';
      if (parentBill && parentBill.customers) {
        const cData: any = parentBill.customers;
        cName = Array.isArray(cData) ? cData[0]?.business_name : cData.business_name;
      }

      return {
        id: item.id,
        bill_no: parentBill?.bill_no || 'Unknown',
        bill_date: parentBill?.bill_date || '',
        customer_name: cName || 'Unknown',
        product_head: item.products?.product_head || 'N/A',
        product_name: item.products?.name || 'Deleted Product',
        qty: item.qty,
        rate: item.rate, 
        taxable_amount: item.taxable_amount 
      };
    });

    combinedData.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
    setCustomerSalesData(combinedData);
    setLoadingCustomer(false);
  };

  const generateGstReport = async () => {
    setLoadingGst(true);
    let query = supabase.from('products').select('*');
    if (selectedGstRate) query = query.eq('gst_rate', Number(selectedGstRate));

    const { data } = await query.order('product_head').order('name');
    setGstProductData(data || []);
    setLoadingGst(false);
  };

  const generateItemPriceReport = async () => {
    setLoadingItemPrice(true);
    const { lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate);

    const itemRates = lineItems.map(item => ({
      product_name: item.products?.name || 'Deleted Product',
      product_head: item.products?.product_head || 'N/A',
      rate: Number(item.rate)
    }));

    const sortedDesc = [...itemRates].sort((a, b) => b.rate - a.rate);
    const uniqueHighest: any[] = [];
    const seenHigh = new Set();
    for (let item of sortedDesc) {
      if (!seenHigh.has(item.product_name)) {
        seenHigh.add(item.product_name);
        uniqueHighest.push(item);
        if (uniqueHighest.length === 10) break;
      }
    }

    const sortedAsc = [...itemRates].sort((a, b) => a.rate - b.rate);
    const uniqueLowest: any[] = [];
    const seenLow = new Set();
    for (let item of sortedAsc) {
      if (!seenLow.has(item.product_name)) {
        seenLow.add(item.product_name);
        uniqueLowest.push(item);
        if (uniqueLowest.length === 10) break; 
      }
    }

    setTopItems(uniqueHighest);
    setBottomItems(uniqueLowest);
    setLoadingItemPrice(false);
  };

  const generateProductsReport = async () => {
    setLoadingProducts(true);
    const { bills, lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate);

    const grouped: Record<string, any> = {};

    lineItems.forEach(item => {
      const parentBill = bills.find(b => b.id === item.quotation_id);
      if (!parentBill) return;

      // FIXED: Safely extract customer name whether it's an array or an object
      let cName = 'Unknown';
      if (parentBill.customers) {
        const cData: any = parentBill.customers;
        cName = Array.isArray(cData) ? cData[0]?.business_name : cData.business_name;
      }

      const productName = item.products?.name || 'Deleted Product';
      const key = `${parentBill.bill_no}_${productName}_${item.rate}`;

      if (!grouped[key]) {
        grouped[key] = {
          bill_no: parentBill.bill_no,
          bill_date: parentBill.bill_date,
          customer_name: cName || 'Unknown',
          product_name: productName,
          qty: 0,
          rate: Number(item.rate)
        };
      }
      grouped[key].qty += Number(item.qty);
    });

    const finalizedData = Object.values(grouped).sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
    
    setProductsReportData(finalizedData);
    setLoadingProducts(false);
  };

  const handleExport = (module: string) => {
    const wb = XLSX.utils.book_new(); 

    if (module === 'customer') {
      if (customerSalesData.length === 0) return alert("No data to export!");
      const wsData = customerSalesData.map(row => ({
        "Date": new Date(row.bill_date).toLocaleDateString('en-IN'),
        "Customer Name": row.customer_name,
        "Bill No": row.bill_no,
        "Product Head": row.product_head,
        "Product Name": row.product_name,
        "Qty": row.qty,
        "Unit Rate": row.rate,
        "Total w/o GST": row.taxable_amount
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Customer Sales");
      XLSX.writeFile(wb, `Customer_Sales_Report_${sharedDates.startDate}_to_${sharedDates.endDate}.xlsx`);
    } 
    
    else if (module === 'gst') {
      if (gstProductData.length === 0) return alert("No data to export!");
      const wsData = gstProductData.map(row => ({
        "Product Head": row.product_head,
        "Product Name": row.name,
        "HSN Code": row.hsn_code,
        "UOM": row.uom,
        "Status": row.is_active ? "Active" : "Inactive"
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, `${selectedGstRate}% GST Products`);
      XLSX.writeFile(wb, `GST_${selectedGstRate}Percent_Products.xlsx`);
    } 
    
    else if (module === 'item_price') {
      if (topItems.length === 0 && bottomItems.length === 0) return alert("No data to export!");
      
      const wsData1 = topItems.map((row, idx) => ({
        "Rank": `#${idx + 1}`,
        "Product Head": row.product_head,
        "Product Name": row.product_name,
        "Selling Price": row.rate
      }));
      const ws1 = XLSX.utils.json_to_sheet(wsData1);
      XLSX.utils.book_append_sheet(wb, ws1, "Highest Prices");

      const wsData2 = bottomItems.map((row, idx) => ({
        "Rank": `#${idx + 1}`,
        "Product Head": row.product_head,
        "Product Name": row.product_name,
        "Selling Price": row.rate
      }));
      const ws2 = XLSX.utils.json_to_sheet(wsData2);
      XLSX.utils.book_append_sheet(wb, ws2, "Lowest Prices");

      XLSX.writeFile(wb, `Item_Pricing_Report.xlsx`);
    } 
    
    else if (module === 'products') {
      if (productsReportData.length === 0) return alert("No data to export!");
      const wsData = productsReportData.map(row => ({
        "Bill No": row.bill_no,
        "Customer Name": row.customer_name,
        "Product Name": row.product_name,
        "Qty Sold": row.qty,
        "Single Rate": row.rate
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Cumulative Sales");
      XLSX.writeFile(wb, `Cumulative_Products_Report_${sharedDates.startDate}_to_${sharedDates.endDate}.xlsx`);
    }
  };

  const totalTaxableRevenue = customerSalesData.reduce((sum, row) => sum + Number(row.taxable_amount), 0);
  const totalItemsSold = customerSalesData.reduce((sum, row) => sum + Number(row.qty), 0);
  const uniqueBills = new Set(customerSalesData.map(r => r.bill_no)).size;
  const totalGstProducts = gstProductData.length;
  const activeGstProducts = gstProductData.filter(p => p.is_active).length;

  const customerDropdownOptions = [{ value: null, label: "-- All Customers --" }, ...customers.map(c => ({ value: c.id, label: c.business_name }))];
  const gstDropdownOptions = [{ value: "0", label: "0% Exempted" }, { value: "5", label: "5% GST Slab" }, { value: "12", label: "12% GST Slab" }, { value: "18", label: "18% GST Slab" }, { value: "28", label: "28% GST Slab" }];

  return (
    <>
      {/* --- PRINT STYLES WITH TABLE FIXES --- */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * { visibility: hidden; }
            #printable-report, #printable-report * { visibility: visible; }
            #printable-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            
            /* Table Wrapping Fixes for Print */
            .overflow-x-auto { overflow: visible !important; }
            table { width: 100% !important; table-layout: auto !important; font-size: 11px !important; }
            th, td { 
              padding: 6px 4px !important; 
              white-space: normal !important; 
              word-break: break-word !important; 
            }
            .truncate { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; max-width: none !important; }
          }
        `
      }} />

      <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-8">
        
        {/* HEADER & WORKSPACE TOGGLE */}
        <div className="no-print">
          <h1 className="text-3xl font-bold text-slate-800">Dashboard & Reports</h1>
          <p className="text-slate-500 mt-1 mb-6">Select a module below to view its specific dashboard and deep-dive reports.</p>
          
          <div className="flex border-b border-slate-300 overflow-x-auto whitespace-nowrap">
            <button onClick={() => setActiveModule("customer")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "customer" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>🏢 Customer</button>
            <button onClick={() => setActiveModule("gst")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "gst" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>% GST</button>
            <button onClick={() => setActiveModule("item_price")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "item_price" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>📈 Item Price</button>
            <button onClick={() => setActiveModule("products")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "products" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>📦 Products</button>
          </div>
        </div>

        {/* CONTAINER FOR PRINTING */}
        <div id="printable-report">
          
          {/* ========================================================= */}
          {/* WORKSPACE 1: CUSTOMER MODULE */}
          {/* ========================================================= */}
          {activeModule === "customer" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">Customer Report Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div className="md:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Target Customer</label><Select options={customerDropdownOptions} value={customerDropdownOptions.find(c => c.value === selectedCustomer) || customerDropdownOptions[0]} onChange={(option: any) => setSelectedCustomer(option?.value)} className="text-sm" /></div>
                  <div className="md:col-span-4 flex justify-end"><button onClick={generateCustomerReport} disabled={loadingCustomer} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors shadow-sm">{loadingCustomer ? "Extracting Data..." : "Apply Customer Filters"}</button></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-blue-600"><p className="text-sm font-medium text-slate-500">Taxable Revenue (w/o GST)</p><p className="text-3xl font-bold text-slate-800 mt-1">₹{totalTaxableRevenue.toFixed(2)}</p></div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-emerald-500"><p className="text-sm font-medium text-slate-500">Total Volume Sold (Qty)</p><p className="text-3xl font-bold text-slate-800 mt-1">{totalItemsSold}</p></div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-purple-500"><p className="text-sm font-medium text-slate-500">Associated Bills</p><p className="text-3xl font-bold text-slate-800 mt-1">{uniqueBills}</p></div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-semibold text-slate-800">Customer Sales Ledger <span className="text-xs font-normal text-slate-500 block print:hidden">({sharedDates.startDate} to {sharedDates.endDate})</span></h3>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => handleExport('customer')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">📥 Excel</button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider">
                      <tr><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Bill No.</th><th className="p-4">Product Head</th><th className="p-4">Product Name</th><th className="p-4 text-center">Qty</th><th className="p-4 text-right">Unit Rate</th><th className="p-4 text-right">Total (w/o GST)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs md:text-sm">
                      {loadingCustomer ? (<tr><td colSpan={8} className="p-10 text-center font-medium">Processing logs...</td></tr>) : customerSalesData.length === 0 ? (<tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">No transactions identified within selection range.</td></tr>) : (
                        customerSalesData.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">{new Date(row.bill_date).toLocaleDateString('en-IN')}</td><td className="p-4 font-medium text-slate-700 truncate max-w-[200px] whitespace-normal">{row.customer_name}</td>
                            <td className="p-4 font-bold text-slate-800">{row.bill_no}</td><td className="p-4 text-slate-500">{row.product_head}</td>
                            <td className="p-4">{row.product_name}</td><td className="p-4 text-center font-medium">{row.qty}</td>
                            <td className="p-4 text-right">₹{Number(row.rate).toFixed(2)}</td><td className="p-4 text-right font-bold text-blue-600">₹{Number(row.taxable_amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* WORKSPACE 2: GST% MODULE */}
          {/* ========================================================= */}
          {activeModule === "gst" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-xl no-print">
                <h3 className="font-semibold text-slate-800 mb-3 text-sm">Tax Bracket Engine</h3>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select Active GST Slab</label>
                <Select options={gstDropdownOptions} value={gstDropdownOptions.find(o => o.value === selectedGstRate)} onChange={(option: any) => setSelectedGstRate(option?.value || null)} className="text-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-purple-600"><p className="text-sm font-medium text-slate-500">Total Products in Bracket</p><p className="text-3xl font-bold text-slate-800 mt-1">{totalGstProducts}</p></div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500"><p className="text-sm font-medium text-slate-500">Active Status</p><p className="text-3xl font-bold text-slate-800 mt-1"><span className="text-emerald-600">{activeGstProducts}</span><span className="text-slate-300 font-light mx-2">/</span><span className="text-red-500">{totalGstProducts - activeGstProducts}</span></p></div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">Product Mapping Matrix <span className="text-xs font-normal text-slate-500 ml-2">({selectedGstRate}% GST Slab)</span></h3>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => handleExport('gst')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">📥 Excel</button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider">
                      <tr><th className="p-4 w-12 text-center">#</th><th className="p-4">Product Head</th><th className="p-4">Product Name</th><th className="p-4">HSN/SAC Code</th><th className="p-4 text-center">UOM</th><th className="p-4 text-center">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs md:text-sm">
                      {loadingGst ? (<tr><td colSpan={6} className="p-10 text-center font-medium">Scanning warehouse...</td></tr>) : gstProductData.length === 0 ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">No products cataloged.</td></tr>) : (
                        gstProductData.map((prod, idx) => (
                          <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-center text-slate-400 font-medium">{idx + 1}</td><td className="p-4 font-bold text-slate-800">{prod.product_head || 'General'}</td><td className="p-4 font-medium text-slate-700">{prod.name}</td>
                            <td className="p-4 text-slate-500 tracking-mono">{prod.hsn_code || 'N/A'}</td><td className="p-4 text-center">{prod.uom}</td>
                            <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${prod.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{prod.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* WORKSPACE 3: ITEM PRICE MODULE */}
          {/* ========================================================= */}
          {activeModule === "item_price" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">Date Range Filter</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div className="flex justify-end"><button onClick={generateItemPriceReport} disabled={loadingItemPrice} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors w-full md:w-auto shadow-sm">{loadingItemPrice ? "Scanning..." : "Fetch Pricing Logs"}</button></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 no-print">
                <button onClick={() => handleExport('item_price')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded text-xs font-bold uppercase transition-colors">📥 Export to Excel</button>
                <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print Both</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Highest Price Table */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="font-semibold text-emerald-700">Top 10 Highest Price Items</h3></div>
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider">
                      <tr><th className="p-3">Rank</th><th className="p-3">Product Name</th><th className="p-3 text-right">Selling Price</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingItemPrice ? (<tr><td colSpan={3} className="p-6 text-center">Loading...</td></tr>) : topItems.length === 0 ? (<tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">No sales data.</td></tr>) : (
                        topItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-emerald-50"><td className="p-3 font-bold text-slate-400">#{idx + 1}</td><td className="p-3 font-medium text-slate-700">{item.product_name}</td><td className="p-3 text-right font-bold text-emerald-600">₹{item.rate.toFixed(2)}</td></tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Lowest Price Table */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="font-semibold text-red-700">Lowest Price Items</h3></div>
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider">
                      <tr><th className="p-3">Rank</th><th className="p-3">Product Name</th><th className="p-3 text-right">Selling Price</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingItemPrice ? (<tr><td colSpan={3} className="p-6 text-center">Loading...</td></tr>) : bottomItems.length === 0 ? (<tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">No sales data.</td></tr>) : (
                        bottomItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-red-50"><td className="p-3 font-bold text-slate-400">#{idx + 1}</td><td className="p-3 font-medium text-slate-700">{item.product_name}</td><td className="p-3 text-right font-bold text-red-600">₹{item.rate.toFixed(2)}</td></tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* WORKSPACE 4: PRODUCTS MODULE */}
          {/* ========================================================= */}
          {activeModule === "products" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">Date Range Filter</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div className="flex justify-end"><button onClick={generateProductsReport} disabled={loadingProducts} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors w-full md:w-auto shadow-sm">{loadingProducts ? "Extracting..." : "Generate Products Report"}</button></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-semibold text-slate-800">Cumulative Product Sales <span className="text-xs font-normal text-slate-500 ml-2 block print:hidden">({sharedDates.startDate} to {sharedDates.endDate})</span></h3>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => handleExport('products')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">📥 Excel</button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider">
                      <tr><th className="p-4">Bill No.</th><th className="p-4">Customer</th><th className="p-4">Product Name</th><th className="p-4 text-center">Qty Sold (Cumulative)</th><th className="p-4 text-right">Single Rate</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs md:text-sm">
                      {loadingProducts ? (<tr><td colSpan={5} className="p-10 text-center font-medium">Aggregating line items...</td></tr>) : productsReportData.length === 0 ? (<tr><td colSpan={5} className="p-10 text-center text-slate-400 italic">No sales found in this period.</td></tr>) : (
                        productsReportData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{row.bill_no}</td><td className="p-4 font-medium text-slate-700 whitespace-normal">{row.customer_name}</td>
                            <td className="p-4">{row.product_name}</td><td className="p-4 text-center font-bold text-blue-600">{row.qty}</td>
                            <td className="p-4 text-right font-medium">₹{row.rate.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div> 
      </div>
    </>
  );
}