"use client";

import InvoiceHeader from "@/components/InvoiceHeader";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Select from "react-select";
import { useRouter } from "next/navigation"; 

export default function CreateBill() {
  const router = useRouter(); 

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]); 
  
  // SLE MECHTRONICS LLP is based in Delhi (State Code 07)
  const HOME_STATE_CODE = "07"; 

  const [header, setHeader] = useState({
    qtNo: "",
    qtDate: new Date().toISOString().split('T')[0], 
    customerId: null as string | null,
    customerStateCode: null as string | null,
  });

  const [dispatch, setDispatch] = useState({
    ewayBillNo: "", 
    modeOfTransport: "", 
    poNumber: "",
    poDate: "",
    vehicleNumber: "",
    grNumber: "",
    grDate: "",
    dateOfSupply: "", 
    reverseCharge: false, 
    isConsigneeDifferent: false,
    consigneeName: "",
    consigneeAddress: "",
    consigneeGst: "",
    consigneeStateId: "", 
    consigneeStateCode: "",
  });

  const [rows, setRows] = useState([
    { id: 1, productId: null as string | null, product_head: "", uom: "", qty: 1 as number | string, rate: 0 as number | string, discountPercent: 0 as number | string, gstPercent: 0 }
  ]);

  const [charges, setCharges] = useState({
    packagingCharges: 0 as number | string,
    packagingGst: 18 as number | string,
    carrierCharges: 0 as number | string,
    carrierGst: 18 as number | string,
    otherCosts: 0 as number | string,
    otherGst: 18 as number | string
  });

  useEffect(() => {
    fetchActiveData();
    generateBillNumber();
  }, []);

  const fetchActiveData = async () => {
    const { data: custData } = await supabase.from('customers').select('*').eq('is_active', true);
    if (custData) setCustomers(custData);

    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true);
    if (prodData) setProducts(prodData);

    const { data: statesData } = await supabase.from('state_master').select('*').order('state_name');
    if (statesData) setStates(statesData);
  };

  const generateBillNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // The prefix for the new bill being generated today
    const newPrefix = `Bill-${year}-${month}-`;

    // Search for ALL bills starting with "Bill-" instead of just this month's bills
    const { data, error } = await supabase
      .from('quotations')
      .select('bill_no')
      .ilike('bill_no', 'Bill-%') 
      .order('bill_no', { ascending: false }) 
      .limit(1);

    if (data && data.length > 0 && data[0].bill_no) {
      // 1. Grabs the highest bill ever made
      // 2. Splits it by '-' and grabs the last digits
      // 3. Parses it as an integer and adds 1
      const lastSequence = parseInt(data[0].bill_no.split('-').pop(), 10);
      const nextSequence = String(lastSequence + 1).padStart(3, '0');
      
      // 4. Stitches the continuous sequence onto the CURRENT month's prefix
      setHeader(prev => ({ ...prev, qtNo: `${newPrefix}${nextSequence}` }));
    } else {
      // Fallback if the database is completely empty
      setHeader(prev => ({ ...prev, qtNo: `${newPrefix}001` }));
    }
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now(), productId: null, product_head: "", uom: "", qty: 1, rate: 0, discountPercent: 0, gstPercent: 0 }]);
  };

  const removeRow = (idToRemove: number) => {
    if (rows.length === 1) return; 
    setRows(rows.filter(row => row.id !== idToRemove));
  };

  const updateRow = (id: number, field: string, value: any) => {
    setRows(rows.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };
        
        if (field === 'productId' && value) {
          const selectedProduct = products.find(p => p.id === value);
          if (selectedProduct) {
            updatedRow.product_head = selectedProduct.product_head;
            updatedRow.uom = selectedProduct.uom;
            updatedRow.gstPercent = parseFloat(selectedProduct.gst_rate) || 0;
          }
        }
        return updatedRow;
      }
      return row;
    }));
  };

  const activeStateCode = dispatch.isConsigneeDifferent && dispatch.consigneeStateCode 
    ? dispatch.consigneeStateCode 
    : header.customerStateCode;

  const isLocal = activeStateCode === HOME_STATE_CODE || activeStateCode === "7";

  const processedRows = rows.map(row => {
    const baseValue = (Number(row.qty) || 0) * (Number(row.rate) || 0);
    const discountPercent = Number(row.discountPercent) || 0;
    
    const discountAmount = baseValue * (discountPercent / 100);
    const taxableAmount = Math.max(0, baseValue - discountAmount);
    const totalTaxAmount = taxableAmount * (row.gstPercent / 100);
    
    const cgst = isLocal ? totalTaxAmount / 2 : 0;
    const sgst = isLocal ? totalTaxAmount / 2 : 0;
    const igst = !isLocal ? totalTaxAmount : 0;
    
    const rowTotal = taxableAmount + totalTaxAmount;

    return { ...row, baseValue, discountPercent, discountAmount, taxableAmount, cgst, sgst, igst, rowTotal };
  });

  const calculateTotals = () => {
    let subtotalTaxable = 0, itemCgst = 0, itemSgst = 0, itemIgst = 0;

    processedRows.forEach(row => {
      subtotalTaxable += row.taxableAmount;
      itemCgst += row.cgst;
      itemSgst += row.sgst;
      itemIgst += row.igst;
    });

    const carrier = Number(charges.carrierCharges) || 0;
    const carrierTax = carrier * ((Number(charges.carrierGst) || 0) / 100);
    const carrierCgst = isLocal ? carrierTax / 2 : 0;
    const carrierSgst = isLocal ? carrierTax / 2 : 0;
    const carrierIgst = !isLocal ? carrierTax : 0;

    const packaging = Number(charges.packagingCharges) || 0;
    const packagingTax = packaging * ((Number(charges.packagingGst) || 0) / 100);
    const packagingCgst = isLocal ? packagingTax / 2 : 0;
    const packagingSgst = isLocal ? packagingTax / 2 : 0;
    const packagingIgst = !isLocal ? packagingTax : 0;

    const other = Number(charges.otherCosts) || 0;
    const otherTax = other * ((Number(charges.otherGst) || 0) / 100);
    const otherCgst = isLocal ? otherTax / 2 : 0;
    const otherSgst = isLocal ? otherTax / 2 : 0;
    const otherIgst = !isLocal ? otherTax : 0;

    const totalTaxableValue = subtotalTaxable + carrier + packaging + other;
    
    const finalCgst = itemCgst + carrierCgst + packagingCgst + otherCgst;
    const finalSgst = itemSgst + carrierSgst + packagingSgst + otherSgst;
    const finalIgst = itemIgst + carrierIgst + packagingIgst + otherIgst;

    const grandTotal = totalTaxableValue + finalCgst + finalSgst + finalIgst;

    return { 
      subtotalTaxable, itemCgst, itemSgst, itemIgst, 
      carrier, carrierCgst, carrierSgst, carrierIgst,
      packaging, packagingCgst, packagingSgst, packagingIgst,
      other, otherCgst, otherSgst, otherIgst,
      totalTaxableValue, finalCgst, finalSgst, finalIgst, grandTotal 
    };
  };

  const totals = calculateTotals();

  const handleSave = async () => {
    if (!header.customerId) return alert("Validation Error: Please select a Customer.");
    if (processedRows.some(row => !row.productId)) return alert("Validation Error: All rows must have a product selected.");

    const { data: quoteData, error: quoteError } = await supabase
      .from('quotations')
      .insert([{
        bill_no: header.qtNo,
        bill_date: header.qtDate, 
        customer_id: header.customerId,
        eway_bill_no: dispatch.ewayBillNo || null,
        mode_of_transport: dispatch.modeOfTransport || null,
        po_number: dispatch.poNumber || null,
        po_date: dispatch.poDate || null, 
        vehicle_number: dispatch.vehicleNumber,
        gr_number: dispatch.grNumber || null,
        gr_date: dispatch.grDate || null, 
        date_of_supply: dispatch.dateOfSupply || null, 
        reverse_charge: dispatch.reverseCharge, 
        is_consignee_different: dispatch.isConsigneeDifferent,
        consignee_name: dispatch.isConsigneeDifferent ? dispatch.consigneeName : null,
        consignee_address: dispatch.isConsigneeDifferent ? dispatch.consigneeAddress : null,
        consignee_gstin: dispatch.isConsigneeDifferent ? dispatch.consigneeGst : null,
        consignee_state: dispatch.isConsigneeDifferent ? dispatch.consigneeStateId : null,
        subtotal: totals.subtotalTaxable,
        cgst: totals.finalCgst,
        sgst: totals.finalSgst,
        igst: totals.finalIgst,
        carrier_charges: totals.carrier,
        carrier_gst: Number(charges.carrierGst) || 0,
        packaging_charges: totals.packaging,
        packaging_gst: Number(charges.packagingGst) || 0,
        other_charges: totals.other, 
        other_gst: Number(charges.otherGst) || 0,
        grand_total: totals.grandTotal
      }])
      .select() 
      .single();

    if (quoteError) return alert("Database Error (Header): " + quoteError.message);

    const lineItemsToInsert = processedRows.map(row => ({
      quotation_id: quoteData.id, 
      product_id: row.productId,
      qty: Number(row.qty) || 0,
      rate: Number(row.rate) || 0,
      discount_percent: row.discountPercent, 
      discount_amount: row.discountAmount,   
      taxable_amount: row.taxableAmount,
      gst_percent: row.gstPercent,
      cgst_amount: row.cgst,
      sgst_amount: row.sgst,
      igst_amount: row.igst,
      total_amount: row.rowTotal
    }));

    const { error: lineError } = await supabase.from('quotation_line_items').insert(lineItemsToInsert);
    if (lineError) return alert("Database Error (Line Items): " + lineError.message);

    alert("Success! Bill saved to database.");
    router.push(`/quotations`);
  };

  const customerOptions = customers.map(c => ({ value: c.id, label: `${c.business_name} (${c.gstin || 'No GSTIN'})`, stateCode: c.state_code }));
  const stateOptions = states.map(s => ({ value: s.id, label: s.state_name, code: s.state_code || s.code }));
  const productOptions = products.map(p => ({ value: p.id, label: p.product_head ? `[${p.product_head}] ${p.name}` : p.name }));

  const selectedCustomer = customers.find(c => c.id === header.customerId);
  const selectedState = states.find(s => (s.state_code || s.code) === header.customerStateCode);

  return (
    <div className="flex flex-col gap-6 relative max-w-[1400px] mx-auto p-4 md:p-8">
      
      {/* DATA ENTRY SECTION (Hidden when printing) */}
      <div className="print:hidden flex flex-col gap-6">
        
        {/* 1. HEADER SECTION */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800">Create Bill</h2>
            <div className="text-right">
              <p className="text-sm text-slate-500 font-medium">Bill No.</p>
              <p className="text-xl font-bold text-blue-600">{header.qtNo}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer (Billed To)</label>
              <Select 
                instanceId="customer-select"
                options={customerOptions}
                value={customerOptions.find(c => c.value === header.customerId) || null}
                placeholder="Search active customers..."
                onChange={(option: any) => setHeader({ ...header, customerId: option?.value, customerStateCode: option?.stateCode })}
                isClearable
                className="text-slate-900"
              />
              {header.customerId && (
                <p className="mt-2 text-xs font-medium px-2 py-1 inline-block rounded bg-slate-100 text-slate-600">
                  Tax Bracket: <span className={`font-bold ${isLocal ? 'text-blue-600' : 'text-purple-600'}`}>
                    {isLocal ? "Local (CGST/SGST)" : "Interstate (IGST)"}
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Document Date</label>
              <input 
                type="date" 
                value={header.qtDate}
                onChange={(e) => setHeader({ ...header, qtDate: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              />
            </div>
          </div>
        </div>

        {/* 2. DISPATCH & CONSIGNEE SECTION */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 border-b border-slate-200 pb-3 mb-4">Dispatch & Order Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">E-Way Bill No. (Optional)</label>
              <input type="text" value={dispatch.ewayBillNo} onChange={(e) => setDispatch({...dispatch, ewayBillNo: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase text-slate-900 bg-white" placeholder="e.g. 123456789012" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mode of Transport</label>
              <input type="text" value={dispatch.modeOfTransport} onChange={(e) => setDispatch({...dispatch, modeOfTransport: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" placeholder="e.g. Road, Train, Hand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">PO Number (Optional)</label>
              <input type="text" value={dispatch.poNumber} onChange={(e) => setDispatch({...dispatch, poNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" placeholder="e.g., PO-4099" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">PO Date (Optional)</label>
              <input type="date" value={dispatch.poDate} onChange={(e) => setDispatch({...dispatch, poDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Number</label>
              <input type="text" value={dispatch.vehicleNumber} onChange={(e) => setDispatch({...dispatch, vehicleNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" placeholder="e.g., DL 1A 1234" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GR / RR No. (Optional)</label>
              <input type="text" value={dispatch.grNumber} onChange={(e) => setDispatch({...dispatch, grNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GR Date (Optional)</label>
              <input type="date" value={dispatch.grDate} onChange={(e) => setDispatch({...dispatch, grDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date of Supply (Optional)</label>
              <input type="date" value={dispatch.dateOfSupply} onChange={(e) => setDispatch({...dispatch, dateOfSupply: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="consigneeCheck"
                checked={dispatch.isConsigneeDifferent}
                onChange={(e) => setDispatch({...dispatch, isConsigneeDifferent: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="consigneeCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
                Consignee (Shipped To) is different from Customer
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="reverseChargeCheck"
                checked={dispatch.reverseCharge}
                onChange={(e) => setDispatch({...dispatch, reverseCharge: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="reverseChargeCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
                Tax is payable on Reverse Charge
              </label>
            </div>
          </div>

          {dispatch.isConsigneeDifferent && (
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Consignee Name</label>
                <input type="text" value={dispatch.consigneeName} onChange={(e) => setDispatch({...dispatch, consigneeName: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" placeholder="Name of the receiving party" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Shipping Address</label>
                <input type="text" value={dispatch.consigneeAddress} onChange={(e) => setDispatch({...dispatch, consigneeAddress: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" placeholder="Full delivery address" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">Consignee GSTIN</label>
                <input type="text" value={dispatch.consigneeGst} onChange={(e) => setDispatch({...dispatch, consigneeGst: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase text-slate-900 bg-white" placeholder="e.g., 07AAACA..." />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                <Select 
                  instanceId="state-select"
                  options={stateOptions}
                  value={stateOptions.find(s => s.value === dispatch.consigneeStateId) || null}
                  placeholder="Search State..."
                  onChange={(option: any) => setDispatch({...dispatch, consigneeStateId: option?.value || "", consigneeStateCode: option?.code || ""})}
                  isClearable
                  className="text-slate-900"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  menuPosition="fixed"
                  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. DYNAMIC LINE ITEMS GRID */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Line Items</h3>
            <button onClick={addRow} className="text-sm bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-md transition-colors">
              + Add Row
            </button>
          </div>

          <div className="overflow-x-auto pb-32">
            <table className="w-full text-left text-xs md:text-sm text-slate-600 whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-800">
                <tr>
                  <th className="p-2 w-8">#</th>
                  <th className="p-2 min-w-[250px]">Product / Service</th>
                  <th className="p-2 w-16">Qty</th>
                  <th className="p-2 w-24">Rate (₹)</th>
                  <th className="p-2 w-24">Disc (%)</th>
                  <th className="p-2 w-28 text-right">Taxable</th>
                  {isLocal ? (
                    <>
                      <th className="p-2 w-24 text-right">CGST</th>
                      <th className="p-2 w-24 text-right">SGST</th>
                    </>
                  ) : (
                    <th className="p-2 w-24 text-right">IGST</th>
                  )}
                  <th className="p-2 w-32 text-right">Row Total</th>
                  <th className="p-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {processedRows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 font-medium text-slate-400">{index + 1}</td>
                    <td className="p-2">
                      <Select 
                        instanceId={`product-select-${row.id}`}
                        options={productOptions}
                        value={productOptions.find(p => p.value === row.productId) || null}
                        placeholder="Search..."
                        onChange={(option: any) => updateRow(row.id, 'productId', option?.value)}
                        isClearable
                        className="text-slate-900"
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                      />
                    </td>
                    <td className="p-2">
                      <input type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-300 rounded p-1.5 text-center outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" value={row.rate} onChange={(e) => updateRow(row.id, 'rate', e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-300 rounded p-1.5 text-right outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" max="100" value={row.discountPercent} onChange={(e) => updateRow(row.id, 'discountPercent', e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-300 rounded p-1.5 text-right outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white" />
                    </td>
                    <td className="p-2 text-right font-medium text-slate-800">₹{row.taxableAmount.toFixed(2)}</td>

                    {isLocal ? (
                      <>
                        <td className="p-2 text-right text-xs">
                          <div className="font-medium text-slate-700">₹{row.cgst.toFixed(2)}</div>
                          <div className="text-slate-400">({row.gstPercent / 2}%)</div>
                        </td>
                        <td className="p-2 text-right text-xs">
                          <div className="font-medium text-slate-700">₹{row.sgst.toFixed(2)}</div>
                          <div className="text-slate-400">({row.gstPercent / 2}%)</div>
                        </td>
                      </>
                    ) : (
                      <td className="p-2 text-right text-xs">
                        <div className="font-medium text-slate-700">₹{row.igst.toFixed(2)}</div>
                        <div className="text-slate-400">({row.gstPercent}%)</div>
                      </td>
                    )}
                    <td className="p-2 text-right font-bold text-blue-600">₹{row.rowTotal.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700 font-bold p-1" title="Remove Row">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. TOTALS & SUMMARY SECTION */}
        <div className="flex flex-col md:flex-row justify-end gap-6 mt-4">
          <div className="w-full md:w-5/12 space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <h4 className="font-medium text-slate-800 mb-3 text-sm border-b pb-2">Additional Charges</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Packaging (₹)</label>
                    <input type="number" min="0" value={charges.packagingCharges} onChange={(e) => setCharges({...charges, packagingCharges: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white" placeholder="0.00" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">GST (%)</label>
                    <input type="number" min="0" value={charges.packagingGst} onChange={(e) => setCharges({...charges, packagingGst: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Carrier / Freight (₹)</label>
                    <input type="number" min="0" value={charges.carrierCharges} onChange={(e) => setCharges({...charges, carrierCharges: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white" placeholder="0.00" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">GST (%)</label>
                    <input type="number" min="0" value={charges.carrierGst} onChange={(e) => setCharges({...charges, carrierGst: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Other Costs (₹)</label>
                    <input type="number" min="0" value={charges.otherCosts} onChange={(e) => setCharges({...charges, otherCosts: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white" placeholder="0.00" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">GST (%)</label>
                    <input type="number" min="0" value={charges.otherGst} onChange={(e) => setCharges({...charges, otherGst: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex justify-between font-medium text-slate-800 pt-1">
                <span>Items Value:</span>
                <span>₹{totals.subtotalTaxable.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-slate-200 mt-3 font-medium">
                <div className="flex justify-between">
                  <span>Total Taxable Value:</span>
                  <span className="text-slate-800">₹{totals.totalTaxableValue.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="border-t border-slate-300 pt-3 mt-3 flex justify-between items-center">
                <span className="text-lg font-bold text-slate-800">Grand Total:</span>
                <span className="text-xl font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                type="button"
                onClick={() => router.push('/quotations')}
                className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium py-3 rounded-md transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-md transition-colors shadow-sm"
              >
                Save & Generate Bill
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================== */}
      {/* PRINTABLE LIVE PREVIEW SECTION */}
      {/* ========================================== */}
      <div className="mt-12 border-t-2 border-dashed border-slate-300 pt-12 print:mt-0 print:border-none print:pt-0">
        <h3 className="text-center text-slate-400 uppercase tracking-widest font-bold mb-8 print:hidden">
          LIVE PRINT PREVIEW
        </h3>
        
        {/* A4 PRINT CANVAS */}
        <div id="printable-invoice" className="w-[210mm] min-h-[297mm] bg-white mx-auto shadow-xl px-8 pt-8 pb-12 print:shadow-none print:px-0 print:pt-0">
          
          <InvoiceHeader />
          
          <div className="w-full border-b-[3px] border-black pb-3 mb-4 text-[13px] flex justify-between mt-4">
            
            <div className="w-1/2 pr-4">
              <p><span className="font-bold text-slate-900">Billed To:</span> {selectedCustomer?.business_name || "SELECT CUSTOMER"}</p>
              <p><span className="font-bold text-slate-900">GSTIN:</span> {selectedCustomer?.gstin || ""}</p>
              <p><span className="font-bold text-slate-900">State:</span> {selectedState?.state_name || ""}</p>
            </div>

            <div className="w-1/2 border-l-[3px] border-black pl-4">
              <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                <div className="font-bold text-slate-900">Invoice No:</div>
                <div className="text-slate-900">{header.qtNo}</div>

                <div className="font-bold text-slate-900">Invoice Date:</div>
                <div className="text-slate-900">{header.qtDate}</div>
                
                {dispatch.ewayBillNo && (
                  <>
                    <div className="font-bold text-red-600">E-Way Bill No:</div>
                    <div className="font-bold text-red-600 uppercase">{dispatch.ewayBillNo}</div>
                  </>
                )}

                {dispatch.modeOfTransport && (
                  <>
                    <div className="font-bold text-slate-900">Transport Mode:</div>
                    <div className="uppercase text-slate-900">{dispatch.modeOfTransport}</div>
                  </>
                )}
              </div>
            </div>

          </div>
          
          {/* Placeholder so you can see where your items table will ultimately render in [id] view */}
          <div className="w-full h-64 flex items-center justify-center border-2 border-dashed border-slate-200 text-slate-400 mt-8 print:hidden">
            [ Invoice Line Items & Totals Will Render Here On Final Document ]
          </div>

        </div>
      </div>
      
    </div>
  );
}