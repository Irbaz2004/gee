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
  InputAdornment,
  TablePagination
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { db } from '../config';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

// Styled Components
const NavyButton = styled(Button)(() => ({
  backgroundColor: '#001F3F',
  color: 'white',
  borderRadius: 8,
  padding: '8px 20px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
  boxShadow: '0 4px 12px rgba(0, 31, 63, 0.25)',
  '&:hover': {
    backgroundColor: '#003366',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.2s ease',
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  border: '1px solid #edf2f7'
}));

const Material = () => {
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

  // Fetch materials from global collection
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setLoading(true);
        // Use global materials collection (not company-specific)
        const materialsRef = collection(db, 'materials');
        const q = query(materialsRef, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const materialsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMaterials(materialsList);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching materials:", error);
          showSnackbar('Failed to load materials', 'error');
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up materials listener:", error);
        showSnackbar('Error fetching materials', 'error');
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []); // Empty dependency array - runs once on mount

  const validateForm = () => {
    const errors = {};
    if (!formData.materialName.trim()) {
      errors.materialName = 'Material name is required';
    }
    
    if (!formData.hsnCode.trim()) {
      errors.hsnCode = 'HSN code is required';
    } else if (!/^\d{4,8}$/.test(formData.hsnCode)) {
      errors.hsnCode = 'HSN code must be 4-8 digits';
    }
    
    if (!formData.rate) {
      errors.rate = 'Rate is required';
    } else if (parseFloat(formData.rate) <= 0) {
      errors.rate = 'Rate must be greater than 0';
    } else if (isNaN(parseFloat(formData.rate))) {
      errors.rate = 'Invalid rate';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field if it exists
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const resetForm = () => {
    setFormData({ materialName: '', hsnCode: '', rate: '' });
    setFormErrors({});
    setEditingMaterial(null);
  };

  const handleOpenDialog = (material = null) => {
    if (material) {
      setFormData({
        materialName: material.materialName || '',
        hsnCode: material.hsnCode || '',
        rate: material.rate?.toString() || ''
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
      // Save to global materials collection
      const materialsRef = collection(db, 'materials');
      await addDoc(materialsRef, {
        materialName: formData.materialName.trim(),
        hsnCode: formData.hsnCode.trim(),
        rate: parseFloat(formData.rate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      showSnackbar('Material added successfully!', 'success');
      handleCloseDialog();
    } catch (error) {
      console.error("Error adding material:", error);
      showSnackbar('Error adding material: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!validateForm() || !editingMaterial) return;
    
    try {
      setLoading(true);
      // Update in global materials collection
      const materialRef = doc(db, 'materials', editingMaterial.id);
      await updateDoc(materialRef, {
        materialName: formData.materialName.trim(),
        hsnCode: formData.hsnCode.trim(),
        rate: parseFloat(formData.rate),
        updatedAt: serverTimestamp()
      });
      
      showSnackbar('Material updated successfully!', 'success');
      handleCloseDialog();
    } catch (error) {
      console.error("Error updating material:", error);
      showSnackbar('Update failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!materialToDelete) return;
    
    try {
      setLoading(true);
      // Delete from global materials collection
      const materialRef = doc(db, 'materials', materialToDelete.id);
      await deleteDoc(materialRef);
      
      showSnackbar('Material deleted successfully!', 'success');
      handleCloseDeleteDialog();
    } catch (error) {
      console.error("Error deleting material:", error);
      showSnackbar('Delete failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Filter materials based on search query
  const filteredMaterials = materials.filter(material =>
    material.materialName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.hsnCode?.includes(searchQuery)
  );

  // Paginate materials
  const paginatedMaterials = filteredMaterials.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '---';
    if (timestamp?.toDate) {
      return new Date(timestamp.toDate()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return '---';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, backgroundColor: '#ffffff', minHeight: '80vh', borderRadius: 2 }}>
      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={handleCloseSnackbar} 
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%', fontWeight: 500 }}
        >
          {snackbar.message}
        </Alert>
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
                Global inventory control and pricing
              </Typography>
            </Box>
          </Box>
          <NavyButton 
            startIcon={<AddIcon />} 
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add Material
          </NavyButton>
        </Box>

        {/* Stats & Search Row */}
        <Card sx={{ backgroundColor: '#001F3F', borderRadius: 3, overflow: 'visible' }}>
          <CardContent sx={{ py: '16px !important' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={2.5}minWidth={'300px'}>
                <Box sx={{ backgroundColor: "white", px: 2, py: 1, borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color='#64748b' fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                    Total Items
                  </Typography>
                  <Typography variant="h5" color='#0f172a' fontWeight={800}>
                    {materials.length}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={9.5}minWidth={'400px'}>
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
                      '& .MuiInputBase-input::placeholder': {
                        color: 'rgba(255,255,255,0.5)',
                        opacity: 1,
                      },
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
        <TableContainer sx={{ maxHeight: '50vh', minHeight: 300 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5, width: '5%' }}>
                  S.No
                </TableCell>
                <TableCell sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5, width: '30%' }}>
                  Material Name
                </TableCell>
                <TableCell sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5, width: '15%' }}>
                  HSN Code
                </TableCell>
                <TableCell sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5, width: '15%' }}>
                  Rate (₹)
                </TableCell>
                <TableCell sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5, width: '20%' }}>
                  Last Updated
                </TableCell>
                <TableCell sx={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.75rem', py: 1.5, width: '15%', textAlign: 'center' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && materials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">Loading materials...</Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <InventoryIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      No materials found
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                      sx={{ mt: 1, borderColor: '#001F3F', color: '#001F3F' }}
                    >
                      Add your first material
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMaterials.map((material, index) => (
                  <TableRow key={material.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontSize: '0.85rem' }}>
                      {(page * rowsPerPage) + index + 1}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                      {material.materialName}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={material.hsnCode} 
                        size="small" 
                        sx={{ 
                          height: 20, 
                          fontSize: '0.7rem', 
                          fontWeight: 600, 
                          backgroundColor: '#f1f5f9',
                          fontFamily: 'monospace'
                        }} 
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>
                      ₹ {new Intl.NumberFormat('en-IN', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2 
                      }).format(material.rate || 0)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {formatDate(material.updatedAt || material.createdAt)}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={0.5} justifyContent="center">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(material)} 
                          sx={{ color: '#3b82f6' }}
                          title="Edit material"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDeleteDialog(material)} 
                          sx={{ color: '#ef4444' }}
                          title="Delete material"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredMaterials.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: '1px solid #edf2f7',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: '0.85rem',
            }
          }}
        />
      </StyledPaper>

      {/* Add/Edit Material Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#001F3F', 
          color: 'white', 
          py: 2, 
          fontSize: '1.1rem',
          fontWeight: 600
        }}>
          {editingMaterial ? 'Edit Material' : 'Add New Material'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2, pb: 1 }}>
          <TextField
            fullWidth
            label="Material Name"
            name="materialName"
            size="small"
            value={formData.materialName}
            onChange={handleInputChange}
            error={!!formErrors.materialName}
            helperText={formErrors.materialName}
            sx={{ mb: 2.5, mt: 2 }}
            required
          />
          <TextField
            fullWidth
            label="HSN Code"
            name="hsnCode"
            size="small"
            value={formData.hsnCode}
            onChange={handleInputChange}
            error={!!formErrors.hsnCode}
            helperText={formErrors.hsnCode || '4-8 digits'}
            sx={{ mb: 2.5 }}
            required
            inputProps={{ maxLength: 8 }}
          />
          <TextField
            fullWidth
            label="Rate (₹)"
            name="rate"
            type="number"
            size="small"
            value={formData.rate}
            onChange={handleInputChange}
            error={!!formErrors.rate}
            helperText={formErrors.rate}
            required
            InputProps={{
              inputProps: { 
                min: 0.01, 
                step: 0.01 
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button 
            onClick={handleCloseDialog} 
            size="small"
            sx={{ color: '#64748b' }}
          >
            Cancel
          </Button>
          <NavyButton 
            onClick={editingMaterial ? handleUpdateMaterial : handleAddMaterial} 
            disabled={loading}
            size="small"
          >
            {loading ? 'Saving...' : (editingMaterial ? 'Update' : 'Add Material')}
          </NavyButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={handleCloseDeleteDialog}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogContent sx={{ textAlign: 'center', pt: 4, pb: 3, px: 4 }}>
          <DeleteIcon sx={{ fontSize: 56, color: '#ef4444', mb: 2 }} />
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Delete Material?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to delete "{materialToDelete?.materialName}"?
          </Typography>
          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 3, px: 3, justifyContent: 'center', gap: 2 }}>
          <Button 
            onClick={handleCloseDeleteDialog}
            variant="outlined"
            sx={{ borderColor: '#ddd', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteMaterial} 
            variant="contained" 
            color="error"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Material;