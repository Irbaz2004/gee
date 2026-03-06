import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Alert,
  Snackbar,
  Chip,
  CircularProgress,
  Tooltip,
  TablePagination,
  InputAdornment,
 
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { db } from '../config';
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { useCompany } from '../context/CompanyContext';
import { getCompanyCollection } from '../utils/firestoreUtils';

// Styled Components
const NavyButton = styled(Button)(() => ({
  backgroundColor: '#001F3F',
  color: 'white',
  borderRadius: 8,
  padding: '8px 20px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9rem', // Smaller font
  boxShadow: '0 4px 12px rgba(0, 31, 63, 0.25)',
  '&:hover': {
    backgroundColor: '#003366',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.2s ease',
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2), // Reduced padding
  borderRadius: 12,
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  border: '1px solid #edf2f7'
}));

const Material = () => {
  const { selectedCompany } = useCompany();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({
    materialName: '',
    hsnCode: '',
    rate: ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const fetchMaterials = async () => {
      if (!selectedCompany) return;
      try {
        const materialsRef = getCompanyCollection(db, selectedCompany.id, 'materials');
        const q = query(materialsRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const materialsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMaterials(materialsList);
          setLoading(false);
        }, (error) => {
          showSnackbar('Failed to load materials', error);

          setLoading(false);
        });
        return () => unsubscribe();
      } catch (error) {
        setLoading(false);
        showSnackbar('Error fetching materials', error);
      }
    };
    fetchMaterials();
  }, [selectedCompany]);

  const validateForm = () => {
    const errors = {};
    if (!formData.materialName.trim()) errors.materialName = 'Required';
    if (!formData.hsnCode.trim()) {
      errors.hsnCode = 'Required';
    } else if (!/^\d{4,8}$/.test(formData.hsnCode)) {
      errors.hsnCode = '4-8 digits required';
    }
    if (!formData.rate || parseFloat(formData.rate) <= 0) errors.rate = 'Invalid rate';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const resetForm = () => {
    setFormData({ materialName: '', hsnCode: '', rate: '' });
    setFormErrors({});
    setEditingMaterial(null);
  };

  const handleOpenDialog = (material = null) => {
    if (material) {
      setFormData({
        materialName: material.materialName,
        hsnCode: material.hsnCode,
        rate: material.rate.toString()
      });
      setEditingMaterial(material);
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleOpenDeleteDialog = (material) => {
    setMaterialToDelete(material);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setMaterialToDelete(null);
  };

  const handleAddMaterial = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      const materialsRef = getCompanyCollection(db, selectedCompany.id, 'materials');
      await addDoc(materialsRef, {
        ...formData,
        rate: parseFloat(formData.rate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showSnackbar('Material added successfully!');
      handleCloseDialog();
    } catch (error) {
      showSnackbar('Error adding material', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!validateForm() || !editingMaterial) return;
    try {
      setLoading(true);
      const materialRef = doc(db, 'companies', selectedCompany.id, 'materials', editingMaterial.id);
      await updateDoc(materialRef, {
        ...formData,
        rate: parseFloat(formData.rate),
        updatedAt: serverTimestamp()
      });
      showSnackbar('Material updated!');
      handleCloseDialog();
    } catch (error) {
      showSnackbar('Update failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async () => {
    try {
      setLoading(true);
      const materialRef = doc(db, 'companies', selectedCompany.id, 'materials', materialToDelete.id);
      await deleteDoc(materialRef);
      showSnackbar('Material deleted');
      handleCloseDeleteDialog();
    } catch (error) {
      showSnackbar('Delete failed', error);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  const filteredMaterials = materials.filter(material =>
    material.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.hsnCode.includes(searchQuery)
  );

  const paginatedMaterials = filteredMaterials.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Container maxWidth="xl" sx={{ py: 3, backgroundColor: '#ffffff', minHeight: '80vh', borderRadius: 2 }}>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>

      {/* Header Area */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center">
            <InventoryIcon sx={{ fontSize: 32, color: '#001F3F', mr: 1.5 }} />
            <Box>
              <Typography variant="h5" fontWeight={700} color="#001F3F" sx={{ lineHeight: 1.2 }}>
                Material Management
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Inventory control and pricing
              </Typography>
            </Box>
          </Box>
          <NavyButton startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Material
          </NavyButton>
        </Box>

        {/* Stats & Search Row */}
        <Card sx={{ backgroundColor: '#001F3F', borderRadius: 3, overflow: 'visible' }}>
          <CardContent sx={{ py: '16px !important' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={2.5}minWidth={'200px'}>
                <Box sx={{ backgroundColor: "white", px: 2, py: 1, borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color='#64748b' fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                    Total Items
                  </Typography>
                  <Typography variant="h5" color='#0f172a' fontWeight={800}>
                    {materials.length}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={9.5}minWidth={'600px'}>
                <TextField
                  fullWidth
                  placeholder="Search by material name or HSN code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    sx: {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      borderRadius: 2,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                    }
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Table Section */}
      <StyledPaper elevation={0}>
        <TableContainer sx={{ maxHeight: '50vh',minHeight: 260 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {['S.No', 'Material Name', 'HSN Code', 'Rate (₹)', 'Updated', 'Actions'].map((head) => (
                  <TableCell key={head} sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5 }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedMaterials.map((material, index) => (
                <TableRow key={material.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{ (page * rowsPerPage) + index + 1 }</TableCell>
                  <TableCell sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{material.materialName}</TableCell>
                  <TableCell>
                    <Chip label={material.hsnCode} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, backgroundColor: '#f1f5f9' }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>
                    {new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(material.rate)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {material.updatedAt?.toDate ? new Date(material.updatedAt.toDate()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '---'}
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" gap={0.5}>
                      <IconButton size="small" onClick={() => handleOpenDialog(material)} sx={{ color: '#3b82f6' }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleOpenDeleteDialog(material)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25]}
          component="div"
          count={filteredMaterials.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </StyledPaper>

     

      {/* Dialogs remain mostly same but with smaller padding/text */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#001F3F', color: 'white', py: 2, fontSize: '1.1rem' }}>
          {editingMaterial ? 'Edit Material' : 'Add New Material'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField fullWidth label="Material Name" name="materialName" size="small" value={formData.materialName} onChange={handleInputChange} error={!!formErrors.materialName} sx={{ mb: 2, mt: 1 }} />
          <TextField fullWidth label="HSN Code" name="hsnCode" size="small" value={formData.hsnCode} onChange={handleInputChange} error={!!formErrors.hsnCode} sx={{ mb: 2 }} />
          <TextField fullWidth label="Rate (₹)" name="rate" type="number" size="small" value={formData.rate} onChange={handleInputChange} error={!!formErrors.rate} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} size="small">Cancel</Button>
          <NavyButton onClick={editingMaterial ? handleUpdateMaterial : handleAddMaterial} disabled={loading}>
            {editingMaterial ? 'Update' : 'Add Material'}
          </NavyButton>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogContent sx={{ textAlign: 'center', pt: 4 }}>
          <DeleteIcon sx={{ fontSize: 48, color: '#ef4444', mb: 2 }} />
          <Typography variant="h6">Delete Material?</Typography>
          <Typography variant="body2" color="text.secondary">This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 3, px: 3, justifyContent: 'center' }}>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteMaterial} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Material;