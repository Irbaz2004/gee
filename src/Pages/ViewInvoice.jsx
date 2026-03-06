import React, { useState, useEffect } from "react";
import { getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../config";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { getCompanyCollection } from "../utils/firestoreUtils";

import Logo from "../assets/Logo.png";

const ViewInvoice = () => {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [notification, setNotification] = useState({ message: "", type: "", show: false });
  const [filters, setFilters] = useState({
    search: "",
    clientName: "",
    fromDate: "",
    toDate: "",
  });

  // Fetch invoices from Firebase
  useEffect(() => {
    fetchInvoices();
  }, [selectedCompany]);

  const fetchInvoices = async () => {
    try {
      if (!selectedCompany) return;

      setLoading(true);
      const invoicesCollection = getCompanyCollection(db, selectedCompany.id, "invoices");
      const invoicesSnapshot = await getDocs(invoicesCollection);
      const invoicesList = invoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by date (newest first)
      invoicesList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setInvoices(invoicesList);
      setFilteredInvoices(invoicesList);
      showNotification("Invoices loaded successfully!", "success");
    } catch (error) {
      console.error("Error fetching invoices:", error);
      showNotification("Failed to load invoices", "error");
    } finally {
      setLoading(false);
    }
  };

  // Custom notification function
  const showNotification = (message, type = "info") => {
    setNotification({ message, type, show: true });

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification({ message: "", type: "", show: false });
    }, 3000);
  };

  // Apply filters
  useEffect(() => {
    let result = [...invoices];

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(searchTerm) ||
        invoice.clientName.toLowerCase().includes(searchTerm) ||
        (invoice.companyName && invoice.companyName.toLowerCase().includes(searchTerm))
      );
    }

    // Client name filter
    if (filters.clientName) {
      result = result.filter(invoice =>
        invoice.clientName.toLowerCase() === filters.clientName.toLowerCase()
      );
    }

    // Date range filter
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate);
      result = result.filter(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate || invoice.timestamp);
        return invoiceDate >= fromDate;
      });
    }

    if (filters.toDate) {
      const toDate = new Date(filters.toDate);
      toDate.setHours(23, 59, 59, 999); // End of day
      result = result.filter(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate || invoice.timestamp);
        return invoiceDate <= toDate;
      });
    }

    setFilteredInvoices(result);
  }, [filters, invoices]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      clientName: "",
      fromDate: "",
      toDate: "",
    });
    showNotification("Filters cleared", "info");
  };

  // Get unique client names for filter dropdown
  const clientNames = [...new Set(invoices.map(invoice => invoice.clientName))].sort();

  // Edit invoice
  const handleEditInvoice = (invoice) => {
    // Navigate to edit page with invoice data
    navigate(`/edit-invoice/${invoice.id}`, { state: { invoice } });
  };

  // View invoice details
  const handleViewDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailsModal(true);
  };

  // Delete invoice confirmation
  const confirmDeleteInvoice = (invoice) => {
    setInvoiceToDelete(invoice);
    setShowDeleteConfirm(true);
  };

  // Delete invoice
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    try {
      const invoiceRef = doc(db, "companies", selectedCompany.id, "invoices", invoiceToDelete.id);
      await deleteDoc(invoiceRef);
      showNotification(`Invoice ${invoiceToDelete.invoiceNumber} deleted successfully!`, "success");
      fetchInvoices(); // Refresh the list
    } catch (error) {
      console.error("Error deleting invoice:", error);
      showNotification("Failed to delete invoice", "error");
    } finally {
      setShowDeleteConfirm(false);
      setInvoiceToDelete(null);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setInvoiceToDelete(null);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN");
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Format number for display
  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      if (filteredInvoices.length === 0) {
        showNotification("No invoices to export", "warning");
        return;
      }

      // Prepare data for Excel
      const excelData = filteredInvoices.map(invoice => {
        const totals = invoice.totals || calculateInvoiceTotals(invoice);
        return {
          "Invoice No": invoice.invoiceNumber,
          "Date": formatDate(invoice.invoiceDate || invoice.timestamp),
          "Client Name": invoice.clientName,
          "Client GSTIN": invoice.clientGSTIN || "N/A",
          "Company Name": invoice.companyName || "N/A",
          "Total Items": invoice.materials?.length || 0,
          "Sub Total": totals.subTotal || 0,
          "CGST Amount": totals.cgstAmount || 0,
          "SGST Amount": totals.sgstAmount || 0,
          "Grand Total": totals.total || 0,
          "PO Number": invoice.poNumber || "N/A",
          "DC No": invoice.DCNO || "N/A",
          "Created Date": formatDate(invoice.timestamp),
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

      // Set column widths
      const colWidths = [
        { wch: 15 }, // Invoice No
        { wch: 12 }, // Date
        { wch: 25 }, // Client Name
        { wch: 20 }, // Client GSTIN
        { wch: 30 }, // Company Name
        { wch: 12 }, // Total Items
        { wch: 15 }, // Sub Total
        { wch: 15 }, // CGST Amount
        { wch: 15 }, // SGST Amount
        { wch: 15 }, // Grand Total
        { wch: 15 }, // PO Number
        { wch: 12 }, // Bill No
        { wch: 12 }, // DC No
        { wch: 12 }, // Created Date
      ];
      worksheet['!cols'] = colWidths;

      // Generate Excel file
      const fileName = `Invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showNotification(`Exported ${filteredInvoices.length} invoices to Excel`, "success");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showNotification("Failed to export to Excel", "error");
    }
  };

  // Export specific invoice details to Excel
  const exportInvoiceDetailsToExcel = (invoice) => {
    try {
      const invoiceData = [{
        "Invoice No": invoice.invoiceNumber,
        "Invoice Date": formatDate(invoice.invoiceDate || invoice.timestamp),
        "Client Name": invoice.clientName,
        "Client Address": invoice.clientAddress || "N/A",
        "Client GSTIN": invoice.clientGSTIN || "N/A",
        "Client Contact": invoice.clientContact || "N/A",
        "Company Name": invoice.companyName || "N/A",
        "Company Address": invoice.companyAddress || "N/A",
        "Company GSTIN": invoice.companyGSTIN || "N/A",
        "Company Contact": invoice.companyContact || "N/A",
        "PO Number": invoice.poNumber || "N/A",
        "DC No": invoice.DCNO || "N/A",
        "DC Date": formatDate(invoice.DCDate),
        "CGST %": invoice.cgstPercentage || 0,
        "SGST %": invoice.sgstPercentage || 0,
      }];

      // Create materials data
      const materialsData = (invoice.materials || []).map((material, index) => ({
        "S.No.": index + 1,
        "Material Description": material.description,
        "HSN/SAC": material.hsn,
        "Quantity": material.quantity,
        "Rate": material.rate,
        "Amount": material.amount,
      }));

      const totals = invoice.totals || calculateInvoiceTotals(invoice);
      const totalsData = [{
        "Sub Total": totals.subTotal,
        "CGST Amount": totals.cgstAmount,
        "SGST Amount": totals.sgstAmount,
        "Grand Total": totals.total,
      }];

      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();

      // Invoice details sheet
      const invoiceSheet = XLSX.utils.json_to_sheet(invoiceData);
      XLSX.utils.book_append_sheet(workbook, invoiceSheet, "Invoice Details");

      // Materials sheet
      const materialsSheet = XLSX.utils.json_to_sheet(materialsData);
      XLSX.utils.book_append_sheet(workbook, materialsSheet, "Materials");

      // Totals sheet
      const totalsSheet = XLSX.utils.json_to_sheet(totalsData);
      XLSX.utils.book_append_sheet(workbook, totalsSheet, "Totals");

      // Set column widths
      invoiceSheet['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
        { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 40 },
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
      ];

      materialsSheet['!cols'] = [
        { wch: 8 }, { wch: 40 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }
      ];

      totalsSheet['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];

      const fileName = `Invoice_${invoice.invoiceNumber}_Details.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showNotification(`Exported invoice ${invoice.invoiceNumber} details to Excel`, "success");
    } catch (error) {
      console.error("Error exporting invoice details:", error);
      showNotification("Failed to export invoice details", "error");
    }
  };

  // Download PDF
  const handleDownloadPDF = async (invoice) => {
    try {
      showNotification(`Generating PDF for invoice ${invoice.invoiceNumber}...`, "info");
      await generateAndDownloadPDF(invoice);
    } catch (error) {
      console.error("Error in handleDownloadPDF:", error);
      showNotification("Failed to generate PDF", "error");
    }
  };

  const generateAndDownloadPDF = async (invoice) => {
    try {
      const pdf = await generatePDFDocument(invoice);

      // Save the PDF
      const fileName = `Invoice_${invoice.invoiceNumber}_${new Date(invoice.invoiceDate || invoice.timestamp).toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
      showNotification(`PDF downloaded: ${fileName}`, "success");
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  };



  const generatePDFDocument = async (invoice) => {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const materials = invoice.materials || [];
          const totals = invoice.totals || calculateInvoiceTotals(invoice);
          const materialsPerPage = 13; // Changed from 8 to 13 to match original
          const pageCount = Math.ceil(materials.length / materialsPerPage);

          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          });

          // Generate each page
          for (let page = 0; page < pageCount; page++) {
          if (page > 0) {
            pdf.addPage();
          }

          // Create a simple HTML string for the page
          const pageHTML = generatePageHTML(invoice, page, materialsPerPage, pageCount, totals);

          // Create temporary container - Matching original structure
          const tempContainer = document.createElement("div");
          tempContainer.style.position = "fixed";
          tempContainer.style.left = "-10000px";
          tempContainer.style.top = "0";
          tempContainer.style.width = "200mm"; // Adjusted for border
          tempContainer.style.backgroundColor = "white";
          tempContainer.style.fontFamily = "'Poppins', sans-serif";
          tempContainer.style.overflow = "visible";

          // Create inner page div with border and padding
          const pageDiv = document.createElement("div");
          pageDiv.style.width = "200mm";
          pageDiv.style.padding = "8mm 6mm";
          pageDiv.style.margin = "0";
          pageDiv.style.backgroundColor = "white";
          pageDiv.style.boxSizing = "border-box";
          pageDiv.style.fontFamily = "'Poppins', sans-serif";
          pageDiv.style.minHeight = "285mm";
          pageDiv.style.border = "2px solid #001F3F";
          pageDiv.style.borderRadius = "3px";

          pageDiv.innerHTML = pageHTML;
          tempContainer.appendChild(pageDiv);
          document.body.appendChild(tempContainer);

          // Wait for images to load
          await new Promise(resolve => setTimeout(resolve, 500));

          // Convert to canvas - Matching original settings
          const canvas = await html2canvas(pageDiv, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            width: pageDiv.offsetWidth,
            height: pageDiv.offsetHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: pageDiv.scrollWidth,
            windowHeight: pageDiv.scrollHeight,
            logging: false,
          });

          // Remove temporary container
          document.body.removeChild(tempContainer);

          // Add image to PDF - Matching original dimensions
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = 186; // Adjusted for border
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          const xPos = 12; // Adjusted for border
          const yPos = 12; // Adjusted for border
          pdf.addImage(imgData, "PNG", xPos, yPos, imgWidth, imgHeight);
        }

          resolve(pdf);
        } catch (error) {
          reject(error);
        }
      })();
    });
  };

  // Helper function to generate page HTML matching the original structure
  const generatePageHTML = (invoice, page, materialsPerPage, pageCount, totals) => {
    const startIdx = page * materialsPerPage;
    const endIdx = Math.min(startIdx + materialsPerPage, invoice.materials.length);

    let html = '';

    // Header Section (only on first page)
    if (page === 0) {
      html += `
      <div class="pdf-header" style="margin-bottom: 10px; font-family: 'Poppins', sans-serif;">
        <!-- Company Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1.5px solid #001F3F; font-family: 'Poppins', sans-serif;">
          <!-- Left side - Logo -->
          <div style="flex: 1; display: flex; align-items: center;">
            <img src="${invoice.logo || Logo}" alt="Company Logo" style="height: 130px; width: auto; display: block; object-fit: contain;">
          </div>
          
          <!-- Right side - Invoice details -->
          <div style="flex: 1; text-align: right; font-family: 'Poppins', sans-serif;">
            <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #001F3F; font-weight: 600; font-family: 'Poppins', sans-serif;">TAX INVOICE</h2>
            <div style="font-size: 11px; line-height: 1.5; color: #001F3F; font-family: 'Poppins', sans-serif;">
              <div><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
              <div><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</div>
              ${invoice.poNumber ? `<div><strong>PO Number:</strong> ${invoice.poNumber}</div>` : ''}
              ${invoice.BillNo ? `<div><strong>Bill No:</strong> ${invoice.BillNo}</div>` : ''}
              ${invoice.DCNO ? `<div><strong>DC No:</strong> ${invoice.DCNO}</div>` : ''}
              ${invoice.DCDate ? `<div><strong>DC Date:</strong> ${invoice.DCDate}</div>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Client details section -->
        <div style="display: flex; justify-content: space-between; margin-top: 10px; padding: 10px; background-color: #F5F7FA; border: 1px solid #001F3F; border-radius: 4px; font-size: 11px; font-family: 'Poppins', sans-serif; line-height: 1.4;">
          <!-- From -->
          <div style="flex: 1; font-family: 'Poppins', sans-serif;">
            <h3 style="margin: 0 0 6px 0; color: #001F3F; font-size: 13px; font-weight: 600; font-family: 'Poppins', sans-serif;">From:</h3>
            <div style="color: #001F3F; font-family: 'Poppins', sans-serif;">
              <div style="font-weight: 600; margin-bottom: 3px;">${invoice.companyName}</div>
              <div style="margin-bottom: 3px;">${invoice.companyAddress}</div>
              ${invoice.companyemail ? `<div style="margin-bottom: 3px;"><strong>Email:</strong> ${invoice.companyemail}</div>` : ''}
              ${invoice.companyGSTIN ? `<div style="margin-bottom: 3px;"><strong>GSTIN:</strong> ${invoice.companyGSTIN}</div>` : ''}
              ${invoice.companyContact ? `<div style="margin-bottom: 3px;"><strong>Contact:</strong> ${invoice.companyContact}</div>` : ''}
              ${invoice.companyDescription ? `<div style="margin-top: 4px; font-style: italic; font-size: 10px;"><em>${invoice.companyDescription}</em></div>` : ''}
            </div>
          </div>
          
          <!-- To -->
          <div style="flex: 1; margin-left: 20px; font-family: 'Poppins', sans-serif;">
            <h3 style="margin: 0 0 6px 0; color: #001F3F; font-size: 13px; font-weight: 600; font-family: 'Poppins', sans-serif;">To:</h3>
            <div style="color: #001F3F; font-family: 'Poppins', sans-serif;">
              <div style="font-weight: 600; margin-bottom: 3px;">${invoice.clientName}</div>
              <div style="margin-bottom: 3px;">${invoice.clientAddress}</div>
              ${invoice.clientGSTIN ? `<div style="margin-bottom: 3px;"><strong>GSTIN:</strong> ${invoice.clientGSTIN}</div>` : ''}
              ${invoice.clientContact ? `<div style="margin-bottom: 3px;"><strong>Contact:</strong> ${invoice.clientContact}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    }

    // Materials Table
    html += `
    <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: ${page === 0 ? '10px' : '0'}; color: #001F3F; font-family: 'Poppins', sans-serif; table-layout: fixed;">
      <thead style="background-color: #001F3F; color: white; font-family: 'Poppins', sans-serif;">
        <tr style="font-family: 'Poppins', sans-serif; height: 22px;">
          <th style="border: 1px solid #001F3F; padding: 5px; width: 4%; font-family: 'Poppins', sans-serif; font-size: 10px;">S.No.</th>
          <th style="border: 1px solid #001F3F; padding: 5px; width: 52%; font-family: 'Poppins', sans-serif; font-size: 10px;">Material Description</th>
          <th style="border: 1px solid #001F3F; padding: 5px; width: 10%; font-family: 'Poppins', sans-serif; font-size: 10px;">HSN/SAC</th>
          <th style="border: 1px solid #001F3F; padding: 5px; width: 8%; font-family: 'Poppins', sans-serif; font-size: 10px;">Qty.</th>
          <th style="border: 1px solid #001F3F; padding: 5px; width: 13%; font-family: 'Poppins', sans-serif; font-size: 10px;">Rate (₹)</th>
          <th style="border: 1px solid #001F3F; padding: 5px; width: 13%; font-family: 'Poppins', sans-serif; font-size: 10px;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody style="font-family: 'Poppins', sans-serif;">
  `;

    // Add material rows
    for (let i = startIdx; i < endIdx; i++) {
      const material = invoice.materials[i];
      const description = material.description || '';
      const truncatedDescription = description.length > 120 ?
        description.substring(0, 120) + '...' : description;

      html += `
      <tr style="height: 20px; background-color: ${i % 2 === 0 ? '#F5F7FA' : 'white'}; font-family: 'Poppins', sans-serif;">
        <td style="border: 1px solid #001F3F; padding: 5px; text-align: center; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px; vertical-align: top;">${i + 1}.</td>
        <td style="border: 1px solid #001F3F; padding: 5px; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px; vertical-align: top; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${description}">${truncatedDescription}</td>
        <td style="border: 1px solid #001F3F; padding: 5px; text-align: center; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px; vertical-align: top;">${material.hsn || ''}</td>
        <td style="border: 1px solid #001F3F; padding: 5px; text-align: center; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px; vertical-align: top;">${material.quantity || ''}</td>
        <td style="border: 1px solid #001F3F; padding: 5px; text-align: right; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px; vertical-align: top;">${formatNumber(material.rate)}</td>
        <td style="border: 1px solid #001F3F; padding: 5px; text-align: right; font-weight: bold; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px; vertical-align: top;">${formatNumber(material.amount)}</td>
      </tr>
    `;
    }

    // Add empty rows if needed
    const remainingRows = materialsPerPage - (endIdx - startIdx);
    for (let i = 0; i < remainingRows; i++) {
      html += `
      <tr style="height: 20px; font-family: 'Poppins', sans-serif;">
        <td style="border: 1px solid #001F3F; padding: 5px; color: #001F3F; font-family: 'Poppins', sans-serif; font-size: 10px;">${endIdx + i + 1}.</td>
        <td style="border: 1px solid #001F3F; padding: 5px; font-family: 'Poppins', sans-serif;"></td>
        <td style="border: 1px solid #001F3F; padding: 5px; font-family: 'Poppins', sans-serif;"></td>
        <td style="border: 1px solid #001F3F; padding: 5px; font-family: 'Poppins', sans-serif;"></td>
        <td style="border: 1px solid #001F3F; padding: 5px; font-family: 'Poppins', sans-serif;"></td>
        <td style="border: 1px solid #001F3F; padding: 5px; font-family: 'Poppins', sans-serif;"></td>
      </tr>
    `;
    }

    // Add totals for last page
    if (page === pageCount - 1) {
      html += `
      <!-- Subtotal -->
      <tr style="background-color: #E8F4F8; font-family: 'Poppins', sans-serif; height: 22px;">
        <td colspan="5" style="border: 1px solid #001F3F; padding: 7px; text-align: right; font-weight: bold; font-size: 11px; color: #001F3F; font-family: 'Poppins', sans-serif;">Sub Total:</td>
        <td style="border: 1px solid #001F3F; padding: 7px; font-weight: bold; font-size: 11px; text-align: right; color: #001F3F; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.subTotal)}</td>
      </tr>
      
      <!-- CGST -->
      <tr style="background-color: #F0F8E8; font-family: 'Poppins', sans-serif; height: 22px;">
        <td colspan="5" style="border: 1px solid #001F3F; padding: 7px; text-align: right; font-weight: bold; font-size: 11px; color: #001F3F; font-family: 'Poppins', sans-serif;">CGST (${invoice.cgstPercentage || 0}%):</td>
        <td style="border: 1px solid #001F3F; padding: 7px; font-weight: bold; font-size: 11px; text-align: right; color: #001F3F; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.cgstAmount)}</td>
      </tr>
      
      <!-- SGST -->
      <tr style="background-color: #F0F8E8; font-family: 'Poppins', sans-serif; height: 22px;">
        <td colspan="5" style="border: 1px solid #001F3F; padding: 7px; text-align: right; font-weight: bold; font-size: 11px; color: #001F3F; font-family: 'Poppins', sans-serif;">SGST (${invoice.sgstPercentage || 0}%):</td>
        <td style="border: 1px solid #001F3F; padding: 7px; font-weight: bold; font-size: 11px; text-align: right; color: #001F3F; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.sgstAmount)}</td>
      </tr>
      
      <!-- Grand Total -->
      <tr style="background-color: #001F3F; color: white; font-family: 'Poppins', sans-serif; height: 24px;">
        <td colspan="5" style="border: 1px solid #001F3F; padding: 9px; text-align: right; font-weight: bold; font-size: 12px; font-family: 'Poppins', sans-serif;">GRAND TOTAL:</td>
        <td style="border: 1px solid #001F3F; padding: 9px; font-weight: bold; font-size: 12px; text-align: right; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.total)}</td>
      </tr>
    `;
    }

    html += '</tbody></table>';

    // Add footer for last page
    if (page === pageCount - 1) {
      html += `
      <div style="margin-top: 15px; font-family: 'Poppins', sans-serif;">
        <!-- Amount in words -->
        <div style="border: 1.5px solid #001F3F; padding: 10px; font-size: 10px; background-color: #F5F7FA; border-radius: 4px 4px 0 0; color: #001F3F; min-height: 45px; font-family: 'Poppins', sans-serif; line-height: 1.4;">
          <div style="font-family: 'Poppins', sans-serif;">
            <strong>Amount Chargeable (in words):</strong> Indian Rupees ${numberToWords(totals.total).toUpperCase()}
          </div>
          <div style="text-align: right; margin-top: 5px; font-weight: bold; color: #001F3F; font-size: 10px; font-family: 'Poppins', sans-serif;">
            E. & O.E
          </div>
        </div>
        
        <!-- Signature box -->
        <div style="border: 1.5px solid #001F3F; border-top: none; border-bottom: none; padding: 12px; font-size: 10px; background-color: white; text-align: center; font-family: 'Poppins', sans-serif;">
          <div style="color: #001F3F; margin-bottom: 50px; text-align: right; font-family: 'Poppins', sans-serif;">
            <strong style="font-size: 11px; font-family: 'Poppins', sans-serif;">For ${invoice.companyName}</strong>
          </div>
          <div style="font-size: 9px; color: #666; margin-top: 12px; text-align: right; font-family: 'Poppins', sans-serif;">
            Authorized Signatory
          </div>
        </div>
        
        <!-- Footer note -->
        <div style="border: 1.5px solid #001F3F; border-top: none; padding: 8px; text-align: center; font-size: 9px; background-color: #001F3F; color: white; border-radius: 0 0 4px 4px; font-family: 'Poppins', sans-serif;">
          SUBJECT TO ${(invoice.companyState || '').toUpperCase()} JURISDICTION | This is a Computer Generated Invoice
        </div>
      </div>
    `;
    }

    return html;
  };



  const calculateInvoiceTotals = (invoice) => {
    const subTotal = (invoice.materials || []).reduce(
      (sum, material) => sum + (material.amount || 0),
      0,
    );
    const cgstAmount = (subTotal * (invoice.cgstPercentage || 0)) / 100;
    const sgstAmount = (subTotal * (invoice.sgstPercentage || 0)) / 100;
    const total = subTotal + cgstAmount + sgstAmount;
    return { subTotal, cgstAmount, sgstAmount, total };
  };

  const numberToWords = (num) => {
    const words = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen"
    ];
    const tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    if (num === 0) return "Zero";

    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = Math.floor((num % 1000) / 100);
    const rest = num % 100;

    let result = "";

    if (crore > 0) result += numberToWords(crore) + " Crore ";
    if (lakh > 0) result += numberToWords(lakh) + " Lakh ";
    if (thousand > 0) result += numberToWords(thousand) + " Thousand ";
    if (hundred > 0) result += numberToWords(hundred) + " Hundred ";

    if (rest > 0) {
      if (result !== "") result += "and ";
      if (rest < 20) {
        result += words[rest];
      } else {
        result += tens[Math.floor(rest / 10)];
        if (rest % 10 > 0) {
          result += " " + words[rest % 10];
        }
      }
    }

    return result.trim() + " Rupees Only";
  };

  // Close details modal
  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedInvoice(null);
  };

  return (
    <div style={styles.container}>
      {/* Notification Banner */}
      {notification.show && (
        <div style={{
          ...styles.notification,
          backgroundColor: notification.type === 'success' ? '#4CAF50' :
            notification.type === 'error' ? '#FF6B6B' :
              notification.type === 'warning' ? '#FF9800' : '#2196F3'
        }}>
          <span style={styles.notificationText}>{notification.message}</span>
          <button
            onClick={() => setNotification({ message: "", type: "", show: false })}
            style={styles.notificationClose}
          >
            &times;
          </button>
        </div>
      )}

      <div style={styles.header}>
        <h1 style={styles.title}>View Invoices</h1>
        <button onClick={exportToExcel} style={styles.exportButton}>
          Export All to Excel
        </button>
      </div>

      {/* Filters Section */}
      <div style={styles.filtersSection}>
        <h2 style={styles.sectionTitle}>Filters:</h2>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search</label>
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search by Invoice No, Client Name..."
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Client Name</label>
            <select
              name="clientName"
              value={filters.clientName}
              onChange={handleFilterChange}
              style={styles.filterInput}
            >
              <option value="">All Clients</option>
              {clientNames.map((name, index) => (
                <option key={index} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>From Date</label>
            <input
              type="date"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleFilterChange}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>To Date</label>
            <input
              type="date"
              name="toDate"
              value={filters.toDate}
              onChange={handleFilterChange}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>&nbsp;</label>
            <button onClick={clearFilters} style={styles.clearButton}>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div style={styles.resultsCount}>
        <p>Showing {filteredInvoices.length} of {invoices.length} invoices</p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p>Loading invoices...</p>
        </div>
      ) : (
        <>
          {/* Invoices Table */}
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeader}>S.No</th>
                  <th style={styles.tableHeader}>Invoice No</th>
                  <th style={styles.tableHeader}>Date</th>
                  <th style={styles.tableHeader}>Client Name</th>
                  <th style={styles.tableHeader}>Total Amount</th>
                  <th style={styles.tableHeader}>Items</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={styles.noDataCell}>
                      No invoices found. {invoices.length === 0 ? "Create your first invoice!" : "Try different filters."}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice, index) => (
                    <tr key={invoice.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <strong>{index + 1}.</strong>
                      </td>
                      <td style={styles.tableCell}>
                        <strong>{invoice.invoiceNumber}</strong>
                      </td>
                      <td style={styles.tableCell}>
                        {formatDate(invoice.invoiceDate || invoice.timestamp)}
                      </td>
                      <td style={styles.tableCell}>
                        {invoice.clientName}
                      </td>
                      <td style={styles.tableCell}>
                        {formatCurrency(invoice.totals?.total || calculateInvoiceTotals(invoice).total)}
                      </td>
                      <td style={styles.tableCell}>
                        {invoice.materials?.length || 0} items
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.actionButtons}>
                          <button
                            onClick={() => handleViewDetails(invoice)}
                            style={styles.viewButton}
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            style={styles.editButton}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(invoice)}
                            style={styles.downloadButton}
                          >
                            Download PDF
                          </button>
                          <button
                            onClick={() => exportInvoiceDetailsToExcel(invoice)}
                            style={styles.excelButton}
                          >
                            Export Excel
                          </button>
                          <button
                            onClick={() => confirmDeleteInvoice(invoice)}
                            style={styles.deleteButton}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Invoice Details Modal */}
      {showDetailsModal && selectedInvoice && (
        <div style={styles.modalOverlay} onClick={closeDetailsModal}>
          <div style={styles.detailsModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Invoice Details - {selectedInvoice.invoiceNumber}
              </h2>
              <button onClick={closeDetailsModal} style={styles.closeButton}>
                &times;
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailsContainer}>
                {/* Invoice Info */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Invoice Information</h3>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <strong>Invoice Number:</strong> {selectedInvoice.invoiceNumber}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Invoice Date:</strong> {formatDate(selectedInvoice.invoiceDate)}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>PO Number:</strong> {selectedInvoice.poNumber || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>PO Number:</strong> {selectedInvoice.poNumber || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>DC No:</strong> {selectedInvoice.DCNO || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>DC Date:</strong> {formatDate(selectedInvoice.DCDate)}
                    </div>
                  </div>
                </div>

                {/* Company Details */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Company Details</h3>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <strong>Company Name:</strong> {selectedInvoice.companyName || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Company Address:</strong> {selectedInvoice.companyAddress || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Company GSTIN:</strong> {selectedInvoice.companyGSTIN || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Company Contact:</strong> {selectedInvoice.companyContact || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Company Email:</strong> {selectedInvoice.companyemail || "N/A"}
                    </div>
                  </div>
                </div>

                {/* Client Details */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Client Details</h3>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <strong>Client Name:</strong> {selectedInvoice.clientName}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Client Address:</strong> {selectedInvoice.clientAddress || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Client GSTIN:</strong> {selectedInvoice.clientGSTIN || "N/A"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>Client Contact:</strong> {selectedInvoice.clientContact || "N/A"}
                    </div>
                  </div>
                </div>

                {/* Tax Details */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Tax Details</h3>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <strong>CGST %:</strong> {selectedInvoice.cgstPercentage || 0}%
                    </div>
                    <div style={styles.detailItem}>
                      <strong>SGST %:</strong> {selectedInvoice.sgstPercentage || 0}%
                    </div>
                  </div>
                </div>

                {/* Materials Table */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Materials ({selectedInvoice.materials?.length || 0} items)</h3>
                  <div style={styles.materialsTableContainer}>
                    <table style={styles.materialsTable}>
                      <thead>
                        <tr>
                          <th style={styles.materialsTableHeader}>S.No.</th>
                          <th style={styles.materialsTableHeader}>Description</th>
                          <th style={styles.materialsTableHeader}>HSN/SAC</th>
                          <th style={styles.materialsTableHeader}>Qty</th>
                          <th style={styles.materialsTableHeader}>Rate (₹)</th>
                          <th style={styles.materialsTableHeader}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.materials?.map((material, index) => (
                          <tr key={index}>
                            <td style={styles.materialsTableCell}>{index + 1}</td>
                            <td style={styles.materialsTableCell}>{material.description}</td>
                            <td style={styles.materialsTableCell}>{material.hsn}</td>
                            <td style={styles.materialsTableCell}>{material.quantity}</td>
                            <td style={styles.materialsTableCell}>{formatNumber(material.rate)}</td>
                            <td style={styles.materialsTableCell}>{formatNumber(material.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Totals</h3>
                  <div style={styles.totalsContainer}>
                    <div style={styles.totalItem}>
                      <strong>Sub Total:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).subTotal)}
                    </div>
                    <div style={styles.totalItem}>
                      <strong>CGST Amount:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).cgstAmount)}
                    </div>
                    <div style={styles.totalItem}>
                      <strong>SGST Amount:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).sgstAmount)}
                    </div>
                    <div style={{ ...styles.totalItem, ...styles.grandTotal }}>
                      <strong>Grand Total:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).total)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  style={styles.downloadButton}
                >
                  Download PDF
                </button>
                <button
                  onClick={() => exportInvoiceDetailsToExcel(selectedInvoice)}
                  style={styles.excelButton}
                >
                  Export to Excel
                </button>
                <button
                  onClick={closeDetailsModal}
                  style={styles.cancelButton}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && invoiceToDelete && (
        <div style={styles.modalOverlay} onClick={cancelDelete}>
          <div style={styles.confirmModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Confirm Delete</h2>
              <button onClick={cancelDelete} style={styles.closeButton}>
                &times;
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.confirmText}>
                Are you sure you want to delete invoice <strong>{invoiceToDelete.invoiceNumber}</strong>
                for client <strong>{invoiceToDelete.clientName}</strong>?
              </p>
              <p style={styles.warningText}>
                This action cannot be undone. All data related to this invoice will be permanently deleted.
              </p>
              <div style={styles.modalActions}>
                <button
                  onClick={handleDeleteInvoice}
                  style={styles.deleteConfirmButton}
                >
                  Yes, Delete Invoice
                </button>
                <button
                  onClick={cancelDelete}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: "#FFFFFF",
    minHeight: "80vh",
    borderRadius: "30px",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#001F3F",
    position: "relative",
  },
  notification: {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "15px 20px",
    borderRadius: "8px",
    color: "white",
    zIndex: 1001,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: "300px",
    maxWidth: "500px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    animation: "slideIn 0.3s ease",
  },
  notificationText: {
    flex: 1,
    marginRight: "10px",
  },
  notificationClose: {
    background: "none",
    border: "none",
    color: "white",
    fontSize: "20px",
    cursor: "pointer",
    padding: "0",
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  title: {
    color: "#001F3F",
    margin: "0 10px 0 0",
    fontSize: "1.5rem",
    fontWeight: "700",
  },
  exportButton: {
    backgroundColor: "#4CAF50",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  },
  filtersSection: {
    backgroundColor: "#F8FAFF",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  sectionTitle: {
    color: "#001F3F",
    fontSize: "1.2rem",
    marginBottom: "15px",
    fontWeight: "600",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "15px",
    alignItems: "end",
  },
  filterGroup: {
    marginBottom: "10px",
  },
  filterLabel: {
    display: "block",
    marginBottom: "5px",
    color: "#001F3F",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  filterInput: {
    width: "100%",
    padding: "8px 10px",
    border: "2px solid #001F3F",
    borderRadius: "4px",
    fontSize: "0.9rem",
    backgroundColor: "#FFFFFF",
    color: "#001F3F",
    boxSizing: "border-box",
  },
  clearButton: {
    backgroundColor: "#FF6B6B",
    color: "#FFFFFF",
    border: "none",
    padding: "8px 15px",
    borderRadius: "4px",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
    width: "100%",
  },
  resultsCount: {
    backgroundColor: "#F0F8FF",
    padding: "8px 12px",
    borderRadius: "4px",
    marginBottom: "15px",
    borderLeft: "4px solid #001F3F",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
  },
  loadingSpinner: {
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #001F3F",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
    marginBottom: "15px",
  },
  tableContainer: {
    overflowX: "auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0, 31, 63, 0.1)",
    marginBottom: "20px",
    maxHeight: "400px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#FFFFFF",
  },
  tableHeaderRow: {
    backgroundColor: "#001F3F",
  },
  tableHeader: {
    padding: "12px",
    textAlign: "left",
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: "0.9rem",
    borderBottom: "3px solid #001F3F",
    whiteSpace: "nowrap",
  },
  tableRow: {
    borderBottom: "1px solid #E0E0E0",
    transition: "background-color 0.2s ease",
  },
  tableCell: {
    padding: "10px 12px",
    color: "#001F3F",
    fontSize: "0.85rem",
    verticalAlign: "middle",
  },
  noDataCell: {
    padding: "30px",
    textAlign: "center",
    color: "#666",
    fontSize: "1rem",
    fontStyle: "italic",
  },
  actionButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
  },
  viewButton: {
    backgroundColor: "#2196F3",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  editButton: {
    backgroundColor: "#FFC107",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  downloadButton: {
    backgroundColor: "#4CAF50",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  excelButton: {
    backgroundColor: "#FF9800",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "10px",
  },
  detailsModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    width: "95%",
    maxWidth: "900px",
    maxHeight: "90vh",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
  },
  confirmModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    width: "95%",
    maxWidth: "500px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
  },
  modalTitle: {
    margin: 0,
    fontSize: "1.2rem",
    fontWeight: "600",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#FFFFFF",
    fontSize: "1.5rem",
    cursor: "pointer",
    padding: 0,
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s ease",
  },
  modalBody: {
    padding: "20px",
    maxHeight: "calc(90vh - 70px)",
    overflow: "auto",
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  detailsSection: {
    backgroundColor: "#F8FAFF",
    padding: "15px",
    borderRadius: "6px",
    border: "1px solid #E0E0E0",
  },
  detailsSectionTitle: {
    color: "#001F3F",
    fontSize: "1.1rem",
    marginBottom: "15px",
    fontWeight: "600",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "10px",
  },
  detailItem: {
    padding: "8px 0",
    color: "#001F3F",
    fontSize: "0.9rem",
    borderBottom: "1px solid #E0E0E0",
  },
  materialsTableContainer: {
    overflowX: "auto",
    marginTop: "10px",
  },
  materialsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.85rem",
  },
  materialsTableHeader: {
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
    padding: "10px",
    textAlign: "left",
    border: "1px solid #001F3F",
  },
  materialsTableCell: {
    padding: "8px 10px",
    border: "1px solid #E0E0E0",
    color: "#001F3F",
  },
  totalsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "400px",
  },
  totalItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E0E0E0",
    borderRadius: "4px",
    color: "#001F3F",
  },
  grandTotal: {
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
    paddingTop: "20px",
    borderTop: "1px solid #E0E0E0",
  },
  deleteConfirmButton: {
    backgroundColor: "#FF6B6B",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
  },
  cancelButton: {
    backgroundColor: "#9E9E9E",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
  },
  confirmText: {
    fontSize: "1rem",
    color: "#001F3F",
    marginBottom: "10px",
    lineHeight: "1.5",
  },
  warningText: {
    fontSize: "0.9rem",
    color: "#FF6B6B",
    marginBottom: "20px",
    lineHeight: "1.5",
    fontStyle: "italic",
  },
};

// Add CSS animations
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// Create style element and add to head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerStyles;
  document.head.appendChild(style);
}

export default ViewInvoice;