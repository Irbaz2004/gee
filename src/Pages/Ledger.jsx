import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getDocs, collection } from "firebase/firestore";
import { 
  Autocomplete, 
  TextField, 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Container,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Paper,
  Alert,
  Snackbar,
  CircularProgress
} from "@mui/material";
import { 
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Clear as ClearIcon
} from "@mui/icons-material";
import { db } from "../config";
import { useCompany } from "../context/CompanyContext";
import { getCompanyCollection } from "../utils/firestoreUtils";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Company-specific color schemes
const companyStyles = {
  'galaxy': {
    primary: [0, 31, 63],
    secondary: [255, 193, 7],
    headerBg: [0, 31, 63],
    headerText: [255, 255, 255],
    accent: [255, 193, 7],
    font: 'helvetica',
    titleFont: 'helvetica',
    borderColor: [200, 200, 200]
  },
  'default': {
    primary: [41, 98, 255],
    secondary: [76, 175, 80],
    headerBg: [41, 98, 255],
    headerText: [255, 255, 255],
    accent: [255, 152, 0],
    font: 'helvetica',
    titleFont: 'helvetica',
    borderColor: [200, 200, 200]
  }
};

// Constants
const TABLE_HEADERS = ['S.No','Date', 'Invoice No', 'Client Name', 'Taxable Amt', 'GST Amt', 'Total Amount'];
const DATE_FORMAT_OPTIONS = { day: '2-digit', month: '2-digit', year: 'numeric' };
const DISPLAY_DATE_FORMAT = { day: '2-digit', month: 'short', year: 'numeric' };

