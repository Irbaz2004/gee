import React, { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../config";

const InvoiceGenerator = () => {
  const invoiceRef = useRef(null);
  const [formData, setFormData] = useState({
    // Company Details
    companyName: "GALAXY ELECTRICALS & ELECTRONICS",
    companyemail: "galaxyenterprises409@gmail.com",
    companyAddress: "NO:2/69,T.K. Street,Nariyambut, AMBUR TK -635808",
    companyGSTIN: "33BEDPA6537A1Z8",
    companyContact: "+91 9790441625",
    companyState: "Tamil Nadu",
    companyDescription: "All Kind of Transformer new making & Rewinding, Industrial Electronic Board work & Shoes machinerys Spare parts available",

    // Invoice Details
    invoiceNumber: "INV-2024-001",
    invoiceDate: new Date().toISOString().split("T")[0],
    poNumber: "PO-789456",
    poDate: "2024-01-15",
    BillNo: "627 -25/26",
    DCNO: "45",
    DCDate: new Date().toISOString().split("T")[0],

    // Client Details
    clientName: "DELTASHOES PVT LTD",
    clientAddress: "Ambur",
    clientGSTIN: "33AAACD1292J1ZV",
    clientContact: "+91 9876543210",

    // GST Details
    cgstPercentage: 9,
    sgstPercentage: 9,

    // Authorized Signatory
    authorizedSignatory: "Rajesh Kumar",
    designation: "Director",

    // Materials - Empty initially
    materials: [],
  });

  const [newMaterial, setNewMaterial] = useState({
    description: "",
    hsn: "",
    quantity: "",
    rate: "",
  });

  const [firebaseMaterials, setFirebaseMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Show notification
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 3000);
  };

  // Fetch materials from Firebase on component mount
  useEffect(() => {
    fetchMaterialsFromFirebase();
  }, []);

  const fetchMaterialsFromFirebase = async () => {
    try {
      setLoading(true);
      const materialsCollection = collection(db, "materials");
      const materialsSnapshot = await getDocs(materialsCollection);
      const materialsList = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFirebaseMaterials(materialsList);
      showNotification("Materials loaded from database!", "success");
    } catch (error) {
      console.error("Error fetching materials from Firebase:", error);
      showNotification("Failed to load materials from database", "error");
    } finally {
      setLoading(false);
    }
  };

  // Save invoice data to Firebase
  const saveInvoiceToFirebase = async () => {
    try {
      const invoiceData = {
        ...formData,
        materials: formData.materials,
        timestamp: new Date().toISOString(),
        totals: calculateTotals()
      };

      const invoicesCollection = collection(db, "invoices");
      await addDoc(invoicesCollection, invoiceData);
      console.log("Invoice saved to Firebase successfully!");
      showNotification("Invoice data saved to database!", "success");
    } catch (error) {
      console.error("Error saving invoice to Firebase:", error);
      showNotification("Failed to save invoice data to database", "error");
    }
  };

  // Save material to Firebase
  const saveMaterialToFirebase = async (material) => {
    try {
      const materialsCollection = collection(db, "materials");
      await addDoc(materialsCollection, {
        materialName: material.description,
        hsnCode: material.hsn,
        rate: material.rate,
        timestamp: new Date().toISOString()
      });
      fetchMaterialsFromFirebase(); // Refresh the materials list
      showNotification("Material added to database!", "success");
    } catch (error) {
      console.error("Error saving material to Firebase:", error);
      showNotification("Failed to save material to database", "error");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMaterialChange = (e) => {
    const { name, value } = e.target;
    setNewMaterial((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "rate" ? parseFloat(value) || 0 : value,
    }));
  };

  // Handle material selection from Firebase
  const handleMaterialSelect = (e) => {
    const selectedMaterialId = e.target.value;
    if (selectedMaterialId) {
      const selectedMaterial = firebaseMaterials.find(mat => mat.id === selectedMaterialId);
      if (selectedMaterial) {
        setNewMaterial(prev => ({
          ...prev,
          description: selectedMaterial.materialName || "",
          hsn: selectedMaterial.hsnCode || "",
          rate: selectedMaterial.rate || ""
        }));
        showNotification("Material details loaded from database", "info");
      }
    }
  };

  const addMaterial = () => {
    if (
      !newMaterial.description ||
      !newMaterial.quantity ||
      !newMaterial.rate
    ) {
      showNotification("Please fill description, quantity, and rate", "error");
      return;
    }

    const amount = (newMaterial.quantity || 0) * (newMaterial.rate || 0);
    const material = {
      id: formData.materials.length + 1,
      description: newMaterial.description,
      hsn: newMaterial.hsn || "",
      quantity: newMaterial.quantity,
      rate: newMaterial.rate,
      amount: amount,
    };

    setFormData((prev) => ({
      ...prev,
      materials: [...prev.materials, material],
    }));

    // Save material to Firebase
    saveMaterialToFirebase(material);

    setNewMaterial({
      description: "",
      hsn: "",
      quantity: "",
      rate: "",
    });

    showNotification("Material added to invoice!", "success");
  };

  const removeMaterial = (id) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((material) => material.id !== id),
    }));
    showNotification("Material removed from invoice", "info");
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const calculateTotals = () => {
    const subTotal = formData.materials.reduce(
      (sum, material) => sum + (material.amount || 0),
      0,
    );
    const cgstAmount = (subTotal * formData.cgstPercentage) / 100;
    const sgstAmount = (subTotal * formData.sgstPercentage) / 100;
    const total = subTotal + cgstAmount + sgstAmount;
    return { subTotal, cgstAmount, sgstAmount, total };
  };

  const numberToWords = (num) => {
    const words = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
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

  const generatePDF = async () => {
    try {
      if (formData.materials.length === 0) {
        showNotification("Please add at least one material before generating PDF", "error");
        return;
      }

      // Save invoice data to Firebase first
      await saveInvoiceToFirebase();

      // Create a container for the PDF content
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "210mm";
      container.style.overflow = "visible";
      container.style.backgroundColor = "white";
      document.body.appendChild(container);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const materialsPerPage = 8;
      const pageCount = Math.ceil(formData.materials.length / materialsPerPage);
      const totals = calculateTotals();

      // Wait for images to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      for (let page = 0; page < pageCount; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // Create page container with reduced margins
        const pageDiv = document.createElement("div");
        pageDiv.style.width = "210mm";
        pageDiv.style.padding = "5mm"; // Reduced from 15mm
        pageDiv.style.margin = "0";
        pageDiv.style.backgroundColor = "white";
        pageDiv.style.boxSizing = "border-box";

        // Add headers (only on first page)
        if (page === 0) {
          // Header Section - Logo on left, invoice details on right
          const headerDiv = document.createElement("div");
          headerDiv.className = "pdf-header";

          const companyHeader = document.createElement("div");
          companyHeader.style.display = "flex";
          companyHeader.style.justifyContent = "space-between";
          companyHeader.style.alignItems = "flex-start";
          companyHeader.style.marginBottom = "15px";
          companyHeader.style.borderBottom = "2px solid #001F3F";
          companyHeader.style.paddingBottom = "10px";

          // Left side - Logo only
          const leftSection = document.createElement("div");
          leftSection.style.flex = "1";
          leftSection.style.display = "flex";
          leftSection.style.alignItems = "center";

          // Add company logo
          const logoImg = document.createElement("img");
          logoImg.src = "https://template.canva.com/EAE1YAgPM_U/1/0/400w-R-Meu_EcnME.jpg";
          logoImg.alt = "Company Logo";
          logoImg.style.height = "150px";
          logoImg.style.display = "block";

          leftSection.appendChild(logoImg);

          // Right side - Invoice details only
          const rightSection = document.createElement("div");
          rightSection.style.flex = "1";
          rightSection.style.textAlign = "right";

          const invoiceTitle = document.createElement("h2");
          invoiceTitle.textContent = "TAX INVOICE";
          invoiceTitle.style.margin = "0 0 10px 0";
          invoiceTitle.style.fontSize = "22px";
          invoiceTitle.style.color = "#001F3F";

          const invoiceDetails = document.createElement("div");
          invoiceDetails.style.fontSize = "12px";
          invoiceDetails.style.lineHeight = "1.5";
          invoiceDetails.style.color = "#001F3F";

          invoiceDetails.innerHTML = `
            <div><strong>Invoice No:</strong> ${formData.invoiceNumber}</div>
            <div><strong>Date:</strong> ${new Date(formData.invoiceDate).toLocaleDateString("en-IN")}</div>
            <div><strong>PO Number:</strong> ${formData.poNumber}</div>
            <div><strong>Bill No:</strong> ${formData.BillNo}</div>
            <div><strong>DC No:</strong> ${formData.DCNO}</div>
            <div><strong>DC Date:</strong> ${formData.DCDate}</div>
          `;

          rightSection.appendChild(invoiceTitle);
          rightSection.appendChild(invoiceDetails);

          companyHeader.appendChild(leftSection);
          companyHeader.appendChild(rightSection);
          headerDiv.appendChild(companyHeader);

          // Client details section
          const clientDetails = document.createElement("div");
          clientDetails.style.display = "flex";
          clientDetails.style.justifyContent = "space-between";
          clientDetails.style.marginTop = "15px";
          clientDetails.style.padding = "12px";
          clientDetails.style.backgroundColor = "#F5F7FA";
          clientDetails.style.border = "1px solid #001F3F";
          clientDetails.style.borderRadius = "5px";
          clientDetails.style.fontSize = "12px";

          const billTo = document.createElement("div");
          billTo.style.flex = "1";

          billTo.innerHTML = `
            <h3 style="margin:0 0 8px 0; color:#001F3F; font-size:14px;">From:</h3>
            <div style="color:#001F3F;">
              <div><strong>${formData.companyName}</strong></div>
              <div>${formData.companyAddress}</div>
              <div><strong>Email:</strong> ${formData.companyemail}</div>
              <div><strong>GSTIN:</strong> ${formData.companyGSTIN}</div>
              <div><strong>Contact:</strong> ${formData.companyContact}</div>
              <div><em>${formData.companyDescription}</em></div>
            </div>
          `;

          const shipTo = document.createElement("div");
          shipTo.style.flex = "1";
          shipTo.style.marginLeft = "30px";

          shipTo.innerHTML = `
            <h3 style="margin:0 0 8px 0; color:#001F3F; font-size:14px;">To:</h3>
            <div style="color:#001F3F;">
              <div><strong>${formData.clientName}</strong></div>
              <div>${formData.clientAddress}</div>
              <div><strong>GSTIN:</strong> ${formData.clientGSTIN}</div>
              <div><strong>Contact:</strong> ${formData.clientContact}</div>
            </div>
          `;

          clientDetails.appendChild(billTo);
          clientDetails.appendChild(shipTo);
          headerDiv.appendChild(clientDetails);

          pageDiv.appendChild(headerDiv);
        }

        // Create material table
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "11px";
        table.style.marginTop = page === 0 ? "15px" : "0";
        table.style.color = "#001F3F";

        // Add table header
        const thead = document.createElement("thead");
        thead.style.backgroundColor = "#001F3F";
        thead.style.color = "white";
        thead.innerHTML = `
          <tr>
            <th style="border:1px solid #001F3F;padding:8px;width:5%">S.No.</th>
            <th style="border:1px solid #001F3F;padding:8px;width:45%">Material Description</th>
            <th style="border:1px solid #001F3F;padding:8px;width:15%">HSN/SAC</th>
            <th style="border:1px solid #001F3F;padding:8px;width:10%">Qty.</th>
            <th style="border:1px solid #001F3F;padding:8px;width:15%">Rate (₹)</th>
            <th style="border:1px solid #001F3F;padding:8px;width:20%">Amount (₹)</th>
          </tr>
        `;
        table.appendChild(thead);

        // Add table body
        const tbody = document.createElement("tbody");
        const startIdx = page * materialsPerPage;
        const endIdx = Math.min(
          startIdx + materialsPerPage,
          formData.materials.length,
        );

        // Add material rows
        for (let i = startIdx; i < endIdx; i++) {
          const material = formData.materials[i];
          const row = document.createElement("tr");
          row.style.backgroundColor = i % 2 === 0 ? "#F5F7FA" : "white";
          row.innerHTML = `
            <td style="border:1px solid #001F3F;padding:8px;text-align:center;color:#001F3F">${i + 1}.</td>
            <td style="border:1px solid #001F3F;padding:8px;color:#001F3F">${material.description}</td>
            <td style="border:1px solid #001F3F;padding:8px;text-align:center;color:#001F3F">${material.hsn}</td>
            <td style="border:1px solid #001F3F;padding:8px;text-align:center;color:#001F3F">${material.quantity}</td>
            <td style="border:1px solid #001F3F;padding:8px;text-align:right;color:#001F3F">${formatNumber(material.rate)}</td>
            <td style="border:1px solid #001F3F;padding:8px;text-align:right;font-weight:bold;color:#001F3F">${formatNumber(material.amount)}</td>
          `;
          tbody.appendChild(row);
        }

        // Add empty rows if needed
        const remainingRows = materialsPerPage - (endIdx - startIdx);
        for (let i = 0; i < remainingRows; i++) {
          const emptyRow = document.createElement("tr");
          emptyRow.style.height = "30px";
          emptyRow.innerHTML = `
            <td style="border:1px solid #001F3F;padding:8px;color:#001F3F">${endIdx + i + 1}.</td>
            <td style="border:1px solid #001F3F;padding:8px"></td>
            <td style="border:1px solid #001F3F;padding:8px"></td>
            <td style="border:1px solid #001F3F;padding:8px"></td>
            <td style="border:1px solid #001F3F;padding:8px"></td>
            <td style="border:1px solid #001F3F;padding:8px"></td>
          `;
          tbody.appendChild(emptyRow);
        }

        // Add totals for last page
        if (page === pageCount - 1) {
          // Subtotal row
          const subtotalRow = document.createElement("tr");
          subtotalRow.style.backgroundColor = "#E8F4F8";
          subtotalRow.innerHTML = `
            <td colspan="5" style="border:1px solid #001F3F;padding:10px;text-align:right;font-weight:bold;font-size:12px;color:#001F3F">Sub Total:</td>
            <td style="border:1px solid #001F3F;padding:10px;font-weight:bold;font-size:12px;text-align:right;color:#001F3F">₹ ${formatNumber(totals.subTotal)}</td>
          `;
          tbody.appendChild(subtotalRow);

          // CGST row
          const cgstRow = document.createElement("tr");
          cgstRow.style.backgroundColor = "#F0F8E8";
          cgstRow.innerHTML = `
            <td colspan="5" style="border:1px solid #001F3F;padding:10px;text-align:right;font-weight:bold;font-size:12px;color:#001F3F">CGST (${formData.cgstPercentage}%):</td>
            <td style="border:1px solid #001F3F;padding:10px;font-weight:bold;font-size:12px;text-align:right;color:#001F3F">₹ ${formatNumber(totals.cgstAmount)}</td>
          `;
          tbody.appendChild(cgstRow);

          // SGST row
          const sgstRow = document.createElement("tr");
          sgstRow.style.backgroundColor = "#F0F8E8";
          sgstRow.innerHTML = `
            <td colspan="5" style="border:1px solid #001F3F;padding:10px;text-align:right;font-weight:bold;font-size:12px;color:#001F3F">SGST (${formData.sgstPercentage}%):</td>
            <td style="border:1px solid #001F3F;padding:10px;font-weight:bold;font-size:12px;text-align:right;color:#001F3F">₹ ${formatNumber(totals.sgstAmount)}</td>
          `;
          tbody.appendChild(sgstRow);

          // Grand Total row
          const grandTotalRow = document.createElement("tr");
          grandTotalRow.style.backgroundColor = "#001F3F";
          grandTotalRow.style.color = "white";
          grandTotalRow.innerHTML = `
            <td colspan="5" style="border:1px solid #001F3F;padding:12px;text-align:right;font-weight:bold;font-size:13px">GRAND TOTAL:</td>
            <td style="border:1px solid #001F3F;padding:12px;font-weight:bold;font-size:13px;text-align:right">₹ ${formatNumber(totals.total)}</td>
          `;
          tbody.appendChild(grandTotalRow);
        }

        table.appendChild(tbody);
        pageDiv.appendChild(table);

        // Add footer for last page
        if (page === pageCount - 1) {
          const footerDiv = document.createElement("div");
          footerDiv.style.marginTop = "20px";

          // Amount in words with better spacing
          const amountInWordsDiv = document.createElement("div");
          amountInWordsDiv.style.border = "2px solid #001F3F";
          amountInWordsDiv.style.padding = "10px";
          amountInWordsDiv.style.fontSize = "11px";
          amountInWordsDiv.style.backgroundColor = "#F5F7FA";
          amountInWordsDiv.style.borderRadius = "5px 5px 0 0";
          amountInWordsDiv.style.color = "#001F3F";
          amountInWordsDiv.style.minHeight = "50px";
          amountInWordsDiv.innerHTML = `
            <div><strong>Amount Chargeable (in words):</strong> Indian Rupees ${numberToWords(totals.total).toUpperCase()}</div>
            <div style="text-align:right; margin-top:5px; font-weight:bold; color:#001F3F;">E. & O.E</div>
          `;
          footerDiv.appendChild(amountInWordsDiv);

          // Single signature box - Company signature only
          const signatureDiv = document.createElement("div");
          signatureDiv.style.border = "2px solid #001F3F";
          signatureDiv.style.borderTop = "none";
          signatureDiv.style.borderBottom = "none";
          signatureDiv.style.padding = "15px";
          signatureDiv.style.fontSize = "11px";
          signatureDiv.style.backgroundColor = "white";
          signatureDiv.style.textAlign = "center";

          signatureDiv.innerHTML = `
            <div style="color:#001F3F; margin-bottom:80px;text-align:right;">
              <strong style="font-size:14px;">For ${formData.companyName}</strong>
            </div>
          
            <div style="font-size:10px; color:#666; margin-top:15px;text-align:right;">
              Authorized Signatory
            </div>
          `;
          footerDiv.appendChild(signatureDiv);

          // Footer note
          const footerNoteDiv = document.createElement("div");
          footerNoteDiv.style.border = "2px solid #001F3F";
          footerNoteDiv.style.borderTop = "none";
          footerNoteDiv.style.padding = "8px";
          footerNoteDiv.style.textAlign = "center";
          footerNoteDiv.style.fontSize = "10px";
          footerNoteDiv.style.backgroundColor = "#001F3F";
          footerNoteDiv.style.color = "white";
          footerNoteDiv.style.borderRadius = "0 0 5px 5px";
          footerNoteDiv.innerHTML = `
            SUBJECT TO ${formData.companyState.toUpperCase()} JURISDICTION | This is a Computer Generated Invoice
          `;
          footerDiv.appendChild(footerNoteDiv);

          pageDiv.appendChild(footerDiv);
        }

        // Render to canvas
        const renderToCanvas = async (element) => {
          const tempContainer = document.createElement("div");
          tempContainer.style.position = "fixed";
          tempContainer.style.left = "-10000px";
          tempContainer.style.top = "0";
          tempContainer.appendChild(element);
          document.body.appendChild(tempContainer);

          try {
            const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#ffffff",
              width: element.offsetWidth,
              height: element.offsetHeight,
              scrollX: 0,
              scrollY: 0,
              windowWidth: element.scrollWidth,
              windowHeight: element.scrollHeight,
            });

            return canvas;
          } finally {
            document.body.removeChild(tempContainer);
          }
        };

        const addCanvasToPdf = (pdf, canvas, pageNum) => {
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = 200;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          const yPos = pageNum === 0 ? 5 : 5;
          pdf.addImage(imgData, "PNG", 5, yPos, imgWidth, imgHeight);
        };

        const canvas = await renderToCanvas(pageDiv);
        addCanvasToPdf(pdf, canvas, page);
      }

      // Clean up
      document.body.removeChild(container);

      // Save the PDF
      const fileName = `Invoice_${formData.invoiceNumber}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      showNotification("PDF generated and data saved to Firebase successfully!", "success");
    } catch (error) {
      console.error("PDF generation error:", error);
      showNotification(`PDF generation failed: ${error.message}`, "error");
    }
  };

  const { subTotal, cgstAmount, sgstAmount, total } = calculateTotals();

  return (
    <div className="invoice-generator" style={styles.container}>
      {/* Notification Component */}
      {notification.message && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          padding: "15px 20px",
          backgroundColor: notification.type === "error" ? "#f44336" : 
                          notification.type === "success" ? "#4caf50" : "#2196f3",
          color: "white",
          borderRadius: "5px",
          zIndex: 1000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          animation: "slideIn 0.3s ease",
          maxWidth: "400px",
          marginTop: "80px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: "bold" }}>
              {notification.type === "error" ? "Error" : 
               notification.type === "success" ? "Success" : "Info"}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <h1 className="title" style={styles.title}>Invoice Generator</h1>

      <div className="container" style={styles.contentContainer}>
        <div className="form-section" style={styles.formSection}>
          
          {/* Company Details Section */}
          <h2 style={styles.sectionTitle}>Company Details</h2>
          <div className="form-grid" style={styles.formGrid}>
            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Company Address</label>
              <textarea
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleInputChange}
                rows="2"
                style={styles.textarea}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Company Email</label>
              <input
                type="text"
                name="companyemail"
                value={formData.companyemail}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Company GSTIN</label>
              <input
                type="text"
                name="companyGSTIN"
                value={formData.companyGSTIN}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Company Contact</label>
              <input
                type="text"
                name="companyContact"
                value={formData.companyContact}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Company Description</label>
              <textarea
                name="companyDescription"
                value={formData.companyDescription}
                onChange={handleInputChange}
                rows="3"
                style={styles.textarea}
                placeholder="All Kind of Transformer new making & Rewinding, Industrial Electronic Board work & Shoes machinerys Spare parts available"
              />
            </div>
          </div>

          {/* Client Details Section */}
          <h2 style={styles.sectionTitle}>Client Details</h2>
          <div className="form-grid" style={styles.formGrid}>
            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Client Name</label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Client Address</label>
              <textarea
                name="clientAddress"
                value={formData.clientAddress}
                onChange={handleInputChange}
                rows="2"
                style={styles.textarea}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Client GSTIN</label>
              <input
                type="text"
                name="clientGSTIN"
                value={formData.clientGSTIN}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Client Contact</label>
              <input
                type="text"
                name="clientContact"
                value={formData.clientContact}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>
          </div>

          {/* Invoice Details Section */}
          <h2 style={styles.sectionTitle}>Invoice Details</h2>
          <div className="form-grid" style={styles.formGrid}>
            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Invoice Number</label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Invoice Date</label>
              <input
                type="date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>PO Number</label>
              <input
                type="text"
                name="poNumber"
                value={formData.poNumber}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Bill No</label>
              <input
                type="text"
                name="BillNo"
                value={formData.BillNo}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>DC No</label>
              <input
                type="text"
                name="DCNO"
                value={formData.DCNO}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>DC Date</label>
              <input
                type="date"
                name="DCDate"
                value={formData.DCDate}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>
          </div>

          {/* GST Details Section */}
          <h2 style={styles.sectionTitle}>GST Details</h2>
          <div className="form-grid" style={styles.formGrid}>
            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>CGST Percentage</label>
              <input
                type="number"
                name="cgstPercentage"
                value={formData.cgstPercentage}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>SGST Percentage</label>
              <input
                type="number"
                name="sgstPercentage"
                value={formData.sgstPercentage}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
                style={styles.input}
              />
            </div>
          </div>

          <h2 style={styles.sectionTitle}>Add Material</h2>
          <div className="material-form" style={styles.materialForm}>
            {/* Select material from Firebase */}
            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Select Material from Database</label>
              <select
                onChange={handleMaterialSelect}
                style={styles.input}
                disabled={loading}
              >
                <option value="">Select a material</option>
                {firebaseMaterials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.materialName} - HSN: {material.hsnCode} - Rate: ₹{material.rate}
                  </option>
                ))}
              </select>
              {loading && <div style={styles.loadingText}>Loading materials...</div>}
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <input
                type="text"
                name="description"
                value={newMaterial.description}
                onChange={handleMaterialChange}
                placeholder="Material description"
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>HSN/SAC</label>
              <input
                type="text"
                name="hsn"
                value={newMaterial.hsn}
                onChange={handleMaterialChange}
                placeholder="HSN code"
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Quantity</label>
              <input
                type="number"
                name="quantity"
                value={newMaterial.quantity}
                onChange={handleMaterialChange}
                placeholder="Quantity"
                min="0"
                step="0.01"
                style={styles.input}
              />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Rate</label>
              <input
                type="number"
                name="rate"
                value={newMaterial.rate}
                onChange={handleMaterialChange}
                placeholder="Rate per unit"
                min="0"
                step="0.01"
                style={styles.input}
              />
            </div>

            <button className="add-btn" onClick={addMaterial} style={styles.addButton}>
              Add Material
            </button>
          </div>

          <h2 style={styles.sectionTitle}>Materials List</h2>
          <div className="materials-list" style={styles.materialsList}>
            {formData.materials.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyStateText}>No materials added yet. Add materials using the form above.</p>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.tableHeader}>S.No.</th>
                    <th style={styles.tableHeader}>Description</th>
                    <th style={styles.tableHeader}>HSN</th>
                    <th style={styles.tableHeader}>Qty</th>
                    <th style={styles.tableHeader}>Rate</th>
                    <th style={styles.tableHeader}>Amount</th>
                    <th style={styles.tableHeader}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.materials.map((material, index) => (
                    <tr key={material.id} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                      <td style={styles.tableCell}>{index + 1}</td>
                      <td style={styles.tableCell}>{material.description}</td>
                      <td style={styles.tableCell}>{material.hsn}</td>
                      <td style={styles.tableCell}>{material.quantity}</td>
                      <td style={styles.tableCell}>₹ {formatNumber(material.rate)}</td>
                      <td style={styles.tableCell}>₹ {formatNumber(material.amount)}</td>
                      <td style={styles.tableCell}>
                        <button
                          className="remove-btn"
                          onClick={() => removeMaterial(material.id)}
                          style={styles.removeButton}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {formData.materials.length > 0 && (
            <div className="totals-section" style={styles.totalsSection}>
              <div className="total-row" style={styles.totalRow}>
                <span style={styles.totalLabel}>Sub Total:</span>
                <span style={styles.totalValue}>₹ {formatNumber(subTotal)}</span>
              </div>
              <div className="total-row" style={styles.totalRow}>
                <span style={styles.totalLabel}>CGST ({formData.cgstPercentage}%):</span>
                <span style={styles.totalValue}>₹ {formatNumber(cgstAmount)}</span>
              </div>
              <div className="total-row" style={styles.totalRow}>
                <span style={styles.totalLabel}>SGST ({formData.sgstPercentage}%):</span>
                <span style={styles.totalValue}>₹ {formatNumber(sgstAmount)}</span>
              </div>
              <div className="total-row grand-total" style={styles.grandTotalRow}>
                <span style={styles.grandTotalLabel}>GRAND TOTAL:</span>
                <span style={styles.grandTotalValue}>₹ {formatNumber(total)}</span>
              </div>
              <div className="total-row" style={styles.totalRow}>
                <span style={styles.totalLabel}>Amount in Words:</span>
                <span className="words" style={styles.amountWords}>{numberToWords(total)}</span>
              </div>
            </div>
          )}

          <div className="generate-section" style={styles.generateSection}>
            <button className="generate-btn" onClick={generatePDF} style={styles.generateButton}>
              Generate Invoice PDF
            </button>
            <p className="note" style={styles.note}>
              Click to generate and download a professional A4 PDF invoice (Data will be saved to Firebase)
            </p>
          </div>
        </div>
      </div>

      {/* Add CSS animation for notification */}
      <style>
        {`
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
        `}
      </style>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: "#FFFFFF",
    minHeight: "100vh",
    borderRadius: "30px",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#001F3F",
  },
  title: {
    color: "#001F3F",
    textAlign: "center",
    marginBottom: "0px",
    fontSize: "2.5rem",
    fontWeight: "600",
    borderBottom: "3px solid #001F3F",
    paddingBottom: "15px",
  },
  contentContainer: {
    maxWidth: "1400px",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    padding: "30px",
  },
  formSection: {
    padding: "20px",
  },
  sectionTitle: {
    color: "#001F3F",
    fontSize: "1.8rem",
    marginBottom: "25px",
    paddingBottom: "10px",
    borderBottom: "2px solid #001F3F",
    fontWeight: "600",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "25px",
    marginBottom: "40px",
  },
  formGroup: {
    marginBottom: "15px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#001F3F",
    fontSize: "1rem",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    padding: "12px 15px",
    border: "2px solid #001F3F",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "#FFFFFF",
    color: "#001F3F",
    boxSizing: "border-box",
    transition: "all 0.3s ease",
  },
  textarea: {
    width: "100%",
    padding: "12px 15px",
    border: "2px solid #001F3F",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "#FFFFFF",
    color: "#001F3F",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "80px",
    transition: "all 0.3s ease",
  },
  materialForm: {
    backgroundColor: "#F8FAFF",
    padding: "25px",
    borderRadius: "8px",
    border: "2px solid #001F3F",
    marginBottom: "40px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "20px",
    alignItems: "end",
  },
  addButton: {
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 25px",
    borderRadius: "6px",
    fontSize: "1.1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    height: "fit-content",
    gridColumn: "1 / -1",
    justifySelf: "center",
    width: "200px",
  },
  loadingText: {
    fontSize: "0.9rem",
    color: "#666",
    marginTop: "5px",
    fontStyle: "italic",
  },
  materialsList: {
    marginBottom: "40px",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 10px rgba(0, 31, 63, 0.1)",
  },
  emptyState: {
    backgroundColor: "#F8FAFF",
    padding: "40px",
    borderRadius: "8px",
    border: "2px dashed #001F3F",
    textAlign: "center",
  },
  emptyStateText: {
    color: "#666",
    fontSize: "1.1rem",
    fontStyle: "italic",
  },
  tableHeaderRow: {
    backgroundColor: "#001F3F",
  },
  tableHeader: {
    padding: "15px",
    textAlign: "left",
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: "1rem",
    borderBottom: "3px solid #001F3F",
  },
  tableRowEven: {
    backgroundColor: "#F8FAFF",
  },
  tableRowOdd: {
    backgroundColor: "#FFFFFF",
  },
  tableCell: {
    padding: "12px 15px",
    borderBottom: "1px solid #E0E0E0",
    color: "#001F3F",
    fontSize: "0.95rem",
  },
  removeButton: {
    backgroundColor: "#FF6B6B",
    color: "#FFFFFF",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
  },
  totalsSection: {
    backgroundColor: "#F8FAFF",
    padding: "25px",
    borderRadius: "8px",
    border: "2px solid #001F3F",
    marginBottom: "40px",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #E0E0E0",
  },
  totalLabel: {
    fontSize: "1.1rem",
    color: "#001F3F",
    fontWeight: "500",
  },
  totalValue: {
    fontSize: "1.1rem",
    color: "#001F3F",
    fontWeight: "600",
  },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 0",
    borderBottom: "none",
    marginTop: "15px",
  },
  grandTotalLabel: {
    fontSize: "1.3rem",
    color: "#001F3F",
    fontWeight: "700",
  },
  grandTotalValue: {
    fontSize: "1.3rem",
    color: "#001F3F",
    fontWeight: "700",
  },
  amountWords: {
    fontSize: "1rem",
    color: "#001F3F",
    fontStyle: "italic",
    maxWidth: "60%",
    textAlign: "right",
  },
  generateSection: {
    textAlign: "center",
    padding: "30px",
    backgroundColor: "#F8FAFF",
    borderRadius: "8px",
    border: "2px solid #001F3F",
  },
  generateButton: {
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
    border: "none",
    padding: "18px 40px",
    borderRadius: "8px",
    fontSize: "1.3rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "400px",
  },
  note: {
    color: "#001F3F",
    fontSize: "1rem",
    fontStyle: "italic",
    marginTop: "15px",
  },
};

// Add hover effects
Object.assign(styles.input, {
  ':hover': {
    outline: "none",
    borderColor: "#0056b3",
    boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
  },
  ':focus': {
    outline: "none",
    borderColor: "#0056b3",
    boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
  }
});

Object.assign(styles.textarea, {
  ':hover': {
    outline: "none",
    borderColor: "#0056b3",
    boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
  },
  ':focus': {
    outline: "none",
    borderColor: "#0056b3",
    boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
  }
});

Object.assign(styles.addButton, {
  ':hover': {
    backgroundColor: "#003366",
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(0, 31, 63, 0.2)",
  }
});

Object.assign(styles.removeButton, {
  ':hover': {
    backgroundColor: "#FF5252",
    transform: "translateY(-1px)",
  }
});

Object.assign(styles.generateButton, {
  ':hover': {
    backgroundColor: "#003366",
    transform: "translateY(-3px)",
    boxShadow: "0 6px 20px rgba(0, 31, 63, 0.25)",
  }
});

export default InvoiceGenerator;