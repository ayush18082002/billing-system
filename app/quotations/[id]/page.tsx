"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

// Helper function to convert INR numbers to words
const numberToWords = (num: number | string) => {
  if (!num || isNaN(Number(num))) return "Zero Rupees Only";
  const [rupees, paise] = Number(num).toFixed(2).split('.');
  
  const toWords = (n: number) => {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    if (n === 0) return '';
    if (n > 999999999) return 'Overflow';
    let str = '';
    const core = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!core) return '';
    str += (Number(core[1]) !== 0) ? (a[Number(core[1])] || b[core[1][0] as any] + ' ' + a[core[1][1] as any]) + 'Crore ' : '';
    str += (Number(core[2]) !== 0) ? (a[Number(core[2])] || b[core[2][0] as any] + ' ' + a[core[2][1] as any]) + 'Lakh ' : '';
    str += (Number(core[3]) !== 0) ? (a[Number(core[3])] || b[core[3][0] as any] + ' ' + a[core[3][1] as any]) + 'Thousand ' : '';
    str += (Number(core[4]) !== 0) ? (a[Number(core[4])] || b[core[4][0] as any] + ' ' + a[core[4][1] as any]) + 'Hundred ' : '';
    str += (Number(core[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(core[5])] || b[core[5][0] as any] + ' ' + a[core[5][1] as any]) : '';
    return str.trim();
  };
  
  let res = toWords(Number(rupees)) + ' Rupees';
  if (Number(paise) > 0) {
     res += ' and ' + toWords(Number(paise)) + ' Paise';
  }
  return res + ' Only';
};

