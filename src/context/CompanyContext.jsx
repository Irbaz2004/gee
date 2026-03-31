import React, { createContext, useState, useContext, useEffect } from 'react';

const CompanyContext = createContext();

export const useCompany = () => {
  return useContext(CompanyContext);
};

export const COMPANIES = [
  {
    id: 'galaxy',
    name: 'Galaxy Electricals & Electronics',
    logo: null
  },
  {
    id: 'faizan',
    name: 'FAIZAN ENTERPRISES',
    logo: null
  }
];

export const CompanyProvider = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We intentionally do NOT load from localStorage to force selection on every new session/reload
    // If you want persistence, uncomment the lines below:
    // const savedCompany = localStorage.getItem('selectedCompany');
    // if (savedCompany) {
    //   setSelectedCompany(JSON.parse(savedCompany));
    // }
    setLoading(false);
  }, []);

  const selectCompany = (companyId) => {
    const company = COMPANIES.find(c => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      // localStorage.setItem('selectedCompany', JSON.stringify(company)); // Disable persistence
    }
  };

  const clearCompany = () => {
    setSelectedCompany(null);
    localStorage.removeItem('selectedCompany');
  };

  const value = {
    selectedCompany,
    selectCompany,
    clearCompany,
    loading,
    companies: COMPANIES
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};
