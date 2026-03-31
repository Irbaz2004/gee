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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_HEADERS       = ['S.No', 'Date', 'Invoice No', 'Client Name', 'Taxable Amt', 'GST Amt', 'Total Amt'];
const DATE_FORMAT_OPTIONS = { day: '2-digit', month: '2-digit', year: 'numeric' };
const DISPLAY_DATE_FORMAT = { day: '2-digit', month: 'short',   year: 'numeric' };

// A4 safe margins
const A4_W  = 210;
const A4_H  = 297;
const MRG   = 14;   // left/right margin
const MRG_B = 16;   // bottom margin reserved for footer

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY STYLE REGISTRY
// All brand colors used sparingly — backgrounds stay white/very-light tint.
// ─────────────────────────────────────────────────────────────────────────────
const COMPANY_STYLES = {
  // ── FAIZAN ENTERPRISES ── Crimson + warm terracotta accent
  'faizan enterprises': {
    layout:      'faizan',
    font:        'helvetica',
    brandDark:   [139, 30,  30],   // Deep crimson  — headings, table header
    brandMid:    [190, 70,  55],   // Warm red      — sub-labels
    brandLight:  [254, 247, 245],  // Blush white   — alt row tint
    accentLine:  [210, 115, 65],   // Terracotta    — decorative rules
    textDark:    [28,  22,  22],   // Near-black
    textMid:     [95,  75,  72],   // Mid warm gray
    textLight:   [148, 125, 120],  // Muted warm gray
    borderLight: [228, 210, 205],  // Soft warm border
  },

  // ── GALAXY ELECTRICALS & ELECTRONICS ── Navy + amber accent
  'galaxy electricals & electronics': {
    layout:      'galaxy',
    font:        'helvetica',
    brandDark:   [10,  38,  78],   // Deep navy     — headings, table header
    brandMid:    [30,  82, 155],   // Mid blue      — sub-labels
    brandLight:  [243, 247, 253],  // Ice-blue white — alt row tint
    accentLine:  [198, 152, 18],   // Amber gold    — decorative rules
    textDark:    [14,  22,  42],   // Near-black navy
    textMid:     [68,  84, 112],   // Mid slate
    textLight:   [128, 144, 168],  // Muted slate
    borderLight: [204, 215, 232],  // Soft blue border
  },
};

const DEFAULT_STYLE = COMPANY_STYLES['faizan enterprises'];

const getCompanyStyle = (company) => {
  if (!company?.name) return DEFAULT_STYLE;
  const key = company.name.trim().toLowerCase();
  return COMPANY_STYLES[key] || DEFAULT_STYLE;
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Horizontal rule spanning full content width */
const rule = (doc, y, color, lw = 0.25) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(lw);
  doc.line(MRG, y, A4_W - MRG, y);
};

