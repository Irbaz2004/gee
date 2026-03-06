import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, Alert, Tooltip, Snackbar, InputAdornment,
    Container
} from '@mui/material';
import {
    Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
    Search as SearchIcon, Person as PersonIcon, Phone as PhoneIcon,
    Email as EmailIcon, Business as BusinessIcon, Receipt as GstIcon
} from '@mui/icons-material';
import {
    collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, 
    query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { useCompany } from '../context/CompanyContext';

const Client = () => {
    const { selectedCompany } = useCompany();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', address: '', gstin: ''
    });

    const THEME_COLOR = '#001F3F';

    // Global clients collection reference
    const getClientsCollection = () => {
        return collection(db, 'clients');
    };

    // Get client document reference with company ID
    const getClientDocRef = (clientId) => {
        return doc(db, 'clients', clientId);
    };

    useEffect(() => {
        if (!selectedCompany) return;

        
        // Query clients for the selected company from global collection
        const clientsRef = getClientsCollection();
        const q = query(
            clientsRef, 
            orderBy('name')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClients(clientsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching clients:", error);
            setSnackbar({ 
                open: true, 
                message: 'Failed to load clients', 
                severity: 'error' 
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedCompany]);

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleOpenDialog = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name || '',
                email: client.email || '',
                phone: client.phone || '',
                address: client.address || '',
                gstin: client.gstin || ''
            });
        } else {
            setEditingClient(null);
            setFormData({ name: '', email: '', phone: '', address: '', gstin: '' });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingClient(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.name.trim()) {
            return showSnackbar('Client name is required', 'error');
        }

        try {
            const clientsRef = getClientsCollection();
            
            // Add companyId to the client data
            const clientData = {
                ...formData,
                companyId: selectedCompany.id,
                companyName: selectedCompany.name,
                updatedAt: serverTimestamp()
            };

            if (editingClient) {
                // Update existing client
                const clientDocRef = getClientDocRef(editingClient.id);
                await updateDoc(clientDocRef, clientData);
                showSnackbar('Client updated successfully');
            } else {
                // Add new client with createdAt
                await addDoc(clientsRef, {
                    ...clientData,
                    createdAt: serverTimestamp()
                });
                showSnackbar('Client added successfully');
            }
            
            handleCloseDialog();
        } catch (error) {
            console.error("Error saving client:", error);
            showSnackbar('Error saving client', 'error');
        }
    };

    const handleDelete = async (clientId) => {
        if (window.confirm('Are you sure you want to delete this client?')) {
            try {
                const clientDocRef = getClientDocRef(clientId);
                await deleteDoc(clientDocRef);
                showSnackbar('Client deleted successfully');
            } catch (error) {
                console.error("Error deleting client:", error);
                showSnackbar('Error deleting client', 'error');
            }
        }
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.phone && client.phone.includes(searchTerm)) ||
        (client.gstin && client.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <Container maxWidth="xl" sx={{ 
            py: 3, 
            backgroundColor: '#ffffff', 
            minHeight: '80vh', 
            borderRadius: 2,
            fontFamily: "'Poppins', sans-serif"
        }}>
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                    * {
                        font-family: 'Poppins', sans-serif !important;
                    }
                `}
            </style>
            
            <Box sx={{ p: 1 }}>
                {/* Header Section */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box>
                        <Typography 
                            variant="h5" 
                            fontWeight="700" 
                            color={THEME_COLOR}
                            sx={{ fontFamily: "'Poppins', sans-serif" }}
                        >
                            Client Management
                        </Typography>
                        <Typography 
                            variant="body2" 
                            color="textSecondary"
                            sx={{ fontFamily: "'Poppins', sans-serif" }}
                        >
                            Listing all clients for <strong>{selectedCompany?.name}</strong>
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                        sx={{ 
                            backgroundColor: THEME_COLOR,
                            borderRadius: 0.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            fontFamily: "'Poppins', sans-serif",
                            boxShadow: '0 4px 12px rgba(0, 31, 63, 0.25)',
                            padding: '8px 20px',
                            '&:hover': {
                                backgroundColor: '#003366',
                                transform: 'translateY(-1px)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Add Client
                    </Button>
                </Box>

                {/* Search Section */}
                <Paper elevation={0} sx={{ 
                    mb: 3, 
                    p: 2, 
                    borderRadius: 2, 
                    border: '1px solid #e0e0e0'
                }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        size="small"
                        placeholder="Search by name, phone, or GSTIN..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            sx: { fontFamily: "'Poppins', sans-serif" }
                        }}
                        sx={{
                            '& .MuiInputBase-root': {
                                fontFamily: "'Poppins', sans-serif"
                            }
                        }}
                    />
                </Paper>

                {/* Table Section */}
                {loading ? (
                    <Box display="flex" justifyContent="center" py={10}>
                        <CircularProgress sx={{ color: THEME_COLOR }} />
                    </Box>
                ) : (
                    <TableContainer 
                        component={Paper} 
                        sx={{ 
                            borderRadius: 2, 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            fontFamily: "'Poppins', sans-serif"
                        }}
                    >
                        <Table size="medium">
                            <TableHead sx={{ backgroundColor: THEME_COLOR }}>
                                <TableRow>
                                    <TableCell sx={{ 
                                        color: 'white', 
                                        fontWeight: 'bold',
                                        fontFamily: "'Poppins', sans-serif"
                                    }}>Name</TableCell>
                                    <TableCell sx={{ 
                                        color: 'white', 
                                        fontWeight: 'bold',
                                        fontFamily: "'Poppins', sans-serif"
                                    }}>Contact</TableCell>
                                    <TableCell sx={{ 
                                        color: 'white', 
                                        fontWeight: 'bold',
                                        fontFamily: "'Poppins', sans-serif"
                                    }}>GSTIN</TableCell>
                                    <TableCell sx={{ 
                                        color: 'white', 
                                        fontWeight: 'bold',
                                        fontFamily: "'Poppins', sans-serif"
                                    }}>Address</TableCell>
                                    <TableCell sx={{ 
                                        color: 'white', 
                                        fontWeight: 'bold',
                                        fontFamily: "'Poppins', sans-serif"
                                    }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredClients.map((client) => (
                                    <TableRow key={client.id} hover>
                                        <TableCell sx={{ 
                                            fontWeight: 600,
                                            fontFamily: "'Poppins', sans-serif"
                                        }}>
                                            {client.name}
                                        </TableCell>
                                        <TableCell>
                                            <Typography 
                                                variant="body2"
                                                sx={{ fontFamily: "'Poppins', sans-serif" }}
                                            >
                                                {client.phone || 'N/A'}
                                            </Typography>
                                            <Typography 
                                                variant="caption" 
                                                color="textSecondary"
                                                sx={{ fontFamily: "'Poppins', sans-serif" }}
                                            >
                                                {client.email || ''}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                {client.gstin || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={client.address || ''}>
                                                <Typography 
                                                    variant="body2" 
                                                    noWrap 
                                                    sx={{ 
                                                        maxWidth: 200,
                                                        fontFamily: "'Poppins', sans-serif"
                                                    }}
                                                >
                                                    {client.address || '-'}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton 
                                                size="small" 
                                                color="primary" 
                                                onClick={() => handleOpenDialog(client)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton 
                                                size="small" 
                                                color="error" 
                                                onClick={() => handleDelete(client.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredClients.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                            <Typography 
                                                color="textSecondary"
                                                sx={{ fontFamily: "'Poppins', sans-serif" }}
                                            >
                                                No clients found.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Dialog */}
                <Dialog 
                    open={openDialog} 
                    onClose={handleCloseDialog} 
                    maxWidth="sm" 
                    fullWidth
                    PaperProps={{
                        sx: {
                            fontFamily: "'Poppins', sans-serif"
                        }
                    }}
                >
                    <DialogTitle sx={{ 
                        backgroundColor: THEME_COLOR, 
                        color: 'white', 
                        py: 2,
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600
                    }}>
                        {editingClient ? 'Edit Client Details' : 'Register New Client'}
                    </DialogTitle>
                    <form onSubmit={handleSubmit}>
                        <DialogContent dividers sx={{ pt: 3 }}>
                            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                                <TextField
                                    label="Client Name"
                                    name="name"
                                    fullWidth
                                    required
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    sx={{ gridColumn: 'span 2' }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonIcon fontSize="small"/>
                                            </InputAdornment>
                                        ),
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                    InputLabelProps={{
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                />
                                <TextField
                                    label="Phone Number"
                                    name="phone"
                                    fullWidth
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PhoneIcon fontSize="small"/>
                                            </InputAdornment>
                                        ),
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                    InputLabelProps={{
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                />
                                <TextField
                                    label="Email Address"
                                    name="email"
                                    type="email"
                                    fullWidth
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon fontSize="small"/>
                                            </InputAdornment>
                                        ),
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                    InputLabelProps={{
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                />
                                <TextField
                                    label="GSTIN"
                                    name="gstin"
                                    fullWidth
                                    value={formData.gstin}
                                    onChange={handleInputChange}
                                    placeholder="22AAAAA0000A1Z5"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <GstIcon fontSize="small"/>
                                            </InputAdornment>
                                        ),
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                    InputLabelProps={{
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                />
                                <TextField
                                    label="Full Address"
                                    name="address"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    sx={{ gridColumn: 'span 2' }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <BusinessIcon fontSize="small"/>
                                            </InputAdornment>
                                        ),
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                    InputLabelProps={{
                                        sx: { fontFamily: "'Poppins', sans-serif" }
                                    }}
                                />
                            </Box>
                        </DialogContent>
                        <DialogActions sx={{ 
                            p: 2, 
                            backgroundColor: '#f9f9f9'
                        }}>
                            <Button 
                                onClick={handleCloseDialog} 
                                color="inherit"
                                sx={{ fontFamily: "'Poppins', sans-serif" }}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                variant="contained" 
                                sx={{ 
                                    backgroundColor: THEME_COLOR,
                                    fontFamily: "'Poppins', sans-serif",
                                    '&:hover': {
                                        backgroundColor: '#003366'
                                    }
                                }}
                            >
                                {editingClient ? 'Save Changes' : 'Create Client'}
                            </Button>
                        </DialogActions>
                    </form>
                </Dialog>

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert 
                        severity={snackbar.severity} 
                        variant="filled" 
                        sx={{ 
                            width: '100%',
                            fontFamily: "'Poppins', sans-serif"
                        }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Container>
    );
};

export default Client;