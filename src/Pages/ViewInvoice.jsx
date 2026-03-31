import React, { useState, useEffect } from "react";
import { getDocs, doc, deleteDoc, orderBy, query } from "firebase/firestore";
import { db } from "../config";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { getCompanyCollection } from "../utils/firestoreUtils";

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
  const [companyLogo, setCompanyLogo] = useState(null);
  const [logoError, setLogoError] = useState(false);

  // Sanitize filename function (same as InvoiceGenerator)
  const sanitizeFilename = (name) => {
    return name
      ?.toLowerCase()
      .trim()
      .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  // Get company logo path (same as InvoiceGenerator)
  const getCompanyLogoPath = (companyName) => {
    if (!companyName) return null;
    const fileName = sanitizeFilename(companyName);
    return `/assets/${fileName}.png`;
  };

  // Load company logo (same as InvoiceGenerator)
  const loadCompanyLogo = (companyName) => {
    try {
      setLogoError(false);
      const logoPath = getCompanyLogoPath(companyName);
      console.log("Attempting to load logo from path:", logoPath);

      if (!logoPath) {
        setCompanyLogo("/assets/default-logo.png");
        return;
      }

      const img = new Image();
      img.onload = () => {
        console.log("✅ Logo loaded successfully:", logoPath);
        setCompanyLogo(logoPath);
      };
      img.onerror = () => {
        console.log("❌ Logo not found, using default logo");
        setLogoError(true);
        setCompanyLogo("/assets/default-logo.png");
      };
      img.src = logoPath;
    } catch (error) {
      console.log("Error loading logo:", error);
      setLogoError(true);
      setCompanyLogo("/assets/default-logo.png");
    }
  };

  // Fetch invoices from Firebase
  useEffect(() => {
    fetchInvoices();
  }, [selectedCompany]);

  const fetchInvoices = async () => {
    try {
      if (!selectedCompany) return;

      setLoading(true);
      const invoicesCollection = getCompanyCollection(db, selectedCompany.id, "invoices");
      const q = query(invoicesCollection, orderBy("timestamp", "desc"));
      const invoicesSnapshot = await getDocs(q);
      const invoicesList = invoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setInvoices(invoicesList);
      setFilteredInvoices(invoicesList);
      showNotification("Invoices loaded successfully!", "success");
      
      // Load logo if there are invoices
      if (invoicesList.length > 0 && invoicesList[0].companyName) {
        loadCompanyLogo(invoicesList[0].companyName);
      } else if (selectedCompany?.name) {
        loadCompanyLogo(selectedCompany.name);
      }
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
        invoice.invoiceNumber?.toLowerCase().includes(searchTerm) ||
        invoice.clientName?.toLowerCase().includes(searchTerm) ||
        (invoice.companyName && invoice.companyName.toLowerCase().includes(searchTerm))
      );
    }

    // Client name filter
    if (filters.clientName) {
      result = result.filter(invoice =>
        invoice.clientName?.toLowerCase() === filters.clientName.toLowerCase()
      );
    }

    // Date range filter
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate || invoice.timestamp);
        return invoiceDate >= fromDate;
      });
    }

    if (filters.toDate) {
      const toDate = new Date(filters.toDate);
      toDate.setHours(23, 59, 59, 999);
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
      fetchInvoices();
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
    return date.toLocaleDateString("en-IN", {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
    if (num === undefined || num === null || isNaN(num)) return "0.00";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatNumberWithDecimal = (num) => {
    if (num === undefined || num === null || isNaN(num)) return "0.00";
    return num.toFixed(2);
  };

  // Calculate invoice totals
  const calculateInvoiceTotals = (invoice) => {
    const materialsTotal = (invoice.materials || []).reduce(
      (sum, material) => sum + (material.amount || 0),
      0
    );

    const servicesTotal = (invoice.additionalServices || []).reduce(
      (sum, service) => sum + (service.amount || 0),
      0
    );

    const subTotal = materialsTotal + servicesTotal;
    
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (invoice.gstType === "IGST") {
      igstAmount = (materialsTotal * (invoice.igstPercentage || 18)) / 100;
    } else {
      cgstAmount = (materialsTotal * (invoice.cgstPercentage || 9)) / 100;
      sgstAmount = (materialsTotal * (invoice.sgstPercentage || 9)) / 100;
    }

    const total = subTotal + cgstAmount + sgstAmount + igstAmount;
    
    // Calculate round off
    const totalRounded = Math.round(total);
    const roundOff = totalRounded - total;

    return {
      subTotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      total,
      roundOff,
      grandTotalWithRoundOff: totalRounded,
      materialsTotal,
      servicesTotal
    };
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      if (filteredInvoices.length === 0) {
        showNotification("No invoices to export", "warning");
        return;
      }

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
          "Grand Total": totals.grandTotalWithRoundOff || totals.total || 0,
          "PO/DC Details": (invoice.podcEntries || []).map(e => `${e.number || ''} (${e.date || ''})`).join(', ') || "N/A",
          "Created Date": formatDate(invoice.timestamp),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

      const colWidths = [
        { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 20 },
        { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 12 }
      ];
      worksheet['!cols'] = colWidths;

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
      const totals = invoice.totals || calculateInvoiceTotals(invoice);
      
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
        "GST Type": invoice.gstType || "GST",
        "CGST %": invoice.cgstPercentage || 9,
        "SGST %": invoice.sgstPercentage || 9,
        "IGST %": invoice.igstPercentage || 18,
      }];

      const materialsData = (invoice.materials || []).map((material, index) => ({
        "S.No.": index + 1,
        "Material Description": material.description,
        "HSN/SAC": material.hsn || "",
        "Quantity": material.quantity,
        "Rate": material.rate,
        "Amount": material.amount,
      }));

      const podcData = (invoice.podcEntries || []).map((entry, index) => ({
        "PO/DC No": index + 1,
        "Number": entry.number || "",
        "Date": entry.date || "",
      }));

      const totalsData = [{
        "Materials Total": totals.materialsTotal,
        "Services Total": totals.servicesTotal || 0,
        "Sub Total": totals.subTotal,
        "CGST Amount": totals.cgstAmount,
        "SGST Amount": totals.sgstAmount,
        "IGST Amount": totals.igstAmount || 0,
        "Round Off": totals.roundOff,
        "Grand Total": totals.grandTotalWithRoundOff,
      }];

      const workbook = XLSX.utils.book_new();

      const invoiceSheet = XLSX.utils.json_to_sheet(invoiceData);
      XLSX.utils.book_append_sheet(workbook, invoiceSheet, "Invoice Details");

      if (materialsData.length > 0) {
        const materialsSheet = XLSX.utils.json_to_sheet(materialsData);
        XLSX.utils.book_append_sheet(workbook, materialsSheet, "Materials");
      }

      if (podcData.length > 0 && podcData[0].Number) {
        const podcSheet = XLSX.utils.json_to_sheet(podcData);
        XLSX.utils.book_append_sheet(workbook, podcSheet, "PO/DC Details");
      }

      const totalsSheet = XLSX.utils.json_to_sheet(totalsData);
      XLSX.utils.book_append_sheet(workbook, totalsSheet, "Totals");

      const fileName = `Invoice_${invoice.invoiceNumber}_Details.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showNotification(`Exported invoice ${invoice.invoiceNumber} details to Excel`, "success");
    } catch (error) {
      console.error("Error exporting invoice details:", error);
      showNotification("Failed to export invoice details", "error");
    }
  };

  // Number to words function (same as InvoiceGenerator)
  const numberToWords = (num) => {
    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    const words = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];

    const tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    const convertBelow1000 = (n) => {
      if (n === 0) return "";
      if (n < 20) return words[n] + " ";
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + words[n % 10] : "") + " ";
      if (n < 1000) return words[Math.floor(n / 100)] + " Hundred " + convertBelow1000(n % 100);
      return "";
    };

    const convert = (n) => {
      if (n === 0) return "Zero";

      let result = "";
      const crore = Math.floor(n / 10000000);
      const lakh = Math.floor((n % 10000000) / 100000);
      const thousand = Math.floor((n % 100000) / 1000);
      const hundred = Math.floor((n % 1000) / 100);
      const rest = n % 100;

      if (crore > 0) result += convertBelow1000(crore) + "Crore ";
      if (lakh > 0) result += convertBelow1000(lakh) + "Lakh ";
      if (thousand > 0) result += convertBelow1000(thousand) + "Thousand ";
      if (hundred > 0) result += convertBelow1000(hundred) + "Hundred ";
      if (rest > 0) {
        if (result !== "") result += "and ";
        result += convertBelow1000(rest);
      }

      return result.trim() || "Zero";
    };

    let result = convert(integerPart) + " Rupees";

    if (decimalPart > 0) {
      result += " and " + convert(decimalPart) + " Paise";
    }

    return result + " Only";
  };

  // Generate PDF with exact same structure as InvoiceGenerator
  const handleDownloadPDF = async (invoice) => {
    try {
      showNotification(`Generating PDF for invoice ${invoice.invoiceNumber}...`, "info");
      
      // Load logo if available
      if (invoice.companyName) {
        await loadCompanyLogoForPDF(invoice.companyName);
      }
      
      await generateAndDownloadPDF(invoice);
    } catch (error) {
      console.error("Error in handleDownloadPDF:", error);
      showNotification("Failed to generate PDF", "error");
    }
  };

  // Load logo specifically for PDF generation
  const loadCompanyLogoForPDF = (companyName) => {
    return new Promise((resolve) => {
      try {
        const logoPath = getCompanyLogoPath(companyName);
        if (!logoPath) {
          resolve(null);
          return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setCompanyLogo(logoPath);
          resolve(img);
        };
        img.onerror = () => {
          setCompanyLogo("/assets/default-logo.png");
          resolve(null);
        };
        img.src = logoPath;
      } catch (error) {
        console.log("Error loading logo for PDF:", error);
        resolve(null);
      }
    });
  };

  const generateAndDownloadPDF = async (invoice) => {
    try {
      const pdf = await generatePDFDocument(invoice);
      const fileName = `Invoice_${invoice.invoiceNumber}_${new Date(invoice.invoiceDate || invoice.timestamp).toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
      showNotification(`PDF downloaded: ${fileName}`, "success");
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  };

  // Generate PDF document with exact same structure as InvoiceGenerator
  const generatePDFDocument = async (invoice) => {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const materials = invoice.materials || [];
          const totals = invoice.totals || calculateInvoiceTotals(invoice);
          
          // Determine if it's Faizan company based on invoice prefix
          const isFaizan = invoice.invoiceNumber?.startsWith('FE');
          
          // Materials per page (same as InvoiceGenerator)
          const rowsPerPage = 18;
          const pageCount = Math.ceil(materials.length / rowsPerPage);
          const getStartIdx = (page) => page * rowsPerPage;
          const getEndIdx = (page) => Math.min((page + 1) * rowsPerPage, materials.length);

          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          });

          const validPodcEntries = (invoice.podcEntries || []).filter(entry => entry.number || entry.date);

          // Pre-load logo for PDF
          const logoToUse = companyLogo || "/assets/default-logo.png";
          
          // Pre-load the logo image
          const preloadImage = (src) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          });

          await preloadImage(logoToUse);

          // Helper function to render to canvas
          const renderToCanvas = async (element) => {
            const tempContainer = document.createElement("div");
            tempContainer.style.position = "fixed";
            tempContainer.style.left = "-10000px";
            tempContainer.style.top = "0";
            tempContainer.style.fontFamily = "'Poppins', sans-serif";
            tempContainer.appendChild(element);
            document.body.appendChild(tempContainer);

            // Force layout
            element.getBoundingClientRect();

            try {
              const canvas = await html2canvas(element, {
                scale: 2.5,
                useCORS: true,
                allowTaint: false,
                backgroundColor: "#ffffff",
                width: element.offsetWidth,
                height: element.offsetHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                imageTimeout: 15000,
                logging: false,
              });
              return canvas;
            } finally {
              document.body.removeChild(tempContainer);
            }
          };

          const addCanvasToPdf = (pdf, canvas) => {
            const imgData = canvas.toDataURL("image/jpeg", 1.0);
            const imgWidth = 190;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            pdf.addImage(imgData, "JPEG", 10, 10, imgWidth, imgHeight, undefined, "FAST");
          };

          // Build Faizan Page Element (exact same as InvoiceGenerator)
          const buildFaizanPageElement = (page) => {
            const maroon = "#800020";
            const borderColor = "#000000";
            
            const pageDiv = document.createElement("div");
            pageDiv.style.width = "210mm";
            pageDiv.style.padding = "0";
            pageDiv.style.margin = "0";
            pageDiv.style.backgroundColor = "white";
            pageDiv.style.boxSizing = "border-box";
            pageDiv.style.fontFamily = "'Poppins', sans-serif";
            pageDiv.style.border = `1px solid ${borderColor}`;

            if (page === 0) {
              const headerDiv = document.createElement("div");
              headerDiv.style.marginBottom = "6px";

              const companyHeader = document.createElement("div");
              companyHeader.style.display = "flex";
              companyHeader.style.justifyContent = "space-between";
              companyHeader.style.alignItems = "flex-start";
              companyHeader.style.marginBottom = "6px";
              companyHeader.style.padding = "8px 12px 0 12px";

              const leftSection = document.createElement("div");
              leftSection.style.flex = "1";
              leftSection.style.display = "flex";
              leftSection.style.alignItems = "center";

              if (logoToUse && !logoError) {
                const logoImg = document.createElement("img");
                logoImg.src = logoToUse;
                logoImg.crossOrigin = "anonymous";
                logoImg.alt = "Company Logo";
                logoImg.style.height = "60px";
                logoImg.style.width = "auto";
                logoImg.style.objectFit = "contain";
                leftSection.appendChild(logoImg);
              } else {
                const textPlaceholder = document.createElement("div");
                textPlaceholder.style.cssText = `height:55px;width:55px;background-color:#F3F4F6;display:flex;align-items:center;justify-content:center;border:2px solid ${borderColor};border-radius:8px;color:${maroon};font-weight:bold;font-size:24px;`;
                textPlaceholder.textContent = invoice.companyName?.charAt(0)?.toUpperCase() || "C";
                leftSection.appendChild(textPlaceholder);
              }

              const rightSection = document.createElement("div");
              rightSection.style.flex = "1";
              rightSection.style.textAlign = "right";

              const invoiceTitle = document.createElement("h2");
              invoiceTitle.textContent = "TAX INVOICE";
              invoiceTitle.style.cssText = `margin:0 0 4px 0;font-size:22px;color:${maroon};font-weight:700;`;

              let invoiceDetailsHTML = `
                <div style="font-size:12px;line-height:1.4;color:#333333;">
                  <div><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
                  <div><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</div>
                </div>
              `;

              rightSection.appendChild(invoiceTitle);
              rightSection.innerHTML += invoiceDetailsHTML;
              companyHeader.appendChild(leftSection);
              companyHeader.appendChild(rightSection);
              headerDiv.appendChild(companyHeader);

              const clientDetails = document.createElement("div");
              clientDetails.style.cssText = `display:flex;justify-content:space-between;margin-top:6px;padding:8px 12px;background-color:white;border-top:1px solid ${borderColor};font-size:11px;line-height:1.4;`;

              const billTo = document.createElement("div");
              billTo.style.flex = "1";
              billTo.style.borderRight = `1px solid ${borderColor}`;
              billTo.innerHTML = `
                <div style="color:#333333;">
                  <div style="font-weight:700;margin-bottom:4px;color:${maroon};font-size:13px;">${invoice.companyName}</div>
                  <div style="margin-bottom:3px;">${invoice.companyAddress || ''}</div>
                  <div style="margin-bottom:3px;"><strong>Email:</strong> ${invoice.companyemail || ''}</div>
                  <div style="margin-bottom:3px;"><strong>GSTIN:</strong> ${invoice.companyGSTIN || ''}</div>
                  <div style="margin-bottom:3px;"><strong>Contact:</strong> ${invoice.companyContact || ''}</div>
                  <div style="margin-top:4px;font-style:italic;font-size:10px;">${invoice.companyDescription || ''}</div>
                </div>`;

              const shipTo = document.createElement("div");
              shipTo.style.cssText = "flex:1;margin-left:20px;";
              
              let podcHTML = "";
              if (validPodcEntries.length > 0) {
                podcHTML = `<div style="margin-top:6px;padding-top:5px;border-top:1px dashed ${borderColor};">`;
                validPodcEntries.forEach((entry, idx) => {
                  podcHTML += `<div style="font-size:10px;margin-bottom:2px;"><strong>PO/DC No ${idx + 1}:</strong> ${entry.number || '-'} &nbsp;&nbsp;<strong>Date:</strong> ${entry.date || '-'}</div>`;
                });
                podcHTML += `</div>`;
              }
              
              shipTo.innerHTML = `
                <h3 style="margin:0 0 4px 0;color:${maroon};font-size:13px;font-weight:700;">To:</h3>
                <div style="color:#333333;">
                  <div style="font-weight:700;margin-bottom:4px;color:${maroon};">${invoice.clientName}</div>
                  <div style="margin-bottom:3px;">${invoice.clientAddress || ''}</div>
                  <div style="margin-bottom:3px;"><strong>GSTIN:</strong> ${invoice.clientGSTIN || ''}</div>
                  <div style="margin-bottom:3px;"><strong>Contact:</strong> ${invoice.clientContact || ''}</div>
                  ${podcHTML}
                </div>`;

              clientDetails.appendChild(billTo);
              clientDetails.appendChild(shipTo);
              headerDiv.appendChild(clientDetails);
              pageDiv.appendChild(headerDiv);
            }

            const table = buildFaizanTableElement(page, rowsPerPage, totals, borderColor, maroon, getStartIdx, getEndIdx, pageCount, invoice);
            pageDiv.appendChild(table);

            if (page === pageCount - 1) {
              const footer = buildFaizanFooterElement(maroon, borderColor, totals, invoice);
              pageDiv.appendChild(footer);
            }

            return pageDiv;
          };

          const buildFaizanTableElement = (page, perPage, totals, borderColor, maroon, getStartIdx, getEndIdx, pageCount, invoice) => {
            const table = document.createElement("table");
            table.style.cssText = `width:100%;border-collapse:collapse;font-size:11px;color:#333333;font-family:'Poppins',sans-serif;table-layout:fixed;`;

            const thead = document.createElement("thead");
            thead.style.backgroundColor = "white";
            thead.innerHTML = `
              <tr style="height:32px;">
                <th style="border:1px solid ${borderColor};padding:6px 4px;width:4%;font-size:11px;color:${maroon};font-weight:700;">S.No.</th>
                <th style="border:1px solid ${borderColor};padding:6px 4px;width:52%;font-size:11px;color:${maroon};font-weight:700;">Material Description</th>
                <th style="border:1px solid ${borderColor};padding:6px 4px;width:10%;font-size:11px;color:${maroon};font-weight:700;">HSN/SAC</th>
                <th style="border:1px solid ${borderColor};padding:6px 4px;width:8%;font-size:11px;color:${maroon};font-weight:700;">Qty.</th>
                <th style="border:1px solid ${borderColor};padding:6px 4px;width:13%;font-size:11px;color:${maroon};font-weight:700;">Rate (₹)</th>
                <th style="border:1px solid ${borderColor};padding:6px 4px;width:13%;font-size:11px;color:${maroon};font-weight:700;">Amount (₹)</th>
              </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            const startIdx = getStartIdx(page);
            const endIdx = getEndIdx(page);

            for (let i = startIdx; i < endIdx; i++) {
              const material = materials[i];
              const desc = material.description;
              const truncDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
              const row = document.createElement("tr");
              row.style.cssText = `height:30px;background-color:${i % 2 === 0 ? '#F9FAFB' : 'white'};`;
              row.innerHTML = `
                <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;vertical-align:middle;">${i + 1}</td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;font-size:11px;vertical-align:middle;" title="${desc}">${truncDesc}</td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;vertical-align:middle;">${material.hsn || ''}</td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;vertical-align:middle;">${material.quantity}</td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:right;font-size:11px;vertical-align:middle;">${formatNumber(material.rate)}</td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:right;font-weight:bold;font-size:11px;vertical-align:middle;">${formatNumber(material.amount)}</td>
              `;
              tbody.appendChild(row);
            }

            const currentRows = endIdx - startIdx;
            const remainingRows = perPage - currentRows;

            for (let i = 0; i < remainingRows; i++) {
              const emptyRow = document.createElement("tr");
              emptyRow.style.height = "30px";
              emptyRow.style.backgroundColor = (endIdx + i) % 2 === 0 ? '#F9FAFB' : 'white';
              emptyRow.innerHTML = `
                <td style="border:1px solid ${borderColor};padding:5px 4px;font-size:11px;">${endIdx + i + 1}</td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;"></td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;"></td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;"></td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;"></td>
                <td style="border:1px solid ${borderColor};padding:5px 4px;"></td>
              `;
              tbody.appendChild(emptyRow);
            }

            if (page === pageCount - 1) {
              if (invoice.additionalServices && invoice.additionalServices.length > 0) {
                const svcHeader = document.createElement("tr");
                svcHeader.style.backgroundColor = maroon;
                svcHeader.innerHTML = `<td colspan="6" style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;color:white;">Additional Services (Excluding GST)</td>`;
                tbody.appendChild(svcHeader);
                invoice.additionalServices.forEach((service, index) => {
                  const svcRow = document.createElement("tr");
                  svcRow.style.cssText = `background-color:${index % 2 === 0 ? '#FFF8E1' : '#FFF3E0'};height:30px;`;
                  svcRow.innerHTML = `
                    <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;">${index + 1}</td>
                    <td colspan="4" style="border:1px solid ${borderColor};padding:5px 4px;font-size:11px;">${service.description}</td>
                    <td style="border:1px solid ${borderColor};padding:5px 4px;text-align:right;font-weight:bold;font-size:11px;">${formatNumber(service.amount)}</td>
                  `;
                  tbody.appendChild(svcRow);
                });
              }

              const subtotalRow = document.createElement("tr");
              subtotalRow.style.backgroundColor = "#F9FAFB";
              subtotalRow.innerHTML = `
                <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">Sub Total:</td>
                <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.subTotal)}</td>
              `;
              tbody.appendChild(subtotalRow);

              if (invoice.gstType === "IGST") {
                const igstRow = document.createElement("tr");
                igstRow.style.backgroundColor = "white";
                igstRow.innerHTML = `
                  <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">IGST (${invoice.igstPercentage || 18}%):<\/td>
                  <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.igstAmount)}<\/td>
                `;
                tbody.appendChild(igstRow);
              } else {
                const cgstRow = document.createElement("tr");
                cgstRow.style.backgroundColor = "white";
                cgstRow.innerHTML = `
                  <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">CGST (${invoice.cgstPercentage || 9}%):<\/td>
                  <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.cgstAmount)}<\/td>
                `;
                tbody.appendChild(cgstRow);
                const sgstRow = document.createElement("tr");
                sgstRow.style.backgroundColor = "#F9FAFB";
                sgstRow.innerHTML = `
                  <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">SGST (${invoice.sgstPercentage || 9}%):<\/td>
                  <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.sgstAmount)}<\/td>
                `;
                tbody.appendChild(sgstRow);
              }

              const roundOffRow = document.createElement("tr");
              roundOffRow.style.backgroundColor = "#F3F4F6";
              roundOffRow.innerHTML = `
                <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">Round Off:<\/td>
                <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}<\/td>
              `;
              tbody.appendChild(roundOffRow);

              const grandTotalRow = document.createElement("tr");
              grandTotalRow.style.backgroundColor = maroon;
              grandTotalRow.innerHTML = `
                <td colspan="5" style="border:1px solid ${maroon};padding:8px 4px;text-align:right;font-weight:bold;font-size:12px;color:white;">GRAND TOTAL:<\/td>
                <td style="border:1px solid ${maroon};padding:8px 4px;font-weight:bold;font-size:12px;text-align:right;color:white;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}<\/td>
              `;
              tbody.appendChild(grandTotalRow);
            }

            table.appendChild(tbody);
            return table;
          };

          const buildFaizanFooterElement = (maroon, borderColor, totals, invoice) => {
            const footerDiv = document.createElement("div");
            footerDiv.style.marginTop = "6px";

            const amountInWordsDiv = document.createElement("div");
            amountInWordsDiv.style.cssText = `border:1px solid ${borderColor};border-top:none;border-right:none;border-left:none;padding:6px 8px;font-size:10px;background-color:white;color:#333333;display:flex;justify-content:space-between;align-items:center;`;
            amountInWordsDiv.innerHTML = `
              <div><strong style="color:${maroon};">Amount Chargeable (in words):</strong> ${numberToWords(totals.grandTotalWithRoundOff)}</div>
              <div style="font-weight:bold;font-size:10px;color:#6B7280;">E. & O.E</div>
            `;
            footerDiv.appendChild(amountInWordsDiv);

            const bottomSection = document.createElement("div");
            bottomSection.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:10px;";

            const bankDetailsDiv = document.createElement("div");
            bankDetailsDiv.style.cssText = `flex:1;border:1px solid ${borderColor};border:none;padding:6px 8px;font-size:9px;background-color:white;`;
            bankDetailsDiv.innerHTML = `
              <div style="font-weight:bold;margin-bottom:4px;color:${maroon};font-size:10px;">Bank Details:</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
                <div style="color:#333333;font-size:9px;"><strong>Account Name:</strong> ${invoice.bankDetails?.accountName || ''}</div>
                <div style="color:#333333;font-size:9px;"><strong>Account No:</strong> ${invoice.bankDetails?.accountNumber || ''}</div>
                <div style="color:#333333;font-size:9px;"><strong>Bank:</strong> ${invoice.bankDetails?.bank || ''}</div>
                <div style="color:#333333;font-size:9px;"><strong>Branch:</strong> ${invoice.bankDetails?.branch || ''}</div>
                <div style="color:#333333;font-size:9px;"><strong>IFSC:</strong> ${invoice.bankDetails?.ifscCode || ''}</div>
                <div style="color:#333333;font-size:9px;"><strong>G-Pay:</strong> ${invoice.bankDetails?.gpayNumber || ''}</div>
              </div>
            `;

            const signatureDiv = document.createElement("div");
            signatureDiv.style.cssText = `flex:1;border:1px solid ${borderColor};border-top:none;border-right:none;padding:8px;font-size:10px;background:white;text-align:center;position:relative;min-height:90px;`;
            signatureDiv.innerHTML = `
              <div style="color:${maroon};position:absolute;top:12px;right:12px;"><strong style="font-size:11px;">For ${invoice.companyName}</strong></div>
              <div style="font-size:9px;color:#6B7280;position:absolute;bottom:12px;right:12px;text-align:right;">Authorized Signatory</div>
            `;

            bottomSection.appendChild(bankDetailsDiv);
            bottomSection.appendChild(signatureDiv);
            footerDiv.appendChild(bottomSection);

            const footerNoteDiv = document.createElement("div");
            footerNoteDiv.style.cssText = `border:1px solid ${borderColor};border-top:none;padding:5px;text-align:center;font-size:9px;background-color:${maroon};color:white;`;
            footerNoteDiv.textContent = `SUBJECT TO ${(invoice.companyState || '').toUpperCase()} JURISDICTION | This is a Computer Generated Invoice`;
            footerDiv.appendChild(footerNoteDiv);

            return footerDiv;
          };

          // Build Gee Page Element (exact same as InvoiceGenerator)
          const buildGeePageElement = (page) => {
            const navyBlue = "#1A2C4E";
            const borderColor = "#000000";
            const textColor = "#1F2937";
            const lightBg = "#F9FAFB";

            const pageDiv = document.createElement("div");
            pageDiv.style.width = "210mm";
            pageDiv.style.padding = "0";
            pageDiv.style.margin = "0";
            pageDiv.style.backgroundColor = "white";
            pageDiv.style.boxSizing = "border-box";
            pageDiv.style.fontFamily = "'Poppins', sans-serif";
            pageDiv.style.border = `1px solid ${borderColor}`;

            if (page === 0) {
              const topBar = document.createElement("div");
              topBar.style.cssText = `border-bottom:1px solid ${borderColor};padding:8px 12px;display:flex;justify-content:space-between;align-items:center;background:white;`;

              const logoArea = document.createElement("div");
              logoArea.style.cssText = "display:flex;align-items:center;gap:15px;";

              if (logoToUse && !logoError) {
                const logoPatch = document.createElement("div");
                logoPatch.style.cssText = "display:flex;align-items:center;";
                const logoImg = document.createElement("img");
                logoImg.src = logoToUse;
                logoImg.crossOrigin = "anonymous";
                logoImg.style.cssText = "height:50px;width:auto;object-fit:contain;display:block;";
                logoPatch.appendChild(logoImg);
                logoArea.appendChild(logoPatch);
              } else {
                const logoBox = document.createElement("div");
                logoBox.style.cssText = `width:50px;height:50px;background:${lightBg};border:1px solid ${borderColor};border-radius:6px;display:flex;align-items:center;justify-content:center;color:${navyBlue};font-size:22px;font-weight:700;`;
                logoBox.textContent = invoice.companyName?.charAt(0)?.toUpperCase() || "G";
                logoArea.appendChild(logoBox);
              }

              const invoiceBadge = document.createElement("div");
              invoiceBadge.style.cssText = "text-align:right;";
              invoiceBadge.innerHTML = `
                <div style="color:${navyBlue};font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;">Tax Invoice</div>
                <div style="color:${navyBlue};font-size:16px;font-weight:700;">${invoice.invoiceNumber}</div>
                <div style="color:#6B7280;font-size:10px;">${new Date(invoice.invoiceDate).toLocaleDateString("en-IN", {day:'2-digit',month:'long',year:'numeric'})}</div>
              `;

              topBar.appendChild(logoArea);
              topBar.appendChild(invoiceBadge);
              pageDiv.appendChild(topBar);

              const fromToSection = document.createElement("div");
              fromToSection.style.cssText = `display:flex;gap:0;border-bottom:1px solid ${borderColor};`;

              const fromBox = document.createElement("div");
              fromBox.style.cssText = `flex:1;padding:8px 12px;border-right:1px solid ${borderColor};background:${lightBg};`;
              fromBox.innerHTML = `
                <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;margin-bottom:6px;">From</div>
                <div style="font-size:12px;color:${navyBlue};font-weight:700;margin-bottom:4px;">${invoice.companyName}</div>
                <div style="font-size:10px;color:${textColor};line-height:1.4;">
                  <div>${invoice.companyAddress || ''}</div>
                  <div><span style="font-weight:600;">GSTIN:</span> ${invoice.companyGSTIN || ''}</div>
                  <div><span style="font-weight:600;">Contact:</span> ${invoice.companyContact || ''}</div>
                  <div><span style="font-weight:600;">Email:</span> ${invoice.companyemail || ''}</div>
                </div>
                <div style="margin-top:4px;font-style:italic;font-size:9px;color:#6B7280;">${invoice.companyDescription || ''}</div>
              `;

              const toBox = document.createElement("div");
              toBox.style.cssText = `flex:1;padding:8px 12px;background:white;`;
              
              toBox.innerHTML = `
                <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;margin-bottom:6px;">Bill To</div>
                <div style="font-size:12px;color:${navyBlue};font-weight:700;margin-bottom:4px;">${invoice.clientName}</div>
                <div style="font-size:10px;color:${textColor};line-height:1.4;">
                  <div>${invoice.clientAddress || ''}</div>
                  <div><span style="font-weight:600;">GSTIN:</span> ${invoice.clientGSTIN || ''}</div>
                  <div><span style="font-weight:600;">Contact:</span> ${invoice.clientContact || ''}</div>
                </div>
              `;

              fromToSection.appendChild(fromBox);
              fromToSection.appendChild(toBox);
              pageDiv.appendChild(fromToSection);

              if (validPodcEntries.length > 0) {
                const podcSection = document.createElement("div");
                podcSection.style.cssText = `padding:5px 12px;background:${lightBg};border-bottom:1px solid ${borderColor};display:flex;flex-wrap:wrap;gap:6px;align-items:center;`;
                
                const podcLabel = document.createElement("span");
                podcLabel.style.cssText = `font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;margin-right:3px;white-space:nowrap;`;
                podcLabel.textContent = "PO/DC:";
                podcSection.appendChild(podcLabel);
                
                validPodcEntries.forEach((entry, index) => {
                  const pill = document.createElement("span");
                  pill.style.cssText = `display:inline-flex;gap:6px;align-items:center;background:white;padding:3px 8px;border-radius:4px;border:1px solid ${borderColor};font-size:9px;`;
                  pill.innerHTML = `<strong style="color:${navyBlue};">#${index + 1}:</strong> <span style="color:${textColor};">${entry.number || '—'}</span> <span style="color:${borderColor};">|</span> <strong style="color:${navyBlue};">Date:</strong> <span style="color:${textColor};">${entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : '—'}</span>`;
                  podcSection.appendChild(pill);
                });
                pageDiv.appendChild(podcSection);
              }
            }

            const tableWrapper = document.createElement("div");
            tableWrapper.style.cssText = "padding:0;";

            const table = document.createElement("table");
            table.style.cssText = `width:100%;border-collapse:collapse;font-size:10px;font-family:'Poppins',sans-serif;table-layout:fixed;`;

            const thead = document.createElement("thead");
            thead.innerHTML = `
              <tr style="background-color:${navyBlue};">
                <th style="padding:6px 4px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:white;font-weight:600;width:4%;border-right:1px solid ${borderColor};">No.</th>
                <th style="padding:6px 4px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:white;font-weight:600;width:52%;border-right:1px solid ${borderColor};">Description</th>
                <th style="padding:6px 4px;text-align:center;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:white;font-weight:600;width:10%;border-right:1px solid ${borderColor};">HSN/SAC</th>
                <th style="padding:6px 4px;text-align:center;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:white;font-weight:600;width:8%;border-right:1px solid ${borderColor};">Qty</th>
                <th style="padding:6px 4px;text-align:right;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:white;font-weight:600;width:13%;border-right:1px solid ${borderColor};">Rate (₹)</th>
                <th style="padding:6px 4px;text-align:right;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:white;font-weight:600;width:13%;">Amount (₹)</th>
              </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            const startIdx = getStartIdx(page);
            const endIdx = getEndIdx(page);

            for (let i = startIdx; i < endIdx; i++) {
              const material = materials[i];
              const desc = material.description;
              const truncDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
              const isEven = i % 2 === 0;
              const row = document.createElement("tr");
              row.style.cssText = `background-color:${isEven ? 'white' : lightBg};border-bottom:1px solid ${borderColor};height:30px;`;
              row.innerHTML = `
                <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${i + 1}</td>
                <td style="padding:5px 4px;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};" title="${desc}">${truncDesc}</td>
                <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${material.hsn || ''}</td>
                <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${material.quantity}</td>
                <td style="padding:5px 4px;text-align:right;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${formatNumber(material.rate)}</td>
                <td style="padding:5px 4px;text-align:right;color:${navyBlue};font-size:10px;font-weight:600;">${formatNumber(material.amount)}</td>
              `;
              tbody.appendChild(row);
            }

            const currentRows = endIdx - startIdx;
            const remainingRows = rowsPerPage - currentRows;

            for (let i = 0; i < remainingRows; i++) {
              const emptyRow = document.createElement("tr");
              emptyRow.style.cssText = `height:30px;border-bottom:1px solid ${borderColor};background-color:${(endIdx + i) % 2 === 0 ? 'white' : lightBg};`;
              emptyRow.innerHTML = `
                <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${endIdx + i + 1}</td>
                <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
                <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
                <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
                <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
                <td>&nbsp;</td>
              `;
              tbody.appendChild(emptyRow);
            }

            if (page === pageCount - 1 && invoice.additionalServices && invoice.additionalServices.length > 0) {
              const svcHeaderRow = document.createElement("tr");
              svcHeaderRow.style.cssText = `background-color:${lightBg};border-top:1px solid ${borderColor};border-bottom:1px solid ${borderColor};`;
              svcHeaderRow.innerHTML = `
                <td colspan="6" style="padding:5px 4px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;">Additional Services (Excl. GST)</td>
              `;
              tbody.appendChild(svcHeaderRow);

              invoice.additionalServices.forEach((service, index) => {
                const svcRow = document.createElement("tr");
                svcRow.style.cssText = `background-color:${index % 2 === 0 ? 'white' : lightBg};border-bottom:1px solid ${borderColor};height:30px;`;
                svcRow.innerHTML = `
                  <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${index + 1}</td>
                  <td colspan="4" style="padding:5px 4px;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${service.description}</td>
                  <td style="padding:5px 4px;text-align:right;color:${navyBlue};font-size:10px;font-weight:600;">${formatNumber(service.amount)}</td>
                `;
                tbody.appendChild(svcRow);
              });
            }

            if (page === pageCount - 1) {
              const subtotalRow = document.createElement("tr");
              subtotalRow.style.cssText = `background-color:${lightBg};border-top:1px solid ${borderColor};border-bottom:1px solid ${borderColor};`;
              subtotalRow.innerHTML = `
                <td colspan="5" style="padding:6px 4px;text-align:right;font-size:10px;font-weight:600;color:${navyBlue};border-right:1px solid ${borderColor};">Sub Total</td>
                <td style="padding:6px 4px;text-align:right;font-size:10px;font-weight:700;color:${navyBlue};">₹ ${formatNumber(totals.subTotal)}</td>
              `;
              tbody.appendChild(subtotalRow);

              if (invoice.gstType === "IGST") {
                const igstRow = document.createElement("tr");
                igstRow.style.cssText = `background-color:white;border-bottom:1px solid ${borderColor};`;
                igstRow.innerHTML = `
                  <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">IGST (${invoice.igstPercentage || 18}%):</td>
                  <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">₹ ${formatNumber(totals.igstAmount)}</td>
                `;
                tbody.appendChild(igstRow);
              } else {
                const cgstRow = document.createElement("tr");
                cgstRow.style.cssText = `background-color:white;border-bottom:1px solid ${borderColor};`;
                cgstRow.innerHTML = `
                  <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">CGST (${invoice.cgstPercentage || 9}%):</td>
                  <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">₹ ${formatNumber(totals.cgstAmount)}</td>
                `;
                tbody.appendChild(cgstRow);

                const sgstRow = document.createElement("tr");
                sgstRow.style.cssText = `background-color:${lightBg};border-bottom:1px solid ${borderColor};`;
                sgstRow.innerHTML = `
                  <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">SGST (${invoice.sgstPercentage || 9}%):</td>
                  <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">₹ ${formatNumber(totals.sgstAmount)}</td>
                `;
                tbody.appendChild(sgstRow);
              }

              const roundOffRow = document.createElement("tr");
              roundOffRow.style.cssText = `background-color:${lightBg};border-bottom:1px solid ${borderColor};`;
              roundOffRow.innerHTML = `
                <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">Round Off</td>
                <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}</td>
              `;
              tbody.appendChild(roundOffRow);

              const grandTotalRow = document.createElement("tr");
              grandTotalRow.style.cssText = `background-color:${navyBlue};`;
              grandTotalRow.innerHTML = `
                <td colspan="5" style="padding:8px 4px;text-align:right;font-size:12px;font-weight:700;color:white;border-right:1px solid rgba(255,255,255,0.2);">Grand Total</td>
                <td style="padding:8px 4px;text-align:right;font-size:12px;font-weight:700;color:white;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}</td>
              `;
              tbody.appendChild(grandTotalRow);
            }

            table.appendChild(tbody);
            tableWrapper.appendChild(table);
            pageDiv.appendChild(tableWrapper);

            if (page === pageCount - 1) {
              const footer = document.createElement("div");
              footer.style.cssText = `margin-top:0;border-top:1px solid ${borderColor};`;

              const amtWords = document.createElement("div");
              amtWords.style.cssText = `padding:6px 12px;background:${lightBg};border-bottom:1px solid ${borderColor};display:flex;justify-content:space-between;align-items:center;`;
              amtWords.innerHTML = `
                <div style="font-size:9px;color:${textColor};"><span style="font-weight:600;color:${navyBlue};">Amount in Words: </span>${numberToWords(totals.grandTotalWithRoundOff)}</div>
                <div style="font-size:8px;color:${textColor};font-style:italic;">E. & O.E</div>
              `;
              footer.appendChild(amtWords);

              const bottomRow = document.createElement("div");
              bottomRow.style.cssText = "display:flex;";

              const bankBox = document.createElement("div");
              bankBox.style.cssText = `flex:1;padding:6px 12px;background:white;border-right:1px solid ${borderColor};`;
              bankBox.innerHTML = `
                <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;margin-bottom:5px;">Bank Details</div>
                <div style="font-size:9px;color:${textColor};line-height:1.6;">
                  <div><span style="font-weight:600;color:${navyBlue};">Account Name:</span> ${invoice.bankDetails?.accountName || ''}</div>
                  <div><span style="font-weight:600;color:${navyBlue};">Account No:</span> ${invoice.bankDetails?.accountNumber || ''}</div>
                  <div><span style="font-weight:600;color:${navyBlue};">Bank:</span> ${invoice.bankDetails?.bank || ''}</div>
                  <div><span style="font-weight:600;color:${navyBlue};">Branch:</span> ${invoice.bankDetails?.branch || ''}</div>
                  <div><span style="font-weight:600;color:${navyBlue};">IFSC:</span> ${invoice.bankDetails?.ifscCode || ''}</div>
                  <div><span style="font-weight:600;color:${navyBlue};">G-Pay:</span> ${invoice.bankDetails?.gpayNumber || ''}</div>
                </div>
              `;

              const sigBox = document.createElement("div");
              sigBox.style.cssText = `flex:1;padding:6px 12px;background:${lightBg};display:flex;flex-direction:column;justify-content:space-between;min-height:90px;`;
              sigBox.innerHTML = `
                <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;">For ${invoice.companyName}</div>
                <div style="font-size:9px;color:${textColor};text-align:right;">Authorized Signatory</div>
              `;

              bottomRow.appendChild(bankBox);
              bottomRow.appendChild(sigBox);
              footer.appendChild(bottomRow);

              const bottomBar = document.createElement("div");
              bottomBar.style.cssText = `background-color:${navyBlue};padding:5px 12px;display:flex;justify-content:space-between;align-items:center;`;
              bottomBar.innerHTML = `
                <span style="color:rgba(255,255,255,0.9);font-size:8px;letter-spacing:1px;">SUBJECT TO ${(invoice.companyState || '').toUpperCase()} JURISDICTION</span>
                <span style="color:rgba(255,255,255,0.9);font-size:8px;letter-spacing:1px;">COMPUTER GENERATED INVOICE</span>
              `;
              footer.appendChild(bottomBar);
              pageDiv.appendChild(footer);
            }

            return pageDiv;
          };

          // Generate all pages
          for (let page = 0; page < pageCount; page++) {
            if (page > 0) pdf.addPage();

            const pageDiv = isFaizan ? buildFaizanPageElement(page) : buildGeePageElement(page);
            const canvas = await renderToCanvas(pageDiv);
            addCanvasToPdf(pdf, canvas);
          }

          resolve(pdf);
        } catch (error) {
          reject(error);
        }
      })();
    });
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
                    <td colSpan="7" style={styles.noDataCell}>
                      No invoices found. {invoices.length === 0 ? "Create your first invoice!" : "Try different filters."}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice, index) => {
                    const totals = invoice.totals || calculateInvoiceTotals(invoice);
                    return (
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
                          {formatCurrency(totals.grandTotalWithRoundOff || totals.total)}
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
                              View
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
                              PDF
                            </button>
                            <button
                              onClick={() => exportInvoiceDetailsToExcel(invoice)}
                              style={styles.excelButton}
                            >
                              Excel
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
                    );
                  })
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
                      <strong>GST Type:</strong> {selectedInvoice.gstType || "GST"}
                    </div>
                    <div style={styles.detailItem}>
                      <strong>PO/DC Entries:</strong> {(selectedInvoice.podcEntries || []).length}
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

                {/* PO/DC Details */}
                {selectedInvoice.podcEntries && selectedInvoice.podcEntries.length > 0 && (
                  <div style={styles.detailsSection}>
                    <h3 style={styles.detailsSectionTitle}>PO/DC Details</h3>
                    <div style={styles.detailsGrid}>
                      {selectedInvoice.podcEntries.map((entry, index) => (
                        entry.number || entry.date ? (
                          <div key={index} style={styles.detailItem}>
                            <strong>Entry {index + 1}:</strong> {entry.number || '-'} | {entry.date || '-'}
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}

                {/* Tax Details */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Tax Details</h3>
                  <div style={styles.detailsGrid}>
                    {selectedInvoice.gstType === "IGST" ? (
                      <div style={styles.detailItem}>
                        <strong>IGST %:</strong> {selectedInvoice.igstPercentage || 18}%
                      </div>
                    ) : (
                      <>
                        <div style={styles.detailItem}>
                          <strong>CGST %:</strong> {selectedInvoice.cgstPercentage || 9}%
                        </div>
                        <div style={styles.detailItem}>
                          <strong>SGST %:</strong> {selectedInvoice.sgstPercentage || 9}%
                        </div>
                      </>
                    )}
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

                {/* Additional Services */}
                {selectedInvoice.additionalServices && selectedInvoice.additionalServices.length > 0 && (
                  <div style={styles.detailsSection}>
                    <h3 style={styles.detailsSectionTitle}>Additional Services ({selectedInvoice.additionalServices.length} items)</h3>
                    <div style={styles.materialsTableContainer}>
                      <table style={styles.materialsTable}>
                        <thead>
                          <tr>
                            <th style={styles.materialsTableHeader}>S.No.</th>
                            <th style={styles.materialsTableHeader}>Description</th>
                            <th style={styles.materialsTableHeader}>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.additionalServices.map((service, index) => (
                            <tr key={index}>
                              <td style={styles.materialsTableCell}>{index + 1}</td>
                              <td style={styles.materialsTableCell}>{service.description}</td>
                              <td style={styles.materialsTableCell}>{formatNumber(service.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div style={styles.detailsSection}>
                  <h3 style={styles.detailsSectionTitle}>Totals</h3>
                  <div style={styles.totalsContainer}>
                    {(() => {
                      const totals = selectedInvoice.totals || calculateInvoiceTotals(selectedInvoice);
                      return (
                        <>
                          <div style={styles.totalItem}>
                            <strong>Materials Total:</strong> {formatCurrency(totals.materialsTotal)}
                          </div>
                          {totals.servicesTotal > 0 && (
                            <div style={styles.totalItem}>
                              <strong>Services Total:</strong> {formatCurrency(totals.servicesTotal)}
                            </div>
                          )}
                          <div style={styles.totalItem}>
                            <strong>Sub Total:</strong> {formatCurrency(totals.subTotal)}
                          </div>
                          {selectedInvoice.gstType === "IGST" ? (
                            <div style={styles.totalItem}>
                              <strong>IGST ({selectedInvoice.igstPercentage || 18}%):</strong> {formatCurrency(totals.igstAmount)}
                            </div>
                          ) : (
                            <>
                              <div style={styles.totalItem}>
                                <strong>CGST ({selectedInvoice.cgstPercentage || 9}%):</strong> {formatCurrency(totals.cgstAmount)}
                              </div>
                              <div style={styles.totalItem}>
                                <strong>SGST ({selectedInvoice.sgstPercentage || 9}%):</strong> {formatCurrency(totals.sgstAmount)}
                              </div>
                            </>
                          )}
                          <div style={styles.totalItem}>
                            <strong>Round Off:</strong> {totals.roundOff > 0 ? '+' : ''}{formatNumberWithDecimal(totals.roundOff)}
                          </div>
                          <div style={{ ...styles.totalItem, ...styles.grandTotal }}>
                            <strong>Grand Total:</strong> {formatCurrency(totals.grandTotalWithRoundOff)}
                          </div>
                        </>
                      );
                    })()}
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    maxHeight: "500px",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
  },
  noDataCell: {
    padding: "30px",
    textAlign: "center",
    color: "#666",
    fontSize: "1rem",
    fontStyle: "italic",
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
  },
  materialsTableCell: {
    padding: "8px 10px",
    border: "1px solid #E0E0E0",
    color: "#001F3F",
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
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
    fontFamily: "'Poppins', sans-serif",
  },
  confirmText: {
    fontSize: "1rem",
    color: "#001F3F",
    marginBottom: "10px",
    lineHeight: "1.5",
    fontFamily: "'Poppins', sans-serif",
  },
  warningText: {
    fontSize: "0.9rem",
    color: "#FF6B6B",
    marginBottom: "20px",
    lineHeight: "1.5",
    fontStyle: "italic",
    fontFamily: "'Poppins', sans-serif",
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
  * {
    font-family: 'Poppins', sans-serif !important;
  }
`;

// Create style element and add to head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerStyles;
  document.head.appendChild(style);
}

export default ViewInvoice;