const Ledger = () => {
    const { selectedCompany } = useCompany();
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportLoading, setExportLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    
    // Date filter states
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [dateFilterType, setDateFilterType] = useState('all');

        const formatCurrency = useCallback((num) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }, []);
    // Get company-specific style
    const companyStyle = useMemo(() => {
        const companyId = selectedCompany?.id?.toLowerCase() || 'default';
        return companyStyles[companyId] || companyStyles.default;
    }, [selectedCompany]);

    // Safe date parser
    const parseFirestoreDate = useCallback((dateValue) => {
        if (!dateValue) return null;
        
        try {
            // Handle Firestore Timestamp
            if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
            }
            // Handle string date
            if (typeof dateValue === 'string') {
                const date = new Date(dateValue);
                return isNaN(date.getTime()) ? null : date;
            }
            // Handle Date object
            if (dateValue instanceof Date) {
                return isNaN(dateValue.getTime()) ? null : dateValue;
            }
            // Handle number (timestamp)
            if (typeof dateValue === 'number') {
                const date = new Date(dateValue);
                return isNaN(date.getTime()) ? null : date;
            }
            return null;
        } catch (error) {
            console.warn('Error parsing date:', error);
            return null;
        }
    }, []);

    // Format date for display
    const formatDate = useCallback((dateValue, options = DATE_FORMAT_OPTIONS) => {
        const date = parseFirestoreDate(dateValue);
        if (!date) return '';
        
        try {
            return date.toLocaleDateString("en-IN", options);
        } catch (error) {
            console.warn('Error formatting date:', error);
            return '';
        }
    }, [parseFirestoreDate]);

    useEffect(() => {
        if (selectedCompany) {
            fetchClients();
            fetchInvoices();
        }
    }, [selectedCompany]);

    const fetchClients = async () => {
        try {
            const clientsCollection = collection(db, "clients");
            const snapshot = await getDocs(clientsCollection);
            const clientsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClients(clientsList);
        } catch (error) {
            console.error("Error fetching clients:", error);
            showSnackbar('Error fetching clients', 'error');
        }
    };

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const invoicesCollection = getCompanyCollection(db, selectedCompany.id, "invoices");
            const snapshot = await getDocs(invoicesCollection);
            const invoicesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInvoices(invoicesList);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            showSnackbar('Error fetching invoices', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    const handleCloseSnackbar = useCallback(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
    }, []);

    // Memoized filtered invoices
    const filteredInvoices = useMemo(() => {
        let filtered = [...invoices];

        // Apply client filter
        if (selectedClient) {
            filtered = filtered.filter(inv => 
                inv.clientName === (selectedClient.clientName || selectedClient.name)
            );
        }

        // Apply date filter
        if (dateFilterType === 'custom' && fromDate && toDate) {
            const from = parseFirestoreDate(fromDate);
            const to = parseFirestoreDate(toDate);
            
            if (from && to) {
                from.setHours(0, 0, 0, 0);
                to.setHours(23, 59, 59, 999);

                filtered = filtered.filter(inv => {
                    const invoiceDate = parseFirestoreDate(inv.invoiceDate || inv.timestamp);
                    return invoiceDate && invoiceDate >= from && invoiceDate <= to;
                });
            }
        }

        return filtered;
    }, [invoices, selectedClient, dateFilterType, fromDate, toDate, parseFirestoreDate]);

    // Memoized totals calculation
    const totals = useMemo(() => {
        return filteredInvoices.reduce((acc, inv) => {
            const taxable = inv.totals?.subTotal || 0;
            const total = inv.totals?.total || 0;
            const gst = total - taxable;
            return {
                taxable: acc.taxable + taxable,
                gst: acc.gst + gst,
                grand: acc.grand + total
            };
        }, { taxable: 0, gst: 0, grand: 0 });
    }, [filteredInvoices]);

    // Memoized formatted invoice data for table
    const tableData = useMemo(() => {
        return filteredInvoices.map(inv => {
            const taxable = inv.totals?.subTotal || 0;
            const total = inv.totals?.total || 0;
            const gst = total - taxable;
            
            return {
                id: inv.id,
                date: formatDate(inv.invoiceDate || inv.timestamp),
                invoiceNumber: inv.invoiceNumber || '',
                clientName: inv.clientName || '',
                taxable,
                gst,
                total,
                formattedTaxable: formatCurrency(taxable),
                formattedGst: formatCurrency(gst),
                formattedTotal: formatCurrency(total)
            };
        });
    }, [filteredInvoices, formatDate]);



    const formatNumber = useCallback((num) => {
        return new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }, []);

    // Export handlers with web workers or chunks to prevent UI blocking
    const exportToExcel = useCallback(async () => {
        if (filteredInvoices.length === 0) {
            showSnackbar('No data to export', 'warning');
            return;
        }

        setExportLoading(true);
        
        // Use requestIdleCallback or setTimeout to prevent UI blocking
        const exportTask = () => {
            try {
                const exportData = filteredInvoices.map(inv => {
                    const taxable = inv.totals?.subTotal || 0;
                    const total = inv.totals?.total || 0;
                    const gst = total - taxable;
                    
                    return {
                        'Date': formatDate(inv.invoiceDate || inv.timestamp),
                        'Invoice No': inv.invoiceNumber || '',
                        'Client Name': inv.clientName || '',
                        'Taxable Amount': taxable,
                        'GST Amount': gst,
                        'Total Amount': total
                    };
                });

                // Add summary row
                exportData.push({
                    'Date': 'SUMMARY',
                    'Invoice No': '',
                    'Client Name': '',
                    'Taxable Amount': totals.taxable,
                    'GST Amount': totals.gst,
                    'Total Amount': totals.grand
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(exportData);
                
                // Set column widths
                ws['!cols'] = [
                    { wch: 12 }, // Date
                    { wch: 15 }, // Invoice No
                    { wch: 25 }, // Client Name
                    { wch: 15 }, // Taxable Amount
                    { wch: 12 }, // GST Amount
                    { wch: 15 }  // Total Amount
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
                
                const fileName = `ledger_${selectedCompany?.name || 'company'}_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);
                
                showSnackbar('Excel exported successfully', 'success');
            } catch (error) {
                console.error('Excel export error:', error);
                showSnackbar('Error exporting Excel', 'error');
            } finally {
                setExportLoading(false);
            }
        };

        // Use setTimeout to prevent UI blocking
        setTimeout(exportTask, 100);
    }, [filteredInvoices, totals, selectedCompany, showSnackbar, formatDate]);

    const exportToPDF = useCallback(() => {
        if (filteredInvoices.length === 0) {
            showSnackbar('No data to export', 'warning');
            return;
        }

        setExportLoading(true);

        const exportTask = () => {
            try {
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                doc.setFont(companyStyle.font, 'normal');

                // Header Section
                doc.setFontSize(24);
                doc.setTextColor(companyStyle.primary[0], companyStyle.primary[1], companyStyle.primary[2]);
                doc.text(selectedCompany?.name?.toUpperCase() || 'CLIENT LEDGER', 14, 15);

                // Decorative line
                doc.setDrawColor(companyStyle.accent[0], companyStyle.accent[1], companyStyle.accent[2]);
                doc.setLineWidth(0.5);
                doc.line(14, 20, 196, 20);

                // Report Title
                doc.setFontSize(16);
                doc.setTextColor(companyStyle.primary[0], companyStyle.primary[1], companyStyle.primary[2]);
                doc.text('LEDGER REPORT', 14, 30);

                // Filter Information
                doc.setFontSize(10);
                doc.setTextColor(80, 80, 80);
                let yPos = 40;
                
                if (selectedClient) {
                    doc.text(`Client: ${selectedClient.clientName || selectedClient.name}`, 14, yPos);
                    yPos += 5;
                }
                
                if (dateFilterType === 'custom' && fromDate && toDate) {
                    const from = formatDate(fromDate, DISPLAY_DATE_FORMAT);
                    const to = formatDate(toDate, DISPLAY_DATE_FORMAT);
                    doc.text(`Period: ${from} to ${to}`, 14, yPos);
                    yPos += 5;
                }
                
                doc.text(`Generated: ${formatDate(new Date(), DISPLAY_DATE_FORMAT)}`, 14, yPos);
                yPos += 5;
                doc.text(`Report ID: LED-${new Date().getTime().toString().slice(-8)}`, 14, yPos);
                
                // Border line
                doc.setDrawColor(companyStyle.borderColor[0], companyStyle.borderColor[1], companyStyle.borderColor[2]);
                doc.line(14, yPos + 3, 196, yPos + 3);

                // Summary Box
                doc.setFillColor(245, 245, 245);
                doc.rect(14, yPos + 8, 182, 20, 'F');
                
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text('TAXABLE AMOUNT', 20, yPos + 16);
                doc.text('GST AMOUNT', 80, yPos + 16);
                doc.text('GRAND TOTAL', 140, yPos + 16);
                
                doc.setFontSize(12);
                doc.setTextColor(companyStyle.primary[0], companyStyle.primary[1], companyStyle.primary[2]);
                doc.setFont(companyStyle.font, 'bold');
                doc.text(formatNumber(totals.taxable), 20, yPos + 24);
                doc.text(formatNumber(totals.gst), 80, yPos + 24);
                doc.text(formatNumber(totals.grand), 140, yPos + 24);

                // Prepare table data
                const tableData = filteredInvoices.map(inv => {
                    const taxable = inv.totals?.subTotal || 0;
                    const total = inv.totals?.total || 0;
                    const gst = total - taxable;
                    
                    return [
                        formatDate(inv.invoiceDate || inv.timestamp),
                        inv.invoiceNumber || '',
                        inv.clientName || '',
                        formatNumber(taxable),
                        formatNumber(gst),
                        formatNumber(total)
                    ];
                });

                // Generate table
                autoTable(doc, {
                    startY: yPos + 35,
                    head: [TABLE_HEADERS],
                    body: tableData,
                    theme: 'grid',
                    styles: {
                        font: companyStyle.font,
                        fontSize: 8,
                        cellPadding: 2,
                        lineColor: companyStyle.borderColor,
                        lineWidth: 0.1,
                        textColor: [50, 50, 50]
                    },
                    headStyles: { 
                        fillColor: companyStyle.headerBg,
                        textColor: companyStyle.headerText,
                        fontStyle: 'bold',
                        fontSize: 9
                    },
                    alternateRowStyles: {
                        fillColor: [250, 250, 250]
                    },
                    columnStyles: {
                        0: { cellWidth: 25 },
                        1: { cellWidth: 25 },
                        2: { cellWidth: 58 },
                        3: { cellWidth: 25, halign: 'right' },
                        4: { cellWidth: 25, halign: 'right' },
                        5: { cellWidth: 25, halign: 'right' }
                    },
                    margin: { left: 14, right: 14 },
                    didDrawPage: (data) => {
                        doc.setFontSize(8);
                        doc.setTextColor(150, 150, 150);
                        doc.text('This is a system generated report', 14, 285);
                        doc.text(`Page ${data.pageNumber}`, 180, 285);
                    }
                });

                // Save PDF
                const fileName = `ledger_${selectedCompany?.name || 'company'}_${new Date().toISOString().split('T')[0]}.pdf`;
                doc.save(fileName);
                
                showSnackbar('PDF exported successfully', 'success');
            } catch (error) {
                console.error('PDF export error:', error);
                showSnackbar('Error exporting PDF', 'error');
            } finally {
                setExportLoading(false);
            }
        };

        setTimeout(exportTask, 100);
    }, [filteredInvoices, selectedClient, selectedCompany, totals, dateFilterType, fromDate, toDate, companyStyle, showSnackbar, formatDate, formatNumber]);

    const clearFilters = useCallback(() => {
        setSelectedClient(null);
        setFromDate('');
        setToDate('');
        setDateFilterType('all');
    }, []);

    return (
        <Container maxWidth="xl" sx={{ py: 3, backgroundColor: '#ffffff', minHeight: '80vh', borderRadius: 2 }}>
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="h5" fontWeight={700} color="#001F3F" gutterBottom>
                            Client Ledger
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Summary of invoices and amounts based on filters.
                        </Typography>
                    </Box>
                    
                    {/* Export Buttons */}
                    <ButtonGroup variant="contained" size="medium">
                        <Button
                            onClick={exportToExcel}
                            startIcon={<ExcelIcon />}
                            disabled={exportLoading || filteredInvoices.length === 0}
                            sx={{ 
                                bgcolor: '#1D6F42', 
                                mr: 2,
                                '&:hover': { bgcolor: '#145530' },
                                '&.Mui-disabled': { bgcolor: '#cccccc' }
                            }}
                        >
                            {exportLoading ? <CircularProgress size={20} color="inherit" /> : 'Excel'}
                        </Button>
                        <Button
                            onClick={exportToPDF}
                            startIcon={<PdfIcon />}
                            disabled={exportLoading || filteredInvoices.length === 0}
                            sx={{ 
                                bgcolor: '#B22222', 
                                '&:hover': { bgcolor: '#8B1A1A' },
                                '&.Mui-disabled': { bgcolor: '#cccccc' }
                            }}
                        >
                            {exportLoading ? <CircularProgress size={20} color="inherit" /> : 'PDF'}
                        </Button>
                    </ButtonGroup>
                </Box>

                {/* Filters Card */}
                <Card sx={{ mb: 4, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                            {/* Client Filter */}
                            <Grid item xs={12} md={3} minWidth={'250px'}>
                                <Autocomplete
                                    options={clients}
                                    getOptionLabel={(option) => option.clientName || option.name || ""}
                                    value={selectedClient}
                                    onChange={(event, newValue) => setSelectedClient(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Filter by Client"
                                            variant="outlined"
                                            placeholder="Search client..."
                                            size="small"
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Date Filter Type */}
                            <Grid item xs={12} md={2} minWidth={'250px'}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Date Range</InputLabel>
                                    <Select
                                        value={dateFilterType}
                                        label="Date Range"
                                        onChange={(e) => setDateFilterType(e.target.value)}
                                    >
                                        <MenuItem value="all">All Dates</MenuItem>
                                        <MenuItem value="custom">Custom Range</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Date Range Filters */}
                            {dateFilterType === 'custom' && (
                                <>
                                    <Grid item xs={12} md={2}>
                                        <TextField
                                            fullWidth
                                            label="From Date"
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) => setFromDate(e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <TextField
                                            fullWidth
                                            label="To Date"
                                            type="date"
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* Clear Filters Button */}
                            <Grid item xs={12} md={dateFilterType === 'custom' ? 3 : 5}>
                                <Stack direction="row" spacing={2} justifyContent="flex-end">
                                    <Button 
                                        variant="outlined" 
                                        onClick={clearFilters}
                                        startIcon={<ClearIcon />}
                                        size="small"
                                        sx={{ py: 1 }}
                                    >
                                        Clear Filters
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                <Paper sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                    <Grid container spacing={7}>
                        <Grid item xs={4} ml={2}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                TAXABLE AMOUNT
                            </Typography>
                            <Typography variant="h6" color="#001F3F" fontWeight={700}>
                                {formatNumber(totals.taxable)}
                            </Typography>
                        </Grid>
                        <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                GST AMOUNT
                            </Typography>
                            <Typography variant="h6" color="#001F3F" fontWeight={700}>
                                {formatNumber(totals.gst)}
                            </Typography>
                        </Grid>
                        <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                GRAND TOTAL
                            </Typography>
                            <Typography variant="h6" color="#001F3F" fontWeight={800}>
                                {formatNumber(totals.grand)}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Results count */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>

                {/* Table */}
                <Box sx={{
                    backgroundColor: 'white',
                    borderRadius: 2,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    overflowY: 'auto',
                    maxHeight: '500px',
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#001F3F', color: 'white' }}>
                                {TABLE_HEADERS.map(header => (
                                    <th key={header} style={tableHeaderStyle}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        <CircularProgress size={30} />
                                        <Typography variant="body2" sx={{ mt: 1 }}>Loading data...</Typography>
                                    </td>
                                </tr>
                            ) : tableData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No invoices found.
                                        </Typography>
                                    </td>
                                </tr>
                            ) : (
                                tableData.map((row,index) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={tableCellStyle}>{index+1}.</td>

                                        <td style={tableCellStyle}>{row.date}</td>
                                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{row.invoiceNumber}</td>
                                        <td style={tableCellStyle}>{row.clientName}</td>
                                        <td style={tableCellStyle}>{row.formattedTaxable}</td>
                                        <td style={tableCellStyle}>{row.formattedGst}</td>
                                        <td style={{ ...tableCellStyle, fontWeight: 700, color: '#001F3F' }}>
                                            {row.formattedTotal}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Box>
            </Box>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

const tableHeaderStyle = {
    padding: '16px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.9rem',
};

const tableCellStyle = {
    padding: '16px',
    fontSize: '0.9rem',
    color: '#444',
};

export default Ledger;