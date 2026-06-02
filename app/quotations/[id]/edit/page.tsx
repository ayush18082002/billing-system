"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import Select from "react-select";
import { useRouter, useParams } from "next/navigation"; 

export default function EditBill() {
  const router = useRouter(); 
  const params = useParams();
  const billId = params.id as string;

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // NOTE: Replace this with your actual Home State UUID from state_master
  const COMPANY_STATE_ID = "bb6a33c1-9649-4f1e-a51b-5eb7f6b0fc8f"; 

  const [header, setHeader] = useState({
    qtNo: "",
    qtDate: "", 
    customerId: null as string | null,
    customerStateId: null as string | null,
  });

  const [dispatch, setDispatch] = useState({
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
    consigneeState: "", 
  });

  const [rows, setRows] = useState<any[]>([]);

  const [charges, setCharges] = useState({
    packagingCharges: 0,
    packagingGst: 18,
    carrierCharges: 0,
    carrierGst: 18,
    otherCosts: 0,
    otherGst: 18
  });

  useEffect(() => {
    if (billId) {
      fetchMasterDataAndBill();
    }
  }, [billId]);

  const fetchMasterDataAndBill = async () => {
    setLoading(true);

    // 1. Fetch Master Data first so we can map names and states
    const [{ data: custData }, { data: prodData }, { data: statesData }] = await Promise.all([
      supabase.from('customers').select('*').eq('is_active', true),
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('state_master').select('*').order('state_name')
    ]);

    if (custData) setCustomers(custData);
    if (prodData) setProducts(prodData);
    if (statesData) setStates(statesData);

    // 2. Fetch the existing Bill
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', billId)
      .single();

    if (quoteError || !quoteData) {
      alert("Error loading bill details.");
      router.push('/quotations');
      return;
    }

    // 3. Fetch the line items
    const { data: lineItemsData } = await supabase
      .from('quotation_line_items')
      .select('*')
      .eq('quotation_id', billId);

    // 4. Pre-fill Header State
    const customer = custData?.find(c => c.id === quoteData.customer_id);
    setHeader({
      qtNo: quoteData.bill_no,
      qtDate: quoteData.bill_date,
      customerId: quoteData.customer_id,
      customerStateId: customer ? customer.state : null,
    });

    // 5. Pre-fill Dispatch State
    setDispatch({
      modeOfTransport: quoteData.mode_of_transport || "",
      poNumber: quoteData.po_number || "",
      poDate: quoteData.po_date || "",
      vehicleNumber: quoteData.vehicle_number || "",
      grNumber: quoteData.gr_number || "",
      grDate: quoteData.gr_date || "",
      dateOfSupply: quoteData.date_of_supply || "",
      reverseCharge: quoteData.reverse_charge || false,
      isConsigneeDifferent: quoteData.is_consignee_different || false,
      consigneeName: quoteData.consignee_name || "",
      consigneeAddress: quoteData.consignee_address || "",
      consigneeGst: quoteData.consignee_gstin || "",
      consigneeState: quoteData.consignee_state || "",
    });

    // 6. Pre-fill Extra Charges State
    setCharges({
      packagingCharges: quoteData.packaging_charges || 0,
      packagingGst: quoteData.packaging_gst || 18,
      carrierCharges: quoteData.carrier_charges || 0,
      carrierGst: quoteData.carrier_gst || 18,
      otherCosts: quoteData.other_charges || 0,
      otherGst: quoteData.other_gst || 18,
    });

    // 7. Pre-fill Line Items Grid
    if (lineItemsData && lineItemsData.length > 0) {
      const mappedRows = lineItemsData.map(item => {
        const prod = prodData?.find(p => p.id === item.product_id);
        return {
          id: item.id,
          productId: item.product_id,
          product_head: prod ? prod.product_head : "",
          uom: prod ? prod.uom : "",
          qty: item.qty,
          rate: item.rate,
          discountPercent: item.discount_percent || 0,
          gstPercent: item.gst_percent || 0
        };
      });
      setRows(mappedRows);
    } else {
      addRow(); // Add a blank row if none exist
    }

    setLoading(false);
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

  const activeStateId = dispatch.isConsigneeDifferent && dispatch.consigneeState 
    ? dispatch.consigneeState 
    : header.customerStateId;

  const isLocal = activeStateId === COMPANY_STATE_ID;

  const processedRows = rows.map(row => {
    const baseValue = (row.qty || 0) * (row.rate || 0);
    const discountPercent = parseFloat(row.discountPercent as any) || 0;
    
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

    const carrier = parseFloat(charges.carrierCharges as any) || 0;
    const carrierTax = carrier * ((parseFloat(charges.carrierGst as any) || 0) / 100);
    const carrierCgst = isLocal ? carrierTax / 2 : 0;
    const carrierSgst = isLocal ? carrierTax / 2 : 0;
    const carrierIgst = !isLocal ? carrierTax : 0;

    const packaging = parseFloat(charges.packagingCharges as any) || 0;
    const packagingTax = packaging * ((parseFloat(charges.packagingGst as any) || 0) / 100);
    const packagingCgst = isLocal ? packagingTax / 2 : 0;
    const packagingSgst = isLocal ? packagingTax / 2 : 0;
    const packagingIgst = !isLocal ? packagingTax : 0;

    const other = parseFloat(charges.otherCosts as any) || 0;
    const otherTax = other * ((parseFloat(charges.otherGst as any) || 0) / 100);
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

  const handleUpdate = async () => {
    if (!header.customerId) return alert("Validation Error: Please select a Customer.");
    if (processedRows.some(row => !row.productId)) return alert("Validation Error: All rows must have a product selected.");

    // 1. UPDATE THE HEADER RECORD
    const { error: quoteError } = await supabase
      .from('quotations')
      .update({
        bill_date: header.qtDate, 
        customer_id: header.customerId,
        mode_of_transport: dispatch.modeOfTransport,
        po_number: dispatch.poNumber,
        po_date: dispatch.poDate || null, 
        vehicle_number: dispatch.vehicleNumber,
        gr_number: dispatch.grNumber,
        gr_date: dispatch.grDate || null, 
        date_of_supply: dispatch.dateOfSupply || null,
        reverse_charge: dispatch.reverseCharge,
        is_consignee_different: dispatch.isConsigneeDifferent,
        consignee_name: dispatch.isConsigneeDifferent ? dispatch.consigneeName : null,
        consignee_address: dispatch.isConsigneeDifferent ? dispatch.consigneeAddress : null,
        consignee_gstin: dispatch.isConsigneeDifferent ? dispatch.consigneeGst : null,
        consignee_state: dispatch.isConsigneeDifferent ? dispatch.consigneeState : null,
        subtotal: totals.subtotalTaxable,
        cgst: totals.finalCgst,
        sgst: totals.finalSgst,
        igst: totals.finalIgst,
        carrier_charges: totals.carrier,
        carrier_gst: parseFloat(charges.carrierGst as any) || 0,
        packaging_charges: totals.packaging,
        packaging_gst: parseFloat(charges.packagingGst as any) || 0,
        other_charges: totals.other, 
        other_gst: parseFloat(charges.otherGst as any) || 0,
        grand_total: totals.grandTotal
      })
      .eq('id', billId);

    if (quoteError) return alert("Database Error (Header Update): " + quoteError.message);

    // 2. DELETE OLD LINE ITEMS
    const { error: deleteError } = await supabase
      .from('quotation_line_items')
      .delete()
      .eq('quotation_id', billId);

    if (deleteError) return alert("Database Error (Cleaning Line Items): " + deleteError.message);

    // 3. INSERT NEW LINE ITEMS
    const lineItemsToInsert = processedRows.map(row => ({
      quotation_id: billId, 
      product_id: row.productId,
      qty: row.qty,
      rate: row.rate,
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
    if (lineError) return alert("Database Error (Inserting New Line Items): " + lineError.message);

    alert("Success! Bill updated.");
    router.push(`/quotations`);
  };

  const customerOptions = customers.map(c => ({ value: c.id, label: `${c.business_name} (${c.gstin || 'No GSTIN'})`, stateId: c.state }));
  const stateOptions = states.map(s => ({ value: s.id, label: s.state_name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.product_head ? `[${p.product_head}] ${p.name}` : p.name }));

  if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Loading Bill Data...</div>;

  return (
    <div className="flex flex-col gap-6 relative max-w-[1400px] mx-auto">
      
      {/* 1. HEADER SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">Edit Bill</h2>
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
              onChange={(option: any) => setHeader({ ...header, customerId: option?.value, customerStateId: option?.stateId })}
              isClearable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Date</label>
            <input type="date" value={header.qtDate} onChange={(e) => setHeader({ ...header, qtDate: e.target.value })} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* 2. DISPATCH & CONSIGNEE SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-800 border-b border-slate-200 pb-3 mb-4">Dispatch & Order Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">PO Number</label>
            <input type="text" value={dispatch.poNumber} onChange={(e) => setDispatch({...dispatch, poNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">PO Date</label>
            <input type="date" value={dispatch.poDate} onChange={(e) => setDispatch({...dispatch, poDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mode of Transport</label>
            <select value={dispatch.modeOfTransport} onChange={(e) => setDispatch({...dispatch, modeOfTransport: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select...</option><option value="Road">Road</option><option value="Rail">Rail</option><option value="Air">Air</option><option value="Ship">Ship</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Number</label>
            <input type="text" value={dispatch.vehicleNumber} onChange={(e) => setDispatch({...dispatch, vehicleNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">GR / RR No.</label>
            <input type="text" value={dispatch.grNumber} onChange={(e) => setDispatch({...dispatch, grNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">GR Date</label>
            <input type="date" value={dispatch.grDate} onChange={(e) => setDispatch({...dispatch, grDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date of Supply</label>
            <input type="date" value={dispatch.dateOfSupply} onChange={(e) => setDispatch({...dispatch, dateOfSupply: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="consigneeCheck" checked={dispatch.isConsigneeDifferent} onChange={(e) => setDispatch({...dispatch, isConsigneeDifferent: e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
            <label htmlFor="consigneeCheck" className="text-sm font-medium text-slate-700 cursor-pointer">Consignee (Shipped To) is different from Customer</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="reverseChargeCheck" checked={dispatch.reverseCharge} onChange={(e) => setDispatch({...dispatch, reverseCharge: e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
            <label htmlFor="reverseChargeCheck" className="text-sm font-medium text-slate-700 cursor-pointer">Tax is payable on Reverse Charge</label>
          </div>
        </div>

        {dispatch.isConsigneeDifferent && (
          <div className="bg-slate-50 p-4 rounded-md border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Consignee Name</label>
              <input type="text" value={dispatch.consigneeName} onChange={(e) => setDispatch({...dispatch, consigneeName: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Shipping Address</label>
              <input type="text" value={dispatch.consigneeAddress} onChange={(e) => setDispatch({...dispatch, consigneeAddress: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Consignee GSTIN</label>
              <input type="text" value={dispatch.consigneeGst} onChange={(e) => setDispatch({...dispatch, consigneeGst: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
              <Select instanceId="state-select" options={stateOptions} value={stateOptions.find(s => s.value === dispatch.consigneeState) || null} onChange={(option: any) => setDispatch({...dispatch, consigneeState: option?.value || ""})} isClearable styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }} />
            </div>
          </div>
        )}
      </div>

      {/* 3. DYNAMIC LINE ITEMS GRID */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Line Items</h3>
          <button onClick={addRow} className="text-sm bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-md transition-colors">+ Add Row</button>
        </div>

        <div className="overflow-x-auto pb-32">
          <table className="w-full text-left text-xs md:text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-800">
              <tr>
                <th className="p-2 w-8">#</th><th className="p-2 min-w-[250px]">Product / Service</th><th className="p-2 w-16">Qty</th><th className="p-2 w-24">Rate (₹)</th><th className="p-2 w-24">Disc (%)</th><th className="p-2 w-28 text-right">Taxable</th>
                {isLocal ? (<><th className="p-2 w-24 text-right">CGST</th><th className="p-2 w-24 text-right">SGST</th></>) : (<th className="p-2 w-24 text-right">IGST</th>)}
                <th className="p-2 w-32 text-right">Row Total</th><th className="p-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {processedRows.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2 font-medium text-slate-400">{index + 1}</td>
                  <td className="p-2"><Select instanceId={`product-select-${row.id}`} options={productOptions} value={productOptions.find(p => p.value === row.productId) || null} onChange={(option: any) => updateRow(row.id, 'productId', option?.value)} isClearable styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }} /></td>
                  <td className="p-2"><input type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', parseFloat(e.target.value) || 0)} className="w-full border border-slate-300 rounded p-1.5 text-center outline-none" /></td>
                  <td className="p-2"><input type="number" min="0" value={row.rate} onChange={(e) => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full border border-slate-300 rounded p-1.5 text-right outline-none" /></td>
                  <td className="p-2"><input type="number" min="0" max="100" value={row.discountPercent} onChange={(e) => updateRow(row.id, 'discountPercent', parseFloat(e.target.value) || 0)} className="w-full border border-slate-300 rounded p-1.5 text-right outline-none" /></td>
                  <td className="p-2 text-right font-medium text-slate-800">₹{row.taxableAmount.toFixed(2)}</td>
                  {isLocal ? (<><td className="p-2 text-right text-xs"><div className="font-medium">₹{row.cgst.toFixed(2)}</div></td><td className="p-2 text-right text-xs"><div className="font-medium">₹{row.sgst.toFixed(2)}</div></td></>) : (<td className="p-2 text-right text-xs"><div className="font-medium">₹{row.igst.toFixed(2)}</div></td>)}
                  <td className="p-2 text-right font-bold text-blue-600">₹{row.rowTotal.toFixed(2)}</td>
                  <td className="p-2 text-center"><button onClick={() => removeRow(row.id)} className="text-red-500 font-bold p-1">✕</button></td>
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
                <div className="col-span-2"><label className="block text-xs">Packaging (₹)</label><input type="number" min="0" value={charges.packagingCharges || ""} onChange={(e) => setCharges({...charges, packagingCharges: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 text-sm" /></div>
                <div className="col-span-1"><label className="block text-xs">GST (%)</label><input type="number" min="0" value={charges.packagingGst || ""} onChange={(e) => setCharges({...charges, packagingGst: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="block text-xs">Carrier / Freight (₹)</label><input type="number" min="0" value={charges.carrierCharges || ""} onChange={(e) => setCharges({...charges, carrierCharges: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 text-sm" /></div>
                <div className="col-span-1"><label className="block text-xs">GST (%)</label><input type="number" min="0" value={charges.carrierGst || ""} onChange={(e) => setCharges({...charges, carrierGst: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="block text-xs">Other Costs (₹)</label><input type="number" min="0" value={charges.otherCosts || ""} onChange={(e) => setCharges({...charges, otherCosts: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 text-sm" /></div>
                <div className="col-span-1"><label className="block text-xs">GST (%)</label><input type="number" min="0" value={charges.otherGst || ""} onChange={(e) => setCharges({...charges, otherGst: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 text-sm" /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="space-y-1 text-sm text-slate-600">
            <div className="flex justify-between font-medium text-slate-800 pt-1"><span>Items Value:</span><span>₹{totals.subtotalTaxable.toFixed(2)}</span></div>
            <div className="pt-3 border-t border-slate-200 mt-3 font-medium">
              <div className="flex justify-between"><span>Total Taxable Value:</span><span className="text-slate-800">₹{totals.totalTaxableValue.toFixed(2)}</span></div>
            </div>
            <div className="border-t border-slate-300 pt-3 mt-3 flex justify-between items-center">
              <span className="text-lg font-bold text-slate-800">Grand Total:</span>
              <span className="text-xl font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button type="button" onClick={() => router.push('/quotations')} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium py-3 rounded-md">Cancel</button>
            <button onClick={handleUpdate} className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-md">Update Bill</button>
          </div>
        </div>
      </div>
    </div>
  );
}