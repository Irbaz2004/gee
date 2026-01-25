import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../Auth/authcontext';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentPage, setCurrentPage] = useState('');
  const location = useLocation();

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleMenuClose();
  };

  // Get current time, date and greeting
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  const day = now.toLocaleDateString('en-US', { 
    weekday: 'long' 
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

  // Function to format page name from URL path
  const formatPageName = (pathname) => {
    if (pathname === '/') return 'Dashboard';
    
    // Remove leading slash and split by slashes
    const path = pathname.substring(1);
    if (!path) return 'Dashboard';
    
    // Split by slashes and take the first part
    const segments = path.split('/');
    const mainSegment = segments[0];
    
    // Format the page name
    const formattedName = mainSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Handle common page names
    const pageNames = {
      'dashboard': 'Dashboard',
      'inventory': 'Inventory Management',
      'products': 'Product Catalog',
      'orders': 'Order Management',
      'customers': 'Customer Management',
      'reports': 'Reports & Analytics',
      'settings': 'Settings',
      'profile': 'User Profile',
      'login': 'Login',
      'register': 'Register',
      'forgot-password': 'Forgot Password',
      'reset-password': 'Reset Password',
    };
    
    return pageNames[mainSegment.toLowerCase()] || formattedName || 'Page';
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
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        borderBottom: '1px solid rgba(0, 31, 63, 0.1)',
        display: 'flex',
      }}
    >
      <Toolbar sx={{ 
        minHeight: { xs: 64, sm: 72 },
        justifyContent: 'space-between',
      }}>
        {/* Left Section: Brand Name + Current Page */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexGrow: 1,
          gap: 3
        }}>
          {/* Brand Name with Border */}
          <Box sx={{ 
            textAlign: 'left',
            borderRight: '4px solid #001F3F', 
            pr: 3,
            minWidth: 220
          }}>
            <Typography 
              variant="h5" 
              component="div" 
              fontWeight={700}
              color="#001F3F"
              lineHeight={1.1}
              fontSize={28}
            >
              Galaxy
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              fontSize={14}
              fontWeight={500}
            >
              Electricals & Electronics
            </Typography>
          </Box>

          {/* Current Page Name */}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            minHeight: 60
          }}>
            <Typography 
              variant="h6" 
              component="div"
              fontWeight={600}
              color="#001F3F"
              sx={{
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  bottom: -8,
                  width: '40px',
                  height: '3px',
                  backgroundColor: '#001F3F',
                  borderRadius: '2px',
                }
              }}
            >
              {currentPage}
            </Typography>
          </Box>
        </Box>

        {/* Right Section: Time, Date, Greeting, User Avatar */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'center', 
          gap: 2
        }}>
          {/* Time */}
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              fontSize={17}
              fontWeight={500}
            >
              {time}
            </Typography>
          </Box>

          {/* Day & Date */}
          <Box sx={{ textAlign: 'center', minWidth: 140 }}>
            <Typography 
              variant="body2" 
              color="#001F3F" 
              fontWeight={500} 
              fontSize={17}
            >
              {day.slice(0, 3)}, {date}
            </Typography>
          </Box>

          {/* Greeting */}
          <Box sx={{ textAlign: 'center', minWidth: 120 }}>
            <Typography 
              variant="h6" 
              color="#001F3F" 
              fontWeight={600} 
              fontSize={17}
            >
              {greeting}
            </Typography>
          </Box>

          {/* User Avatar */}
          <Tooltip title="Account settings">
            <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#001F3F',
                  color: 'white',
                  fontWeight: 600,
                  border: '2px solid rgba(0, 31, 63, 0.1)',
                }}
              >
                {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
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
              minWidth: 220,
              borderRadius: 1,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
              border: '1px solid rgba(0, 31, 63, 0.08)',
            }
          }}
        >
          <MenuItem disabled sx={{ py: 2 }}>
            <ListItemIcon>
              <PersonIcon fontSize="small" sx={{ color: '#001F3F' }} />
            </ListItemIcon>
            <Box>
              <Typography variant="body2" fontWeight={600} color="#001F3F">
                {currentUser?.email || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Administrator
              </Typography>
            </Box>
          </MenuItem>
          
          <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: '#001F3F' }} />
            </ListItemIcon>
            <Typography color="#001F3F">Logout</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;