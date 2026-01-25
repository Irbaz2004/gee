import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline, Toolbar, Container } from '@mui/material';
import { styled } from '@mui/material/styles';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(2),
    backgroundColor: '#001F3F',
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: 0,
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 280,
    }),
    [theme.breakpoints.down('md')]: {
      marginLeft: 0,
    },
  }),
);

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Header onMenuClick={handleDrawerToggle} />
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Main open={mobileOpen}>
        <Toolbar />
        <Container maxWidth="xl" sx={{ mt: 3.2, mb: 2 }}>
          <Outlet />
        </Container>
      </Main>
    </Box>
  );
};

export default DashboardLayout;