export default function QuotationPrintView() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const COMPANY_STATE_ID = "bb6a33c1-9649-4f1e-a51b-5eb7f6b0fc8f"; 

  useEffect(() => {
    if (params.id) {
      fetchQuotationData(params.id as string);
    }
  }, [params.id]);

  const fetchQuotationData = async (id: string) => {
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotations')
      .select('*, customers!fk_quotation_customer(*)')
      .eq('id', id)
      .single();

    if (quoteError) {
      console.error(quoteError);
      setLoading(false);
      return;
    }

    const { data: itemsData } = await supabase
      .from('quotation_line_items')
      .select('*, products(*)')
      .eq('quotation_id', id);

    const { data: statesData } = await supabase.from('state_master').select('*');

    setQuotation(quoteData);
    if (itemsData) setLineItems(itemsData);
    if (statesData) setStates(statesData);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Loading document...</div>;
  if (!quotation) return <div className="p-10 text-center text-red-500 font-bold">Quotation not found.</div>;

  const customer = quotation.customers;
  const isLocal = Number(quotation.cgst) > 0 || Number(quotation.sgst) > 0;

  const getStateDetails = (stateId: string) => {
    const foundState = states.find(s => s.id === stateId);
    if (foundState) {
      return { 
        state_name: foundState.state_name, 
        code: foundState.state_code || foundState.code || 'N/A' 
      };
    }
    return { state_name: 'N/A', code: 'N/A' };
  };

  const customerState = getStateDetails(customer.state);
  const consigneeState = quotation.consignee_state ? getStateDetails(quotation.consignee_state) : null;
  const companyState = getStateDetails(COMPANY_STATE_ID);

  const placeOfSupply = quotation.is_consignee_different && consigneeState 
    ? consigneeState.state_name 
    : customerState.state_name;

  // MATH FOR BREAKDOWN
  const itemsTaxable = Number(quotation.subtotal) || 0;
  let itemsCgst = 0, itemsSgst = 0, itemsIgst = 0;
  lineItems.forEach(item => {
    itemsCgst += Number(item.cgst_amount) || 0;
    itemsSgst += Number(item.sgst_amount) || 0;
    itemsIgst += Number(item.igst_amount) || 0;
  });

  const packaging = Number(quotation.packaging_charges) || 0;
  const packagingTax = packaging * ((Number(quotation.packaging_gst) || 0) / 100);
  const packagingCgst = isLocal ? packagingTax / 2 : 0;
  const packagingSgst = isLocal ? packagingTax / 2 : 0;
  const packagingIgst = !isLocal ? packagingTax : 0;

  const freight = Number(quotation.carrier_charges) || 0;
  const freightTax = freight * ((Number(quotation.carrier_gst) || 0) / 100);
  const freightCgst = isLocal ? freightTax / 2 : 0;
  const freightSgst = isLocal ? freightTax / 2 : 0;
  const freightIgst = !isLocal ? freightTax : 0;

  const other = Number(quotation.other_charges) || 0;
  const otherTax = other * ((Number(quotation.other_gst) || 0) / 100);
  const otherCgst = isLocal ? otherTax / 2 : 0;
  const otherSgst = isLocal ? otherTax / 2 : 0;
  const otherIgst = !isLocal ? otherTax : 0;

  const totalTaxableValue = itemsTaxable + packaging + freight + other;

  // CHUNKING LOGIC
  const ITEMS_PAGE_1 = 12;
  const ITEMS_PAGE_N = 18;
  const paginatedItems = [];
  
  if (lineItems.length > 0) {
    paginatedItems.push(lineItems.slice(0, ITEMS_PAGE_1));
    let currentIndex = ITEMS_PAGE_1;
    while (currentIndex < lineItems.length) {
      paginatedItems.push(lineItems.slice(currentIndex, currentIndex + ITEMS_PAGE_N));
      currentIndex += ITEMS_PAGE_N;
    }
  } else {
    paginatedItems.push([]);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 0 !important; 
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background-color: white !important;
              margin: 0;
            }
            body * { visibility: hidden; }
            #printable-invoice, #printable-invoice * { visibility: visible; }
            #printable-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              background: white;
            }
            #print-action-bar { display: none !important; }
            
            .a4-container {
              width: 210mm !important;
              height: 296mm !important; 
              max-height: 296mm !important;
              padding: 10mm !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
              page-break-after: always;
              break-after: page;
            }
            .a4-container:last-child {
              page-break-after: auto;
              break-after: auto;
            }
          }
          
          .a4-container {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            background: white;
            padding: 10mm;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          @media (max-width: 800px) {
            .a4-container { width: 100%; height: auto; box-shadow: none; padding: 4mm; }
          }
        `
      }} />

      <div id="printable-invoice" className="bg-slate-100 min-h-screen p-4 md:p-8 print:p-0 print:bg-white text-black flex flex-col gap-8 print:block">
        
        {/* ACTION BAR */}
        <div id="print-action-bar" className="max-w-[210mm] w-full mx-auto flex justify-between items-center print:hidden">
          <button onClick={() => router.push('/quotations')} className="text-slate-600 hover:text-slate-900 font-medium">
            ← Back to Dashboard
          </button>
          <button 
            onClick={() => window.print()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors"
          >
            🖨️ Print as PDF
          </button>
        </div>

        {paginatedItems.map((pageItems, pageIndex) => {
          const isLastPage = pageIndex === paginatedItems.length - 1;
          const isFirstPage = pageIndex === 0;

          const serialOffset = isFirstPage ? 0 : ITEMS_PAGE_1 + ((pageIndex - 1) * ITEMS_PAGE_N);

          return (
            <div key={pageIndex} className="a4-container flex flex-col mb-8 print:mb-0">
              
              {/* HEADER AREA (Shrunk 50%) */}
              <div className="text-center mb-1 shrink-0">
                <h1 className="text-[10px] font-bold uppercase tracking-wider text-black leading-none">
                  TAX Invoice {pageIndex > 0 && <span className="text-[8px] font-medium italic text-gray-500">(Continued)</span>}
                </h1>
                <p className="text-[7px] text-black font-medium mt-0.5">See Section 31 CGST Act & Rule 1 of Invoice Rule</p>
              </div>

              {/* MASTER BORDER WRAPPER */}
              <div className="border-[2px] border-black flex-1 flex flex-col overflow-hidden">
                
                {/* ========================================= */}
                {/* RENDER HEADERS ONLY ON PAGE 1             */}
                {/* ========================================= */}
                {isFirstPage && (
                  <>
                    {/* COMPANY HEADER (Shrunk Enterprise 30%, Padding Tightened) */}
                    <div className="flex border-b-[2px] border-black shrink-0">
                      <div className="w-1/2 p-1 border-r-[2px] border-black">
                        <h2 className="text-[12px] font-bold uppercase leading-none">YOUR ENTERPRISE NAME</h2>
                        <p className="font-medium text-[9px] mt-1">Manufacturers of Industrial Equipment</p>
                        <p className="text-[9px] leading-tight mt-0.5">123 Business Tech Park, Sector 45, New Delhi, India 110001</p>
                        <p className="text-[9px] leading-tight mt-0.5">Mobile: +91 98765 43210 | Email: billing@yourenterprise.com</p>
                      </div>
                      <div className="w-1/2 p-1 flex flex-col justify-center">
                        <div className="grid grid-cols-[60px_1fr] gap-x-1 gap-y-0.5 text-[9px]">
                          <span className="font-bold">GSTIN/UIN</span><span className="uppercase">: 07AAACA1234A1Z5</span>
                          <span className="font-bold">PAN</span><span className="uppercase">: AAACA1234A</span>
                          <span className="font-bold">IEC No.</span><span className="uppercase">: 0123456789</span>
                          <span className="font-bold">State Code</span><span className="uppercase">: {companyState.code}</span>
                        </div>
                      </div>
                    </div>

                    {/* INVOICE DETAILS w/ PO & GR (Padding Tightened) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 border-b-[2px] border-black divide-x-[2px] divide-black bg-slate-50 shrink-0">
                      <div className="p-1">
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Invoice / Bill No.</p>
                        <p className="font-bold text-[10px] leading-none">{quotation.bill_no}</p>
                        {(quotation.po_no || quotation.po_date) && (
                          <div className="mt-1 text-[8px] leading-none">
                            <span className="font-bold">PO No:</span> {quotation.po_no || 'N/A'} {quotation.po_date && `| ${new Date(quotation.po_date).toLocaleDateString('en-IN')}`}
                          </div>
                        )}
                        {(quotation.gr_no || quotation.gr_date) && (
                          <div className="mt-0.5 text-[8px] leading-none">
                            <span className="font-bold">GR No:</span> {quotation.gr_no || 'N/A'} {quotation.gr_date && `| ${new Date(quotation.gr_date).toLocaleDateString('en-IN')}`}
                          </div>
                        )}
                      </div>
                      <div className="p-1">
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Date of Supply</p>
                        <p className="font-semibold text-[10px] leading-none">{quotation.date_of_supply ? new Date(quotation.date_of_supply).toLocaleDateString('en-IN') : 'N/A'}</p>
                      </div>
                      <div className="p-1">
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Place of Supply</p>
                        <p className="font-semibold text-[10px] leading-none">{placeOfSupply}</p>
                      </div>
                      <div className="p-1">
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Vehicle Number</p>
                        <p className="font-semibold text-[10px] leading-none">{quotation.vehicle_number || 'N/A'}</p>
                      </div>
                    </div>

                    {/* PARTIES (Padding Tightened) */}
                    <div className="flex border-b-[2px] border-black shrink-0">
                      <div className="w-1/2 p-1 border-r-[2px] border-black">
                        <p className="text-[9px] font-bold italic mb-0.5 underline">Details of Receiver (Billed to)</p>
                        <h3 className="font-bold uppercase text-[10px]">{customer.business_name}</h3>
                        <p className="whitespace-pre-line text-[9px] mt-0.5 leading-tight">{customer.billing_address}</p>
                        {customer.phone && <p className="text-[9px] mt-0.5 leading-tight">Phone: {customer.phone}</p>}
                        <div className="mt-1 grid grid-cols-[60px_1fr] gap-y-0.5 text-[9px]">
                          <span className="font-bold">State</span><span>: {customerState.state_name}</span>
                          <span className="font-bold">State Code</span><span>: {customerState.code}</span>
                          <span className="font-bold">GSTIN</span><span className="uppercase">: {customer.gstin || 'Unregistered'}</span>
                        </div>
                      </div>
                      <div className="w-1/2 p-1">
                        <p className="text-[9px] font-bold italic mb-0.5 underline">Details of Consignee (Shipped to)</p>
                        {quotation.is_consignee_different ? (
                          <>
                            <h3 className="font-bold uppercase text-[10px]">{quotation.consignee_name}</h3>
                            <p className="whitespace-pre-line text-[9px] mt-0.5 leading-tight">{quotation.consignee_address}</p>
                            <div className="mt-1 grid grid-cols-[60px_1fr] gap-y-0.5 text-[9px]">
                              <span className="font-bold">State</span><span>: {consigneeState?.state_name}</span>
                              <span className="font-bold">State Code</span><span>: {consigneeState?.code}</span>
                              <span className="font-bold">GSTIN</span><span className="uppercase">: {quotation.consignee_gstin || 'Unregistered'}</span>
                            </div>
                          </>
                        ) : (
                          <div className="h-[70%] flex items-center justify-center">
                            <p className="text-gray-400 italic text-[10px] font-medium">Same as Billed To</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* ========================================= */}
                {/* RENDER MINI-HEADER FOR PAGE 2+            */}
                {/* ========================================= */}
                {!isFirstPage && (
                  <div className="flex justify-between items-center p-1.5 border-b-[2px] border-black bg-slate-50 shrink-0">
                     <p className="font-bold text-[10px] uppercase tracking-wider">Invoice / Bill No: {quotation.bill_no}</p>
                     <p className="font-bold text-[10px] uppercase tracking-wider">Date: {quotation.date_of_supply ? new Date(quotation.date_of_supply).toLocaleDateString('en-IN') : 'N/A'}</p>
                  </div>
                )}

                {/* ========================================= */}
                {/* THE CONTINUOUS TABLE                      */}
                {/* ========================================= */}
                <div className="flex-1 flex flex-col min-h-0">
                  <table className="w-full h-full text-left text-[10px]">
                    <thead className="border-b-[2px] border-black bg-slate-100 shrink-0">
                      <tr className="divide-x-[2px] divide-black">
                        <th className="py-0.5 px-1 text-center w-6 font-bold">S.No</th>
                        <th className="py-0.5 px-1 font-bold">Description of Goods</th>
                        <th className="py-0.5 px-1 text-center font-bold">HSN/SAC</th>
                        <th className="py-0.5 px-1 text-center w-10 font-bold">Qty</th>
                        <th className="py-0.5 px-1 text-right font-bold">Rate</th>
                        <th className="py-0.5 px-1 text-right font-bold">Taxable</th>
                        {isLocal ? (
                          <><th className="py-0.5 px-1 text-right font-bold">CGST</th><th className="py-0.5 px-1 text-right font-bold">SGST</th></>
                        ) : (
                          <th className="py-0.5 px-1 text-right font-bold">IGST</th>
                        )}
                        <th className="py-0.5 px-1 text-right font-extrabold bg-slate-200">Item Total</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y-[1px] divide-black/30">
                      {pageItems.map((item, index) => {
                        const taxForThisItem = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
                        const lineItemTotal = Number(item.taxable_amount) + taxForThisItem;

                        return (
                          <tr key={item.id} className="divide-x-[2px] divide-black">
                            <td className="px-1 py-[2px] text-center font-medium align-middle">{serialOffset + index + 1}</td>
                            <td className="px-1 py-[2px] align-middle">
                              <span className="font-bold text-[11px] leading-tight">{item.products?.name}</span>
                              {Number(item.discount_percent) > 0 && <span className="block text-[8px] text-gray-500 italic mt-[1px]">Disc: {item.discount_percent}%</span>}
                            </td>
                            <td className="px-1 py-[2px] text-center align-middle">{item.products?.hsn_code || '-'}</td>
                            <td className="px-1 py-[2px] text-center font-bold align-middle">{item.qty} <span className="text-[8px] font-normal">{item.products?.uom}</span></td>
                            <td className="px-1 py-[2px] text-right align-middle leading-tight">₹{Number(item.rate).toFixed(2)}</td>
                            <td className="px-1 py-[2px] text-right font-bold text-gray-800 align-middle leading-tight">₹{Number(item.taxable_amount).toFixed(2)}</td>
                            
                            {isLocal ? (
                              <>
                                <td className="px-1 py-[2px] text-right align-middle leading-tight">
                                  ₹{Number(item.cgst_amount).toFixed(2)} <span className="block text-[7px] text-gray-500 leading-none mt-0.5">({item.gst_percent / 2}%)</span>
                                </td>
                                <td className="px-1 py-[2px] text-right align-middle leading-tight">
                                  ₹{Number(item.sgst_amount).toFixed(2)} <span className="block text-[7px] text-gray-500 leading-none mt-0.5">({item.gst_percent / 2}%)</span>
                                </td>
                              </>
                            ) : (
                              <td className="px-1 py-[2px] text-right align-middle leading-tight">
                                ₹{Number(item.igst_amount).toFixed(2)} <span className="block text-[7px] text-gray-500 leading-none mt-0.5">({item.gst_percent}%)</span>
                              </td>
                            )}

                            <td className="px-1 py-[2px] text-right font-extrabold bg-slate-50 text-black align-middle leading-tight">
                              ₹{lineItemTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ========================================= */}
                {/* FOOTER (ONLY ON THE VERY LAST PAGE)       */}
                {/* ========================================= */}
                {isLastPage && (
                  <div className="shrink-0 flex flex-col border-t-[2px] border-black bg-white">
                    
                    {/* TOTALS & BANK DETAILS (Padding and Text Sizing Aggressively Reduced) */}
                    <div className="flex border-b-[2px] border-black">
                      <div className="w-[55%] p-1.5 border-r-[2px] border-black flex flex-col justify-start">
                        <p className="text-[9px] font-bold italic underline mb-1">Bank Details:</p>
                        <div className="grid grid-cols-[65px_1fr] gap-y-0.5 text-[8px]">
                          <span className="font-bold">Bank Name</span><span>: HDFC Bank Ltd.</span>
                          <span className="font-bold">A/C Name</span><span>: YOUR ENTERPRISE NAME</span>
                          <span className="font-bold">A/C Number</span><span>: 50200012345678</span>
                          <span className="font-bold">IFSC Code</span><span>: HDFC0001234</span>
                        </div>
                      </div>

                      <div className="w-[45%] bg-slate-50">
                        <table className="w-full text-[8px]">
                          <tbody className="divide-y-[1px] divide-black/20 border-b-[2px] border-black">
                            <tr><td className="py-0.5 px-1 font-bold">Items Value</td><td className="py-0.5 px-1 text-right font-bold w-20 border-l-[2px] border-black">₹{itemsTaxable.toFixed(2)}</td></tr>
                            {itemsTaxable > 0 && (isLocal ? (<><tr><td className="py-[1px] px-1 text-gray-600 italic pl-3 text-[7px]">CGST on Items</td><td className="py-[1px] px-1 text-right border-l-[2px] border-black text-[7px]">₹{itemsCgst.toFixed(2)}</td></tr><tr><td className="py-[1px] px-1 text-gray-600 italic pl-3 text-[7px]">SGST on Items</td><td className="py-[1px] px-1 text-right border-l-[2px] border-black text-[7px]">₹{itemsSgst.toFixed(2)}</td></tr></>) : (<tr><td className="py-[1px] px-1 text-gray-600 italic pl-3 text-[7px]">IGST on Items</td><td className="py-[1px] px-1 text-right border-l-[2px] border-black text-[7px]">₹{itemsIgst.toFixed(2)}</td></tr>))}
                            {packaging > 0 && (<><tr className="border-t-[1px] border-black/20"><td className="py-0.5 px-1 font-bold">Packaging</td><td className="py-0.5 px-1 text-right font-bold border-l-[2px] border-black">₹{packaging.toFixed(2)}</td></tr></>)}
                            {freight > 0 && (<><tr className="border-t-[1px] border-black/20"><td className="py-0.5 px-1 font-bold">Freight</td><td className="py-0.5 px-1 text-right font-bold border-l-[2px] border-black">₹{freight.toFixed(2)}</td></tr></>)}
                          </tbody>
                          <tbody className="divide-y-[1px] divide-black text-[8px]">
                            <tr><td className="py-0.5 px-1 font-bold">Total Taxable</td><td className="py-0.5 px-1 text-right font-bold border-l-[2px] border-black">₹{totalTaxableValue.toFixed(2)}</td></tr>
                            {isLocal ? (<><tr><td className="py-0.5 px-1 font-bold text-gray-700">Total CGST</td><td className="py-0.5 px-1 text-right border-l-[2px] border-black">₹{Number(quotation.cgst).toFixed(2)}</td></tr><tr><td className="py-0.5 px-1 font-bold text-gray-700">Total SGST</td><td className="py-0.5 px-1 text-right border-l-[2px] border-black">₹{Number(quotation.sgst).toFixed(2)}</td></tr></>) : (<tr><td className="py-0.5 px-1 font-bold text-gray-700">Total IGST</td><td className="py-0.5 px-1 text-right border-l-[2px] border-black">₹{Number(quotation.igst).toFixed(2)}</td></tr>)}
                            <tr className="bg-slate-200"><td className="py-1 px-1 text-[10px] font-black uppercase tracking-wide">Grand Total</td><td className="py-1 px-1 text-right text-[10px] font-black border-l-[2px] border-black">₹{Number(quotation.grand_total).toFixed(2)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* WORDS AND EXTRA DETAILS */}
                    <div className="border-b-[2px] border-black p-1 bg-slate-50 text-[9px]">
                      <span className="font-bold">Invoice Value (In Words): </span><span className="italic font-medium">{numberToWords(quotation.grand_total)}</span>
                    </div>

                    <div className="border-b-[2px] border-black p-1 text-[9px]">
                      <span className="font-bold">Tax is payable on reverse charge (Yes/No): </span><span>{quotation.reverse_charge ? 'Yes' : 'No'}</span>
                    </div>

                    <div className="border-b-[2px] border-black p-1 text-center text-[9px] font-bold tracking-wide">
                      Certified that the particulars given above are true and correct.
                    </div>

                    {/* TERMS AND SIGNATURE */}
                    <div className="flex">
                      <div className="w-[60%] p-1.5 border-r-[2px] border-black">
                        <p className="text-[9px] font-bold italic underline mb-0.5">Terms & Conditions:</p>
                        <ul className="text-[8px] list-decimal list-inside space-y-[1px] font-medium text-gray-800 leading-tight">
                          <li>Goods once sold will not be taken back or exchanged.</li>
                          <li>Interest @ 18% p.a. will be charged if payment is delayed beyond 15 days.</li>
                          <li>Our responsibility ceases the moment goods leave our premises.</li>
                          <li>Subject to Delhi jurisdiction only.</li>
                        </ul>
                      </div>

                      <div className="w-[40%] p-1.5 flex flex-col justify-between items-end text-center">
                        <p className="font-bold w-full text-right text-[9px]">For YOUR ENTERPRISE NAME</p>
                        <div className="h-6"></div> 
                        <div className="w-32 border-t border-black pt-0.5 mr-1">
                          <p className="text-[8px] font-bold uppercase tracking-wider">Authorized Signatory</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}