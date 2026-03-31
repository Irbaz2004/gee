import React, { useState, useEffect, useCallback, useRef } from "react";
import { Autocomplete, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../config";
import { useCompany } from "../context/CompanyContext";

const InvoiceGenerator = () => {
  const { selectedCompany } = useCompany();
  const [currentStep, setCurrentStep] = useState(1);
  const [adminData, setAdminData] = useState(null);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const previewRef = useRef(null);
  
  // Bank details - will be loaded from Firebase
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bank: "",
    branch: "",
    ifscCode: "",
    gpayNumber: ""
  });

  const [gstType, setGstType] = useState("GST");
  const [igstPercentage, setIgstPercentage] = useState(18);

  const [podcEntries, setPodcEntries] = useState([
    { id: 1, number: '', date: '' }
  ]);

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
      .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  // ================================
  // Get Company Logo Path
  // ================================
  const getCompanyLogoPath = (companyName) => {
    if (!companyName) return null;
    const fileName = sanitizeFilename(companyName);
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

  // Get current company's bank details from adminData
  const getCurrentBankDetails = useCallback(() => {
    return {
      accountName: adminData?.accountName || "",
      accountNumber: adminData?.accountNumber || "",
      bank: adminData?.bank || "",
      branch: adminData?.branch || "",
      ifscCode: adminData?.ifscCode || "",
      gpayNumber: adminData?.gpayNumber || ""
    };
  }, [adminData]);

  // Open bank details dialog
  const openBankDialog = () => {
    // Load current bank details into dialog state
    setBankDetails(getCurrentBankDetails());
    setBankDialogOpen(true);
  };

  // Handle bank details change
  const handleBankDetailChange = (e) => {
    const { name, value } = e.target;
    setBankDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save bank details to Firebase
  const saveBankDetails = async () => {
    try {
      // Update adminData with new bank details
      const updatedAdminData = {
        ...adminData,
        accountName: bankDetails.accountName,
        accountNumber: bankDetails.accountNumber,
        bank: bankDetails.bank,
        branch: bankDetails.branch,
        ifscCode: bankDetails.ifscCode,
        gpayNumber: bankDetails.gpayNumber,
        timestamp: new Date().toISOString()
      };

      const adminCollection = getCompanyAdminCollection();
      await addDoc(adminCollection, updatedAdminData);
      
      // Update local adminData state
      setAdminData(updatedAdminData);
      
      setBankDialogOpen(false);
      showNotification("Bank details saved successfully!", "success");
    } catch (error) {
      console.error("Error saving bank details:", error);
      showNotification("Failed to save bank details", "error");
    }
  };

  // Handle PO/DC entries
  const addPodcEntry = () => {
    setPodcEntries(prev => [...prev, { id: Date.now(), number: '', date: '' }]);
  };

  const removePodcEntry = (id) => {
    if (podcEntries.length > 1) {
      setPodcEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  const handlePodcChange = (id, field, value) => {
    setPodcEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  // Get company-specific collection path
  const getCompanyInvoiceCollection = useCallback(() => {
    const companyPath = isFaizanCompany() ? "faizan" : "galaxy";
    return collection(db, "companies", companyPath, "invoices");
  }, [isFaizanCompany]);

  const getCompanyAdminCollection = useCallback(() => {
    const companyPath = isFaizanCompany() ? "faizan" : "galaxy";
    return collection(db, "companies", companyPath, "adminSettings");
  }, [isFaizanCompany]);

  // Fetch admin data and last invoice number on component mount
  useEffect(() => {
    if (selectedCompany) {
      fetchAdminData();
      fetchLastInvoiceNumber();
      fetchMaterialsFromFirebase();
      fetchClientsFromFirebase();
      setPodcEntries([{ id: Date.now(), number: "", date: "" }]);
    }
  }, [selectedCompany]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const adminCollection = getCompanyAdminCollection();
      const q = query(adminCollection, orderBy("timestamp", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const latestData = snapshot.docs[0].data();
        setAdminData(latestData);

        setFormData(prev => ({
          ...prev,
          companyName: latestData.companyName || "",
          companyemail: latestData.companyEmail || "",
          companyAddress: latestData.companyAddress || "",
          companyGSTIN: latestData.companyGSTIN || "",
          companyContact: latestData.companyContact || "",
          companyDescription: latestData.companyDescription || "",
          companyState: latestData.companyState || "Tamil Nadu",
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
      const invoicesCollection = getCompanyInvoiceCollection();
      const q = query(invoicesCollection, orderBy("invoiceNumber", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const lastInvoice = snapshot.docs[0].data();
        setLastInvoiceNumber(lastInvoice.invoiceNumber);
        if (!isResetMode) {
          generateNextInvoiceNumber(lastInvoice.invoiceNumber);
        }
      } else {
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

    if (!lastNumber) {
      setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/001/${fyString}` }));
      return;
    }

    const parts = lastNumber.split('/');
    if (parts.length === 3 && parts[0] === prefix && parts[2] === fyString) {
      const lastSeq = parseInt(parts[1]);
      if (!isNaN(lastSeq)) {
        const nextSeq = (lastSeq + 1).toString().padStart(3, '0');
        setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/${nextSeq}/${fyString}` }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, invoiceNumber: `${prefix}/001/${fyString}` }));
  };

  const fetchMaterialsFromFirebase = async () => {
    try {
      const materialsCollection = collection(db, "materials");
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
      showNotification("Failed to load materials", "error");
    }
  };

  const fetchClientsFromFirebase = async () => {
    try {
      const clientsCollection = collection(db, "clients");
      const clientsSnapshot = await getDocs(clientsCollection);
      const clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setClients(clientsList);
    } catch (error) {
      console.error("Error fetching clients from Firebase:", error);
      showNotification("Failed to load clients", "error");
    }
  };

  const saveInvoiceToFirebase = async () => {
    try {
      const totals = calculateTotals();
      const invoiceData = {
        ...formData,
        materials: formData.materials,
        additionalServices: formData.additionalServices,
        gstType,
        igstPercentage: gstType === "IGST" ? igstPercentage : null,
        podcEntries: podcEntries.filter(entry => entry.number || entry.date),
        timestamp: new Date().toISOString(),
        totals: totals,
        roundOff: totals.roundOff,
        grandTotalWithRoundOff: totals.grandTotalWithRoundOff,
        bankDetails: getCurrentBankDetails()
      };

      const invoicesCollection = getCompanyInvoiceCollection();
      await addDoc(invoicesCollection, invoiceData);
      return true;
    } catch (error) {
      console.error("Error saving invoice to Firebase:", error);
      showNotification("Failed to save invoice data to database", "error");
      return false;
    }
  };

  const saveMaterialToFirebase = async (material) => {
    try {
      const existingMaterial = firebaseMaterials.find(mat =>
        mat.materialName === material.description &&
        mat.hsnCode === material.hsn
      );

      if (!existingMaterial) {
        const materialsCollection = collection(db, "materials");
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

  const handleInputChange = useCallback((e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    
    if (type === 'number') {
      if (value === '' || value === '-' || value === '.') {
        processedValue = value;
      } else {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          processedValue = value;
        }
      }
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  }, []);

  const handleMaterialChange = useCallback((e) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    if (name === "quantity" || name === "rate") {
      if (value === '' || value === '.' || value === '-') {
        processedValue = value;
      } else {
        const regex = /^-?\d*\.?\d*$/;
        if (regex.test(value)) {
          processedValue = value;
        } else {
          return;
        }
      }
    }
    
    setNewMaterial((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  }, []);

  const handleAdditionalServiceChange = useCallback((e) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    if (name === "amount") {
      if (value === '' || value === '.' || value === '-') {
        processedValue = value;
      } else {
        const regex = /^-?\d*\.?\d*$/;
        if (regex.test(value)) {
          processedValue = value;
        } else {
          return;
        }
      }
    }
    
    setNewAdditionalService((prev) => ({
      ...prev,
      [name]: processedValue,
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

  const handleClientInputChange = useCallback((event, newInputValue) => {
    setFormData(prev => ({ ...prev, clientName: newInputValue }));
  }, []);

  const handleMaterialSelect = useCallback((e) => {
    const selectedMaterialId = e.target.value;
    if (selectedMaterialId) {
      const selectedMaterial = firebaseMaterials.find(mat => mat.id === selectedMaterialId);
      if (selectedMaterial) {
        setNewMaterial(prev => ({
          ...prev,
          description: selectedMaterial.materialName || "",
          hsn: selectedMaterial.hsnCode || "",
          rate: selectedMaterial.rate?.toString() || ""
        }));
        showNotification("Material details loaded from database", "info");
      }
    }
  }, [firebaseMaterials, showNotification]);

  const addMaterial = useCallback(() => {
    if (!newMaterial.description || !newMaterial.quantity || !newMaterial.rate) {
      showNotification("Please fill description, quantity, and rate", "error");
      return;
    }

    const quantity = parseFloat(newMaterial.quantity) || 0;
    const rate = parseFloat(newMaterial.rate) || 0;
    const amount = quantity * rate;

    const material = {
      id: Date.now(),
      description: newMaterial.description,
      hsn: newMaterial.hsn || "",
      quantity: quantity,
      rate: rate,
      amount: amount,
    };

    setFormData((prev) => ({
      ...prev,
      materials: [...prev.materials, material],
    }));

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

    const amount = parseFloat(newAdditionalService.amount) || 0;

    const service = {
      id: Date.now(),
      description: newAdditionalService.description,
      amount: amount,
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
    
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (gstType === "GST") {
      cgstAmount = (materialsTotal * formData.cgstPercentage) / 100;
      sgstAmount = (materialsTotal * formData.sgstPercentage) / 100;
    } else {
      igstAmount = (materialsTotal * igstPercentage) / 100;
    }

    const total = subTotal + cgstAmount + sgstAmount + igstAmount;
    
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
  }, [formData.materials, formData.additionalServices, formData.cgstPercentage, formData.sgstPercentage, gstType, igstPercentage]);

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

  const resetForm = async () => {
    await fetchLastInvoiceNumber();

    setFormData(prev => ({
      ...prev,
      invoiceDate: new Date().toISOString().split("T")[0],
      clientName: "",
      clientAddress: "",
      clientGSTIN: "",
      clientContact: "",
      materials: [],
      additionalServices: [],
    }));

    setPodcEntries([{ id: Date.now(), number: "", date: "" }]);

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

  // Function to generate preview HTML with reduced padding
  const generatePreviewHTML = () => {
    const isFaizan = isFaizanCompany();
    const rowsPerPage = 18;
    const pageCount = Math.ceil(formData.materials.length / rowsPerPage);
    const getStartIdx = (page) => page * rowsPerPage;
    const getEndIdx = (page) => Math.min((page + 1) * rowsPerPage, formData.materials.length);
    const totals = calculateTotals();
    const validPodcEntries = podcEntries.filter(entry => entry.number || entry.date);
    const currentBankDetails = getCurrentBankDetails();

    const buildFaizanPageHTML = (page) => {
      const maroon = "#800020";
      const borderColor = "#000000";
      
      let html = `
        <div style="width: 210mm; padding: 0; margin: 0; background-color: white; box-sizing: border-box; font-family: 'Poppins', sans-serif; border: 1px solid ${borderColor};">
      `;

      if (page === 0) {
        html += `
          <div style="margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; padding: 8px 12px 0 12px;">
              <div style="flex: 1; display: flex; align-items: center;">
                ${companyLogo && !logoError ? 
                  `<img src="${companyLogo}" alt="Company Logo" style="height: 60px; width: auto; object-fit: contain;" />` :
                  `<div style="height: 55px; width: 55px; background-color: #F3F4F6; display: flex; align-items: center; justify-content: center; border: 2px solid ${borderColor}; border-radius: 8px; color: ${maroon}; font-weight: bold; font-size: 24px;">${formData.companyName?.charAt(0)?.toUpperCase() || "C"}</div>`
                }
              </div>
              <div style="flex: 1; text-align: right;">
                <h2 style="margin: 0 0 4px 0; font-size: 22px; color: ${maroon}; font-weight: 700;">TAX INVOICE</h2>
                <div style="font-size: 12px; line-height: 1.4; color: #333333;">
                  <div><strong>Invoice No:</strong> ${formData.invoiceNumber}</div>
                  <div><strong>Date:</strong> ${new Date(formData.invoiceDate).toLocaleDateString("en-IN")}</div>
                </div>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 6px;padding: 8px 12px; background-color: white; border-top: 1px solid ${borderColor}; font-size: 11px; line-height: 1.4;">
              <div style="flex: 1;border-right:1px solid ${borderColor};">
                <div style="color: #333333;">
                  <div style="font-weight: 700; margin-bottom: 4px; color: ${maroon}; font-size: 13px;">${formData.companyName}</div>
                  <div style="margin-bottom: 3px;">${formData.companyAddress}</div>
                  <div style="margin-bottom: 3px;"><strong>Email:</strong> ${formData.companyemail}</div>
                  <div style="margin-bottom: 3px;"><strong>GSTIN:</strong> ${formData.companyGSTIN}</div>
                  <div style="margin-bottom: 3px;"><strong>Contact:</strong> ${formData.companyContact}</div>
                  <div style="margin-top: 4px; font-style: italic; font-size: 10px;">${formData.companyDescription}</div>
                </div>
              </div>
              <div style="flex: 1; margin-left: 20px;">
                <h3 style="margin: 0 0 4px 0; color: ${maroon}; font-size: 13px; font-weight: 700;">To:</h3>
                <div style="color: #333333;">
                  <div style="font-weight: 700; margin-bottom: 4px; color: ${maroon};">${formData.clientName}</div>
                  <div style="margin-bottom: 3px;">${formData.clientAddress}</div>
                  <div style="margin-bottom: 3px;"><strong>GSTIN:</strong> ${formData.clientGSTIN}</div>
                  <div style="margin-bottom: 3px;"><strong>Contact:</strong> ${formData.clientContact}</div>
                </div>
                ${validPodcEntries.length > 0 ? `
                  <div style="margin-top: 6px; padding-top: 5px; border-top: 1px dashed ${borderColor};">
                    ${validPodcEntries.map((entry, idx) => `
                      <div style="font-size: 10px; margin-bottom: 2px;"><strong>PO/DC No ${idx + 1}:</strong> ${entry.number || '-'} &nbsp;&nbsp;<strong>Date:</strong> ${entry.date || '-'}</div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }

      html += buildFaizanTableHTML(page, rowsPerPage, totals, borderColor, maroon, getStartIdx, getEndIdx, pageCount);

      if (page === pageCount - 1) {
        html += buildFaizanFooterHTML(maroon, borderColor, totals, currentBankDetails);
      }

      html += `</div>`;
      return html;
    };

    const buildFaizanTableHTML = (page, perPage, totals, borderColor, maroon, getStartIdx, getEndIdx, pageCount) => {
      let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; color: #333333; font-family: 'Poppins', sans-serif; table-layout: fixed;">
          <thead>
            <tr style="height: 32px; background-color: white;">
              <th style="border: 1px solid ${borderColor}; padding: 6px 4px; width: 4%; font-size: 11px; color: ${maroon}; font-weight: 700;">S.No.</th>
              <th style="border: 1px solid ${borderColor}; padding: 6px 4px; width: 52%; font-size: 11px; color: ${maroon}; font-weight: 700;">Material Description</th>
              <th style="border: 1px solid ${borderColor}; padding: 6px 4px; width: 10%; font-size: 11px; color: ${maroon}; font-weight: 700;">HSN/SAC</th>
              <th style="border: 1px solid ${borderColor}; padding: 6px 4px; width: 8%; font-size: 11px; color: ${maroon}; font-weight: 700;">Qty.</th>
              <th style="border: 1px solid ${borderColor}; padding: 6px 4px; width: 13%; font-size: 11px; color: ${maroon}; font-weight: 700;">Rate (₹)</th>
              <th style="border: 1px solid ${borderColor}; padding: 6px 4px; width: 13%; font-size: 11px; color: ${maroon}; font-weight: 700;">Amount (₹)</th>
             </tr>
          </thead>
          <tbody>
      `;

      const startIdx = getStartIdx(page);
      const endIdx = getEndIdx(page);

      for (let i = startIdx; i < endIdx; i++) {
        const material = formData.materials[i];
        const desc = material.description;
        const truncDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
        // White background for all rows, no horizontal border
        tableHtml += `
          <tr style="height: 30px; background-color: white;">
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: center; font-size: 11px; vertical-align: middle;">${i + 1}</td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; font-size: 11px; vertical-align: middle;" title="${desc}">${truncDesc}</td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: center; font-size: 11px; vertical-align: middle;">${material.hsn}</td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: center; font-size: 11px; vertical-align: middle;">${material.quantity}</td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: right; font-size: 11px; vertical-align: middle;">${formatNumber(material.rate)}</td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: right; font-weight: bold; font-size: 11px; vertical-align: middle;">${formatNumber(material.amount)}</td>
          </tr>
        `;
      }

      const currentRows = endIdx - startIdx;
      const remainingRows = perPage - currentRows;

      for (let i = 0; i < remainingRows; i++) {
        // White background for all empty rows
        tableHtml += `
          <tr style="height: 30px; background-color: white;">
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; font-size: 11px;">${endIdx + i + 1}</td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px;"></td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px;"></td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px;"></td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px;"></td>
            <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px;"></td>
          </tr>
        `;
      }

      if (page === pageCount - 1) {
        if (formData.additionalServices.length > 0) {
          tableHtml += `
            <tr style="background-color: ${maroon};">
              <td colspan="6" style="border: 1px solid ${borderColor}; padding: 6px 4px; font-weight: bold; font-size: 11px; color: white;">Additional Services (Excluding GST)</td>
            </tr>
          `;
          formData.additionalServices.forEach((service, index) => {
            // White background for service rows
            tableHtml += `
              <tr style="background-color: white; height: 30px;">
                <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: center; font-size: 11px;">${index + 1}</td>
                <td colspan="4" style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; font-size: 11px;">${service.description}</td>
                <td style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; padding: 5px 4px; text-align: right; font-weight: bold; font-size: 11px;">${formatNumber(service.amount)}</td>
              </tr>
            `;
          });
        }

        tableHtml += `
          <tr style="background-color: #F9FAFB;">
            <td colspan="5" style="border: 1px solid ${borderColor}; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 11px; color: ${maroon};">Sub Total:</td>
            <td style="border: 1px solid ${borderColor}; padding: 6px 4px; font-weight: bold; font-size: 11px; text-align: right; color: ${maroon};">₹ ${formatNumber(totals.subTotal)}</td>
          </tr>
        `;

        if (gstType === "GST") {
          tableHtml += `
            <tr style="background-color: white;">
              <td colspan="5" style="border: 1px solid ${borderColor}; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 11px; color: ${maroon};">CGST (${formData.cgstPercentage}%):</td>
              <td style="border: 1px solid ${borderColor}; padding: 6px 4px; font-weight: bold; font-size: 11px; text-align: right; color: ${maroon};">₹ ${formatNumber(totals.cgstAmount)}</td>
            </tr>
            <tr style="background-color: #F9FAFB;">
              <td colspan="5" style="border: 1px solid ${borderColor}; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 11px; color: ${maroon};">SGST (${formData.sgstPercentage}%):</td>
              <td style="border: 1px solid ${borderColor}; padding: 6px 4px; font-weight: bold; font-size: 11px; text-align: right; color: ${maroon};">₹ ${formatNumber(totals.sgstAmount)}</td>
            </tr>
          `;
        } else {
          tableHtml += `
            <tr style="background-color: white;">
              <td colspan="5" style="border: 1px solid ${borderColor}; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 11px; color: ${maroon};">IGST (${igstPercentage}%):</td>
              <td style="border: 1px solid ${borderColor}; padding: 6px 4px; font-weight: bold; font-size: 11px; text-align: right; color: ${maroon};">₹ ${formatNumber(totals.igstAmount)}</td>
            </tr>
          `;
        }

        tableHtml += `
          <tr style="background-color: #F3F4F6;">
            <td colspan="5" style="border: 1px solid ${borderColor}; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 11px; color: ${maroon};">Round Off:</td>
            <td style="border: 1px solid ${borderColor}; padding: 6px 4px; font-weight: bold; font-size: 11px; text-align: right; color: ${maroon};">₹ ${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}</td>
          </tr>
          <tr style="background-color: white;">
            <td colspan="5" style="border: 1px solid ${borderColor}; padding: 8px 4px; text-align: right; font-weight: bold; font-size: 12px; color: ${maroon}; background-color: white;">GRAND TOTAL:</td>
            <td style="border: 1px solid ${borderColor}; padding: 8px 4px; font-weight: bold; font-size: 12px; text-align: right; color: ${maroon}; background-color: white;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}</td>
          </tr>
        `;
      }

      tableHtml += `</tbody>`;
      return tableHtml;
    };

    const buildFaizanFooterHTML = (maroon, borderColor, totals, currentBankDetails) => {
      return `
        <div style="margin-top: 6px;">
          <div style="border: 1px solid ${borderColor}; border-top: none;border-right: none;border-left: none; padding: 6px 8px; font-size: 10px; background-color: white; color: #333333; display: flex; justify-content: space-between; align-items: center;">
            <div><strong style="color: ${maroon};">Amount Chargeable (in words):</strong> ${numberToWords(totals.grandTotalWithRoundOff)}</div>
            <div style="font-weight: bold; font-size: 10px; color: #6B7280;">E. & O.E</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div style="flex: 1; border: 1px solid ${borderColor}; border: none; padding: 6px 8px; font-size: 9px; background-color: white;">
              <div style="font-weight: bold; margin-bottom: 4px; color: ${maroon}; font-size: 10px;">Bank Details:</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <div style="color: #333333; font-size: 9px;"><strong>Account Name:</strong> ${currentBankDetails.accountName || 'Not configured'}</div>
                <div style="color: #333333; font-size: 9px;"><strong>Account No:</strong> ${currentBankDetails.accountNumber || 'Not configured'}</div>
                <div style="color: #333333; font-size: 9px;"><strong>Bank:</strong> ${currentBankDetails.bank || 'Not configured'}</div>
                <div style="color: #333333; font-size: 9px;"><strong>Branch:</strong> ${currentBankDetails.branch || 'Not configured'}</div>
                <div style="color: #333333; font-size: 9px;"><strong>IFSC:</strong> ${currentBankDetails.ifscCode || 'Not configured'}</div>
                <div style="color: #333333; font-size: 9px;"><strong>G-Pay:</strong> ${currentBankDetails.gpayNumber || 'Not configured'}</div>
              </div>
            </div>
            <div style="flex: 1; border: 1px solid ${borderColor}; border-top: none;border-right: none; padding: 8px; font-size: 10px; background: white; text-align: center; position: relative; min-height: 90px;">
              <div style="color: ${maroon}; position: absolute; top: 12px; right: 12px;"><strong style="font-size: 11px;">For ${formData.companyName}</strong></div>
              <div style="font-size: 9px; color: #6B7280; position: absolute; bottom: 12px; right: 12px; text-align: right;">Authorized Signatory</div>
            </div>
          </div>
          <div style="border: 1px solid ${borderColor}; border-top: none; padding: 5px; text-align: center; font-size: 9px; background-color: white; color: ${maroon};">
            SUBJECT TO ${(formData.companyState || '').toUpperCase()} JURISDICTION | This is a Computer Generated Invoice
          </div>
        </div>
      `;
    };

    const buildGeePageHTML = (page) => {
      const navyBlue = "#1A2C4E";
      const borderColor = "#000000";
      const textColor = "#1F2937";
      const lightBg = "#F9FAFB";

      let html = `
        <div style="width: 210mm; padding: 0; margin: 0; background-color: white; box-sizing: border-box; font-family: 'Poppins', sans-serif; border: 1px solid ${borderColor};">
      `;

      if (page === 0) {
        html += `
          <div style="border-bottom: 1px solid ${borderColor}; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: white;">
            <div style="display: flex; align-items: center; gap: 15px;">
              ${companyLogo && !logoError ? 
                `<img src="${companyLogo}" alt="Company Logo" style="height: 50px; width: auto; object-fit: contain;" />` :
                `<div style="width: 50px; height: 50px; background: ${lightBg}; border: 1px solid ${borderColor}; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${navyBlue}; font-size: 22px; font-weight: 700;">${formData.companyName?.charAt(0)?.toUpperCase() || "G"}</div>`
              }
            </div>
            <div style="text-align: right;">
              <div style="color: ${navyBlue}; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;">Tax Invoice</div>
              <div style="color: ${navyBlue}; font-size: 16px; font-weight: 700;">${formData.invoiceNumber}</div>
              <div style="color: #6B7280; font-size: 10px;">${new Date(formData.invoiceDate).toLocaleDateString("en-IN", {day:'2-digit',month:'long',year:'numeric'})}</div>
            </div>
          </div>
          <div style="display: flex; gap: 0; border-bottom: 1px solid ${borderColor};">
            <div style="flex: 1; padding: 8px 12px; border-right: 1px solid ${borderColor}; background: ${lightBg};">
              <div style="font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; margin-bottom: 6px;">From</div>
              <div style="font-size: 12px; color: ${navyBlue}; font-weight: 700; margin-bottom: 4px;">${formData.companyName}</div>
              <div style="font-size: 10px; color: ${textColor}; line-height: 1.4;">
                <div>${formData.companyAddress}</div>
                <div><span style="font-weight: 600;">GSTIN:</span> ${formData.companyGSTIN}</div>
                <div><span style="font-weight: 600;">Contact:</span> ${formData.companyContact}</div>
                <div><span style="font-weight: 600;">Email:</span> ${formData.companyemail}</div>
              </div>
              <div style="margin-top: 4px; font-style: italic; font-size: 9px; color: #6B7280;">${formData.companyDescription}</div>
            </div>
            <div style="flex: 1; padding: 8px 12px; background: white;">
              <div style="font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; margin-bottom: 6px;">Bill To</div>
              <div style="font-size: 12px; color: ${navyBlue}; font-weight: 700; margin-bottom: 4px;">${formData.clientName}</div>
              <div style="font-size: 10px; color: ${textColor}; line-height: 1.4;">
                <div>${formData.clientAddress}</div>
                <div><span style="font-weight: 600;">GSTIN:</span> ${formData.clientGSTIN}</div>
                <div><span style="font-weight: 600;">Contact:</span> ${formData.clientContact}</div>
              </div>
            </div>
          </div>
        `;

        if (validPodcEntries.length > 0) {
          html += `
            <div style="padding: 5px 12px; background: ${lightBg}; border-bottom: 1px solid ${borderColor}; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              <span style="font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; margin-right: 3px;">PO/DC:</span>
          `;
          validPodcEntries.forEach((entry, index) => {
            html += `
              <span style="display: inline-flex; gap: 6px; align-items: center; background: white; padding: 3px 8px; border-radius: 4px; border: 1px solid ${borderColor}; font-size: 9px;">
                <strong style="color: ${navyBlue};">#${index + 1}:</strong> <span style="color: ${textColor};">${entry.number || '—'}</span> <span style="color: ${borderColor};">|</span> 
                <strong style="color: ${navyBlue};">Date:</strong> <span style="color: ${textColor};">${entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : '—'}</span>
              </span>
            `;
          });
          html += `</div>`;
        }
      }

      html += buildGeeTableHTML(page, rowsPerPage, totals, borderColor, navyBlue, textColor, lightBg, getStartIdx, getEndIdx, pageCount);

      if (page === pageCount - 1) {
        html += buildGeeFooterHTML(navyBlue, borderColor, textColor, lightBg, totals, currentBankDetails);
      }

      html += `</div>`;
      return html;
    };

    const buildGeeTableHTML = (page, perPage, totals, borderColor, navyBlue, textColor, lightBg, getStartIdx, getEndIdx, pageCount) => {
      let tableHtml = `
        <div style="padding: 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: 'Poppins', sans-serif; table-layout: fixed;">
            <thead>
              <tr style="background-color: white;">
                <th style="padding: 6px 4px; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; width: 4%; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">No.</th>
                <th style="padding: 6px 4px; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; width: 52%; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">Description</th>
                <th style="padding: 6px 4px; text-align: center; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; width: 10%; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">HSN/SAC</th>
                <th style="padding: 6px 4px; text-align: center; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; width: 8%; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">Qty</th>
                <th style="padding: 6px 4px; text-align: right; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; width: 13%; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">Rate (₹)</th>
                <th style="padding: 6px 4px; text-align: right; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; width: 13%; border-bottom: 1px solid ${borderColor};">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
      `;

      const startIdx = getStartIdx(page);
      const endIdx = getEndIdx(page);

      for (let i = startIdx; i < endIdx; i++) {
        const material = formData.materials[i];
        const desc = material.description;
        const truncDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
        // White background for all rows, no horizontal border
        tableHtml += `
          <tr style="background-color: white; height: 30px;">
            <td style="padding: 5px 4px; text-align: center; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${i + 1}</td>
            <td style="padding: 5px 4px; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};" title="${desc}">${truncDesc}</td>
            <td style="padding: 5px 4px; text-align: center; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${material.hsn}</td>
            <td style="padding: 5px 4px; text-align: center; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${material.quantity}</td>
            <td style="padding: 5px 4px; text-align: right; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${formatNumber(material.rate)}</td>
            <td style="padding: 5px 4px; text-align: right; color: ${navyBlue}; font-size: 10px; font-weight: 600;">${formatNumber(material.amount)}</td>
          </tr>
        `;
      }

      const currentRows = endIdx - startIdx;
      const remainingRows = perPage - currentRows;

      for (let i = 0; i < remainingRows; i++) {
        // White background for all empty rows
        tableHtml += `
          <tr style="height: 30px; background-color: white;">
            <td style="padding: 5px 4px; text-align: center; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${endIdx + i + 1}</td>
            <td style="border-right: 1px solid ${borderColor};">&nbsp;</td>
            <td style="border-right: 1px solid ${borderColor};">&nbsp;</td>
            <td style="border-right: 1px solid ${borderColor};">&nbsp;</td>
            <td style="border-right: 1px solid ${borderColor};">&nbsp;</td>
            <td style="">&nbsp;</td>
          </tr>
        `;
      }

      if (page === pageCount - 1 && formData.additionalServices.length > 0) {
        tableHtml += `
          <tr style="background-color: ${lightBg}; border-top: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">
            <td colspan="6" style="padding: 5px 4px; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600;">Additional Services (Excl. GST)</td>
          </tr>
        `;
        formData.additionalServices.forEach((service, index) => {
          // White background for service rows
          tableHtml += `
            <tr style="background-color: white; border-bottom: 1px solid ${borderColor}; height: 30px;">
              <td style="padding: 5px 4px; text-align: center; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${index + 1}</td>
              <td colspan="4" style="padding: 5px 4px; color: ${textColor}; font-size: 10px; border-right: 1px solid ${borderColor};">${service.description}</td>
              <td style="padding: 5px 4px; text-align: right; color: ${navyBlue}; font-size: 10px; font-weight: 600;">${formatNumber(service.amount)}</td>
            </tr>
          `;
        });
      }

      if (page === pageCount - 1) {
        tableHtml += `
          <tr style="background-color: ${lightBg}; border-top: 1px solid ${borderColor};">
            <td colspan="5" style="padding: 6px 4px; text-align: right; font-size: 10px; font-weight: 600; color: ${navyBlue}; border-right: 1px solid ${borderColor};">Sub Total</td>
            <td style="padding: 6px 4px; text-align: right; font-size: 10px; font-weight: 700; color: ${navyBlue};">₹ ${formatNumber(totals.subTotal)}</td>
          </tr>
        `;

        if (gstType === "GST") {
          tableHtml += `
            <tr style="background-color: white;">
              <td colspan="5" style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor}; border-right: 1px solid ${borderColor};">CGST (${formData.cgstPercentage}%)</td>
              <td style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor};">₹ ${formatNumber(totals.cgstAmount)}</td>
            </tr>
            <tr style="background-color: ${lightBg};">
              <td colspan="5" style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor}; border-right: 1px solid ${borderColor};">SGST (${formData.sgstPercentage}%)</td>
              <td style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor};">₹ ${formatNumber(totals.sgstAmount)}</td>
            </tr>
          `;
        } else {
          tableHtml += `
            <tr style="background-color: white;">
              <td colspan="5" style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor}; border-right: 1px solid ${borderColor};">IGST (${igstPercentage}%)</td>
              <td style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor};">₹ ${formatNumber(totals.igstAmount)}</td>
            </tr>
          `;
        }

        tableHtml += `
          <tr style="background-color: ${lightBg};">
            <td colspan="5" style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor}; border-right: 1px solid ${borderColor};">Round Off</td>
            <td style="padding: 5px 4px; text-align: right; font-size: 10px; color: ${textColor};">${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}</td>
          </tr>
          <tr style="background-color: white;">
            <td colspan="5" style="padding: 8px 4px; text-align: right; font-size: 12px; font-weight: 700; color: ${navyBlue}; border-right: 1px solid ${borderColor}; background-color: white;">Grand Total</td>
            <td style="padding: 8px 4px; text-align: right; font-size: 12px; font-weight: 700; color: ${navyBlue}; background-color: white;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}</td>
          </tr>
        `;
      }

      tableHtml += `</tbody>`;
      return tableHtml;
    };

    const buildGeeFooterHTML = (navyBlue, borderColor, textColor, lightBg, totals, currentBankDetails) => {
      return `
        <div style="margin-top: 0; border-top: 1px solid ${borderColor};">
          <div style="padding: 6px 12px; background: ${lightBg}; border-bottom: 1px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 9px; color: ${textColor};"><span style="font-weight: 600; color: ${navyBlue};">Amount in Words: </span>${numberToWords(totals.grandTotalWithRoundOff)}</div>
            <div style="font-size: 8px; color: ${textColor}; font-style: italic;">E. & O.E</div>
          </div>
          <div style="display: flex;">
            <div style="flex: 1; padding: 6px 12px; background: white; border-right: 1px solid ${borderColor};">
              <div style="font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600; margin-bottom: 5px;">Bank Details</div>
              <div style="font-size: 9px; color: ${textColor}; line-height: 1.6;">
                <div><span style="font-weight: 600; color: ${navyBlue};">Account Name:</span> ${currentBankDetails.accountName || 'Not configured'}</div>
                <div><span style="font-weight: 600; color: ${navyBlue};">Account No:</span> ${currentBankDetails.accountNumber || 'Not configured'}</div>
                <div><span style="font-weight: 600; color: ${navyBlue};">Bank:</span> ${currentBankDetails.bank || 'Not configured'}</div>
                <div><span style="font-weight: 600; color: ${navyBlue};">Branch:</span> ${currentBankDetails.branch || 'Not configured'}</div>
                <div><span style="font-weight: 600; color: ${navyBlue};">IFSC:</span> ${currentBankDetails.ifscCode || 'Not configured'}</div>
                <div><span style="font-weight: 600; color: ${navyBlue};">G-Pay:</span> ${currentBankDetails.gpayNumber || 'Not configured'}</div>
              </div>
            </div>
            <div style="flex: 1; padding: 6px 12px; background: ${lightBg}; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
              <div style="font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${navyBlue}; font-weight: 600;">For ${formData.companyName}</div>
              <div style="font-size: 9px; color: ${textColor}; text-align: right;">Authorized Signatory</div>
            </div>
          </div>
          <div style="background-color: white; padding: 5px 12px; display: flex; justify-content: space-between; align-items: center; color: ${navyBlue};">
            <span style="color: ${navyBlue}; font-size: 8px; letter-spacing: 1px;">SUBJECT TO ${(formData.companyState || '').toUpperCase()} JURISDICTION</span>
            <span style="color: ${navyBlue}; font-size: 8px; letter-spacing: 1px;">COMPUTER GENERATED INVOICE</span>
          </div>
        </div>
      `;
    };

    let fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice Preview</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          * {
            font-family: 'Poppins', sans-serif;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background: #e5e7eb;
            display: flex;
            justify-content: center;
            padding: 15px;
          }
          .preview-container {
            background: white;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }
        </style>
      </head>
      <body>
        <div class="preview-container">
    `;

    for (let page = 0; page < pageCount; page++) {
      if (page > 0) {
        fullHtml += `<div style="page-break-before: always; margin-top: 10px;"></div>`;
      }
      if (isFaizan) {
        fullHtml += buildFaizanPageHTML(page);
      } else {
        fullHtml += buildGeePageHTML(page);
      }
    }

    fullHtml += `
        </div>
      </body>
      </html>
    `;

    return fullHtml;
  };

  const handlePreview = () => {
    if (formData.materials.length === 0) {
      showNotification("Please add at least one material to preview invoice", "error");
      return;
    }
    const html = generatePreviewHTML();
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  const generatePDF = async () => {
    try {
      if (formData.materials.length === 0) {
        showNotification("Please add at least one material before generating PDF", "error");
        return;
      }

      const currentBankDetails = getCurrentBankDetails();
      if (!currentBankDetails.accountNumber) {
        setBankDialogOpen(true);
        return;
      }

      const saved = await saveInvoiceToFirebase();
      if (!saved) return;

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

      const isFaizan = isFaizanCompany();
      const rowsPerPage = 18;
      const pageCount = Math.ceil(formData.materials.length / rowsPerPage);
      const getStartIdx = (page) => page * rowsPerPage;
      const getEndIdx = (page) => Math.min((page + 1) * rowsPerPage, formData.materials.length);
      const totals = calculateTotals();
      const validPodcEntries = podcEntries.filter(entry => entry.number || entry.date);
      const currentBankDetailsForFooter = getCurrentBankDetails();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const preloadImage = (src) => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

      if (companyLogo && !logoError) {
        await preloadImage(companyLogo);
      }

      const renderToCanvas = async (element) => {
        const tempContainer = document.createElement("div");
        tempContainer.style.position = "fixed";
        tempContainer.style.left = "-10000px";
        tempContainer.style.top = "0";
        tempContainer.style.fontFamily = "'Poppins', sans-serif";
        tempContainer.appendChild(element);
        document.body.appendChild(tempContainer);

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

      // Build Faizan Page Element
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

          if (companyLogo && !logoError) {
            const logoImg = document.createElement("img");
            logoImg.src = companyLogo;
            logoImg.crossOrigin = "anonymous";
            logoImg.alt = "Company Logo";
            logoImg.style.height = "70px";
            logoImg.style.width = "auto";
            logoImg.style.objectFit = "contain";
            leftSection.appendChild(logoImg);
          } else {
            const textPlaceholder = document.createElement("div");
            textPlaceholder.style.cssText = `height:70px;width:70px;background-color:#F3F4F6;display:flex;align-items:center;justify-content:center;border:1px solid ${borderColor};border-radius:6px;color:${maroon};font-weight:bold;font-size:24px;`;
            textPlaceholder.textContent = formData.companyName?.charAt(0)?.toUpperCase() || "C";
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
              <div><strong>Invoice No:</strong> ${formData.invoiceNumber}</div>
              <div><strong>Date:</strong> ${new Date(formData.invoiceDate).toLocaleDateString("en-IN")}</div>
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
          billTo.innerHTML = `
            <div style="color:#333333;">
              <div style="font-weight:700;margin-bottom:4px;color:${maroon};font-size:13px;">${formData.companyName}</div>
              <div style="margin-bottom:3px;">${formData.companyAddress}</div>
              <div style="margin-bottom:3px;"><strong>Email:</strong> ${formData.companyemail}</div>
              <div style="margin-bottom:3px;"><strong>GSTIN:</strong> ${formData.companyGSTIN}</div>
              <div style="margin-bottom:3px;"><strong>Contact:</strong> ${formData.companyContact}</div>
              <div style="margin-top:4px;font-style:italic;font-size:10px;">${formData.companyDescription}</div>
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
              <div style="font-weight:700;margin-bottom:4px;color:${maroon};">${formData.clientName}</div>
              <div style="margin-bottom:3px;">${formData.clientAddress}</div>
              <div style="margin-bottom:3px;"><strong>GSTIN:</strong> ${formData.clientGSTIN}</div>
              <div style="margin-bottom:3px;"><strong>Contact:</strong> ${formData.clientContact}</div>
              ${podcHTML}
            </div>`;

          clientDetails.appendChild(billTo);
          clientDetails.appendChild(shipTo);
          headerDiv.appendChild(clientDetails);
          pageDiv.appendChild(headerDiv);
        }

        const table = buildFaizanTableElement(page, rowsPerPage, totals, borderColor, maroon, getStartIdx, getEndIdx, pageCount);
        pageDiv.appendChild(table);

        if (page === pageCount - 1) {
          const footer = buildFaizanFooterElement(maroon, borderColor, totals, currentBankDetailsForFooter);
          pageDiv.appendChild(footer);
        }

        return pageDiv;
      };

      const buildFaizanTableElement = (page, perPage, totals, borderColor, maroon, getStartIdx, getEndIdx, pageCount) => {
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
          const material = formData.materials[i];
          const desc = material.description;
          const truncDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
          const row = document.createElement("tr");
          row.style.cssText = `height:30px;background-color:white;`;
          row.innerHTML = `
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;vertical-align:middle;">${i + 1}</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;font-size:11px;vertical-align:middle;" title="${desc}">${truncDesc}</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;vertical-align:middle;">${material.hsn}</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;vertical-align:middle;">${material.quantity}</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:right;font-size:11px;vertical-align:middle;">${formatNumber(material.rate)}</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:right;font-weight:bold;font-size:11px;vertical-align:middle;">${formatNumber(material.amount)}</td>
          `;
          tbody.appendChild(row);
        }

        const currentRows = endIdx - startIdx;
        const remainingRows = perPage - currentRows;

        for (let i = 0; i < remainingRows; i++) {
          const emptyRow = document.createElement("tr");
          emptyRow.style.height = "30px";
          emptyRow.style.backgroundColor = "white";
          emptyRow.innerHTML = `
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;font-size:11px;">${endIdx + i + 1}</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;">&nbsp;</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;">&nbsp;</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;">&nbsp;</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;">&nbsp;</td>
            <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;">&nbsp;</td>
          `;
          tbody.appendChild(emptyRow);
        }

        if (page === pageCount - 1) {
          if (formData.additionalServices.length > 0) {
            const svcHeader = document.createElement("tr");
            svcHeader.style.backgroundColor = maroon;
            svcHeader.innerHTML = `<td colspan="6" style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;color:white;">Additional Services (Excluding GST)</td>`;
            tbody.appendChild(svcHeader);
            formData.additionalServices.forEach((service, index) => {
              const svcRow = document.createElement("tr");
              svcRow.style.cssText = `background-color:white;height:30px;`;
              svcRow.innerHTML = `
                <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:center;font-size:11px;">${index + 1}</td>
                <td colspan="4" style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;font-size:11px;">${service.description}</td>
                <td style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};padding:5px 4px;text-align:right;font-weight:bold;font-size:11px;">${formatNumber(service.amount)}</td>
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

          if (gstType === "GST") {
            const cgstRow = document.createElement("tr");
            cgstRow.style.backgroundColor = "white";
            cgstRow.innerHTML = `
              <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">CGST (${formData.cgstPercentage}%):</td>
              <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.cgstAmount)}</td>
            `;
            tbody.appendChild(cgstRow);
            const sgstRow = document.createElement("tr");
            sgstRow.style.backgroundColor = "#F9FAFB";
            sgstRow.innerHTML = `
              <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">SGST (${formData.sgstPercentage}%):</td>
              <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.sgstAmount)}</td>
            `;
            tbody.appendChild(sgstRow);
          } else {
            const igstRow = document.createElement("tr");
            igstRow.style.backgroundColor = "white";
            igstRow.innerHTML = `
              <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">IGST (${igstPercentage}%):</td>
              <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${formatNumber(totals.igstAmount)}</td>
            `;
            tbody.appendChild(igstRow);
          }

          const roundOffRow = document.createElement("tr");
          roundOffRow.style.backgroundColor = "#F3F4F6";
          roundOffRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${borderColor};padding:6px 4px;text-align:right;font-weight:bold;font-size:11px;color:${maroon};">Round Off:</td>
            <td style="border:1px solid ${borderColor};padding:6px 4px;font-weight:bold;font-size:11px;text-align:right;color:${maroon};">₹ ${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}</td>
          `;
          tbody.appendChild(roundOffRow);

          const grandTotalRow = document.createElement("tr");
          grandTotalRow.style.backgroundColor = "white";
          grandTotalRow.innerHTML = `
            <td colspan="5" style="border:1px solid ${borderColor};padding:8px 4px;text-align:right;font-weight:bold;font-size:12px;color:${maroon};background-color:white;">GRAND TOTAL:</td>
            <td style="border:1px solid ${borderColor};padding:8px 4px;font-weight:bold;font-size:12px;text-align:right;color:${maroon};background-color:white;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}</td>
          `;
          tbody.appendChild(grandTotalRow);
        }

        table.appendChild(tbody);
        return table;
      };

      const buildFaizanFooterElement = (maroon, borderColor, totals, currentBankDetails) => {
        const footerDiv = document.createElement("div");
        footerDiv.style.marginTop = "6px";

        const amountInWordsDiv = document.createElement("div");
        amountInWordsDiv.style.cssText = `border:1px solid ${borderColor};border-top:none;border-right:none;border-left:none; padding:6px 8px;font-size:10px;background-color:white;color:#333333;display:flex;justify-content:space-between;align-items:center;`;
        amountInWordsDiv.innerHTML = `
          <div><strong style="color:${maroon};">Amount Chargeable (in words):</strong> ${numberToWords(totals.grandTotalWithRoundOff)}</div>
          <div style="font-weight:bold;font-size:10px;color:#6B7280;">E. & O.E</div>
        `;
        footerDiv.appendChild(amountInWordsDiv);

        const bottomSection = document.createElement("div");
        bottomSection.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:10px;";

        const bankDetailsDiv = document.createElement("div");
        bankDetailsDiv.style.cssText = `flex:1;border:1px solid ${borderColor};border-top:none;padding:6px 8px;font-size:9px;background-color:white;`;
        bankDetailsDiv.innerHTML = `
          <div style="font-weight:bold;margin-bottom:4px;color:${maroon};font-size:10px;">Bank Details:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div style="color:#333333;font-size:9px;"><strong>Account Name:</strong> ${currentBankDetails.accountName || 'Not configured'}</div>
            <div style="color:#333333;font-size:9px;"><strong>Account No:</strong> ${currentBankDetails.accountNumber || 'Not configured'}</div>
            <div style="color:#333333;font-size:9px;"><strong>Bank:</strong> ${currentBankDetails.bank || 'Not configured'}</div>
            <div style="color:#333333;font-size:9px;"><strong>Branch:</strong> ${currentBankDetails.branch || 'Not configured'}</div>
            <div style="color:#333333;font-size:9px;"><strong>IFSC:</strong> ${currentBankDetails.ifscCode || 'Not configured'}</div>
            <div style="color:#333333;font-size:9px;"><strong>G-Pay:</strong> ${currentBankDetails.gpayNumber || 'Not configured'}</div>
          </div>
        `;

        const signatureDiv = document.createElement("div");
        signatureDiv.style.cssText = `flex:1;border:1px solid ${borderColor};border-top:none;border-right:none; padding:8px;font-size:10px;background:white;text-align:center;position:relative;min-height:90px;`;
        signatureDiv.innerHTML = `
          <div style="color:${maroon};position:absolute;top:12px;right:12px;"><strong style="font-size:11px;">For ${formData.companyName}</strong></div>
          <div style="font-size:9px;color:#6B7280;position:absolute;bottom:12px;right:12px;text-align:right;">Authorized Signatory</div>
        `;

        bottomSection.appendChild(bankDetailsDiv);
        bottomSection.appendChild(signatureDiv);
        footerDiv.appendChild(bottomSection);

        const footerNoteDiv = document.createElement("div");
        footerNoteDiv.style.cssText = `border:1px solid ${borderColor};border-top:none;padding:5px;text-align:center;font-size:9px;background-color:white;color:${maroon};`;
        footerNoteDiv.textContent = `SUBJECT TO ${(formData.companyState || '').toUpperCase()} JURISDICTION | This is a Computer Generated Invoice`;
        footerDiv.appendChild(footerNoteDiv);

        return footerDiv;
      };

      // Build Gee Page Element
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

          if (companyLogo && !logoError) {
            const logoPatch = document.createElement("div");
            logoPatch.style.cssText = "display:flex;align-items:center;";
            const logoImg = document.createElement("img");
            logoImg.src = companyLogo;
            logoImg.crossOrigin = "anonymous";
            logoImg.style.cssText = "height:70px;width:auto;object-fit:contain;display:block;";
            logoPatch.appendChild(logoImg);
            logoArea.appendChild(logoPatch);
          } else {
            const logoBox = document.createElement("div");
            logoBox.style.cssText = `width:50px;height:50px;background:${lightBg};border:1px solid ${borderColor};border-radius:6px;display:flex;align-items:center;justify-content:center;color:${navyBlue};font-size:22px;font-weight:700;`;
            logoBox.textContent = formData.companyName?.charAt(0)?.toUpperCase() || "G";
            logoArea.appendChild(logoBox);
          }

          const invoiceBadge = document.createElement("div");
          invoiceBadge.style.cssText = "text-align:right;";
          invoiceBadge.innerHTML = `
            <div style="color:${navyBlue};font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;">Tax Invoice</div>
            <div style="color:${navyBlue};font-size:16px;font-weight:700;">${formData.invoiceNumber}</div>
            <div style="color:#6B7280;font-size:10px;">${new Date(formData.invoiceDate).toLocaleDateString("en-IN", {day:'2-digit',month:'long',year:'numeric'})}</div>
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
            <div style="font-size:12px;color:${navyBlue};font-weight:700;margin-bottom:4px;">${formData.companyName}</div>
            <div style="font-size:10px;color:${textColor};line-height:1.4;">
              <div>${formData.companyAddress}</div>
              <div><span style="font-weight:600;">GSTIN:</span> ${formData.companyGSTIN}</div>
              <div><span style="font-weight:600;">Contact:</span> ${formData.companyContact}</div>
              <div><span style="font-weight:600;">Email:</span> ${formData.companyemail}</div>
            </div>
            <div style="margin-top:4px;font-style:italic;font-size:9px;color:#6B7280;">${formData.companyDescription}</div>
          `;

          const toBox = document.createElement("div");
          toBox.style.cssText = `flex:1;padding:8px 12px;background:white;`;
          
          toBox.innerHTML = `
            <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;margin-bottom:6px;">Bill To</div>
            <div style="font-size:12px;color:${navyBlue};font-weight:700;margin-bottom:4px;">${formData.clientName}</div>
            <div style="font-size:10px;color:${textColor};line-height:1.4;">
              <div>${formData.clientAddress}</div>
              <div><span style="font-weight:600;">GSTIN:</span> ${formData.clientGSTIN}</div>
              <div><span style="font-weight:600;">Contact:</span> ${formData.clientContact}</div>
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
        tableWrapper.style.cssText = "padding:0 0;";

        const table = document.createElement("table");
        table.style.cssText = `width:100%;border-collapse:collapse;font-size:10px;font-family:'Poppins',sans-serif;table-layout:fixed;`;

        const thead = document.createElement("thead");
        thead.innerHTML = `
          <tr style="background-color: white;">
            <th style="padding:6px 4px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;width:4%;border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};">No.</th>
            <th style="padding:6px 4px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;width:52%;border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};">Description</th>
            <th style="padding:6px 4px;text-align:center;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;width:10%;border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};">HSN/SAC</th>
            <th style="padding:6px 4px;text-align:center;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;width:8%;border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};">Qty</th>
            <th style="padding:6px 4px;text-align:right;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;width:13%;border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};">Rate (₹)</th>
            <th style="padding:6px 4px;text-align:right;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;width:13%;border-bottom:1px solid ${borderColor};">Amount (₹)</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        const startIdx = getStartIdx(page);
        const endIdx = getEndIdx(page);

        for (let i = startIdx; i < endIdx; i++) {
          const material = formData.materials[i];
          const desc = material.description;
          const truncDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
          const row = document.createElement("tr");
          row.style.cssText = `background-color:white;height:30px;`;
          row.innerHTML = `
            <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${i + 1}</td>
            <td style="padding:5px 4px;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${desc}">${truncDesc}</td>
            <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${material.hsn}</td>
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
          emptyRow.style.cssText = `height:30px;background-color:white;`;
          emptyRow.innerHTML = `
            <td style="padding:5px 4px;text-align:center;color:${textColor};font-size:10px;border-right:1px solid ${borderColor};">${endIdx + i + 1}</td>
            <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
            <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
            <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
            <td style="border-right:1px solid ${borderColor};">&nbsp;</td>
            <td style="">&nbsp;</td>
          `;
          tbody.appendChild(emptyRow);
        }

        if (page === pageCount - 1 && formData.additionalServices.length > 0) {
          const svcHeaderRow = document.createElement("tr");
          svcHeaderRow.style.cssText = `background-color:${lightBg};border-top:1px solid ${borderColor};border-bottom:1px solid ${borderColor};`;
          svcHeaderRow.innerHTML = `
            <td colspan="6" style="padding:5px 4px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;">Additional Services (Excl. GST)</td>
          `;
          tbody.appendChild(svcHeaderRow);

          formData.additionalServices.forEach((service, index) => {
            const svcRow = document.createElement("tr");
            svcRow.style.cssText = `background-color:white;border-bottom:1px solid ${borderColor};height:30px;`;
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
          subtotalRow.style.cssText = `background-color:${lightBg};border-top:1px solid ${borderColor};`;
          subtotalRow.innerHTML = `
            <td colspan="5" style="padding:6px 4px;text-align:right;font-size:10px;font-weight:600;color:${navyBlue};border-right:1px solid ${borderColor};">Sub Total</td>
            <td style="padding:6px 4px;text-align:right;font-size:10px;font-weight:700;color:${navyBlue};">₹ ${formatNumber(totals.subTotal)}</td>
          `;
          tbody.appendChild(subtotalRow);

          if (gstType === "GST") {
            const cgstRow = document.createElement("tr");
            cgstRow.style.cssText = `background-color:white;`;
            cgstRow.innerHTML = `
              <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">CGST (${formData.cgstPercentage}%)</td>
              <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">₹ ${formatNumber(totals.cgstAmount)}</td>
            `;
            tbody.appendChild(cgstRow);

            const sgstRow = document.createElement("tr");
            sgstRow.style.cssText = `background-color:${lightBg};`;
            sgstRow.innerHTML = `
              <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">SGST (${formData.sgstPercentage}%)</td>
              <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">₹ ${formatNumber(totals.sgstAmount)}</td>
            `;
            tbody.appendChild(sgstRow);
          } else {
            const igstRow = document.createElement("tr");
            igstRow.style.cssText = `background-color:white;`;
            igstRow.innerHTML = `
              <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">IGST (${igstPercentage}%)</td>
              <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">₹ ${formatNumber(totals.igstAmount)}</td>
            `;
            tbody.appendChild(igstRow);
          }

          const roundOffRow = document.createElement("tr");
          roundOffRow.style.cssText = `background-color:${lightBg};`;
          roundOffRow.innerHTML = `
            <td colspan="5" style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};border-right:1px solid ${borderColor};">Round Off</td>
            <td style="padding:5px 4px;text-align:right;font-size:10px;color:${textColor};">${totals.roundOff > 0 ? '+' : ''}${formatNumberWithDecimal(totals.roundOff)}</td>
           </tr>
          `;
          tbody.appendChild(roundOffRow);

          const grandTotalRow = document.createElement("tr");
          grandTotalRow.style.cssText = `background-color:white;`;
          grandTotalRow.innerHTML = `
            <td colspan="5" style="padding:8px 4px;text-align:right;font-size:12px;font-weight:700;color:${navyBlue};border-right:1px solid ${borderColor};background-color:white;">Grand Total</td>
            <td style="padding:8px 4px;text-align:right;font-size:12px;font-weight:700;color:${navyBlue};background-color:white;">₹ ${formatNumber(totals.grandTotalWithRoundOff)}</td>
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
              <div><span style="font-weight:600;color:${navyBlue};">Account Name:</span> ${currentBankDetailsForFooter.accountName || 'Not configured'}</div>
              <div><span style="font-weight:600;color:${navyBlue};">Account No:</span> ${currentBankDetailsForFooter.accountNumber || 'Not configured'}</div>
              <div><span style="font-weight:600;color:${navyBlue};">Bank:</span> ${currentBankDetailsForFooter.bank || 'Not configured'}</div>
              <div><span style="font-weight:600;color:${navyBlue};">Branch:</span> ${currentBankDetailsForFooter.branch || 'Not configured'}</div>
              <div><span style="font-weight:600;color:${navyBlue};">IFSC:</span> ${currentBankDetailsForFooter.ifscCode || 'Not configured'}</div>
              <div><span style="font-weight:600;color:${navyBlue};">G-Pay:</span> ${currentBankDetailsForFooter.gpayNumber || 'Not configured'}</div>
            </div>
          `;

          const sigBox = document.createElement("div");
          sigBox.style.cssText = `flex:1;padding:6px 12px;background:${lightBg};display:flex;flex-direction:column;justify-content:space-between;min-height:90px;`;
          sigBox.innerHTML = `
            <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${navyBlue};font-weight:600;">For ${formData.companyName}</div>
            <div style="font-size:9px;color:${textColor};text-align:right;">Authorized Signatory</div>
          `;

          bottomRow.appendChild(bankBox);
          bottomRow.appendChild(sigBox);
          footer.appendChild(bottomRow);

          const bottomBar = document.createElement("div");
          bottomBar.style.cssText = `background-color:white;padding:5px 12px;display:flex;justify-content:space-between;align-items:center;color:${navyBlue};`;
          bottomBar.innerHTML = `
            <span style="color:${navyBlue};font-size:8px;letter-spacing:1px;">SUBJECT TO ${(formData.companyState || '').toUpperCase()} JURISDICTION</span>
            <span style="color:${navyBlue};font-size:8px;letter-spacing:1px;">COMPUTER GENERATED INVOICE</span>
          `;
          footer.appendChild(bottomBar);
          pageDiv.appendChild(footer);
        }

        return pageDiv;
      };

      for (let page = 0; page < pageCount; page++) {
        if (page > 0) pdf.addPage();

        const pageDiv = isFaizan ? buildFaizanPageElement(page) : buildGeePageElement(page);
        const canvas = await renderToCanvas(pageDiv);
        addCanvasToPdf(pdf, canvas);
      }

      document.body.removeChild(container);

      const companyPrefix = getCompanyPrefix();
      const fileName = `${companyPrefix}_Invoice_${formData.invoiceNumber}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      showNotification("PDF generated and data saved to Firebase successfully!", "success");
      await resetForm();

    } catch (error) {
      console.error("PDF generation error:", error);
      showNotification(`PDF generation failed: ${error.message}`, "error");
    }
  };

  const totals = calculateTotals();

  const renderStepNavigation = () => (
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

  const renderStep1 = () => (
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

  const renderStep2 = () => (
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
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Client Address</label>
          <textarea
            name="clientAddress"
            value={formData.clientAddress || ""}
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
            value={formData.clientGSTIN || ""}
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
            value={formData.clientContact || ""}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Enter client contact number"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Invoice Details</h2>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Invoice Number</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber || ""}
              onChange={handleInputChange}
              style={{ ...styles.input, flex: 1 }}
              readOnly
              title="Auto-generated invoice number"
            />
          </div>
          <small style={styles.helpText}>Auto-generated based on last invoice</small>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Invoice Date *</label>
          <input
            type="date"
            name="invoiceDate"
            value={formData.invoiceDate || ""}
            onChange={handleInputChange}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>GST Type</label>
          <select
            value={gstType || "GST"}
            onChange={(e) => setGstType(e.target.value)}
            style={styles.input}
          >
            <option value="GST">GST (CGST + SGST)</option>
            <option value="IGST">IGST</option>
          </select>
        </div>

        {gstType === "GST" ? (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>CGST Percentage (%)</label>
              <select
                name="cgstPercentage"
                value={formData.cgstPercentage || 9}
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
                value={formData.sgstPercentage || 9}
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
          </>
        ) : (
          <div style={styles.formGroup}>
            <label style={styles.label}>IGST Percentage (%)</label>
            <select
              value={igstPercentage || 18}
              onChange={(e) => setIgstPercentage(parseFloat(e.target.value))}
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
        )}
      </div>

      {/* PO/DC Entries Section */}
      <div style={styles.sectionBox}>
        <h3 style={styles.subSectionTitle}>PO / DC Details</h3>
        {podcEntries.map((entry, index) => (
          <div key={entry.id} style={{ display: 'flex', gap: '20px', marginBottom: '15px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>PO/DC Number {index + 1}</label>
              <input
                type="text"
                value={entry.number || ""}
                onChange={(e) => handlePodcChange(entry.id, 'number', e.target.value)}
                style={styles.input}
                placeholder={`Enter PO/DC number ${index + 1}`}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>PO/DC Date {index + 1}</label>
              <input
                type="date"
                value={entry.date || ""}
                onChange={(e) => handlePodcChange(entry.id, 'date', e.target.value)}
                style={styles.input}
              />
            </div>
            {podcEntries.length > 1 && (
              <button
                onClick={() => removePodcEntry(entry.id)}
                style={{
                  ...styles.removeButton,
                  marginTop: '25px',
                  padding: '8px 15px'
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addPodcEntry}
          style={{
            ...styles.addButton,
            width: 'auto',
            padding: '10px 25px',
            marginTop: '10px'
          }}
        >
          + Add Another PO/DC
        </button>
      </div>

      {/* Configure Bank Details Button */}
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
    </div>
  );

  const renderStep4 = () => (
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
              value=""
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
              value={newMaterial.description || ""}
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
              value={newMaterial.hsn || ""}
              onChange={handleMaterialChange}
              placeholder="HSN code"
              style={styles.input}
              autoComplete="off"
            />
          </div>
  
          <div style={styles.formGroup}>
            <label style={styles.label}>Quantity *</label>
            <input
              type="text"
              name="quantity"
              value={newMaterial.quantity || ""}
              onChange={handleMaterialChange}
              placeholder="Quantity"
              style={styles.input}
              autoComplete="off"
            />
          </div>
  
          <div style={styles.formGroup}>
            <label style={styles.label}>Rate *</label>
            <input
              type="text"
              name="rate"
              value={newMaterial.rate || ""}
              onChange={handleMaterialChange}
              placeholder="Rate per unit"
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
              value={newAdditionalService.description || ""}
              onChange={handleAdditionalServiceChange}
              placeholder="Service description"
              style={styles.input}
              autoComplete="off"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Amount *</label>
            <input
              type="text"
              name="amount"
              value={newAdditionalService.amount || ""}
              onChange={handleAdditionalServiceChange}
              placeholder="Amount"
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
          {gstType === "GST" ? (
            <>
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>CGST ({formData.cgstPercentage}%):</span>
                <span style={styles.totalValue}>₹ {formatNumber(totals.cgstAmount)}</span>
              </div>
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>SGST ({formData.sgstPercentage}%):</span>
                <span style={styles.totalValue}>₹ {formatNumber(totals.sgstAmount)}</span>
              </div>
            </>
          ) : (
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>IGST ({igstPercentage}%):</span>
              <span style={styles.totalValue}>₹ {formatNumber(totals.igstAmount)}</span>
            </div>
          )}
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

      {/* Generate and Preview Buttons */}
      <div style={styles.generateSection}>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="preview-btn"
            onClick={handlePreview}
            style={{
              ...styles.generateButton,
              backgroundColor: "#4CAF50",
              maxWidth: "300px"
            }}
            disabled={formData.materials.length === 0}
          >
            Preview Invoice
          </button>
          <button
            className="generate-btn"
            onClick={generatePDF}
            style={{
              ...styles.generateButton,
              backgroundColor: "#001F3F",
              maxWidth: "300px"
            }}
            disabled={formData.materials.length === 0}
          >
            Generate Invoice PDF
          </button>
        </div>
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

      {/* Bank Details Dialog */}
      <Dialog open={bankDialogOpen} onClose={() => setBankDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#4CAF50", color: "white", py: 2 }}>
          Configure Bank Details - {isFaizanCompany() ? "Faizan Enterprises" : "GEE Enterprises"}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          <div style={{ display: "grid", gap: "20px", padding: "10px 0" }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Account Name</label>
              <input
                type="text"
                name="accountName"
                value={bankDetails.accountName || ""}
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
                value={bankDetails.accountNumber || ""}
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
                value={bankDetails.bank || ""}
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
                value={bankDetails.branch || ""}
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
                value={bankDetails.ifscCode || ""}
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
                value={bankDetails.gpayNumber || ""}
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

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#001F3F", color: "white", py: 2 }}>
          Invoice Preview
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, backgroundColor: "#e5e7eb", overflow: "auto" }}>
          <div
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            style={{ padding: "20px", display: "flex", justifyContent: "center" }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f9f9f9' }}>
          <Button onClick={() => setPreviewOpen(false)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step Navigation */}
      {renderStepNavigation()}

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
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
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
    fontSize: "1.2rem",
    color: "#001F3F",
    fontWeight: "500",
  },
  totalValue: {
    fontSize: "1.2rem",
    color: "#001F3F",
    fontWeight: "600",
  },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 0",
    borderBottom: "none",
    marginTop: "15px",
  },
  grandTotalLabel: {
    fontSize: "1.4rem",
    color: "#001F3F",
    fontWeight: "700",
  },
  grandTotalValue: {
    fontSize: "1.4rem",
    color: "#001F3F",
    fontWeight: "700",
  },
  amountWords: {
    fontSize: "1.1rem",
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
    color: "#FFFFFF",
    border: "none",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "1.2rem",
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

export default InvoiceGenerator;