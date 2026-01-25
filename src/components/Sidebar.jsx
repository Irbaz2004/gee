import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Typography,
  Avatar,
  ListItemButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  BarChart as AnalyticsIcon,
  ShoppingCart as OrdersIcon,
  People as UsersIcon,
  Inventory as ProductsIcon,
  Help as HelpIcon
  
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAuth } from '../Auth/authcontext';

const drawerWidth = 280;

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    height: '100vh',
    borderRight: '1px solid rgba(0, 31, 63, 0.43)',
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column',
  },
}));

const LogoContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  borderBottom: '1px solid rgba(0, 31, 63, 0.08)',
}));

const UserInfoBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: theme.spacing(3),
  backgroundColor: 'rgba(0, 31, 63, 0.02)',
  borderTop: '1px solid rgba(0, 31, 63, 0.08)',
  textAlign: 'center',
  marginBottom: theme.spacing(5),
  maxHeight: '10px',
}));

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Generate Invoice', icon: <AnalyticsIcon />, path: '/generate-invoice' },
  { text: 'Material', icon: <OrdersIcon />, path: '/material' },
  { text: 'View Invoice', icon: <ProductsIcon />, path: '/view-invoice' },
  
];

const Sidebar = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if a menu item is active
  const isActive = (itemPath) => {
    if (itemPath === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(itemPath);
  };

  // Handle menu item click
  const handleMenuItemClick = (path) => {
    navigate(path);
  };

  return (
    <StyledDrawer
      variant="permanent"
      open={open}
      sx={{
        display: { xs: open ? 'block' : 'none', md: 'block' },
      }}
    >
      {/* Main Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', py: 2, mt: 8, backgroundColor: '#ffffff' }}>
        <List sx={{ px: 1 }}>
          {menuItems.map((item) => {
            const active = isActive(item.path);
            
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={active}
                  onClick={() => handleMenuItemClick(item.path)}
                  sx={{
                    mx: 1.5,
                    borderRadius: 2,
                    minHeight: 48,
                    transition: 'all 0.2s ease-in-out',
                    position: 'relative',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 31, 63, 0.04)',
                      transform: 'translateX(4px)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(0, 31, 63, 0.08)',
                      borderLeft: '4px solid #001F3F',
                      ml: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(0, 31, 63, 0.12)',
                      },
                    },
                  }}
                >
                  {/* Active indicator */}
                  {active && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 4,
                        height: '60%',
                        backgroundColor: '#001F3F',
                        borderRadius: '0 2px 2px 0',
                      }}
                    />
                  )}
                  
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: active ? '#001F3F' : 'text.secondary',
                      transition: 'color 0.2s ease-in-out',
                      '& svg': {
                        fontSize: active ? '1.3rem' : '1.25rem',
                      }
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: active ? 700 : 500,
                      color: active ? '#001F3F' : 'text.primary',
                      fontSize: active ? '0.95rem' : '0.9rem',
                      letterSpacing: active ? '0.3px' : '0.2px',
                    }}
                  />
                  
                  {/* Active page indicator dot */}
                  {active && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        backgroundColor: '#001F3F',
                        borderRadius: '50%',
                        ml: 1,
                        mr: 1,
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Fixed Bottom User Info Bar */}
      <UserInfoBar>
        <Box display={'flex'} alignContent={'center'} alignItems={'center'}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              backgroundColor: '#001F3F',
              color: 'white',
              fontWeight: 600,
              fontSize: '1.1rem',
              mr: 2,
              border: '2px solid rgba(0, 31, 63, 0.1)',
            }}
          >
            {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ textAlign: 'left' }}>
            <Typography
              variant="body2"
              fontWeight={600}
              color="#001F3F"
              sx={{ mb: 0.5 }}
            >
              {currentUser?.displayName || 'Admin User'}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              fontSize={11}
            >
              {currentUser?.email || 'admin@galaxy.com'}
            </Typography>
          </Box>
        </Box>
      </UserInfoBar>
    </StyledDrawer>
  );
};

export default Sidebar;