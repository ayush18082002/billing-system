"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Select from "react-select";
import { useRouter } from "next/navigation"; 

export default function CreateBill() {
  const router = useRouter(); 

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]); 
  
  // NOTE: Replace this with your actual Home State UUID from state_master
  const COMPANY_STATE_ID = "bb6a33c1-9649-4f1e-a51b-5eb7f6b0fc8f"; 

  const [header, setHeader] = useState({
    qtNo: "",
    qtDate: new Date().toISOString().split('T')[0], 
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
    dateOfSupply: "", // NEW
    reverseCharge: false, // NEW
    isConsigneeDifferent: false,
    consigneeName: "",
    consigneeAddress: "",
    consigneeGst: "",
    consigneeState: "", 
  });

  const [rows, setRows] = useState([
    { id: 1, productId: null as string | null, product_head: "", uom: "", qty: 1, rate: 0, discountPercent: 0, gstPercent: 0 }
  ]);

  const [charges, setCharges] = useState({
    packagingCharges: 0,
    packagingGst: 18,
    carrierCharges: 0,
    carrierGst: 18,
    otherCosts: 0,
    otherGst: 18
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

  const generateBillNumber = () => {
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setHeader(prev => ({ ...prev, qtNo: `Bill-${year}-${randomSeq}` }));
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
    let subtotalTaxable = 0;
    let itemCgst = 0;
    let itemSgst = 0;
    let itemIgst = 0;

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

  const handleSave = async () => {
    if (!header.customerId) {
      alert("Validation Error: Please select a Customer.");
      return;
    }
    const hasEmptyRows = processedRows.some(row => !row.productId);
    if (hasEmptyRows) {
      alert("Validation Error: All rows must have a product selected.");
      return;
    }

    const { data: quoteData, error: quoteError } = await supabase
      .from('quotations')
      .insert([{
        bill_no: header.qtNo,
        bill_date: header.qtDate, 
        customer_id: header.customerId,
        mode_of_transport: dispatch.modeOfTransport,
        po_number: dispatch.poNumber,
        po_date: dispatch.poDate || null, 
        vehicle_number: dispatch.vehicleNumber,
        gr_number: dispatch.grNumber,
        gr_date: dispatch.grDate || null, 
        date_of_supply: dispatch.dateOfSupply || null, // NEW
        reverse_charge: dispatch.reverseCharge, // NEW
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
      }])
      .select() 
      .single();

    if (quoteError) {
      alert("Database Error (Header): " + quoteError.message);
      return;
    }

    const lineItemsToInsert = processedRows.map(row => ({
      quotation_id: quoteData.id, 
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

    if (lineError) {
      alert("Database Error (Line Items): " + lineError.message);
      return;
    }

    alert("Success! Bill saved to database.");
    router.push(`/quotations`);
  };

  const customerOptions = customers.map(c => ({ value: c.id, label: `${c.business_name} (${c.gstin || 'No GSTIN'})`, stateId: c.state }));
  const stateOptions = states.map(s => ({ value: s.id, label: s.state_name }));
  
  const productOptions = products.map(p => ({ 
    value: p.id, 
    label: p.product_head ? `[${p.product_head}] ${p.name}` : p.name 
  }));

  return (
    <div className="flex flex-col gap-6 relative max-w-[1400px] mx-auto">
      
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
              onChange={(option: any) => setHeader({ ...header, customerId: option?.value, customerStateId: option?.stateId })}
              isClearable
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
              className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 2. DISPATCH & CONSIGNEE SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-800 border-b border-slate-200 pb-3 mb-4">Dispatch & Order Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">PO Number (Optional)</label>
            <input type="text" value={dispatch.poNumber} onChange={(e) => setDispatch({...dispatch, poNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., PO-4099" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">PO Date (Optional)</label>
            <input type="date" value={dispatch.poDate} onChange={(e) => setDispatch({...dispatch, poDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mode of Transport</label>
            <select value={dispatch.modeOfTransport} onChange={(e) => setDispatch({...dispatch, modeOfTransport: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select...</option>
              <option value="Road">Road</option>
              <option value="Rail">Rail</option>
              <option value="Air">Air</option>
              <option value="Ship">Ship</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Number</label>
            <input type="text" value={dispatch.vehicleNumber} onChange={(e) => setDispatch({...dispatch, vehicleNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., DL 1A 1234" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">GR / RR No. (Optional)</label>
            <input type="text" value={dispatch.grNumber} onChange={(e) => setDispatch({...dispatch, grNumber: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">GR Date (Optional)</label>
            <input type="date" value={dispatch.grDate} onChange={(e) => setDispatch({...dispatch, grDate: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          
          {/* NEW: Date of Supply Field */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date of Supply (Optional)</label>
            <input type="date" value={dispatch.dateOfSupply} onChange={(e) => setDispatch({...dispatch, dateOfSupply: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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

          {/* NEW: Reverse Charge Toggle */}
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
              <input type="text" value={dispatch.consigneeName} onChange={(e) => setDispatch({...dispatch, consigneeName: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name of the receiving party" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Shipping Address</label>
              <input type="text" value={dispatch.consigneeAddress} onChange={(e) => setDispatch({...dispatch, consigneeAddress: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Full delivery address" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Consignee GSTIN</label>
              <input type="text" value={dispatch.consigneeGst} onChange={(e) => setDispatch({...dispatch, consigneeGst: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., 07AAACA..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
              <Select 
                instanceId="state-select"
                options={stateOptions}
                value={stateOptions.find(s => s.value === dispatch.consigneeState) || null}
                placeholder="Search State..."
                onChange={(option: any) => setDispatch({...dispatch, consigneeState: option?.value || ""})}
                isClearable
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
                      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                      menuPosition="fixed"
                      styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                    />
                  </td>
                  <td className="p-2">
                    <input type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', parseFloat(e.target.value) || 0)} className="w-full border border-slate-300 rounded p-1.5 text-center outline-none focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td className="p-2">
                    <input type="number" min="0" value={row.rate} onChange={(e) => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full border border-slate-300 rounded p-1.5 text-right outline-none focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td className="p-2">
                    <input type="number" min="0" max="100" value={row.discountPercent} onChange={(e) => updateRow(row.id, 'discountPercent', parseFloat(e.target.value) || 0)} className="w-full border border-slate-300 rounded p-1.5 text-right outline-none focus:ring-2 focus:ring-blue-500" />
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
                  <input type="number" min="0" value={charges.packagingCharges || ""} onChange={(e) => setCharges({...charges, packagingCharges: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="0.00" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">GST (%)</label>
                  <input type="number" min="0" value={charges.packagingGst || ""} onChange={(e) => setCharges({...charges, packagingGst: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Carrier / Freight (₹)</label>
                  <input type="number" min="0" value={charges.carrierCharges || ""} onChange={(e) => setCharges({...charges, carrierCharges: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="0.00" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">GST (%)</label>
                  <input type="number" min="0" value={charges.carrierGst || ""} onChange={(e) => setCharges({...charges, carrierGst: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Other Costs (₹)</label>
                  <input type="number" min="0" value={charges.otherCosts || ""} onChange={(e) => setCharges({...charges, otherCosts: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="0.00" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">GST (%)</label>
                  <input type="number" min="0" value={charges.otherGst || ""} onChange={(e) => setCharges({...charges, otherGst: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="space-y-1 text-sm text-slate-600">
            
            {/* Items Breakdown */}
            <div className="flex justify-between font-medium text-slate-800 pt-1">
              <span>Items Value:</span>
              <span>₹{totals.subtotalTaxable.toFixed(2)}</span>
            </div>
            {totals.subtotalTaxable > 0 && (
              isLocal ? (
                <>
                  <div className="flex justify-between text-xs pl-2 text-slate-500"><span>CGST on Items:</span><span>₹{totals.itemCgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs pl-2 text-slate-500"><span>SGST on Items:</span><span>₹{totals.itemSgst.toFixed(2)}</span></div>
                </>
              ) : (
                <div className="flex justify-between text-xs pl-2 text-slate-500"><span>IGST on Items:</span><span>₹{totals.itemIgst.toFixed(2)}</span></div>
              )
            )}

            {/* Packaging Breakdown */}
            {totals.packaging > 0 && (
              <>
                <div className="flex justify-between font-medium text-slate-800 pt-2">
                  <span>Packaging Cost:</span>
                  <span>₹{totals.packaging.toFixed(2)}</span>
                </div>
                {isLocal ? (
                  <>
                    <div className="flex justify-between text-xs pl-2 text-slate-500"><span>CGST on Pkg:</span><span>₹{totals.packagingCgst.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs pl-2 text-slate-500"><span>SGST on Pkg:</span><span>₹{totals.packagingSgst.toFixed(2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs pl-2 text-slate-500"><span>IGST on Pkg:</span><span>₹{totals.packagingIgst.toFixed(2)}</span></div>
                )}
              </>
            )}

            {/* Freight Breakdown */}
            {totals.carrier > 0 && (
              <>
                <div className="flex justify-between font-medium text-slate-800 pt-2">
                  <span>Freight Cost:</span>
                  <span>₹{totals.carrier.toFixed(2)}</span>
                </div>
                {isLocal ? (
                  <>
                    <div className="flex justify-between text-xs pl-2 text-slate-500"><span>CGST on Freight:</span><span>₹{totals.carrierCgst.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs pl-2 text-slate-500"><span>SGST on Freight:</span><span>₹{totals.carrierSgst.toFixed(2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs pl-2 text-slate-500"><span>IGST on Freight:</span><span>₹{totals.carrierIgst.toFixed(2)}</span></div>
                )}
              </>
            )}

            {/* Other Breakdown */}
            {totals.other > 0 && (
              <>
                <div className="flex justify-between font-medium text-slate-800 pt-2">
                  <span>Other Costs:</span>
                  <span>₹{totals.other.toFixed(2)}</span>
                </div>
                {isLocal ? (
                  <>
                    <div className="flex justify-between text-xs pl-2 text-slate-500"><span>CGST on Other:</span><span>₹{totals.otherCgst.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs pl-2 text-slate-500"><span>SGST on Other:</span><span>₹{totals.otherSgst.toFixed(2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs pl-2 text-slate-500"><span>IGST on Other:</span><span>₹{totals.otherIgst.toFixed(2)}</span></div>
                )}
              </>
            )}
            
            {/* Final Totals */}
            <div className="pt-3 border-t border-slate-200 mt-3 font-medium">
              <div className="flex justify-between">
                <span>Total Taxable Value:</span>
                <span className="text-slate-800">₹{totals.totalTaxableValue.toFixed(2)}</span>
              </div>
              {isLocal ? (
                <>
                  <div className="flex justify-between">
                    <span>Total CGST:</span>
                    <span className="text-slate-800">₹{totals.finalCgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total SGST:</span>
                    <span className="text-slate-800">₹{totals.finalSgst.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Total IGST:</span>
                  <span className="text-slate-800">₹{totals.finalIgst.toFixed(2)}</span>
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-300 pt-3 mt-3 flex justify-between items-center">
              <span className="text-lg font-bold text-slate-800">Grand Total:</span>
              <span className="text-xl font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* NEW: Cancel Button Added Next to Save */}
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
  );
}