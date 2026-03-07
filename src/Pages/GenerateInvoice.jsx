import React, { useState, useEffect, useCallback } from "react";
import { Autocomplete, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../config";
import { useCompany } from "../context/CompanyContext";
import { getCompanyCollection } from "../utils/firestoreUtils";

const InvoiceGenerator = () => {
  const { selectedCompany } = useCompany();
  const [currentStep, setCurrentStep] = useState(1);
  const [adminData, setAdminData] = useState(null);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  
  
  const [bankDetails, setBankDetails] = useState({
    accountName: "Faizan Enterprises",
    accountNumber: "120000079620",
    bank: "Canara Bank",
    branch: "Kedambur",
    ifscCode: "CNRB0001464",
    gpayNumber: "9445877025"
  });

  const [formData, setFormData] = useState({
    // Company Details - Will be loaded from Firebase
    companyName: "",
    companyemail: "",
    companyAddress: "",
    companyGSTIN: "",
    companyContact: "",
    companyState: "",
    companyDescription: "",

    // Invoice Details
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    poNumber: "",
    poDate: "",
    DCNO: "",
    DCDate: "",

    // Client Details
    clientName: "",
    clientAddress: "",
    clientGSTIN: "",
    clientContact: "",

    // GST Details
    cgstPercentage: 9,
    sgstPercentage: 9,

    // Additional Services
    additionalServices: [],

    // Materials - Empty initially
    materials: [],
  });

  const [newMaterial, setNewMaterial] = useState({
    description: "",
    hsn: "",
    quantity: "",
    rate: "",
  });

  const [newAdditionalService, setNewAdditionalService] = useState({
    description: "",
    amount: "",
  });

  const [firebaseMaterials, setFirebaseMaterials] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState(null);
  const [isResetMode, setIsResetMode] = useState(false);

  const sanitizeFilename = (name) => {
    return name
      ?.toLowerCase()
      .trim()
      .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, "") // remove special characters
      .replace(/\s+/g, "-") // replace spaces with hyphen
      .replace(/-+/g, "-"); // remove multiple hyphens
  };

  // ================================
  // Get Company Logo Path
  // ================================
  const getCompanyLogoPath = (companyName) => {
    if (!companyName) return null;

    const fileName = sanitizeFilename(companyName);

    // Default extension (recommended)
    return `/assets/${fileName}.png`;
  };

  // ================================
  // Load Company Logo
  // ================================
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

  // ================================
  // Trigger When Company Changes
  // ================================
  useEffect(() => {
    if (adminData?.companyName) {
      loadCompanyLogo(adminData.companyName);
    }
  }, [adminData?.companyName]);

  // Show notification
  const showNotification = useCallback((message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 3000);
  }, []);

  // Check if current company is Faizan Enterprises
  const isFaizanCompany = useCallback(() => {
    return selectedCompany?.name?.toLowerCase().includes('faizan') || 
           formData.companyName?.toLowerCase().includes('faizan');
  }, [selectedCompany, formData.companyName]);

  // Get company prefix for invoice number
  const getCompanyPrefix = useCallback(() => {
    return isFaizanCompany() ? "FE" : "GEE";
  }, [isFaizanCompany]);

  // Open bank details dialog for Faizan company
  const openBankDialog = () => {
    if (isFaizanCompany()) {
      setBankDialogOpen(true);
    }
  };

  // Handle bank details change
  const handleBankDetailChange = (e) => {
    const { name, value } = e.target;
    setBankDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save bank details and close dialog
  const saveBankDetails = () => {
    setBankDialogOpen(false);
    showNotification("Bank details saved successfully!", "success");
  };

  // Fetch admin data and last invoice number on component mount
  useEffect(() => {
    if (selectedCompany) {
      fetchAdminData();
      fetchLastInvoiceNumber();
      fetchMaterialsFromFirebase();
      fetchClientsFromFirebase();
    }
  }, [selectedCompany]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const adminCollection = getCompanyCollection(db, selectedCompany.id, "adminSettings");
      const q = query(adminCollection, orderBy("timestamp", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const latestData = snapshot.docs[0].data();
        setAdminData(latestData);

        // Update formData with admin data
        setFormData(prev => ({
          ...prev,
          companyName: latestData.companyName || "",
          companyemail: latestData.companyEmail || "",
          companyAddress: latestData.companyAddress || "",
          companyGSTIN: latestData.companyGSTIN || "",
          companyContact: latestData.companyContact || "",
          companyDescription: latestData.companyDescription || "",
          companyState: "Tamil Nadu", // Default or fetch from admin
        }));

        showNotification("Company details loaded from database!", "success");
      } else {
        showNotification("No company details found. Please configure in Admin Data.", "error");
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showNotification("Failed to load company details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLastInvoiceNumber = async () => {
    try {
      const invoicesCollection = getCompanyCollection(db, selectedCompany.id, "invoices");
      const q = query(invoicesCollection, orderBy("invoiceNumber", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const lastInvoice = snapshot.docs[0].data();
        setLastInvoiceNumber(lastInvoice.invoiceNumber);
        // Generate next invoice number only if not in reset mode
        if (!isResetMode) {
          generateNextInvoiceNumber(lastInvoice.invoiceNumber);
        }
      } else {
        // First invoice
        setLastInvoiceNumber(null);
        if (!isResetMode) {
          generateNextInvoiceNumber(null);
        }
      }
    } catch (error) {
      console.error("Error fetching last invoice:", error);
      setLastInvoiceNumber(null);
      if (!isResetMode) {
        generateNextInvoiceNumber(null);
      }
    }
  };

  const generateNextInvoiceNumber = (lastNumber) => {
    // Calculate Financial Year
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11 (Jan is 0)
    const currentYear = today.getFullYear();

    let startYear, endYear;
    if (currentMonth >= 3) { // April onwards (April is 3)
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }

    const fyString = `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
    const prefix = getCompanyPrefix();

    if (!lastNumber) {
      setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/001/${fyString}` }));
      return;
    }

    // Check if the last invoice is from the same financial year and company
    const parts = lastNumber.split('/');
    if (parts.length === 3 && parts[0] === prefix && parts[2] === fyString) {
      const lastSeq = parseInt(parts[1]);
      if (!isNaN(lastSeq)) {
        const nextSeq = (lastSeq + 1).toString().padStart(3, '0');
        setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/${nextSeq}/${fyString}` }));
        return;
      }
    }

    // Fallback if format doesn't match or different financial year
    setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/001/${fyString}` }));
  };

  // Function to reset invoice number to base format
  const resetInvoiceNumber = () => {
    // Calculate Financial Year
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let startYear, endYear;
    if (currentMonth >= 3) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }

    const fyString = `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
    const prefix = getCompanyPrefix();
    
    // Set reset mode to true
    setIsResetMode(true);
    
    // Clear the last invoice number cache
    setLastInvoiceNumber(null);
    
    // Set the invoice number to base format
    setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/001/${fyString}` }));
    
    showNotification("Invoice number reset to base format. Next invoice will start from 001.", "success");
    
    // Reset the mode after a short delay
    setTimeout(() => {
      setIsResetMode(false);
    }, 1000);
  };

  const fetchMaterialsFromFirebase = async () => {
    try {
      const materialsCollection = getCompanyCollection(db, selectedCompany.id, "materials");
      const materialsSnapshot = await getDocs(materialsCollection);
      const materialsList = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const uniqueMaterials = materialsList.reduce((acc, current) => {
        const existing = acc.find(item =>
          item.materialName === current.materialName &&
          item.hsnCode === current.hsnCode
        );
        if (!existing) {
          return acc.concat([current]);
        }
        return acc;
      }, []);

      setFirebaseMaterials(uniqueMaterials);
    } catch (error) {
      console.error("Error fetching materials from Firebase:", error);
    }
  };

  const fetchClientsFromFirebase = async () => {
    try {
      // Fetch from global clients collection (not company-specific)
      const clientsCollection = collection(db, "clients");
      const clientsSnapshot = await getDocs(clientsCollection);
      const clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log("Fetched clients from global collection:", clientsList); // Debug log
      setClients(clientsList);
    } catch (error) {
      console.error("Error fetching clients from Firebase:", error);
    }
  };

  // Save invoice data to Firebase
  const saveInvoiceToFirebase = async () => {
    try {
      const totals = calculateTotals();
      const invoiceData = {
        ...formData,
        materials: formData.materials,
        additionalServices: formData.additionalServices,
        timestamp: new Date().toISOString(),
        totals: totals,
        roundOff: totals.roundOff,
        grandTotalWithRoundOff: totals.grandTotalWithRoundOff,
        bankDetails: isFaizanCompany() ? bankDetails : null // Save bank details only for Faizan
      };

      const invoicesCollection = getCompanyCollection(db, selectedCompany.id, "invoices");
      await addDoc(invoicesCollection, invoiceData);
      console.log("Invoice saved to Firebase successfully!");
      return true;
    } catch (error) {
      console.error("Error saving invoice to Firebase:", error);
      showNotification("Failed to save invoice data to database", "error");
      return false;
    }
  };

  // Save material to Firebase
  const saveMaterialToFirebase = async (material) => {
    try {
      const existingMaterial = firebaseMaterials.find(mat =>
        mat.materialName === material.description &&
        mat.hsnCode === material.hsn
      );

      if (!existingMaterial) {
        const materialsCollection = getCompanyCollection(db, selectedCompany.id, "materials");
        await addDoc(materialsCollection, {
          materialName: material.description,
          hsnCode: material.hsn,
          rate: material.rate,
          timestamp: new Date().toISOString()
        });
        fetchMaterialsFromFirebase();
      }
    } catch (error) {
      console.error("Error saving material to Firebase:", error);
    }
  };

  // Fix: Use useCallback to prevent unnecessary re-renders
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleMaterialChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewMaterial((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "rate" ? parseFloat(value) || 0 : value,
    }));
  }, []);

  const handleAdditionalServiceChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewAdditionalService((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }));
  }, []);

  const handleClientSelect = useCallback((event, newValue) => {
    if (typeof newValue === 'string') {
      setFormData(prev => ({
        ...prev,
        clientName: newValue,
      }));
    } else if (newValue && typeof newValue === 'object') {
      setFormData(prev => ({
        ...prev,
        clientName: newValue.clientName || newValue.name || newValue.companyName || "",
        clientAddress: newValue.clientAddress || newValue.address || "",
        clientGSTIN: newValue.clientGSTIN || newValue.gstin || "",
        clientContact: newValue.phone || newValue.contact || ""
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        clientName: "",
        clientAddress: "",
        clientGSTIN: "",
        clientContact: ""
      }));
    }
  }, []);

  // Handle client input change - Fix for focus issue
  const handleClientInputChange = useCallback((event, newInputValue) => {
    // Only update if the input value actually changed
    if (newInputValue !== formData.clientName) {
      setFormData(prev => ({ ...prev, clientName: newInputValue }));
    }
  }, [formData.clientName]);

  // Handle material selection from Firebase
  const handleMaterialSelect = useCallback((e) => {
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
  }, [firebaseMaterials, showNotification]);

  const addMaterial = useCallback(() => {
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
      id: Date.now(),
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
  }, [newMaterial, showNotification]);

  const addAdditionalService = useCallback(() => {
    if (!newAdditionalService.description || !newAdditionalService.amount) {
      showNotification("Please fill description and amount", "error");
      return;
    }

    const service = {
      id: Date.now(),
      description: newAdditionalService.description,
      amount: parseFloat(newAdditionalService.amount) || 0,
    };

    setFormData((prev) => ({
      ...prev,
      additionalServices: [...prev.additionalServices, service],
    }));

    setNewAdditionalService({
      description: "",
      amount: "",
    });

    showNotification("Additional service added!", "success");
  }, [newAdditionalService, showNotification]);

  const removeMaterial = useCallback((id) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((material) => material.id !== id),
    }));
    showNotification("Material removed from invoice", "info");
  }, [showNotification]);

  const removeAdditionalService = useCallback((id) => {
    setFormData((prev) => ({
      ...prev,
      additionalServices: prev.additionalServices.filter((service) => service.id !== id),
    }));
    showNotification("Additional service removed", "info");
  }, [showNotification]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatNumberWithDecimal = (num) => {
    return num.toFixed(2);
  };

  const calculateTotals = useCallback(() => {
    const materialsTotal = formData.materials.reduce(
      (sum, material) => sum + (material.amount || 0),
      0
    );

    const servicesTotal = formData.additionalServices.reduce(
      (sum, service) => sum + (service.amount || 0),
      0
    );

    const subTotal = materialsTotal + servicesTotal;
    const cgstAmount = (materialsTotal * formData.cgstPercentage) / 100;
    const sgstAmount = (materialsTotal * formData.sgstPercentage) / 100;
    const total = subTotal + cgstAmount + sgstAmount;
    
    // Calculate round off
    const totalRounded = Math.round(total);
    const roundOff = totalRounded - total;

    return {
      subTotal,
      cgstAmount,
      sgstAmount,
      total,
      roundOff,
      grandTotalWithRoundOff: totalRounded,
      materialsTotal,
      servicesTotal
    };
  }, [formData.materials, formData.additionalServices, formData.cgstPercentage, formData.sgstPercentage]);

  const numberToWords = (num) => {
    // Fix for decimal numbers
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

  // Navigation functions
  const nextStep = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Reset form after successful generation
  const resetForm = async () => {
    // Fetch new invoice number based on the last saved invoice
    await fetchLastInvoiceNumber();

    // Reset form data except company details
    setFormData(prev => ({
      ...prev,
      invoiceDate: new Date().toISOString().split("T")[0],
      poNumber: "",
      poDate: "",
      DCNO: "",
      DCDate: "",
      clientName: "",
      clientAddress: "",
      clientGSTIN: "",
      clientContact: "",
      materials: [],
      additionalServices: [],
    }));

    setNewMaterial({
      description: "",
      hsn: "",
      quantity: "",
      rate: "",
    });

    setNewAdditionalService({
      description: "",
      amount: "",
    });

    setCurrentStep(1);
  };

  const generatePDF = async () => {
    try {
      if (formData.materials.length === 0) {
        showNotification("Please add at least one material before generating PDF", "error");
        return;
      }

      // Check if bank details are needed for Faizan company
      if (isFaizanCompany() && !bankDetails.accountNumber) {
        setBankDialogOpen(true);
        return;
      }

      // Save invoice data to Firebase first
      const saved = await saveInvoiceToFirebase();
      if (!saved) return;

      // Create a container for the PDF content
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "210mm";
      container.style.overflow = "visible";
      container.style.backgroundColor = "white";
      container.style.fontFamily = "'Poppins', sans-serif";
      document.body.appendChild(container);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Determine rows per page based on company
      const materialsPerPage = isFaizanCompany() ? 10 : 13;
      const pageCount = Math.ceil(formData.materials.length / materialsPerPage);
      const totals = calculateTotals();

      // Determine theme color based on company
      const themeColor = isFaizanCompany() ? "#302c3a" : "#001F3F";
      const secondaryColor = isFaizanCompany() ? "#E8F5E9" : "#F5F7FA";

      // Wait for images to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      for (let page = 0; page < pageCount; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // Create page container with border and adjusted padding
        const pageDiv = document.createElement("div");
        pageDiv.style.width = "200mm";
        pageDiv.style.padding = "8mm 6mm";
        pageDiv.style.margin = "0";
        pageDiv.style.backgroundColor = "white";
        pageDiv.style.boxSizing = "border-box";
        pageDiv.style.fontFamily = "'Poppins', sans-serif";
        pageDiv.style.minHeight = "285mm";
        pageDiv.style.border = `2px solid ${themeColor}`;
        pageDiv.style.borderRadius = "3px";

        // Add headers (only on first page)
        if (page === 0) {
          const headerDiv = document.createElement("div");
          headerDiv.className = "pdf-header";
          headerDiv.style.marginBottom = "10px";

          const companyHeader = document.createElement("div");
          companyHeader.style.display = "flex";
          companyHeader.style.justifyContent = "space-between";
          companyHeader.style.alignItems = "flex-start";
          companyHeader.style.marginBottom = "10px";
          companyHeader.style.paddingBottom = "6px";
          companyHeader.style.borderBottom = `1.5px solid ${themeColor}`;
          companyHeader.style.fontFamily = "'Poppins', sans-serif";

          // Left side - Logo
          const leftSection = document.createElement("div");
          leftSection.style.flex = "1";
          leftSection.style.display = "flex";
          leftSection.style.alignItems = "center";

          // Create logo image element
          const logoImg = document.createElement("img");
          
          // Use company logo if available
          if (companyLogo && !logoError) {
            logoImg.src = companyLogo;
            logoImg.alt = "Company Logo";
            logoImg.style.height = "150px";
            logoImg.style.width = "auto";
            logoImg.style.display = "block";
            logoImg.style.objectFit = "contain";
            leftSection.appendChild(logoImg);
          } else {
            // Create a text placeholder
            const textPlaceholder = document.createElement("div");
            textPlaceholder.style.height = "130px";
            textPlaceholder.style.width = "130px";
            textPlaceholder.style.backgroundColor = secondaryColor;
            textPlaceholder.style.display = "flex";
            textPlaceholder.style.alignItems = "center";
            textPlaceholder.style.justifyContent = "center";
            textPlaceholder.style.border = `1px solid ${themeColor}`;
            textPlaceholder.style.borderRadius = "4px";
            textPlaceholder.style.color = themeColor;
            textPlaceholder.style.fontWeight = "bold";
            textPlaceholder.style.fontSize = "24px";
            textPlaceholder.textContent = formData.companyName?.charAt(0)?.toUpperCase() || "C";
            leftSection.appendChild(textPlaceholder);
          }

          // Right side - Invoice details
          const rightSection = document.createElement("div");
          rightSection.style.flex = "1";
          rightSection.style.textAlign = "right";
          rightSection.style.fontFamily = "'Poppins', sans-serif";

          const invoiceTitle = document.createElement("h2");
          invoiceTitle.textContent = "TAX INVOICE";
          invoiceTitle.style.margin = "0 0 8px 0";
          invoiceTitle.style.fontSize = "20px";
          invoiceTitle.style.color = themeColor;
          invoiceTitle.style.fontWeight = "600";
          invoiceTitle.style.fontFamily = "'Poppins', sans-serif";

          const invoiceDetails = document.createElement("div");
          invoiceDetails.style.fontSize = "11px";
          invoiceDetails.style.lineHeight = "1.5";
          invoiceDetails.style.color = themeColor;
          invoiceDetails.style.fontFamily = "'Poppins', sans-serif";

          invoiceDetails.innerHTML = `
            <div><strong>Invoice No:</strong> ${formData.invoiceNumber}</div>
            <div><strong>Date:</strong> ${new Date(formData.invoiceDate).toLocaleDateString("en-IN")}</div>
            <div><strong>PO Number:</strong> ${formData.poNumber}</div>
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
          clientDetails.style.marginTop = "10px";
          clientDetails.style.padding = "10px";
          clientDetails.style.backgroundColor = secondaryColor;
          clientDetails.style.border = `1px solid ${themeColor}`;
          clientDetails.style.borderRadius = "4px";
          clientDetails.style.fontSize = "11px";
          clientDetails.style.fontFamily = "'Poppins', sans-serif";
          clientDetails.style.lineHeight = "1.4";

          const billTo = document.createElement("div");
          billTo.style.flex = "1";
          billTo.style.fontFamily = "'Poppins', sans-serif";

          billTo.innerHTML = `
            <h3 style="margin:0 0 6px 0; color:${themeColor}; font-size:13px; font-weight:600; font-family: 'Poppins', sans-serif;">From:</h3>
            <div style="color:${themeColor}; font-family: 'Poppins', sans-serif;">
              <div style="font-weight:600; margin-bottom:3px;">${formData.companyName}</div>
              <div style="margin-bottom:3px;">${formData.companyAddress}</div>
              <div style="margin-bottom:3px;"><strong>Email:</strong> ${formData.companyemail}</div>
              <div style="margin-bottom:3px;"><strong>GSTIN:</strong> ${formData.companyGSTIN}</div>
              <div style="margin-bottom:3px;"><strong>Contact:</strong> ${formData.companyContact}</div>
              <div style="margin-top:4px; font-style:italic; font-size:10px;"><em>${formData.companyDescription}</em></div>
            </div>
          `;

          const shipTo = document.createElement("div");
          shipTo.style.flex = "1";
          shipTo.style.marginLeft = "20px";
          shipTo.style.fontFamily = "'Poppins', sans-serif";

          shipTo.innerHTML = `
            <h3 style="margin:0 0 6px 0; color:${themeColor}; font-size:13px; font-weight:600; font-family: 'Poppins', sans-serif;">To:</h3>
            <div style="color:${themeColor}; font-family: 'Poppins', sans-serif;">
              <div style="font-weight:600; margin-bottom:3px;">${formData.clientName}</div>
              <div style="margin-bottom:3px;">${formData.clientAddress}</div>
              <div style="margin-bottom:3px;"><strong>GSTIN:</strong> ${formData.clientGSTIN}</div>
              <div style="margin-bottom:3px;"><strong>Contact:</strong> ${formData.clientContact}</div>
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
        table.style.fontSize = "10px";
        table.style.marginTop = page === 0 ? "10px" : "0";
        table.style.color = themeColor;
        table.style.fontFamily = "'Poppins', sans-serif";
        table.style.tableLayout = "fixed";

        // Add table header
        const thead = document.createElement("thead");
        thead.style.backgroundColor = themeColor;
        thead.style.color = "white";
        thead.style.fontFamily = "'Poppins', sans-serif";
        thead.innerHTML = `
          <tr style="font-family: 'Poppins', sans-serif; height: 22px;">
            <th style="border:1px solid ${themeColor};padding:5px;width:4%; font-family: 'Poppins', sans-serif; font-size:10px;">S.No.</th>
            <th style="border:1px solid ${themeColor};padding:5px;width:52%; font-family: 'Poppins', sans-serif; font-size:10px;">Material Description</th>
            <th style="border:1px solid ${themeColor};padding:5px;width:10%; font-family: 'Poppins', sans-serif; font-size:10px;">HSN/SAC</th>
            <th style="border:1px solid ${themeColor};padding:5px;width:8%; font-family: 'Poppins', sans-serif; font-size:10px;">Qty.</th>
            <th style="border:1px solid ${themeColor};padding:5px;width:13%; font-family: 'Poppins', sans-serif; font-size:10px;">Rate (₹)</th>
            <th style="border:1px solid ${themeColor};padding:5px;width:13%; font-family: 'Poppins', sans-serif; font-size:10px;">Amount (₹)</th>
          </tr>
        `;
        table.appendChild(thead);

        // Add table body
        const tbody = document.createElement("tbody");
        tbody.style.fontFamily = "'Poppins', sans-serif";
        const startIdx = page * materialsPerPage;
        const endIdx = Math.min(
          startIdx + materialsPerPage,
          formData.materials.length,
        );

        // Add material rows
        for (let i = startIdx; i < endIdx; i++) {
          const material = formData.materials[i];
          const row = document.createElement("tr");
          row.style.height = "20px";
          row.style.backgroundColor = i % 2 === 0 ? secondaryColor : "white";
          row.style.fontFamily = "'Poppins', sans-serif";

          const description = material.description;
          const truncatedDescription = description.length > 120 ?
            description.substring(0, 120) + '...' : description;

          row.innerHTML = `
            <td style="border:1px solid ${themeColor};padding:5px;text-align:center;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px; vertical-align:top;">${i + 1}.</td>
            <td style="border:1px solid ${themeColor};padding:5px;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px; vertical-align:top; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${description}">${truncatedDescription}</td>
            <td style="border:1px solid ${themeColor};padding:5px;text-align:center;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px; vertical-align:top;">${material.hsn}</td>
            <td style="border:1px solid ${themeColor};padding:5px;text-align:center;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px; vertical-align:top;">${material.quantity}</td>
            <td style="border:1px solid ${themeColor};padding:5px;text-align:right;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px; vertical-align:top;">${formatNumber(material.rate)}</td>
            <td style="border:1px solid ${themeColor};padding:5px;text-align:right;font-weight:bold;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px; vertical-align:top;">${formatNumber(material.amount)}</td>
          `;
          tbody.appendChild(row);
        }

        // Add empty rows if needed (only on last page)
        if (page === pageCount - 1) {
          const remainingRows = materialsPerPage - (endIdx - startIdx);
          for (let i = 0; i < remainingRows; i++) {
            const emptyRow = document.createElement("tr");
            emptyRow.style.height = "20px";
            emptyRow.style.fontFamily = "'Poppins', sans-serif";
            emptyRow.innerHTML = `
              <td style="border:1px solid ${themeColor};padding:5px;color:${themeColor}; font-family: 'Poppins', sans-serif; font-size:10px;">${endIdx + i + 1}.</td>
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
            `;
            tbody.appendChild(emptyRow);
          }
        }

        // Add additional services on last page
        if (page === pageCount - 1 && formData.additionalServices.length > 0) {
          // Add separator row
          const separatorRow = document.createElement("tr");
          separatorRow.style.backgroundColor = "#E0E0E0";
          separatorRow.style.height = "2px";
          separatorRow.innerHTML = `<td colspan="6" style="border:none; padding:0; background-color:${themeColor};"></td>`;
          tbody.appendChild(separatorRow);

          // Add Additional Services header
          const servicesHeaderRow = document.createElement("tr");
          servicesHeaderRow.style.backgroundColor = themeColor;
          servicesHeaderRow.style.color = "white";
          servicesHeaderRow.innerHTML = `
            <td colspan="6" style="border:1px solid ${themeColor};padding:8px;font-weight:bold;font-size:11px; font-family: 'Poppins', sans-serif;">
              Additional Services (Excluding GST)
            </td>
          `;
          tbody.appendChild(servicesHeaderRow);

          // Add additional services rows
          formData.additionalServices.forEach((service, index) => {
            const serviceRow = document.createElement("tr");
            serviceRow.style.backgroundColor = index % 2 === 0 ? "#FFF8E1" : "#FFF3E0";
            serviceRow.style.height = "20px";
            serviceRow.innerHTML = `
              <td style="border:1px solid ${themeColor};padding:5px;text-align:center; font-family: 'Poppins', sans-serif; font-size:10px;">${index + 1}.</td>
              <td colspan="4" style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif; font-size:10px;">${service.description}</td>
              <td style="border:1px solid ${themeColor};padding:5px;text-align:right;font-weight:bold; font-family: 'Poppins', sans-serif; font-size:10px;">${formatNumber(service.amount)}</td>
            `;
            tbody.appendChild(serviceRow);
          });

          // Add empty rows for services if needed
          const serviceRowsToAdd = Math.max(0, 3 - formData.additionalServices.length);
          for (let i = 0; i < serviceRowsToAdd; i++) {
            const emptyServiceRow = document.createElement("tr");
            emptyServiceRow.style.height = "20px";
            emptyServiceRow.innerHTML = `
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;">${formData.additionalServices.length + i + 1}.</td>
              <td colspan="4" style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
              <td style="border:1px solid ${themeColor};padding:5px; font-family: 'Poppins', sans-serif;"></td>
            `;
            tbody.appendChild(emptyServiceRow);
          }
        }

        // Add totals for last page
        if (page === pageCount - 1) {
          // Subtotal row
          const subtotalRow = document.createElement("tr");
          subtotalRow.style.backgroundColor = secondaryColor;
          subtotalRow.style.fontFamily = "'Poppins', sans-serif";
          subtotalRow.style.height = "22px";
          subtotalRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${themeColor};padding:7px;text-align:right;font-weight:bold;font-size:11px;color:${themeColor}; font-family: 'Poppins', sans-serif;">Sub Total:</td>
            <td style="border:1px solid ${themeColor};padding:7px;font-weight:bold;font-size:11px;text-align:right;color:${themeColor}; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.subTotal)}</td>
          `;
          tbody.appendChild(subtotalRow);

          // CGST row (only on materials)
          const cgstRow = document.createElement("tr");
          cgstRow.style.backgroundColor = "#F0F8E8";
          cgstRow.style.fontFamily = "'Poppins', sans-serif";
          cgstRow.style.height = "22px";
          cgstRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${themeColor};padding:7px;text-align:right;font-weight:bold;font-size:11px;color:${themeColor}; font-family: 'Poppins', sans-serif;">CGST (${formData.cgstPercentage}%):</td>
            <td style="border:1px solid ${themeColor};padding:7px;font-weight:bold;font-size:11px;text-align:right;color:${themeColor}; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.cgstAmount)}</td>
          `;
          tbody.appendChild(cgstRow);

          // SGST row (only on materials)
          const sgstRow = document.createElement("tr");
          sgstRow.style.backgroundColor = "#F0F8E8";
          sgstRow.style.fontFamily = "'Poppins', sans-serif";
          sgstRow.style.height = "22px";
          sgstRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${themeColor};padding:7px;text-align:right;font-weight:bold;font-size:11px;color:${themeColor}; font-family: 'Poppins', sans-serif;">SGST (${formData.sgstPercentage}%):</td>
            <td style="border:1px solid ${themeColor};padding:7px;font-weight:bold;font-size:11px;text-align:right;color:${themeColor}; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.sgstAmount)}</td>
          `;
          tbody.appendChild(sgstRow);

          // Round Off row
          const roundOffRow = document.createElement("tr");
          roundOffRow.style.backgroundColor = "#E8E8E8";
          roundOffRow.style.fontFamily = "'Poppins', sans-serif";
          roundOffRow.style.height = "22px";
          roundOffRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${themeColor};padding:7px;text-align:right;font-weight:bold;font-size:11px;color:${themeColor}; font-family: 'Poppins', sans-serif;">Round Off:</td>
            <td style="border:1px solid ${themeColor};padding:7px;font-weight:bold;font-size:11px;text-align:right;color:${themeColor}; font-family: 'Poppins', sans-serif;">₹ ${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}</td>
          `;
          tbody.appendChild(roundOffRow);

          // Grand Total row with round off
          const grandTotalRow = document.createElement("tr");
          grandTotalRow.style.backgroundColor = themeColor;
          grandTotalRow.style.color = "white";
          grandTotalRow.style.fontFamily = "'Poppins', sans-serif";
          grandTotalRow.style.height = "24px";
          grandTotalRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${themeColor};padding:9px;text-align:right;font-weight:bold;font-size:12px; font-family: 'Poppins', sans-serif;">GRAND TOTAL (After Round Off):</td>
            <td style="border:1px solid ${themeColor};padding:9px;font-weight:bold;font-size:12px;text-align:right; font-family: 'Poppins', sans-serif;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}</td>
          `;
          tbody.appendChild(grandTotalRow);
        }

        table.appendChild(tbody);
        pageDiv.appendChild(table);

        // Add footer for last page
        if (page === pageCount - 1) {
          const footerDiv = document.createElement("div");
          footerDiv.style.marginTop = "15px";
          footerDiv.style.fontFamily = "'Poppins', sans-serif";
          footerDiv.style.display = "flex";
          footerDiv.style.flexDirection = "column";

          // Amount in words
          const amountInWordsDiv = document.createElement("div");
          amountInWordsDiv.style.border = `1.5px solid ${themeColor}`;
          amountInWordsDiv.style.padding = "10px";
          amountInWordsDiv.style.fontSize = "10px";
          amountInWordsDiv.style.backgroundColor = secondaryColor;
          amountInWordsDiv.style.borderRadius = "4px 4px 0 0";
          amountInWordsDiv.style.color = themeColor;
          amountInWordsDiv.style.minHeight = "45px";
          amountInWordsDiv.style.fontFamily = "'Poppins', sans-serif";
          amountInWordsDiv.style.lineHeight = "1.4";
          amountInWordsDiv.innerHTML = `
            <div style="font-family: 'Poppins', sans-serif;"><strong>Amount Chargeable (in words):</strong> ${numberToWords(totals.grandTotalWithRoundOff)}</div>
            <div style="text-align:right; margin-top:5px; font-weight:bold; color:${themeColor}; font-size:10px; font-family: 'Poppins', sans-serif;">E. & O.E</div>
          `;
          footerDiv.appendChild(amountInWordsDiv);

          // Bank details and signature section
          const bottomSection = document.createElement("div");
          bottomSection.style.display = "flex";
          bottomSection.style.justifyContent = "space-between";
          bottomSection.style.alignItems = "flex-start";
          bottomSection.style.gap = "20px";
          bottomSection.style.marginTop = "5px";

          // Bank details (only for Faizan company)
          if (isFaizanCompany()) {
            const bankDetailsDiv = document.createElement("div");
            bankDetailsDiv.style.flex = "1";
            bankDetailsDiv.style.border = `1.5px solid ${themeColor}`;
            bankDetailsDiv.style.borderTop = "none";
            bankDetailsDiv.style.padding = "10px";
            bankDetailsDiv.style.fontSize = "9px";
            bankDetailsDiv.style.backgroundColor = secondaryColor;
            bankDetailsDiv.style.borderRadius = "0 0 0 4px";
            bankDetailsDiv.style.fontFamily = "'Poppins', sans-serif";

            bankDetailsDiv.innerHTML = `
              <div style="font-weight:bold; margin-bottom:6px; color:${themeColor};">Bank Details:</div>
              <div style="margin-bottom:2px;"><strong>Account Name:</strong> ${bankDetails.accountName}</div>
              <div style="margin-bottom:2px;"><strong>Account No:</strong> ${bankDetails.accountNumber}</div>
              <div style="margin-bottom:2px;"><strong>Bank:</strong> ${bankDetails.bank}</div>
              <div style="margin-bottom:2px;"><strong>Branch:</strong> ${bankDetails.branch}</div>
              <div style="margin-bottom:2px;"><strong>IFSC:</strong> ${bankDetails.ifscCode}</div>
              <div style="margin-top:4px;"><strong>G-Pay:</strong> ${bankDetails.gpayNumber}</div>
            `;

            bottomSection.appendChild(bankDetailsDiv);
          }

          // Signature box
          const signatureDiv = document.createElement("div");
          signatureDiv.style.flex = isFaizanCompany() ? "1" : "2";
          signatureDiv.style.border = `1.5px solid ${themeColor}`;
          signatureDiv.style.borderTop = "none";
          signatureDiv.style.padding = "12px";
          signatureDiv.style.fontSize = "10px";
          signatureDiv.style.backgroundColor = "white";
          signatureDiv.style.textAlign = "center";
          signatureDiv.style.borderRadius = isFaizanCompany() ? "0 0 4px 0" : "0 0 4px 4px";
          signatureDiv.style.fontFamily = "'Poppins', sans-serif";
          signatureDiv.style.position = "relative";
          signatureDiv.style.minHeight = "120px";

          signatureDiv.innerHTML = `
            <div style="color:${themeColor}; position: absolute; top: 20px; right: 20px; font-family: 'Poppins', sans-serif;">
              <strong style="font-size:11px; font-family: 'Poppins', sans-serif;">For ${formData.companyName}</strong>
            </div>
            <div style="font-size:9px; color:#666; position: absolute; bottom: 20px; right: 20px; text-align:right; font-family: 'Poppins', sans-serif;">
              Authorized Signatory
            </div>
          `;

          bottomSection.appendChild(signatureDiv);

          if (isFaizanCompany()) {
            footerDiv.appendChild(bottomSection);
          } else {
            footerDiv.appendChild(signatureDiv);
          }

          // Footer note
          const footerNoteDiv = document.createElement("div");
          footerNoteDiv.style.border = `1.5px solid ${themeColor}`;
          footerNoteDiv.style.borderTop = "none";
          footerNoteDiv.style.padding = "8px";
          footerNoteDiv.style.textAlign = "center";
          footerNoteDiv.style.fontSize = "9px";
          footerNoteDiv.style.backgroundColor = themeColor;
          footerNoteDiv.style.color = "white";
          footerNoteDiv.style.borderRadius = "0 0 4px 4px";
          footerNoteDiv.style.fontFamily = "'Poppins', sans-serif";
          footerNoteDiv.style.marginTop = isFaizanCompany() ? "0" : "55px";
          footerNoteDiv.innerHTML = `
            SUBJECT TO ${formData.companyState.toUpperCase()} JURISDICTION | This is a Computer Generated Invoice
          `;

          if (!isFaizanCompany()) {
            footerDiv.appendChild(footerNoteDiv);
          } else {
            footerDiv.appendChild(footerNoteDiv);
          }

          pageDiv.appendChild(footerDiv);
        }

        // Render to canvas
        const renderToCanvas = async (element) => {
          const tempContainer = document.createElement("div");
          tempContainer.style.position = "fixed";
          tempContainer.style.left = "-10000px";
          tempContainer.style.top = "0";
          tempContainer.style.fontFamily = "'Poppins', sans-serif";
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

        const addCanvasToPdf = (pdf, canvas) => {
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = 186;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          const xPos = 12;
          const yPos = 12;
          pdf.addImage(imgData, "PNG", xPos, yPos, imgWidth, imgHeight);
        };

        const canvas = await renderToCanvas(pageDiv);
        addCanvasToPdf(pdf, canvas, page);
      }

      // Clean up
      document.body.removeChild(container);

      // Save the PDF with company-specific filename
      const companyPrefix = getCompanyPrefix();
      const fileName = `${companyPrefix}_Invoice_${formData.invoiceNumber}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      showNotification("PDF generated and data saved to Firebase successfully!", "success");

      // Reset form after successful generation
      await resetForm();

    } catch (error) {
      console.error("PDF generation error:", error);
      showNotification(`PDF generation failed: ${error.message}`, "error");
    }
  };

  const totals = calculateTotals();

  // Step navigation component
  const StepNavigation = () => (
    <div style={styles.stepNavigation}>
      <div style={styles.stepContainer}>
        {[1, 2, 3, 4].map((step) => (
          <div key={step} style={styles.stepWrapper}>
            <div
              style={{
                ...styles.stepCircle,
                backgroundColor: currentStep >= step ? "#001F3F" : "#CCCCCC",
                color: currentStep >= step ? "#FFFFFF" : "#666666",
              }}
            >
              {step}
            </div>
            <div style={styles.stepLabel}>
              {step === 1 ? "Company" : step === 2 ? "Client" : step === 3 ? "Invoice" : "Materials"}
            </div>
          </div>
        ))}
        <div style={{
          ...styles.stepLine,
          left: "calc(25% / 2)",
          right: "calc(25% / 2)",
        }} />
      </div>
    </div>
  );

  // Step 1: Company Details (Read-only from Firebase)
  const Step1 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Company Details</h2>
      <div style={styles.noteBox}>
        <p>These details are loaded from your company configuration.</p>
        <p>To change them, go to <strong>Admin Data</strong> page.</p>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading company details...</div>
      ) : adminData ? (
        <div style={styles.companyDetailsDisplay}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company Name:</span>
            <span style={styles.detailValue}>{formData.companyName || "Not configured"}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company Address:</span>
            <span style={styles.detailValue}>{formData.companyAddress || "Not configured"}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company Email:</span>
            <span style={styles.detailValue}>{formData.companyemail || "Not configured"}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company GSTIN:</span>
            <span style={styles.detailValue}>{formData.companyGSTIN || "Not configured"}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company Contact:</span>
            <span style={styles.detailValue}>{formData.companyContact || "Not configured"}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company Description:</span>
            <span style={styles.detailValue}>{formData.companyDescription || "Not configured"}</span>
          </div>
        </div>
      ) : (
        <div style={styles.errorBox}>
          <p>No company details found. Please configure company details in Admin Data first.</p>
        </div>
      )}
    </div>
  );

  // Step 2: Client Details
  const Step2 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Client Details</h2>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Client Name *</label>
          <Autocomplete
            freeSolo
            options={clients}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.clientName || option.name || option.companyName || "";
            }}
            value={formData.clientName}
            onChange={handleClientSelect}
            onInputChange={handleClientInputChange}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                placeholder="Select or enter client name"
                size="small"
                sx={{
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '4px',
                  }
                }}
              />
            )}
            key={`autocomplete-${formData.clientName}`} // Add key to force re-render when needed
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Client Address</label>
          <textarea
            name="clientAddress"
            value={formData.clientAddress}
            onChange={handleInputChange}
            rows="2"
            style={styles.textarea}
            placeholder="Enter client address"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Client GSTIN</label>
          <input
            type="text"
            name="clientGSTIN"
            value={formData.clientGSTIN}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Enter client GSTIN"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Client Contact</label>
          <input
            type="text"
            name="clientContact"
            value={formData.clientContact}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Enter client contact number"
          />
        </div>
      </div>
    </div>
  );

  // Step 3: Invoice Details
  const Step3 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Invoice Details</h2>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Invoice Number</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleInputChange}
              style={{ ...styles.input, flex: 1 }}
              readOnly
              title="Auto-generated invoice number"
            />
           
          </div>
          <small style={styles.helpText}>Auto-generated</small>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Invoice Date *</label>
          <input
            type="date"
            name="invoiceDate"
            value={formData.invoiceDate}
            onChange={handleInputChange}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>PO Number</label>
          <input
            type="text"
            name="poNumber"
            value={formData.poNumber}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Enter PO number"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>PO Date</label>
          <input
            type="date"
            name="poDate"
            value={formData.poDate}
            onChange={handleInputChange}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>DC No</label>
          <input
            type="text"
            name="DCNO"
            value={formData.DCNO}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Enter DC number"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>DC Date</label>
          <input
            type="date"
            name="DCDate"
            value={formData.DCDate}
            onChange={handleInputChange}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>CGST Percentage (%)</label>
          <select
            name="cgstPercentage"
            value={formData.cgstPercentage}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setFormData(prev => ({ ...prev, cgstPercentage: val }));
            }}
            style={styles.input}
          >
            <option value={0}>0%</option>
            <option value={2.5}>2.5%</option>
            <option value={5}>5%</option>
            <option value={6}>6%</option>
            <option value={9}>9%</option>
            <option value={12}>12%</option>
            <option value={14}>14%</option>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>SGST Percentage (%)</label>
          <select
            name="sgstPercentage"
            value={formData.sgstPercentage}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setFormData(prev => ({ ...prev, sgstPercentage: val }));
            }}
            style={styles.input}
          >
            <option value={0}>0%</option>
            <option value={2.5}>2.5%</option>
            <option value={5}>5%</option>
            <option value={6}>6%</option>
            <option value={9}>9%</option>
            <option value={12}>12%</option>
            <option value={14}>14%</option>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
        </div>
      </div>

      {/* Show Bank Details button for Faizan company */}
      {isFaizanCompany() && (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            onClick={openBankDialog}
            style={{
              ...styles.navButton,
              backgroundColor: "#4CAF50",
              width: "auto",
              padding: "10px 30px"
            }}
          >
            Configure Bank Details
          </button>
        </div>
      )}
    </div>
  );

  // Step 4: Materials and Additional Services
  const Step4 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Materials & Services</h2>

      {/* Materials Section */}
      <div style={styles.sectionBox}>
        <h3 style={styles.subSectionTitle}>Add Materials</h3>
        <div style={styles.materialForm}>
          <div style={styles.formGroup}>
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
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Description *</label>
            <input
              type="text"
              name="description"
              value={newMaterial.description}
              onChange={handleMaterialChange}
              placeholder="Material description"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>HSN/SAC</label>
            <input
              type="text"
              name="hsn"
              value={newMaterial.hsn}
              onChange={handleMaterialChange}
              placeholder="HSN code"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={newMaterial.quantity}
              onChange={handleMaterialChange}
              placeholder="Quantity"
              min="0"
              step="0.01"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Rate *</label>
            <input
              type="number"
              name="rate"
              value={newMaterial.rate}
              onChange={handleMaterialChange}
              placeholder="Rate per unit"
              min="0"
              step="0.01"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <button className="add-btn" onClick={addMaterial} style={styles.addButton}>
            Add Material
          </button>
        </div>
      </div>

      {/* Additional Services Section */}
      <div style={styles.sectionBox}>
        <h3 style={styles.subSectionTitle}>Additional Services (Excluding GST)</h3>
        <div style={styles.materialForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Service Description *</label>
            <input
              type="text"
              name="description"
              value={newAdditionalService.description}
              onChange={handleAdditionalServiceChange}
              placeholder="Service description"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Amount *</label>
            <input
              type="number"
              name="amount"
              value={newAdditionalService.amount}
              onChange={handleAdditionalServiceChange}
              placeholder="Amount"
              min="0"
              step="0.01"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <button onClick={addAdditionalService} style={styles.addButton}>
            Add Service
          </button>
        </div>
      </div>

      {/* Materials List */}
      {formData.materials.length > 0 && (
        <div style={styles.sectionBox}>
          <h3 style={styles.subSectionTitle}>Materials List ({formData.materials.length})</h3>
          <div style={styles.materialsList}>
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
          </div>
        </div>
      )}

      {/* Additional Services List */}
      {formData.additionalServices.length > 0 && (
        <div style={styles.sectionBox}>
          <h3 style={styles.subSectionTitle}>Additional Services List ({formData.additionalServices.length})</h3>
          <div style={styles.materialsList}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeader}>S.No.</th>
                  <th style={styles.tableHeader}>Description</th>
                  <th style={styles.tableHeader}>Amount</th>
                  <th style={styles.tableHeader}>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.additionalServices.map((service, index) => (
                  <tr key={service.id} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                    <td style={styles.tableCell}>{index + 1}</td>
                    <td style={styles.tableCell}>{service.description}</td>
                    <td style={styles.tableCell}>₹ {formatNumber(service.amount)}</td>
                    <td style={styles.tableCell}>
                      <button
                        onClick={() => removeAdditionalService(service.id)}
                        style={styles.removeButton}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals Preview */}
      {formData.materials.length > 0 && (
        <div style={styles.totalsSection}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Materials Total:</span>
            <span style={styles.totalValue}>₹ {formatNumber(totals.materialsTotal)}</span>
          </div>
          {totals.servicesTotal > 0 && (
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Additional Services:</span>
              <span style={styles.totalValue}>₹ {formatNumber(totals.servicesTotal)}</span>
            </div>
          )}
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Sub Total:</span>
            <span style={styles.totalValue}>₹ {formatNumber(totals.subTotal)}</span>
          </div>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>CGST ({formData.cgstPercentage}%):</span>
            <span style={styles.totalValue}>₹ {formatNumber(totals.cgstAmount)}</span>
          </div>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>SGST ({formData.sgstPercentage}%):</span>
            <span style={styles.totalValue}>₹ {formatNumber(totals.sgstAmount)}</span>
          </div>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Round Off:</span>
            <span style={styles.totalValue}>₹ {totals.roundOff > 0 ? '+' : ''}{formatNumberWithDecimal(totals.roundOff)}</span>
          </div>
          <div style={styles.grandTotalRow}>
            <span style={styles.grandTotalLabel}>GRAND TOTAL (After Round Off):</span>
            <span style={styles.grandTotalValue}>₹ {formatNumber(totals.grandTotalWithRoundOff)}</span>
          </div>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Amount in Words:</span>
            <span style={styles.amountWords}>{numberToWords(totals.grandTotalWithRoundOff)}</span>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div style={styles.generateSection}>
        <button
          className="generate-btn"
          onClick={generatePDF}
          style={styles.generateButton}
          disabled={formData.materials.length === 0}
        >
          Generate Invoice PDF
        </button>
        {formData.materials.length === 0 && (
          <p style={styles.errorText}>Please add at least one material to generate invoice</p>
        )}
      </div>
    </div>
  );

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
          marginTop: "80px",
          fontFamily: "'Poppins', sans-serif"
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

      {/* Bank Details Dialog for Faizan Company */}
      <Dialog open={bankDialogOpen} onClose={() => setBankDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#4CAF50", color: "white", py: 2 }}>
          Configure Bank Details
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          <div style={{ display: "grid", gap: "20px", padding: "10px 0" }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Account Name</label>
              <input
                type="text"
                name="accountName"
                value={bankDetails.accountName}
                onChange={handleBankDetailChange}
                style={styles.input}
                placeholder="Enter account name"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Account Number</label>
              <input
                type="text"
                name="accountNumber"
                value={bankDetails.accountNumber}
                onChange={handleBankDetailChange}
                style={styles.input}
                placeholder="Enter account number"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Bank Name</label>
              <input
                type="text"
                name="bank"
                value={bankDetails.bank}
                onChange={handleBankDetailChange}
                style={styles.input}
                placeholder="Enter bank name"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Branch</label>
              <input
                type="text"
                name="branch"
                value={bankDetails.branch}
                onChange={handleBankDetailChange}
                style={styles.input}
                placeholder="Enter branch"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>IFSC Code</label>
              <input
                type="text"
                name="ifscCode"
                value={bankDetails.ifscCode}
                onChange={handleBankDetailChange}
                style={styles.input}
                placeholder="Enter IFSC code"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>G-Pay Number</label>
              <input
                type="text"
                name="gpayNumber"
                value={bankDetails.gpayNumber}
                onChange={handleBankDetailChange}
                style={styles.input}
                placeholder="Enter G-Pay number"
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f9f9f9' }}>
          <Button onClick={() => setBankDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={saveBankDetails} variant="contained" sx={{ backgroundColor: "#4CAF50" }}>
            Save Details
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step Navigation */}
      <StepNavigation />

      <div className="container" style={styles.contentContainer}>
        {/* Navigation Buttons */}
        <div style={styles.navigationButtons}>
          {currentStep > 1 && (
            <button onClick={prevStep} style={styles.navButton}>
              ← Back
            </button>
          )}

          {currentStep < 4 && (
            <button
              onClick={nextStep}
              style={styles.navButton}
              disabled={currentStep === 2 && !formData.clientName}
            >
              Next →
            </button>
          )}
        </div>

        {/* Step Content */}
        {currentStep === 1 && <Step1 />}
        {currentStep === 2 && <Step2 />}
        {currentStep === 3 && <Step3 />}
        {currentStep === 4 && <Step4 />}
      </div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          
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
          
          input:focus, textarea:focus, select:focus {
            outline: none;
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
    fontFamily: "'Poppins', sans-serif",
    color: "#001F3F",
  },
  title: {
    color: "#001F3F",
    marginBottom: "30px",
    fontSize: "1.5rem",
    fontWeight: "700",
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
  // Step Navigation Styles
  stepNavigation: {
    marginBottom: "40px",
  },
  stepContainer: {
    display: "flex",
    justifyContent: "space-between",
    position: "relative",
    margin: "0 50px",
  },
  stepWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    zIndex: 1,
  },
  stepCircle: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "8px",
    transition: "all 0.3s ease",
  },
  stepLabel: {
    fontSize: "14px",
    color: "#001F3F",
    fontWeight: "500",
  },
  stepLine: {
    position: "absolute",
    top: "20px",
    height: "2px",
    backgroundColor: "#CCCCCC",
    zIndex: 0,
  },
  // Step Content Styles
  stepContent: {
    minHeight: "500px",
  },
  stepTitle: {
    color: "#001F3F",
    fontSize: "1.8rem",
    marginBottom: "30px",
    fontWeight: "600",
    textAlign: "center",
  },
  // Navigation Buttons
  navigationButtons: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "30px",
  },
  navButton: {
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
    border: "none",
    padding: "12px 25px",
    borderRadius: "6px",
    fontSize: "1.1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    minWidth: "120px",
  },
  // Company Details Display
  noteBox: {
    backgroundColor: "#E8F4F8",
    padding: "15px",
    borderRadius: "6px",
    marginBottom: "25px",
    border: "1px solid #001F3F",
  },
  loadingBox: {
    textAlign: "center",
    padding: "40px",
    fontSize: "1.2rem",
    color: "#666",
  },
  errorBox: {
    backgroundColor: "#FFEBEE",
    padding: "20px",
    borderRadius: "6px",
    border: "1px solid #F44336",
    textAlign: "center",
    color: "#D32F2F",
  },
  companyDetailsDisplay: {
    backgroundColor: "#F8FAFF",
    padding: "25px",
    borderRadius: "8px",
    border: "2px solid #001F3F",
  },
  detailRow: {
    display: "flex",
    marginBottom: "12px",
    paddingBottom: "12px",
    borderBottom: "1px solid #E0E0E0",
  },
  detailLabel: {
    fontWeight: "600",
    width: "200px",
    color: "#001F3F",
  },
  detailValue: {
    flex: 1,
    color: "#333",
  },
  // Form Styles
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "25px",
    marginBottom: "30px",
  },
  formGroup: {
    marginBottom: "20px",
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
  helpText: {
    fontSize: "0.9rem",
    color: "#666",
    marginTop: "5px",
    display: "block",
  },
  // Material and Service Forms
  sectionBox: {
    backgroundColor: "#F8FAFF",
    padding: "25px",
    borderRadius: "8px",
    border: "2px solid #001F3F",
    marginBottom: "30px",
  },
  subSectionTitle: {
    color: "#001F3F",
    fontSize: "1.4rem",
    marginBottom: "20px",
    fontWeight: "600",
  },
  materialForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "20px",
    alignItems: "end",
    marginBottom: "20px",
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
  // Table Styles
  materialsList: {
    marginBottom: "20px",
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
  // Totals Section
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
  // Generate Section
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
  errorText: {
    color: "#F44336",
    fontSize: "1rem",
    marginTop: "10px",
  },
};

// Add hover effects
styles.input[':hover'] = {
  outline: "none",
  borderColor: "#0056b3",
  boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
};

styles.input[':focus'] = {
  outline: "none",
  borderColor: "#0056b3",
  boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
};

styles.textarea[':hover'] = styles.input[':hover'];
styles.textarea[':focus'] = styles.input[':focus'];

styles.addButton[':hover'] = {
  backgroundColor: "#003366",
  transform: "translateY(-2px)",
  boxShadow: "0 4px 12px rgba(0, 31, 63, 0.2)",
};

styles.removeButton[':hover'] = {
  backgroundColor: "#FF5252",
  transform: "translateY(-1px)",
};

styles.generateButton[':hover'] = {
  backgroundColor: "#003366",
  transform: "translateY(-3px)",
  boxShadow: "0 6px 20px rgba(0, 31, 63, 0.25)",
};

styles.navButton[':hover'] = {
  backgroundColor: "#003366",
  transform: "translateY(-2px)",
  boxShadow: "0 4px 12px rgba(0, 31, 63, 0.2)",
};

styles.navButton[':disabled'] = {
  backgroundColor: "#CCCCCC",
  cursor: "not-allowed",
  transform: "none",
  boxShadow: "none",
};

export default InvoiceGenerator;