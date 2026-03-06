import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  AccountCircle as AccountCircleIcon,
  Business as BusinessIcon,
  Groups as GroupsIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {  onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../config';
import { useCompany } from '../context/CompanyContext';
import { getCompanyCollection } from '../utils/firestoreUtils';

// Styled components with Poppins font
const StyledCard = styled(Card)(() => ({
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
  backgroundColor: 'white',
  transition: 'transform 0.3s',
  fontFamily: '"Poppins", sans-serif',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
}));

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <StyledCard>
    <CardContent>
      <Box display="flex" alignItems="center" gap={2}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            backgroundColor: `${color}15`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </Box>
        <Box flex={1}>
          <Typography 
            color="textSecondary" 
            variant="body2" 
            sx={{ 
              opacity: 0.8, 
              fontSize: '0.875rem',
              fontFamily: '"Poppins", sans-serif',
              fontWeight: 400
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h5" 
            fontWeight="bold" 
            sx={{ 
              color: '#001F3F',
              fontFamily: '"Poppins", sans-serif',
              fontWeight: 600
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography 
              variant="caption" 
              color="textSecondary" 
              sx={{ 
                display: 'block', 
                mt: 0.5,
                fontFamily: '"Poppins", sans-serif',
                fontWeight: 400
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </StyledCard>
);

export default function Home() {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [uniqueCompaniesCount, setUniqueCompaniesCount] = useState(0);
  const [dailyInvoiceData, setDailyInvoiceData] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [invoiceDates, setInvoiceDates] = useState([]);

  // Fetch all data from Firebase
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!selectedCompany) return;

      try {
        setLoading(true);

        // Fetch materials count
        const materialsRef = getCompanyCollection(db, selectedCompany.id, 'materials');
        const materialsSnapshot = await getDocs(materialsRef);
        setMaterialsCount(materialsSnapshot.size);

        // Fetch invoices
        const invoicesRef = getCompanyCollection(db, selectedCompany.id, 'invoices');
        const unsubscribe = onSnapshot(invoicesRef, (snapshot) => {
          const invoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          setInvoicesCount(invoices.length);

          // Count unique companies/clients
          const uniqueCompanies = new Set();
          invoices.forEach(invoice => {
            if (invoice.clientName) {
              uniqueCompanies.add(invoice.clientName.trim().toUpperCase());
            }
          });
          setUniqueCompaniesCount(uniqueCompanies.size);

          // Get recent 5 invoices
          const sortedInvoices = [...invoices].sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) :
              a.invoiceDate ? new Date(a.invoiceDate) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp) :
              b.invoiceDate ? new Date(b.invoiceDate) : new Date(0);
            return dateB - dateA;
          });
          setRecentInvoices(sortedInvoices.slice(0, 5));

          // Process daily invoice data
          const dailyCounts = {};
          const clientInvoiceCount = {};
          const allDates = [];

          invoices.forEach(invoice => {
            // Get date from invoice
            let invoiceDate;

            if (invoice.timestamp) {
              invoiceDate = new Date(invoice.timestamp);
            } else if (invoice.invoiceDate) {
              invoiceDate = new Date(invoice.invoiceDate);
            } else if (invoice.date) {
              invoiceDate = new Date(invoice.date);
            } else {
              invoiceDate = new Date();
            }

            // Format date to YYYY-MM-DD
            const dateStr = invoiceDate.toISOString().split('T')[0];
            allDates.push(dateStr);

            // Count invoices per day (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            if (invoiceDate >= sevenDaysAgo) {
              const dayName = invoiceDate.toLocaleDateString('en-US', { weekday: 'short' });
              dailyCounts[dayName] = (dailyCounts[dayName] || 0) + 1;
            }

            // Count invoices per client
            if (invoice.clientName) {
              const clientName = invoice.clientName.trim();
              clientInvoiceCount[clientName] = (clientInvoiceCount[clientName] || 0) + 1;
            }
          });

          // Prepare daily invoice data for chart
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
          }).reverse();

          const chartData = last7Days.map(day => ({
            day,
            invoices: dailyCounts[day] || 0,
            color: dailyCounts[day] > 0 ? '#001F3F' : '#e0e0e0'
          }));

          setDailyInvoiceData(chartData);

          // Prepare top clients data
          const topClientsData = Object.entries(clientInvoiceCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          setTopClients(topClientsData);

          // Set all invoice dates
          setInvoiceDates([...new Set(allDates)].sort().reverse().slice(0, 10));

          setLoading(false);
        }, (error) => {
          console.error('Error fetching invoices:', error);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedCompany]);

  const formatCurrency = (amount) => {
    if (!amount) return '₹ 0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.log('Error formatting date:', error);
    }
  };

  const getInvoiceAmount = (invoice) => {
    if (invoice.totals && invoice.totals.total) {
      return invoice.totals.total;
    } else if (invoice.total) {
      return invoice.total;
    } else if (invoice.amount) {
      return invoice.amount;
    } else {
      if (invoice.materials && Array.isArray(invoice.materials)) {
        return invoice.materials.reduce((sum, item) => sum + (item.amount || 0), 0);
      }
      return 0;
    }
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        backgroundColor: 'white',
        borderRadius: 2,
        p: 3
      }}>
        <CircularProgress sx={{ color: '#001F3F' }} />
      </Box>
    );
  }

  return (
    <Box sx={{
      backgroundColor: 'white',
      borderRadius: 2,
      p: 3,
      minHeight: '100vh',
      fontFamily: '"Poppins", sans-serif'
    }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          fontWeight="bold" 
          color="#001F3F" 
          gutterBottom
          sx={{ 
            fontFamily: '"Poppins", sans-serif',
            fontWeight: 600
          }}
        >
          Dashboard Overview
        </Typography>
        <Typography 
          variant="body1" 
          color="textSecondary"
          sx={{ 
            fontFamily: '"Poppins", sans-serif',
            fontWeight: 400
          }}
        >
          Real-time insights into your business operations
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3} minWidth={'250px'}>
          <StatCard
            title="Total Materials"
            value={materialsCount}
            icon={<InventoryIcon sx={{ fontSize: 28 }} />}
            color="#2196F3"
            subtitle="In inventory"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} minWidth={'250px'}>
          <StatCard
            title="Total Invoices"
            value={invoicesCount}
            icon={<ReceiptIcon sx={{ fontSize: 28 }} />}
            color="#9C27B0"
            subtitle="All time"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} minWidth={'250px'}>
          <StatCard
            title="Total Companies"
            value={uniqueCompaniesCount}
            icon={<BusinessIcon sx={{ fontSize: 28 }} />}
            color="#4CAF50"
            subtitle="Clients served"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} minWidth={'250px'}>
          <StatCard
            title="Active Clients"
            value={topClients.length > 0 ? topClients.length : 0}
            icon={<GroupsIcon sx={{ fontSize: 28 }} />}
            color="#FF9800"
            subtitle="With invoices"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Daily Invoices Chart */}
        <Grid item xs={12} minWidth={'1070px'}>
          <StyledCard>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                  <Typography 
                    variant="h6" 
                    fontWeight="bold" 
                    color="#001F3F"
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 600
                    }}
                  >
                    Daily Invoices Created
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="textSecondary"
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 400
                    }}
                  >
                    Invoices created per day (Last 7 days)
                  </Typography>
                </Box>
                <Chip
                  icon={<CalendarIcon />}
                  label={`Total: ${invoicesCount}`}
                  size="small"
                  sx={{ 
                    backgroundColor: '#001F3F', 
                    color: 'white', 
                    fontWeight: 600,
                    fontFamily: '"Poppins", sans-serif'
                  }}
                />
              </Box>
              <Box sx={{ height: 300 }}>
                {dailyInvoiceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyInvoiceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666', fontFamily: '"Poppins", sans-serif' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666', fontFamily: '"Poppins", sans-serif' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} invoices`, 'Count']}
                        labelStyle={{ 
                          color: '#001F3F', 
                          fontWeight: 600,
                          fontFamily: '"Poppins", sans-serif'
                        }}
                        contentStyle={{ 
                          borderRadius: 8, 
                          border: '1px solid #e0e0e0',
                          fontFamily: '"Poppins", sans-serif'
                        }}
                      />
                      <Bar
                        dataKey="invoices"
                        radius={[6, 6, 0, 0]}
                        name="Number of Invoices"
                      >
                        {dailyInvoiceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#999'
                  }}>
                    <ReceiptIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography 
                      variant="body1" 
                      color="textSecondary"
                      sx={{ 
                        fontFamily: '"Poppins", sans-serif',
                        fontWeight: 400
                      }}
                    >
                      No invoice data available
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="textSecondary"
                      sx={{ 
                        fontFamily: '"Poppins", sans-serif',
                        fontWeight: 400
                      }}
                    >
                      Create invoices to see data here
                    </Typography>
                  </Box>
                )}
              </Box>
              {invoiceDates.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography 
                    variant="caption" 
                    color="textSecondary" 
                    display="block" 
                    gutterBottom
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 400
                    }}
                  >
                    Recent Invoice Dates:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {invoiceDates.map((date, index) => (
                      <Chip
                        key={index}
                        label={date}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.75rem',
                          fontFamily: '"Poppins", sans-serif'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* Top Clients by Invoice Count */}
        <Grid item xs={12} md={6} minWidth={'450px'}>
          <StyledCard sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography 
                  variant="h6" 
                  fontWeight="bold" 
                  color="#001F3F"
                  sx={{ 
                    fontFamily: '"Poppins", sans-serif',
                    fontWeight: 600
                  }}
                >
                  Top Clients
                </Typography>
                <Chip
                  label={`${topClients.length} Clients`}
                  size="small"
                  sx={{ 
                    backgroundColor: '#f5f5f5', 
                    fontWeight: 600,
                    fontFamily: '"Poppins", sans-serif'
                  }}
                />
              </Box>
              <Typography 
                variant="body2" 
                color="textSecondary" 
                gutterBottom
                sx={{ 
                  fontFamily: '"Poppins", sans-serif',
                  fontWeight: 400
                }}
              >
                Clients with most invoices
              </Typography>

              {topClients.length > 0 ? (
                <List dense>
                  {topClients.map((client, index) => (
                    <React.Fragment key={client.name}>
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemAvatar>
                          <Avatar sx={{
                            bgcolor: index === 0 ? '#FFD700' :
                              index === 1 ? '#C0C0C0' :
                                index === 2 ? '#CD7F32' : '#001F3F20',
                            color: index < 3 ? '#001F3F' : '#666',
                            fontWeight: 600,
                            fontSize: 14,
                            fontFamily: '"Poppins", sans-serif'
                          }}>
                            {index + 1}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              fontWeight={600} 
                              sx={{ 
                                color: '#001F3F',
                                fontFamily: '"Poppins", sans-serif',
                                fontWeight: 600
                              }}
                            >
                              {client.name}
                            </Typography>
                          }
                          secondary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <ReceiptIcon sx={{ fontSize: 14, color: '#666' }} />
                              <Typography 
                                variant="caption" 
                                color="textSecondary"
                                sx={{ 
                                  fontFamily: '"Poppins", sans-serif',
                                  fontWeight: 400
                                }}
                              >
                                {client.count} invoices
                              </Typography>
                            </Box>
                          }
                        />
                        <Chip
                          label={client.count}
                          size="small"
                          sx={{
                            backgroundColor: '#001F3F',
                            color: 'white',
                            fontWeight: 600,
                            minWidth: 40,
                            fontFamily: '"Poppins", sans-serif'
                          }}
                        />
                      </ListItem>
                      {index < topClients.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 6,
                  color: '#999'
                }}>
                  <AccountCircleIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                  <Typography 
                    variant="body1" 
                    color="textSecondary"
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 400
                    }}
                  >
                    No client data available
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="textSecondary"
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 400
                    }}
                  >
                    Create invoices to see client data
                  </Typography>
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Recent Invoices */}
        <Grid item xs={12} md={6} minWidth={'600px'}>
          <StyledCard sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography 
                  variant="h6" 
                  fontWeight="bold" 
                  color="#001F3F"
                  sx={{ 
                    fontFamily: '"Poppins", sans-serif',
                    fontWeight: 600
                  }}
                >
                  Recent Invoices
                </Typography>
                <Chip
                  label="Last 5"
                  size="small"
                  sx={{ 
                    backgroundColor: '#f5f5f5', 
                    fontWeight: 600,
                    fontFamily: '"Poppins", sans-serif'
                  }}
                />
              </Box>
              <Typography 
                variant="body2" 
                color="textSecondary" 
                gutterBottom
                sx={{ 
                  fontFamily: '"Poppins", sans-serif',
                  fontWeight: 400
                }}
              >
                Latest invoice transactions
              </Typography>

              {recentInvoices.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#001F3F' }}>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.875rem', 
                          color: 'white',
                          fontFamily: '"Poppins", sans-serif'
                        }}>
                          Client
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.875rem', 
                          color: 'white',
                          fontFamily: '"Poppins", sans-serif'
                        }} align="right">
                          Amount
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.875rem', 
                          color: 'white',
                          fontFamily: '"Poppins", sans-serif'
                        }}>
                          Invoice No
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.875rem', 
                          color: 'white',
                          fontFamily: '"Poppins", sans-serif'
                        }}>
                          Date
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentInvoices.map((invoice) => (
                        <TableRow
                          key={invoice.id}
                          hover
                          sx={{
                            '&:last-child td, &:last-child th': { border: 0 },
                            '&:hover': { backgroundColor: '#f9f9f9' }
                          }}
                        >
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <AccountCircleIcon sx={{ color: '#666', mr: 1, fontSize: 18 }} />
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 500, 
                                  fontSize: '0.875rem',
                                  fontFamily: '"Poppins", sans-serif',
                                }}
                              >
                                {invoice.clientName || 'Unnamed Client'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              fontWeight={600} 
                              sx={{ 
                                color: '#001F3F', 
                                fontSize: '0.875rem',
                                fontFamily: '"Poppins", sans-serif',
                                fontWeight: 600
                              }}
                            >
                              {formatCurrency(getInvoiceAmount(invoice))}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={invoice.invoiceNumber || invoice.BillNo || 'N/A'}
                              size="small"
                              sx={{
                                backgroundColor: '#001F3F15',
                                color: '#001F3F',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                height: 24,
                                fontFamily: '"Poppins", sans-serif'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography 
                              variant="body2" 
                              color="textSecondary" 
                              sx={{ 
                                fontSize: '0.875rem',
                                fontFamily: '"Poppins", sans-serif',
                                fontWeight: 400
                              }}
                            >
                              {formatDate(invoice.invoiceDate || invoice.timestamp)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 6,
                  color: '#999'
                }}>
                  <ReceiptIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                  <Typography 
                    variant="body1" 
                    color="textSecondary"
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 400
                    }}
                  >
                    No recent invoices
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="textSecondary"
                    sx={{ 
                      fontFamily: '"Poppins", sans-serif',
                      fontWeight: 400
                    }}
                  >
                    Create your first invoice to get started
                  </Typography>
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>
    </Box>
  );
}