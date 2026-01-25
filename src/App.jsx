import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './Auth/authcontext';
import ProtectedRoute from './Auth/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Dashboard';
import DashboardLayout from './Layout/DashboardLayout';
import GenerateInvoice from './Pages/GenerateInvoice';
import Material from './Pages/Material';
import ViewInvoice from './Pages/ViewInvoice';

// Create theme FIRST, outside component
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2196F3',
    },
    secondary: {
      main: '#FF4081',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// Create App component
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Home />} />
              <Route path="/generate-invoice" element={<GenerateInvoice />} />
              <Route path="/material" element={<Material />} />
              <Route path="/view-invoice" element={<ViewInvoice />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;