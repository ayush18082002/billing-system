"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Select from "react-select";
import * as XLSX from "xlsx"; 

export default function DashboardAndReport() {
  const [activeModule, setActiveModule] = useState<"customer" | "gst_report" | "gstr1" | "eway_bill" | "item_price" | "products">("customer");

  // --- SHARED STATE ---
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [sharedDates, setSharedDates] = useState({
    startDate: firstDay.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  });

  // --- MASTER DATA LISTS ---
  const [customers, setCustomers] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // --- CUSTOMER MODULE STATE ---
  const [showLedger, setShowLedger] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerSalesData, setCustomerSalesData] = useState<any[]>([]);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // --- GST % REPORT MODULE STATE ---
  const [selectedGstRate, setSelectedGstRate] = useState<string | null>("18");
  const [gstReportData, setGstReportData] = useState<any[]>([]);
  const [loadingGst, setLoadingGst] = useState(false);

  // --- ITEM PRICE MODULE STATE ---
  const [topItems, setTopItems] = useState<any[]>([]);
  const [bottomItems, setBottomItems] = useState<any[]>([]);
  const [loadingItemPrice, setLoadingItemPrice] = useState(false);

  // --- PRODUCTS MODULE STATE ---
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [productsReportData, setProductsReportData] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetchMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMasterData = async () => {
    const { data: custData } = await supabase.from('customers').select('*').order('business_name');
    if (custData) setCustomers(custData);

    const { data: prodData } = await supabase.from('products').select('*').order('name');
    if (prodData) {
      setProductsList(prodData);
      if (prodData.length > 0) setSelectedProduct(prodData[0].id);
    }
  };

  // --- MASTER DATA FETCHER ---
  const fetchSalesDataInRange = async (startDate: string, endDate: string, customerId: string | null = null) => {
    let query = supabase
      .from('quotations')
      .select('id, bill_no, bill_date, customer_id, customers!fk_quotation_customer(business_name, gstin, state_code, state_name)')
      .eq('is_active', true)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    if (customerId) query = query.eq('customer_id', customerId);

    const { data: bills, error: billsError } = await query;
    if (billsError || !bills || bills.length === 0) return { bills: [], lineItems: [] };

    const billIds = bills.map(b => b.id);
    const { data: lineItems } = await supabase
      .from('quotation_line_items')
      .select('*, products(product_head, name, hsn_code)')
      .in('quotation_id', billIds);

    return { bills, lineItems: lineItems || [] };
  };

  // =========================================================================
  // REPORT GENERATORS
  // =========================================================================
  const generateCustomerReport = async () => {
    setLoadingCustomer(true);
    const { bills, lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate, selectedCustomer);

    const combinedData = lineItems.map(item => {
      const parentBill = bills.find(b => b.id === item.quotation_id);
      const cData: any = parentBill?.customers;
      
      const cName = Array.isArray(cData) ? cData[0]?.business_name : cData?.business_name;
      const cGstin = Array.isArray(cData) ? cData[0]?.gstin : cData?.gstin;
      const stateCode = Array.isArray(cData) ? cData[0]?.state_code : cData?.state_code;
      const stateName = Array.isArray(cData) ? cData[0]?.state_name : cData?.state_name;
      const cState = (stateCode && stateName) ? `${stateCode}-${stateName}` : '07-Delhi';

      return {
        id: item.id,
        bill_no: parentBill?.bill_no || 'Unknown',
        bill_date: parentBill?.bill_date || '',
        customer_name: cName || 'Unknown',
        customer_gstin: cGstin || 'URP', 
        place_of_supply: cState,
        product_head: item.products?.product_head || 'N/A',
        product_name: item.products?.name || 'Deleted Product',
        hsn_code: item.products?.hsn_code || '000000',
        qty: item.qty,
        rate: item.rate, 
        gst_percent: item.gst_percent || 18,
        taxable_amount: item.taxable_amount 
      };
    });

    combinedData.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
    setCustomerSalesData(combinedData);
    setLoadingCustomer(false);
  };

  const generateGstReport = async () => {
    setLoadingGst(true);
    const { lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate);
    const filteredItems = lineItems.filter(item => Number(item.gst_percent) === Number(selectedGstRate));

    const grouped: Record<string, any> = {};
    filteredItems.forEach(item => {
      const pName = item.products?.name || 'Deleted Product';
      if (!grouped[pName]) grouped[pName] = { product_name: pName, qty: 0, taxable_amount: 0 };
      grouped[pName].qty += Number(item.qty);
      grouped[pName].taxable_amount += Number(item.taxable_amount);
    });

    setGstReportData(Object.values(grouped).sort((a, b) => b.taxable_amount - a.taxable_amount));
    setLoadingGst(false);
  };

  const generateItemPriceReport = async () => {
    setLoadingItemPrice(true);
    const { lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate);
    const itemRates = lineItems.map(item => ({ product_name: item.products?.name || 'Deleted Product', product_head: item.products?.product_head || 'N/A', rate: Number(item.rate) }));
    setTopItems([...itemRates].sort((a, b) => b.rate - a.rate).slice(0, 10));
    setBottomItems([...itemRates].sort((a, b) => a.rate - b.rate).slice(0, 10));
    setLoadingItemPrice(false);
  };

  const generateProductsReport = async () => {
    setLoadingProducts(true);
    const { bills, lineItems } = await fetchSalesDataInRange(sharedDates.startDate, sharedDates.endDate);
    const specificItemSales = lineItems.filter(item => item.product_id === selectedProduct);

    const detailedData = specificItemSales.map(item => {
      const parentBill = bills.find(b => b.id === item.quotation_id);
      return { id: item.id, bill_no: parentBill?.bill_no || 'Unknown', bill_date: parentBill?.bill_date || '', product_name: item.products?.name || 'Deleted Product', qty: Number(item.qty), rate: Number(item.rate), taxable_amount: Number(item.taxable_amount) };
    });

    detailedData.sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());
    setProductsReportData(detailedData);
    setLoadingProducts(false);
  };

  // =========================================================================
  // STANDARD EXPORTS & EXCEL MAPPERS
  // =========================================================================
  const handleExport = (module: string) => {
    const wb = XLSX.utils.book_new(); 

    if (module === 'customer') {
      if (customerSalesData.length === 0) return alert("No data to export!");
      const wsData = customerSalesData.map(row => ({ "Date": new Date(row.bill_date).toLocaleDateString('en-IN'), "Customer Name": row.customer_name, "Bill No": row.bill_no, "Product Head": row.product_head, "Product Name": row.product_name, "Qty": row.qty, "Unit Rate": row.rate, "Total w/o GST": row.taxable_amount }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Customer Sales");
      XLSX.writeFile(wb, `Customer_Sales_Report_${sharedDates.startDate}_to_${sharedDates.endDate}.xlsx`);
    } 
    else if (module === 'gst_report') {
      if (gstReportData.length === 0) return alert("No data to export!");
      const wsData = gstReportData.map(row => ({ "Product Name": row.product_name, "Total Qty Sold": row.qty, "Total Taxable Amount": row.taxable_amount }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, `${selectedGstRate}% GST Sales`);
      XLSX.writeFile(wb, `GST_${selectedGstRate}Percent_Sales_${sharedDates.startDate}.xlsx`);
    } 
    else if (module === 'item_price') {
      if (topItems.length === 0 && bottomItems.length === 0) return alert("No data to export!");
      const ws1 = XLSX.utils.json_to_sheet(topItems.map((row, idx) => ({ "Rank": `#${idx + 1}`, "Product Head": row.product_head, "Product Name": row.product_name, "Selling Price": row.rate })));
      XLSX.utils.book_append_sheet(wb, ws1, "Highest Prices");
      const ws2 = XLSX.utils.json_to_sheet(bottomItems.map((row, idx) => ({ "Rank": `#${idx + 1}`, "Product Head": row.product_head, "Product Name": row.product_name, "Selling Price": row.rate })));
      XLSX.utils.book_append_sheet(wb, ws2, "Lowest Prices");
      XLSX.writeFile(wb, `Item_Pricing_Report.xlsx`);
    } 
    else if (module === 'products') {
      if (productsReportData.length === 0) return alert("No data to export!");
      const wsData = productsReportData.map(row => ({ "Date": new Date(row.bill_date).toLocaleDateString('en-IN'), "Bill No": row.bill_no, "Product Name": row.product_name, "Qty Sold": row.qty, "Selling Price": row.rate, "Total Item Value": row.taxable_amount }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Product History");
      XLSX.writeFile(wb, `Product_Sales_Report_${sharedDates.startDate}_to_${sharedDates.endDate}.xlsx`);
    }
  };

  const handleExportGSTR1 = () => {
    if (customerSalesData.length === 0) return alert("No sales logs identified to compile GSTR-1.");
    const gstr1Rows = customerSalesData.map(row => {
      const invoiceDate = new Date(row.bill_date);
      const formattedDate = `${String(invoiceDate.getDate()).padStart(2, '0')}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}-${invoiceDate.getFullYear()}`;
      const rate = Number(row.gst_percent);
      const taxAmount = row.taxable_amount * (rate / 100);

      return {
        "GSTIN/UIN of Recipient": row.customer_gstin,
        "Receiver Name": row.customer_name,
        "Invoice Number": row.bill_no,
        "Invoice date": formattedDate,
        "Invoice Value": Number((row.taxable_amount + taxAmount).toFixed(2)),
        "Place Of Supply": row.place_of_supply,
        "Reverse Charge": "N",
        "Applicable % of Tax Rate": "",
        "Invoice Type": "Regular B2B",
        "E-Commerce GSTIN": "",
        "Rate": rate,
        "Taxable Value": Number(row.taxable_amount.toFixed(2)),
        "Cess Amount": 0
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(gstr1Rows);
    XLSX.utils.book_append_sheet(wb, ws, "b2b"); 
    XLSX.writeFile(wb, `GSTR1_B2B_${sharedDates.startDate}.xlsx`);
  };

  // E-Way bill logic preserved safely here for future use
  const handleExportEWayBillOffline = () => {
    const ewayEligibleData = customerSalesData.filter(row => row.taxable_amount >= 50000);
    if (ewayEligibleData.length === 0) return alert("No transactions cross the statutory threshold baseline value (₹50,000).");

    const ewayRows = ewayEligibleData.map(row => {
      const invoiceDate = new Date(row.bill_date);
      const formattedDate = `${String(invoiceDate.getDate()).padStart(2, '0')}/${String(invoiceDate.getMonth() + 1).padStart(2, '0')}/${invoiceDate.getFullYear()}`;
      
      return {
        "Supply Type": "O", "Sub Supply Type": "1", "Document Type": "INV", "Document No": row.bill_no, "Document Date": formattedDate,
        "Transaction Type": "1", "To_OtherPartyName": row.customer_name, "To_GSTIN": row.customer_gstin,
        "To_State": row.place_of_supply.split('-')[0], "Dispatch_State": "07", 
        "Product_Name": row.product_name, "Description": row.product_head, "HSN": row.hsn_code, "Unit": "NOS", "Qty": row.qty,
        "Assessable Value": Number(row.taxable_amount.toFixed(2)), "Tax Rate (CGST+SGST/IGST)": Number(row.gst_percent),
        "CGST Amount": Number((row.taxable_amount * (Number(row.gst_percent)/200)).toFixed(2)),
        "SGST Amount": Number((row.taxable_amount * (Number(row.gst_percent)/200)).toFixed(2)),
        "IGST Amount": 0, "CESS Amount": 0, "Transporter ID": "", "Transporter Name": "", "Transporter Doc No": "", "Transporter Date": "", "Vehicle No": ""
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(ewayRows);
    XLSX.utils.book_append_sheet(wb, ws, "EWAY_BILL");
    XLSX.writeFile(wb, `EWay_Bulk_Upload_${sharedDates.startDate}.xlsx`);
  };

  const customerDropdownOptions = [{ value: null, label: "-- All Customers --" }, ...customers.map(c => ({ value: c.id, label: c.business_name }))];
  const gstDropdownOptions = [{ value: "0", label: "0% Exempted" }, { value: "5", label: "5% GST Slab" }, { value: "12", label: "12% GST Slab" }, { value: "18", label: "18% GST Slab" }, { value: "28", label: "28% GST Slab" }];

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * { visibility: hidden; }
            #printable-report, #printable-report * { visibility: visible; }
            #printable-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            .overflow-x-auto { overflow: visible !important; }
            table { width: 100% !important; font-size: 11px !important; }
            th, td { padding: 6px 4px !important; word-break: break-word !important; }
          }
        `
      }} />

      <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-8">
        
        {/* HEADER & WORKSPACE TOGGLE */}
        <div className="no-print">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Dashboard & Compliance Engine</h1>
              <p className="text-slate-500 mt-1 mb-6">Centralized administration and reporting.</p>
            </div>
          </div>
          
          <div className="flex border-b border-slate-300 overflow-x-auto whitespace-nowrap hide-scrollbar">
            <button onClick={() => setActiveModule("customer")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "customer" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>🏢 Customer Ledger</button>
            <button onClick={() => setActiveModule("gst_report")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "gst_report" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>📊 % GST Tracker</button>
            <button onClick={() => setActiveModule("gstr1")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "gstr1" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>📑 GSTR-1 Govt Form</button>
            
            {/* E-WAY BILL BUTTON DISABLED SAFELY */}
            {/* <button onClick={() => setActiveModule("eway_bill")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "eway_bill" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>🚚 E-Way Bill</button> */}
            
            <button onClick={() => setActiveModule("item_price")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "item_price" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>📈 Item Price</button>
            <button onClick={() => setActiveModule("products")} className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 ${activeModule === "products" ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-md font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>📦 Products</button>
          </div>
        </div>

        {/* CONTAINER FOR PRINTING */}
        <div id="printable-report">
          
          {/* ========================================================= */}
          {/* WORKSPACE 1: CUSTOMER MODULE */}
          {/* ========================================================= */}
          {activeModule === "customer" && (
            <div className="space-y-6 animate-in fade-in duration-200">

              {/* REPORT PARAMETERS */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">Customer Sales Ledger Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div className="md:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Target Customer</label><Select options={customerDropdownOptions} value={customerDropdownOptions.find(c => c.value === selectedCustomer) || customerDropdownOptions[0]} onChange={(option: any) => setSelectedCustomer(option?.value)} className="text-sm" /></div>
                  <div className="md:col-span-4 flex justify-end"><button onClick={generateCustomerReport} disabled={loadingCustomer} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors shadow-sm">{loadingCustomer ? "Extracting Data..." : "Apply Customer Filters"}</button></div>
                </div>
              </div>

              {/* LEDGER RESULTS */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-800">Ledger Results <span className="text-xs font-normal text-slate-500 block print:hidden">({sharedDates.startDate} to {sharedDates.endDate})</span></h3>
                    <button onClick={() => setShowLedger(!showLedger)} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors no-print" title={showLedger ? "Hide Ledger" : "Show Ledger"}>
                      {showLedger ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => handleExport('customer')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">📥 Excel</button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print</button>
                  </div>
                </div>
                
                {showLedger ? (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider sticky top-0">
                        <tr><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Bill No.</th><th className="p-4">Product Name</th><th className="p-4 text-center">Qty</th><th className="p-4 text-right">Unit Rate</th><th className="p-4 text-right">Taxable Value</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs md:text-sm">
                        {loadingCustomer ? (<tr><td colSpan={7} className="p-10 text-center font-medium">Processing logs...</td></tr>) : customerSalesData.length === 0 ? (<tr><td colSpan={7} className="p-10 text-center text-slate-400 italic">No transactions identified within selection range.</td></tr>) : (
                          customerSalesData.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4">{new Date(row.bill_date).toLocaleDateString('en-IN')}</td><td className="p-4 font-medium text-slate-700 truncate max-w-[200px] whitespace-normal">{row.customer_name}</td>
                              <td className="p-4 font-bold text-slate-800">{row.bill_no}</td>
                              <td className="p-4">{row.product_name}</td><td className="p-4 text-center font-medium">{row.qty}</td>
                              <td className="p-4 text-right">₹{Number(row.rate).toFixed(2)}</td><td className="p-4 text-right font-bold text-emerald-600">₹{Number(row.taxable_amount).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 italic text-sm">Ledger hidden. Use toggle eye indicator.</div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* WORKSPACE 2: GST % AGGREGATOR MODULE */}
          {/* ========================================================= */}
          {activeModule === "gst_report" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">GST Sales Percentage Aggregator</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Tax Slab</label><Select options={gstDropdownOptions} value={gstDropdownOptions.find(o => o.value === selectedGstRate)} onChange={(option: any) => setSelectedGstRate(option?.value || null)} className="text-sm" /></div>
                  <div className="flex justify-end"><button onClick={generateGstReport} disabled={loadingGst} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors w-full shadow-sm">{loadingGst ? "Calculating..." : "Generate Slab Report"}</button></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">Sales under {selectedGstRate}% Slab</h3>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => handleExport('gst_report')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">📥 Excel</button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print</button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider sticky top-0">
                      <tr><th className="p-4">Item Name</th><th className="p-4 text-center">Total Qty Sold</th><th className="p-4 text-right">Aggregate Selling Price (Taxable)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs md:text-sm">
                      {loadingGst ? (<tr><td colSpan={3} className="p-10 text-center font-medium">Aggregating slab data...</td></tr>) : gstReportData.length === 0 ? (<tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">No items sold under this slab in the selected date range.</td></tr>) : (
                        gstReportData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{row.product_name}</td>
                            <td className="p-4 text-center font-medium text-blue-600">{row.qty}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">₹{row.taxable_amount.toFixed(2)}</td>
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
          {/* WORKSPACE 3: GSTR-1 GOVT FILING MODULE */}
          {/* ========================================================= */}
          {activeModule === "gstr1" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-4 gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">GSTR-1 Portal Return Preparatory Dashboard</h3>
                    <p className="text-xs text-slate-500">Exports direct data sheets strictly aligned into standard offline template layouts.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportGSTR1} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm transition-all">
                      📥 Download Govt Ready GSTR-1 Sheet
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm transition-all">
                      🖨️ PDF / Print
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Tax Period Start</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Tax Period End</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><button onClick={generateCustomerReport} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 text-sm rounded-md shadow-sm">Sync Audit Records</button></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50"><h4 className="font-semibold text-slate-800 text-sm">Preview GSTR-1 Mapping Output Row Matrix</h4></div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-700 sticky top-0">
                      <tr><th className="p-3">Receiver GSTIN</th><th className="p-3">Receiver Name</th><th className="p-3">Invoice No</th><th className="p-3">Date</th><th className="p-3 text-right">Taxable Value</th><th className="p-3 text-center">Tax Rate</th><th className="p-3">Place of Supply</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-600">
                      {customerSalesData.length === 0 ? (<tr><td colSpan={7} className="p-6 text-center italic text-slate-400">Zero entries loaded. Select date range parameters and hit Sync.</td></tr>) : (
                        customerSalesData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-800 uppercase">{row.customer_gstin}</td>
                            <td className="p-3 font-medium">{row.customer_name}</td>
                            <td className="p-3 font-semibold">{row.bill_no}</td>
                            <td className="p-3">{row.bill_date}</td>
                            <td className="p-3 text-right font-bold text-slate-800">₹{row.taxable_amount.toFixed(2)}</td>
                            <td className="p-3 text-center text-blue-600 font-bold">{row.gst_percent}%</td>
                            <td className="p-3 text-xs">{row.place_of_supply}</td>
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
          {/* WORKSPACE 4: E-WAY BILL UTILITY MODULE (TEMPORARILY DISABLED) */}
          {/* ========================================================= */}
          {/* activeModule === "eway_bill" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-4 gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">E-Way Bill Batch Generation Utility</h3>
                    <p className="text-xs text-slate-500">Auto-isolates and formats invoices crossing target boundaries for portal offline toolkit upload structures.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportEWayBillOffline} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm transition-all">
                      📦 Download E-Way Bulk Tool Workbook
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm transition-all">
                      🖨️ PDF / Print
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Dispatch Period Start</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Dispatch Period End</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><button onClick={generateCustomerReport} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 text-sm rounded-md shadow-sm">Sync Audit Records</button></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h4 className="font-semibold text-slate-800 text-sm">Isolated Threshold Orders (Value ≥ ₹50,000)</h4>
                  <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {customerSalesData.filter(r => r.taxable_amount >= 50000).length} Orders Found
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-700 sticky top-0">
                      <tr><th className="p-3">Bill Number</th><th className="p-3">Consignee</th><th className="p-3 font-mono">Consignee GSTIN</th><th className="p-3">Product Profile</th><th className="p-3 text-right">Taxable Worth</th><th className="p-3 text-right">Action Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-600">
                      {customerSalesData.filter(r => r.taxable_amount >= 50000).length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic font-medium">No sales matches identified inside current timeline boundary limits that exceed the ₹50,000 baseline requirement.</td></tr>
                      ) : (
                        customerSalesData.filter(r => r.taxable_amount >= 50000).map((row, idx) => (
                          <tr key={idx} className="hover:bg-purple-50/40">
                            <td className="p-3 font-bold text-slate-800">{row.bill_no}</td>
                            <td className="p-3 font-medium">{row.customer_name}</td>
                            <td className="p-3 font-mono uppercase">{row.customer_gstin}</td>
                            <td className="p-3">{row.product_name} (HSN: {row.hsn_code})</td>
                            <td className="p-3 text-right font-bold text-purple-700">₹{row.taxable_amount.toFixed(2)}</td>
                            <td className="p-3 text-right"><span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Govt Template Compliant</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) */}

          {/* ========================================================= */}
          {/* WORKSPACE 5: ITEM PRICE MODULE */}
          {/* ========================================================= */}
          {activeModule === "item_price" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">Price Fluctuation Engine</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div className="md:col-span-2 flex justify-end"><button onClick={generateItemPriceReport} disabled={loadingItemPrice} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors w-full md:w-auto shadow-sm">{loadingItemPrice ? "Scanning Rates..." : "Fetch Pricing Logs"}</button></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 no-print">
                <button onClick={() => handleExport('item_price')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded text-xs font-bold uppercase transition-colors">📥 Export to Excel</button>
                <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print Both</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="font-semibold text-emerald-700 text-sm">Top 10 Highest Price Items</h3></div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider sticky top-0"><tr><th className="p-3">Rank</th><th className="p-3">Product Name</th><th className="p-3 text-right">Selling Price</th></tr></thead>
                      <tbody className="divide-y divide-slate-200">
                        {loadingItemPrice ? (<tr><td colSpan={3} className="p-6 text-center">Loading...</td></tr>) : topItems.length === 0 ? (<tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">No records.</td></tr>) : (
                          topItems.map((item, idx) => (<tr key={idx} className="hover:bg-emerald-50"><td className="p-3 font-bold text-slate-400">#{idx + 1}</td><td className="p-3 font-medium text-slate-700">{item.product_name}</td><td className="p-3 text-right font-bold text-emerald-600">₹{item.rate.toFixed(2)}</td></tr>))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="font-semibold text-red-700 text-sm">Lowest Price Items</h3></div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider sticky top-0"><tr><th className="p-3">Rank</th><th className="p-3">Product Name</th><th className="p-3 text-right">Selling Price</th></tr></thead>
                      <tbody className="divide-y divide-slate-200">
                        {loadingItemPrice ? (<tr><td colSpan={3} className="p-6 text-center">Loading...</td></tr>) : bottomItems.length === 0 ? (<tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">No records.</td></tr>) : (
                          bottomItems.map((item, idx) => (<tr key={idx} className="hover:bg-red-50"><td className="p-3 font-bold text-slate-400">#{idx + 1}</td><td className="p-3 font-medium text-slate-700">{item.product_name}</td><td className="p-3 text-right font-bold text-red-600">₹{item.rate.toFixed(2)}</td></tr>))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* WORKSPACE 6: PRODUCTS MODULE */}
          {/* ========================================================= */}
          {activeModule === "products" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* REPORT PARAMETERS */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2 text-sm">Product Sales Tracker</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">From Date</label><input type="date" value={sharedDates.startDate} onChange={(e) => setSharedDates({...sharedDates, startDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">To Date</label><input type="date" value={sharedDates.endDate} onChange={(e) => setSharedDates({...sharedDates, endDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none" /></div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Select Product Target</label>
                    <Select options={productsList.map(p => ({ value: p.id, label: p.name }))} value={productsList.map(p => ({ value: p.id, label: p.name })).find(o => o.value === selectedProduct)} onChange={(option: any) => setSelectedProduct(option?.value)} className="text-sm" />
                  </div>
                  <div className="flex justify-end"><button onClick={generateProductsReport} disabled={loadingProducts} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 text-sm rounded-md transition-colors w-full shadow-sm">{loadingProducts ? "Tracking..." : "Track Product Sales"}</button></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Product Historic Distribution Activity Logs</h3>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => handleExport('products')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">📥 Excel</button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors">🖨️ PDF / Print</button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider sticky top-0">
                      <tr><th className="p-4">Date</th><th className="p-4">Bill No.</th><th className="p-4">Product Name</th><th className="p-4 text-center">Qty Sold</th><th className="p-4 text-right">Selling Rate</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs md:text-sm">
                      {loadingProducts ? (<tr><td colSpan={5} className="p-10 text-center font-medium">Scanning invoices...</td></tr>) : productsReportData.length === 0 ? (<tr><td colSpan={5} className="p-10 text-center text-slate-400 italic">No entries verified during targeted metric windows.</td></tr>) : (
                        productsReportData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">{new Date(row.bill_date).toLocaleDateString('en-IN')}</td><td className="p-4 font-bold text-slate-800">{row.bill_no}</td><td className="p-4">{row.product_name}</td><td className="p-4 text-center font-bold text-blue-600">{row.qty}</td><td className="p-4 text-right font-medium">₹{row.rate.toFixed(2)}</td>
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