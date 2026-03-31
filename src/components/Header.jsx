import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  Divider,
  Chip,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useAuth } from '../Auth/authcontext';
import { useCompany } from '../context/CompanyContext';

// Poppins font configuration
const poppinsFont = {
  fontFamily: 'Poppins, sans-serif',
};

const Header = () => {
  const { currentUser, logout } = useAuth();
  const { selectedCompany, clearCompany } = useCompany();
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentPage, setCurrentPage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      handleMenuClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSwitchCompany = () => {
    clearCompany();
    handleMenuClose();
    navigate('/select-company');
  };

  const handleGoToDashboard = () => {
    handleMenuClose();
    navigate('/');
  };

  // Get current time, date and greeting
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const day = now.toLocaleDateString('en-US', {
    weekday: 'short'
  });
  const date = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const greeting = getGreeting();

  // Function to split company name into two parts
  const splitCompanyName = (fullName) => {
    if (!fullName) return { firstLine: 'Select', secondLine: 'Company' };
    
    const words = fullName.trim().split(' ');
    
    if (words.length === 1) {
      return { firstLine: words[0], secondLine: '' };
    }
    
    if (words.length === 2) {
      return { firstLine: words[0], secondLine: words[1] };
    }
    
    // For names with 3 or more words, take first word as first line, rest as second line
    const firstLine = words[0];
    const secondLine = words.slice(1).join(' ');
    
    return { firstLine, secondLine };
  };

  const companyNameParts = splitCompanyName(selectedCompany?.name);

  // Function to format page name from URL path
  const formatPageName = (pathname) => {
    if (pathname === '/') return 'Dashboard';

    const path = pathname.substring(1);
    if (!path) return 'Dashboard';

    const segments = path.split('/');
    const mainSegment = segments[0];

    const formattedName = mainSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const pageNames = {
      'dashboard': 'Dashboard',
      'inventory': 'Inventory',
      'materials': 'Materials',
      'clients': 'Clients',
      'invoice': 'Invoice Generator',
      'invoices': 'Invoices',
      'admin': 'Admin Settings',
      'reports': 'Reports',
      'profile': 'Profile',
      'settings': 'Settings',
    };

    return pageNames[mainSegment.toLowerCase()] || formattedName;
  };

  // Update current page when location changes
  useEffect(() => {
    setCurrentPage(formatPageName(location.pathname));
  }, [location.pathname]);

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'white',
        color: '#001F3F',
        boxShadow: '0 2px 8px rgba(0, 31, 63, 0.08)',
        borderBottom: '1px solid rgba(0, 31, 63, 0.1)',
        ...poppinsFont,
      }}
    >
      <Toolbar sx={{
        minHeight: { xs: 64, sm: 72 },
        display: 'flex',
        justifyContent: 'space-between',
        px: { xs: 2, sm: 3 }
      }}>
        {/* Left Section: Brand + Page */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flex: 1,
          minWidth: 0 // Prevents flex overflow
        }}>
          {/* Brand */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pr: 10,
            borderRight: '2px solid rgba(0, 31, 63, 0.1)',
          }}>
            <BusinessIcon sx={{ color: '#001F3F', fontSize: 28 }} />
            <Box sx={{ minWidth: 120 }}>
              <Typography
                variant="h6"
                component="div"
                color="#001F3F"
                sx={{
                  fontSize: { xs: '1rem', sm: '1.1rem' },
                  lineHeight: 1.2,
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {companyNameParts.firstLine}
              </Typography>
              {companyNameParts.secondLine && (
                <Typography
                  variant="caption"
                  component="div"
                  color="#64748b"
                  sx={{
                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                    lineHeight: 1.2,
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {companyNameParts.secondLine}
                </Typography>
              )}
              {selectedCompany && (
                <Chip
                  label="Active"
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.55rem',
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    fontWeight: 600,
                    mt: 0.5,
                    fontFamily: 'Poppins, sans-serif',
                    '& .MuiChip-label': {
                      fontFamily: 'Poppins, sans-serif',
                      px: 1,
                    }
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Current Page */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <DashboardIcon sx={{ color: '#64748b', fontSize: 20 }} />
            <Typography
              variant="h6"
              component="div"
              fontWeight={600}
              color="#1e293b"
              sx={{
                fontSize: { xs: '0.95rem', sm: '1.1rem' },
                whiteSpace: 'nowrap',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {currentPage}
            </Typography>
          </Box>
        </Box>

        {/* Right Section: DateTime + Greeting + Avatar */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 2 }
        }}>
          {/* DateTime Box */}
          <Box sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: 2,
            px: 2,
            py: 0.8,
            border: '1px solid #e2e8f0'
          }}>
            <Box sx={{ textAlign: 'center', px: 1 }}>
              <Typography 
                variant="caption" 
                color="#64748b" 
                sx={{ 
                  fontSize: '0.65rem', 
                  display: 'block',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                }}
              >
                TIME
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight={600} 
                color="#001F3F" 
                sx={{ 
                  fontSize: '0.85rem',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {time}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <Box sx={{ textAlign: 'center', px: 1 }}>
              <Typography 
                variant="caption" 
                color="#64748b" 
                sx={{ 
                  fontSize: '0.65rem', 
                  display: 'block',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                }}
              >
                DATE
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight={600} 
                color="#001F3F" 
                sx={{ 
                  fontSize: '0.85rem',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {day}, {date}
              </Typography>
            </Box>
          </Box>

          {/* Compact DateTime for mobile/tablet */}
          <Box sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            mr: 1
          }}>
            <Typography 
              variant="body2" 
              color="#64748b" 
              sx={{ 
                fontSize: '0.75rem',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {time} • {day}, {date}
            </Typography>
          </Box>

          {/* Greeting */}
          <Box sx={{
            display: { xs: 'none', lg: 'block' },
            textAlign: 'right',
            mr: 1
          }}>
            <Typography 
              variant="caption" 
              color="#64748b" 
              sx={{ 
                fontSize: '0.7rem', 
                display: 'block',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {greeting}
            </Typography>
            <Typography 
              variant="body2" 
              fontWeight={500} 
              color="#001F3F" 
              sx={{ 
                fontSize: '0.85rem',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
            </Typography>
          </Box>

          {/* User Avatar */}
          <Tooltip title="Account settings">
            <IconButton
              onClick={handleMenuOpen}
              size="small"
              sx={{
                ml: 0.5,
                '&:hover': { backgroundColor: '#f1f5f9' }
              }}
            >
              <Avatar
                sx={{
                  width: 38,
                  height: 38,
                  backgroundColor: '#001F3F',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  border: '2px solid #e2e8f0',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {currentUser?.email?.charAt(0).toUpperCase() || 
                 currentUser?.displayName?.charAt(0).toUpperCase() || 
                 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>

        {/* User Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 260,
              borderRadius: 2,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              border: '1px solid #e2e8f0',
              overflow: 'visible',
              fontFamily: 'Poppins, sans-serif',
            }
          }}
        >
          <Box sx={{ px: 2, py: 1.5, backgroundColor: '#f8fafc' }}>
            <Typography 
              variant="body2" 
              fontWeight={600} 
              color="#001F3F"
              sx={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {currentUser?.displayName || 'User'}
            </Typography>
            <Typography 
              variant="caption" 
              color="#64748b" 
              sx={{ 
                display: 'block', 
                mt: 0.3,
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {currentUser?.email || ''}
            </Typography>
          </Box>
          
          <Divider />
          
          <MenuItem 
            onClick={handleGoToDashboard} 
            sx={{ 
              py: 1.5,
              '& .MuiTypography-root': {
                fontFamily: 'Poppins, sans-serif',
              }
            }}
          >
            <ListItemIcon>
              <DashboardIcon fontSize="small" sx={{ color: '#001F3F' }} />
            </ListItemIcon>
            <Typography color="#001F3F">Dashboard</Typography>
          </MenuItem>

          <MenuItem 
            onClick={handleSwitchCompany} 
            sx={{ 
              py: 1.5,
              '& .MuiTypography-root': {
                fontFamily: 'Poppins, sans-serif',
              }
            }}
          >
            <ListItemIcon>
              <BusinessIcon fontSize="small" sx={{ color: '#001F3F' }} />
            </ListItemIcon>
            <Box>
              <Typography color="#001F3F">Switch Company</Typography>
              <Typography 
                variant="caption" 
                color="#64748b"
                sx={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {selectedCompany?.name || 'No company selected'}
              </Typography>
            </Box>
          </MenuItem>

          <Divider />

          <MenuItem 
            onClick={handleLogout} 
            sx={{ 
              py: 1.5,
              '& .MuiTypography-root': {
                fontFamily: 'Poppins, sans-serif',
              }
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} />
            </ListItemIcon>
            <Typography color="#ef4444">Logout</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>

      {/* Global style for Poppins font */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          
          * {
            font-family: 'Poppins', sans-serif !important;
          }
          
          .MuiTypography-root,
          .MuiMenuItem-root,
          .MuiChip-root,
          .MuiButton-root,
          .MuiInputBase-root,
          .MuiListItemText-root,
          .MuiListItemIcon-root {
            font-family: 'Poppins', sans-serif !important;
          }
        `}
      </style>
    </AppBar>
  );
};

export default Header;