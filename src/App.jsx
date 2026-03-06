import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './Auth/authcontext';
import ProtectedRoute from './Auth/ProtectedRoute';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import CompanySelection from './Pages/CompanySelection';
import Login from './Pages/Login';
import Home from './Pages/Dashboard';
import DashboardLayout from './Layout/DashboardLayout';
import GenerateInvoice from './Pages/GenerateInvoice';
import Material from './Pages/Material';
import ViewInvoice from './Pages/ViewInvoice';
import AdminData from './Pages/AdminData';
import Client from './Pages/Client';
import Ledger from './Pages/Ledger';

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

// Component to ensure company is selected
const RequireCompany = ({ children }) => {
  const { selectedCompany, loading } = useCompany();
  const { currentUser } = useAuth();

  if (loading) return null; // Or a spinner

  if (currentUser && !selectedCompany) {
    return <Navigate to="/select-company" />;
  }

  return children;
};

// Create App component
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <CompanyProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/select-company"
                element={
                  <ProtectedRoute>
                    <CompanySelection />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RequireCompany>
                      <DashboardLayout />
                    </RequireCompany>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Home />} />
                <Route path="/generate-invoice" element={<GenerateInvoice />} />
                <Route path="/material" element={<Material />} />
                <Route path="/clients" element={<Client />} />
                <Route path="/view-invoice" element={<ViewInvoice />} />
                <Route path="/ledger" element={<Ledger />} />
                <Route path="/admin-data" element={<AdminData />} />
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </CompanyProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;