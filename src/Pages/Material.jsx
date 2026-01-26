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
const NavyButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#001F3F',
  color: 'white',
  borderRadius: 8,
  padding: '10px 24px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  boxShadow: '0 4px 12px rgba(0, 31, 63, 0.25)',
  '&:hover': {
    backgroundColor: '#003366',
    boxShadow: '0 6px 16px rgba(0, 31, 63, 0.35)',
    transform: 'translateY(-2px)',
  },
  transition: 'all 0.3s ease',
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 12,
  backgroundColor: '#f8f9fa',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
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

  // Fetch materials from Firebase
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const materialsRef = collection(db, 'materials');
        const q = query(materialsRef);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const materialsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMaterials(materialsList);
          setLoading(false);
        }, (error) => {
          console.error('Error fetching materials:', error);
          showSnackbar('Failed to load materials', 'error');
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching materials:', error);
        showSnackbar('Failed to load materials', 'error');
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.materialName.trim()) {
      errors.materialName = 'Material name is required';
    }
    
    if (!formData.hsnCode.trim()) {
      errors.hsnCode = 'HSN code is required';
    } else if (!/^\d{6,8}$/.test(formData.hsnCode)) {
      errors.hsnCode = 'HSN code must be 6-8 digits';
    }
    
    if (!formData.rate) {
      errors.rate = 'Rate is required';
    } else if (parseFloat(formData.rate) <= 0) {
      errors.rate = 'Rate must be greater than 0';
    } else if (isNaN(parseFloat(formData.rate))) {
      errors.rate = 'Rate must be a valid number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      materialName: '',
      hsnCode: '',
      rate: ''
    });
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
      const materialsRef = collection(db, 'materials');
      const materialData = {
        materialName: formData.materialName.trim(),
        hsnCode: formData.hsnCode.trim(),
        rate: parseFloat(formData.rate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(materialsRef, materialData);
      showSnackbar('Material added successfully!', 'success');
      handleCloseDialog();
    } catch (error) {
      console.error('Error adding material:', error);
      showSnackbar('Failed to add material', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!validateForm() || !editingMaterial) return;

    try {
      setLoading(true);
      const materialRef = doc(db, 'materials', editingMaterial.id);
      const materialData = {
        materialName: formData.materialName.trim(),
        hsnCode: formData.hsnCode.trim(),
        rate: parseFloat(formData.rate),
        updatedAt: serverTimestamp()
      };

      await updateDoc(materialRef, materialData);
      showSnackbar('Material updated successfully!', 'success');
      handleCloseDialog();
    } catch (error) {
      console.error('Error updating material:', error);
      showSnackbar('Failed to update material', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!materialToDelete) return;

    try {
      setLoading(true);
      const materialRef = doc(db, 'materials', materialToDelete.id);
      await deleteDoc(materialRef);
      showSnackbar('Material deleted successfully!', 'success');
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting material:', error);
      showSnackbar('Failed to delete material', 'error');
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
    material.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.hsnCode.includes(searchQuery)
  );

  // Pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedMaterials = filteredMaterials.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, backgroundColor: '#ffffff', minHeight: '75vh', borderRadius: 2, mt: -2, mb: -2 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <InventoryIcon sx={{ fontSize: 40, color: '#001F3F', mr: 2 }} />
            <Box>
              <Typography variant="h4" component="h1" fontWeight={700} color="#001F3F">
                Material Management
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Add, edit and manage your materials
              </Typography>
            </Box>
          </Box>
          <NavyButton
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add New Material
          </NavyButton>
        </Box>

        <Card sx={{ backgroundColor: '#001F3F', color: 'white', borderRadius: 2 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3} sx={{ backgroundColor: "white", px: 2, py: 1, borderRadius: 1 }}>
                <Box display="flex" alignItems="center" ml={2}>
                  <Box>
                    <Typography variant="body2" color='#001F3F' fontWeight={'bold'} ml={-2}>Total Materials</Typography>
                    <Typography variant="h5" color='#001F3F' fontSize={29} fontWeight={700}>
                      {materials.length}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={3} sx={{ backgroundColor: "white", px: 2, py: 1, borderRadius: 1 }}>
                <Box display="flex" alignItems="center" ml={2}>
                  <Box>
                    <Typography variant="body2" color='#001F3F' fontWeight={'bold'} ml={-2}>Unique HSN Codes</Typography>
                    <Typography variant="h5" color='#001F3F' fontSize={29} fontWeight={700}>
                      {new Set(materials.map(m => m.hsnCode)).size}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6} ml={2}>
                <TextField
                  fullWidth
                  placeholder="Search materials by name or HSN code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
                      </InputAdornment>
                    ),
                    sx: {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      minWidth: 550,
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white',
                      },
                      '& input::placeholder': {
                        color: 'rgba(255,255,255,0.7)',
                      }
                    }
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Materials Table */}
      <StyledPaper>
        {loading && materials.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress size={60} sx={{ color: '#001F3F' }} />
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: '55vh', overflow: 'auto', position: 'relative' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ 
                      backgroundColor: '#001F3F', 
                      color: 'white', 
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      borderBottom: '2px solid #001F3F'
                    }}>
                      S.No
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: '#001F3F', 
                      color: 'white', 
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      borderBottom: '2px solid #001F3F'
                    }}>
                      Material Name
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: '#001F3F', 
                      color: 'white', 
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      borderBottom: '2px solid #001F3F'
                    }}>
                      HSN Code
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: '#001F3F', 
                      color: 'white', 
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      borderBottom: '2px solid #001F3F'
                    }} align="right">
                      Rate (₹)
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: '#001F3F', 
                      color: 'white', 
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      borderBottom: '2px solid #001F3F'
                    }}>
                      Last Updated
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: '#001F3F', 
                      color: 'white', 
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      borderBottom: '2px solid #001F3F'
                    }} align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedMaterials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <InventoryIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          {searchQuery ? 'No materials found matching your search' : 'No materials added yet'}
                        </Typography>
                        {!searchQuery && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Click "Add New Material" to get started
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMaterials.map((material, index) => (
                      <TableRow 
                        key={material.id} 
                        hover
                        sx={{ 
                          '&:hover': { backgroundColor: 'rgba(0, 31, 63, 0.04)' },
                          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' }
                        }}
                      >
                        <TableCell>
                          <Typography fontWeight={500}>
                            {(page * rowsPerPage) + index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <InventoryIcon sx={{ color: '#001F3F', mr: 1, fontSize: 20 }} />
                            <Typography fontWeight={600}>
                              {material.materialName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={material.hsnCode} 
                            size="small" 
                            icon={<CodeIcon fontSize="small" />}
                            sx={{ 
                              backgroundColor: 'rgba(0, 31, 63, 0.1)',
                              color: '#001F3F',
                              fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            <CurrencyRupeeIcon sx={{ color: '#2e7d32', mr: 0.5, fontSize: 18 }} />
                            <Typography fontWeight={700} color="#2e7d32">
                              {formatNumber(material.rate)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {material.updatedAt?.toDate ? 
                              new Date(material.updatedAt.toDate()).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" justifyContent="center" gap={1}>
                            <Tooltip title="Edit Material">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(material)}
                                sx={{ 
                                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                                  '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.2)' }
                                }}
                              >
                                <EditIcon fontSize="small" sx={{ color: '#1976d2' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Material">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDeleteDialog(material)}
                                sx={{ 
                                  backgroundColor: 'rgba(211, 47, 47, 0.1)',
                                  '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.2)' }
                                }}
                              >
                                <DeleteIcon fontSize="small" sx={{ color: '#d32f2f' }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {filteredMaterials.length > 0 && (
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={filteredMaterials.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    fontWeight: 500,
                  },
                  borderTop: '1px solid #e0e0e0',
                  mt: 2
                }}
              />
            )}
          </>
        )}
      </StyledPaper>

      {/* Add/Edit Material Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#001F3F', color: 'white' }}>
          <Box display="flex" alignItems="center">
            <InventoryIcon sx={{ mr: 1 }} />
            {editingMaterial ? 'Edit Material' : 'Add New Material'}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3} mt={4}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Material Name"
                name="materialName"
                value={formData.materialName}
                onChange={handleInputChange}
                error={!!formErrors.materialName}
                helperText={formErrors.materialName}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <InventoryIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="HSN Code"
                name="hsnCode"
                value={formData.hsnCode}
                onChange={handleInputChange}
                error={!!formErrors.hsnCode}
                helperText={formErrors.hsnCode || "6-8 digit HSN code"}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CodeIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rate (₹)"
                name="rate"
                type="number"
                value={formData.rate}
                onChange={handleInputChange}
                error={!!formErrors.rate}
                helperText={formErrors.rate}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CurrencyRupeeIcon color="action" />
                    </InputAdornment>
                  ),
                  inputProps: { 
                    min: 0,
                    step: 0.01
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#666' }}>
            Cancel
          </Button>
          <NavyButton
            onClick={editingMaterial ? handleUpdateMaterial : handleAddMaterial}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Processing...' : editingMaterial ? 'Update Material' : 'Add Material'}
          </NavyButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#d32f2f', color: 'white' }}>
          <Box display="flex" alignItems="center">
            <DeleteIcon sx={{ mr: 1 }} />
            Confirm Delete
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box textAlign="center" py={2}>
            <DeleteIcon sx={{ fontSize: 60, color: '#d32f2f', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Are you sure you want to delete this material?
            </Typography>
            {materialToDelete && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
                <Typography variant="body1" fontWeight={600}>
                  {materialToDelete.materialName}
                </Typography>
                <Box display="flex" justifyContent="center" gap={3} mt={1}>
                  <Chip 
                    label={`HSN: ${materialToDelete.hsnCode}`} 
                    size="small" 
                    sx={{ backgroundColor: 'rgba(0, 31, 63, 0.1)', color: '#001F3F' }}
                  />
                  <Chip 
                    label={`Rate: ₹${formatNumber(materialToDelete.rate)}`} 
                    size="small" 
                    sx={{ backgroundColor: 'rgba(46, 125, 50, 0.1)', color: '#2e7d32' }}
                  />
                </Box>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              This action cannot be undone. All associated data will be permanently removed.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={handleCloseDeleteDialog} 
            sx={{ color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteMaterial}
            disabled={loading}
            variant="contained"
            color="error"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
            sx={{
              backgroundColor: '#d32f2f',
              '&:hover': { backgroundColor: '#c62828' }
            }}
          >
            {loading ? 'Deleting...' : 'Delete Material'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Tips */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Tip:</strong> Materials added here will be available for selection in the Invoice Generator
        </Typography>
      </Box>
    </Container>
  );
};

export default Material;