/** Three-column summary block. Returns bottom Y. */
const drawSummary = (doc, y, totals, fmt, style) => {
  const W = A4_W - MRG * 2;
  const cW = W / 3;
  const H  = 22;

  // Very light tint fill
  doc.setFillColor(...style.brandLight);
  doc.rect(MRG, y, W, H, 'F');

  // Outer border
  doc.setDrawColor(...style.borderLight);
  doc.setLineWidth(0.25);
  doc.rect(MRG, y, W, H);

  // Column dividers
  [1, 2].forEach(i => {
    doc.setDrawColor(...style.borderLight);
    doc.setLineWidth(0.15);
    doc.line(MRG + cW * i, y + 3, MRG + cW * i, y + H - 3);
  });

  const labels = ['TAXABLE AMOUNT', 'GST AMOUNT', 'GRAND TOTAL'];
  const values = [totals.taxable, totals.gst, totals.grand];

  labels.forEach((lbl, i) => {
    const cx = MRG + i * cW + cW / 2;

    doc.setFontSize(6);
    doc.setFont(style.font, 'normal');
    doc.setTextColor(...style.textLight);
    doc.text(lbl, cx, y + 8, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setFont(style.font, 'bold');
    doc.setTextColor(...style.brandDark);
    doc.text(`Rs. ${fmt(values[i])}`, cx, y + 18, { align: 'center' });
  });

  return y + H;
};

/** Footer drawn on every page */
const drawFooter = (doc, style, companyName) => {
  const y = A4_H - MRG_B;
  rule(doc, y, style.borderLight, 0.2);
  doc.setFontSize(6);
  doc.setFont(style.font, 'normal');
  doc.setTextColor(...style.textLight);
  doc.text(`${companyName} — System generated report`, MRG, y + 5);
  const pg  = doc.getCurrentPageInfo().pageNumber;
  const tot = doc.getNumberOfPages();
  doc.text(`Page ${pg} of ${tot}`, A4_W - MRG, y + 5, { align: 'right' });
};

/** Shared autoTable call */
const drawTable = (doc, startY, tableData, fmt, style, companyName) => {
  const body = tableData.map(r => [
    r.sno.toString(), r.date, r.invoiceNumber, r.clientName,
    fmt(r.taxable), fmt(r.gst), fmt(r.total),
  ]);

  autoTable(doc, {
    startY,
    head: [TABLE_HEADERS],
    body,
    theme: 'grid',
    styles: {
      font:        style.font,
      fontSize:    7,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor:   style.borderLight,
      lineWidth:   0.18,
      textColor:   style.textDark,
      valign:      'middle',
    },
    headStyles: {
      fillColor:   style.brandDark,
      textColor:   [255, 255, 255],
      fontStyle:   'bold',
      fontSize:    7,
      halign:      'center',
      valign:      'middle',
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: style.brandLight },
    columnStyles: {
      0: { cellWidth: 13,  halign: 'center' },
      1: { cellWidth: 20,  halign: 'center' },
      2: { cellWidth: 24,  halign: 'center' },
      3: { cellWidth: 55,  halign: 'left'   },
      4: { cellWidth: 23,  halign: 'right'  },
      5: { cellWidth: 22,  halign: 'right'  },
      6: { cellWidth: 26,  halign: 'right'  },
    },
    // Keep bottom margin so footer is never overlapped
    margin: { left: MRG, right: MRG, bottom: MRG_B + 4 },
    didDrawPage: () => drawFooter(doc, style, companyName),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF LAYOUT A — FAIZAN ENTERPRISES
//
// White page. Company name in large crimson, thin double rule (crimson +
// terracotta) below. Report type & date on the same line. Metadata block.
// Thin separator. Summary block. Table.
// ─────────────────────────────────────────────────────────────────────────────
const buildFaizanPDF = (doc, { style, selectedCompany, selectedClient, dateFilterType, fromDate, toDate, tableData, totals, formatDate, formatNumber }) => {
  const name = selectedCompany?.name || 'Faizan Enterprises';

  // Company name
  doc.setFont(style.font, 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...style.brandDark);
  doc.text(name.toUpperCase(), MRG, 22);

  // Double decorative rule
  doc.setDrawColor(...style.brandDark);
  doc.setLineWidth(0.55);
  doc.line(MRG, 25.5, A4_W - MRG, 25.5);
  doc.setDrawColor(...style.accentLine);
  doc.setLineWidth(0.2);
  doc.line(MRG, 27, A4_W - MRG, 27);

  // Report title (left) + generated date (right)
  doc.setFont(style.font, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...style.brandMid);
  doc.text('LEDGER REPORT', MRG, 34);

  doc.setFont(style.font, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...style.textLight);
  doc.text(`Generated: ${formatDate(new Date(), DISPLAY_DATE_FORMAT)}`, A4_W - MRG, 34, { align: 'right' });

  // Metadata
  let y = 42;
  doc.setFontSize(7.5);

  if (selectedClient) {
    doc.setFont(style.font, 'bold');
    doc.setTextColor(...style.textMid);
    doc.text('Client :', MRG, y);
    doc.setFont(style.font, 'normal');
    doc.setTextColor(...style.textDark);
    doc.text(selectedClient.clientName || selectedClient.name, MRG + 18, y);
    y += 5;
  }

  if (dateFilterType === 'custom' && fromDate && toDate) {
    const fr = formatDate(fromDate, DISPLAY_DATE_FORMAT);
    const to = formatDate(toDate,   DISPLAY_DATE_FORMAT);
    doc.setFont(style.font, 'bold');
    doc.setTextColor(...style.textMid);
    doc.text('Period :', MRG, y);
    doc.setFont(style.font, 'normal');
    doc.setTextColor(...style.textDark);
    doc.text(`${fr}  to  ${to}`, MRG + 18, y);
    y += 5;
  }

  y += 2;
  rule(doc, y, style.borderLight);
  y += 6;

  // Summary
  y = drawSummary(doc, y, totals, formatNumber, style) + 7;

  // Table
  drawTable(doc, y, tableData, formatNumber, style, name);
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF LAYOUT B — GALAXY ELECTRICALS & ELECTRONICS
//
// White page. Thin amber top bar (3 mm). Company name in navy below.
// Amber + navy double rule. Report tag left, date right. Metadata.
// Thin separator. Summary block. Table.
// ─────────────────────────────────────────────────────────────────────────────
const buildGalaxyPDF = (doc, { style, selectedCompany, selectedClient, dateFilterType, fromDate, toDate, tableData, totals, formatDate, formatNumber }) => {
  const name = selectedCompany?.name || 'Galaxy Electricals & Electronics';

  // Thin amber top bar
  doc.setFillColor(...style.accentLine);
  doc.rect(0, 0, A4_W, 2.5, 'F');

  // Company name
  doc.setFont(style.font, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...style.brandDark);
  doc.text(name.toUpperCase(), MRG, 19);

  // Double rule — amber first, thinner navy below
  doc.setDrawColor(...style.accentLine);
  doc.setLineWidth(0.45);
  doc.line(MRG, 22.5, A4_W - MRG, 22.5);
  doc.setDrawColor(...style.brandDark);
  doc.setLineWidth(0.2);
  doc.line(MRG, 24, A4_W - MRG, 24);

  // Report tag (left) + date (right)
  doc.setFont(style.font, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...style.brandMid);
  doc.text('LEDGER STATEMENT', MRG, 31);

  doc.setFont(style.font, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...style.textLight);
  doc.text(`Generated: ${formatDate(new Date(), DISPLAY_DATE_FORMAT)}`, A4_W - MRG, 31, { align: 'right' });

  // Metadata
  let y = 39;
  doc.setFontSize(7.5);

  if (selectedClient) {
    doc.setFont(style.font, 'bold');
    doc.setTextColor(...style.textMid);
    doc.text('Client :', MRG, y);
    doc.setFont(style.font, 'normal');
    doc.setTextColor(...style.textDark);
    doc.text(selectedClient.clientName || selectedClient.name, MRG + 18, y);
    y += 5;
  }

  if (dateFilterType === 'custom' && fromDate && toDate) {
    const fr = formatDate(fromDate, DISPLAY_DATE_FORMAT);
    const to = formatDate(toDate,   DISPLAY_DATE_FORMAT);
    doc.setFont(style.font, 'bold');
    doc.setTextColor(...style.textMid);
    doc.text('Period :', MRG, y);
    doc.setFont(style.font, 'normal');
    doc.setTextColor(...style.textDark);
    doc.text(`${fr}  to  ${to}`, MRG + 18, y);
    y += 5;
  }

  y += 2;
  rule(doc, y, style.borderLight);
  y += 6;

  // Summary
  y = drawSummary(doc, y, totals, formatNumber, style) + 7;

  // Table
  drawTable(doc, y, tableData, formatNumber, style, name);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Ledger = () => {
  const { selectedCompany } = useCompany();

  const [invoices,       setInvoices]       = useState([]);
  const [clients,        setClients]        = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [exportLoading,  setExportLoading]  = useState(false);
  const [snackbar,       setSnackbar]       = useState({ open: false, message: '', severity: 'info' });
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [dateFilterType, setDateFilterType] = useState('all');

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatNumber = useCallback((num) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    const n = parseFloat(num);
    if (isNaN(n)) return '0.00';
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }, []);

  const formatCurrency = useCallback((num) => {
    if (num === undefined || num === null || isNaN(num)) return '₹ 0.00';
    return `₹ ${formatNumber(num)}`;
  }, [formatNumber]);

  const parseFirestoreDate = useCallback((v) => {
    if (!v) return null;
    try {
      if (v?.toDate)             return v.toDate();
      if (typeof v === 'string') { const d = new Date(v); return isNaN(d) ? null : d; }
      if (v instanceof Date)     return isNaN(v) ? null : v;
      if (typeof v === 'number') { const d = new Date(v); return isNaN(d) ? null : d; }
      return null;
    } catch { return null; }
  }, []);

  const formatDate = useCallback((v, opts = DATE_FORMAT_OPTIONS) => {
    const d = parseFirestoreDate(v);
    if (!d) return '';
    try { return d.toLocaleDateString('en-IN', opts); } catch { return ''; }
  }, [parseFirestoreDate]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedCompany) { fetchClients(); fetchInvoices(); }
  }, [selectedCompany]);

  const fetchClients = async () => {
    try {
      const snap = await getDocs(collection(db, 'clients'));
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); showSnackbar('Error fetching clients', 'error'); }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const col  = getCompanyCollection(db, selectedCompany.id, 'invoices');
      const snap = await getDocs(col);
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); showSnackbar('Error fetching invoices', 'error'); }
    finally     { setLoading(false); }
  };

  const showSnackbar        = useCallback((msg, sev = 'info') => setSnackbar({ open: true, message: msg, severity: sev }), []);
  const handleCloseSnackbar = useCallback(() => setSnackbar(p => ({ ...p, open: false })), []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    let f = [...invoices];
    if (selectedClient)
      f = f.filter(inv => inv.clientName === (selectedClient.clientName || selectedClient.name));
    if (dateFilterType === 'custom' && fromDate && toDate) {
      const fr = parseFirestoreDate(fromDate);
      const to = parseFirestoreDate(toDate);
      if (fr && to) {
        fr.setHours(0,0,0,0); to.setHours(23,59,59,999);
        f = f.filter(inv => { const d = parseFirestoreDate(inv.invoiceDate || inv.timestamp); return d && d >= fr && d <= to; });
      }
    }
    f.sort((a, b) => {
      const dA = parseFirestoreDate(a.invoiceDate || a.timestamp);
      const dB = parseFirestoreDate(b.invoiceDate || b.timestamp);
      return (!dA || !dB) ? 0 : dB - dA;
    });
    return f;
  }, [invoices, selectedClient, dateFilterType, fromDate, toDate, parseFirestoreDate]);

  const totals = useMemo(() =>
    filteredInvoices.reduce((acc, inv) => {
      const taxable = inv.totals?.subTotal || 0;
      const total   = inv.totals?.grandTotalWithRoundOff || inv.totals?.total || 0;
      return { taxable: acc.taxable + taxable, gst: acc.gst + (total - taxable), grand: acc.grand + total };
    }, { taxable: 0, gst: 0, grand: 0 }),
  [filteredInvoices]);

  const tableData = useMemo(() =>
    filteredInvoices.map((inv, i) => {
      const taxable = inv.totals?.subTotal || 0;
      const total   = inv.totals?.grandTotalWithRoundOff || inv.totals?.total || 0;
      const gst     = total - taxable;
      return {
        id: inv.id, sno: i + 1,
        date:          formatDate(inv.invoiceDate || inv.timestamp),
        invoiceNumber: inv.invoiceNumber || '',
        clientName:    inv.clientName    || '',
        taxable, gst, total,
        formattedTaxable: formatCurrency(taxable),
        formattedGst:     formatCurrency(gst),
        formattedTotal:   formatCurrency(total),
      };
    }),
  [filteredInvoices, formatDate, formatCurrency]);

  // ── Export Excel ───────────────────────────────────────────────────────────
  const exportToExcel = useCallback(() => {
    if (!filteredInvoices.length) { showSnackbar('No data to export', 'warning'); return; }
    setExportLoading(true);
    setTimeout(() => {
      try {
        const data = tableData.map(r => ({
          'S.No': r.sno, 'Date': r.date, 'Invoice No': r.invoiceNumber, 'Client Name': r.clientName,
          'Taxable Amount (Rs.)': formatNumber(r.taxable),
          'GST Amount (Rs.)':     formatNumber(r.gst),
          'Total Amount (Rs.)':   formatNumber(r.total),
        }));
        data.push({ 'S.No':'','Date':'','Invoice No':'','Client Name':'SUMMARY',
          'Taxable Amount (Rs.)': formatNumber(totals.taxable),
          'GST Amount (Rs.)':     formatNumber(totals.gst),
          'Total Amount (Rs.)':   formatNumber(totals.grand),
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{wch:8},{wch:12},{wch:15},{wch:35},{wch:18},{wch:15},{wch:18}];
        XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
        XLSX.writeFile(wb, `ledger_${selectedCompany?.name || 'company'}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showSnackbar('Excel exported successfully', 'success');
      } catch (e) { console.error(e); showSnackbar('Error exporting Excel', 'error'); }
      finally     { setExportLoading(false); }
    }, 100);
  }, [tableData, totals, selectedCompany, showSnackbar, formatNumber]);

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const exportToPDF = useCallback(() => {
    if (!filteredInvoices.length) { showSnackbar('No data to export', 'warning'); return; }
    setExportLoading(true);
    setTimeout(() => {
      try {
        const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const style = getCompanyStyle(selectedCompany);
        const args  = { style, selectedCompany, selectedClient, dateFilterType, fromDate, toDate, tableData, totals, formatDate, formatNumber };

        if (style.layout === 'galaxy') buildGalaxyPDF(doc, args);
        else                           buildFaizanPDF(doc, args);

        doc.save(`ledger_${selectedCompany?.name || 'company'}_${new Date().toISOString().split('T')[0]}.pdf`);
        showSnackbar('PDF exported successfully', 'success');
      } catch (e) { console.error(e); showSnackbar('Error exporting PDF', 'error'); }
      finally     { setExportLoading(false); }
    }, 100);
  }, [tableData, selectedClient, selectedCompany, totals, dateFilterType, fromDate, toDate, showSnackbar, formatDate, formatNumber]);

  const clearFilters = useCallback(() => {
    setSelectedClient(null); setFromDate(''); setToDate(''); setDateFilterType('all');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="xl" sx={{ py: 2, backgroundColor: '#ffffff', minHeight: '80vh', borderRadius: 2 }}>
      <Box>
        {/* Header */}
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2, flexWrap:'wrap', gap:2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#001F3F" gutterBottom>Client Ledger</Typography>
            <Typography variant="body2" color="text.secondary">Summary of invoices and amounts based on filters.</Typography>
          </Box>
          <ButtonGroup variant="contained" size="medium">
            <Button onClick={exportToExcel} startIcon={<ExcelIcon />}
              disabled={exportLoading || !filteredInvoices.length}
              sx={{ bgcolor:'#1D6F42','&:hover':{bgcolor:'#145530'},'&.Mui-disabled':{bgcolor:'#cccccc'} }}>
              {exportLoading ? <CircularProgress size={20} color="inherit" /> : 'Excel'}
            </Button>
            <Button onClick={exportToPDF} startIcon={<PdfIcon />}
              disabled={exportLoading || !filteredInvoices.length}
              sx={{ bgcolor:'#B22222','&:hover':{bgcolor:'#8B1A1A'},'&.Mui-disabled':{bgcolor:'#cccccc'} }}>
              {exportLoading ? <CircularProgress size={20} color="inherit" /> : 'PDF'}
            </Button>
          </ButtonGroup>
        </Box>

        {/* Filters */}
        <Card sx={{ mb:3, borderRadius:2, boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p:2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3} minWidth="250px">
                <Autocomplete options={clients} getOptionLabel={o => o.clientName || o.name || ''}
                  value={selectedClient} onChange={(_, v) => setSelectedClient(v)}
                  renderInput={p => <TextField {...p} label="Filter by Client" variant="outlined" placeholder="Search client..." size="small" />} />
              </Grid>
              <Grid item xs={12} md={2} minWidth="200px">
                <FormControl fullWidth size="small">
                  <InputLabel>Date Range</InputLabel>
                  <Select value={dateFilterType} label="Date Range" onChange={e => setDateFilterType(e.target.value)}>
                    <MenuItem value="all">All Dates</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {dateFilterType === 'custom' && <>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="From Date" type="date" value={fromDate}
                    onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink:true }} size="small" />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="To Date" type="date" value={toDate}
                    onChange={e => setToDate(e.target.value)} InputLabelProps={{ shrink:true }} size="small" />
                </Grid>
              </>}
              <Grid item xs={12} md={dateFilterType === 'custom' ? 3 : 5}>
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button variant="outlined" onClick={clearFilters} startIcon={<ClearIcon />} size="small" sx={{ py:0.5 }}>
                    Clear Filters
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Summary */}
        <Paper sx={{ mb:2, p:2, bgcolor:'#f8f9fa', border:'1px solid #e0e0e0' }}>
          <Grid container spacing={2}>
            {[
              { label:'TAXABLE AMOUNT', val: totals.taxable },
              { label:'GST AMOUNT',     val: totals.gst     },
              { label:'GRAND TOTAL',    val: totals.grand   },
            ].map(({ label, val }) => (
              <Grid item xs={12} sm={4} key={label}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ letterSpacing:'0.5px' }}>{label}</Typography>
                <Typography variant="h6" color="#001F3F" fontWeight={700}>₹ {formatNumber(val)}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Count */}
        <Box sx={{ mb:1 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Data table */}
        <Box sx={{ backgroundColor:'white', borderRadius:2, boxShadow:'0 4px 20px rgba(0,0,0,0.08)', overflowX:'auto', maxHeight:'500px', overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'900px' }}>
            <thead style={{ position:'sticky', top:0, zIndex:10 }}>
              <tr style={{ backgroundColor:'#001F3F' }}>
                {TABLE_HEADERS.map(h => (
                  <th key={h} style={{
                    padding:'12px 10px',
                    textAlign: h === 'Client Name' ? 'left' : 'center',
                    fontWeight:600, fontSize:'0.85rem', color:'white', borderBottom:'2px solid #001F3F',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'50px' }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" sx={{ mt:2 }}>Loading data...</Typography>
                </td></tr>
              ) : tableData.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'50px' }}>
                  <Typography variant="body2" color="text.secondary">No invoices found.</Typography>
                </td></tr>
              ) : tableData.map((row, i) => (
                <tr key={row.id} style={{ borderBottom:'1px solid #eee', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding:'10px 8px', textAlign:'center', fontSize:'0.85rem', color:'#444' }}>{row.sno}</td>
                  <td style={{ padding:'10px 8px', textAlign:'center', fontSize:'0.85rem', color:'#444' }}>{row.date}</td>
                  <td style={{ padding:'10px 8px', textAlign:'center', fontSize:'0.85rem', fontWeight:600, color:'#001F3F' }}>{row.invoiceNumber}</td>
                  <td style={{ padding:'10px 8px', textAlign:'left',   fontSize:'0.85rem', color:'#444' }}>{row.clientName}</td>
                  <td style={{ padding:'10px 8px', textAlign:'right',  fontSize:'0.85rem', color:'#444' }}>{formatNumber(row.taxable)}</td>
                  <td style={{ padding:'10px 8px', textAlign:'right',  fontSize:'0.85rem', color:'#444' }}>{formatNumber(row.gst)}</td>
                  <td style={{ padding:'10px 8px', textAlign:'right',  fontSize:'0.85rem', fontWeight:700, color:'#001F3F' }}>{formatNumber(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width:'100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Ledger;