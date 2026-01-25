import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../Auth/authcontext';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  IconButton,
  InputAdornment,
  Grid,
  Fade,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';

// Keyframes for the background animation
const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const BackgroundContainer = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(-45deg, #001F3F, #003366, #000814, #001d3d)',
  backgroundSize: '400% 400%',
  animation: `${gradientAnimation} 15s ease infinite`,
  padding: '16px',
});

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: '40px 30px',
  borderRadius: 16,
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
  backgroundColor: 'rgba(255, 255, 255, 1)',
  width: '100%',
  maxWidth: 450, // Limits width on desktop
  minWidth: 220, // Allows shrinking for 250px devices
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  [theme.breakpoints.down(300)]: {
    padding: '20px 15px', // Tighter padding for ultra-small screens
  }
}));

const NavyButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#001F3F',
  color: 'white',
  borderRadius: 8,
  height: 48,
  width: '100%',
  maxWidth: 250,
  padding: '0 24px',
  textTransform: 'none',
  fontWeight: 600,
  boxShadow: '0 2px 8px rgba(0, 31, 63, 0.2)',
  '&:hover': {
    backgroundColor: '#003366',
    boxShadow: '0 4px 12px rgba(0, 31, 63, 0.3)',
  },
}));

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Failed to login');
      }
    } catch (err) {
      setError('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <BackgroundContainer>
      <Fade in={true} timeout={800}>
        <StyledPaper elevation={0}>
          {/* Brand Header */}
          <Box textAlign="center" mb={3}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                color: '#001F3F',
                letterSpacing: 1,
                mb: 0,
                fontSize: { xs: '1.8rem', sm: '2.5rem' }
              }}
            >
              GALAXY
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontWeight: 600,
                color: '#666',
                letterSpacing: 2,
                textTransform: 'uppercase',
                mt: -0.5,
                mb: 3,
                fontSize: { xs: '0.6rem', sm: '0.75rem' }
              }}
            >
              Electricals & Electronics
            </Typography>
            
            <Typography 
              variant="h5" 
              fontWeight="700"
              color="#001F3F"
              sx={{ mb: 1 }}
            >
              Sign in
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2.5} direction="column">
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '& fieldset': { borderColor: 'rgba(0, 31, 63, 0.2)' },
                      '&:hover fieldset': { borderColor: '#001F3F' },
                      '&.Mui-focused fieldset': { borderColor: '#001F3F' },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleClickShowPassword}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '& fieldset': { borderColor: 'rgba(0, 31, 63, 0.2)' },
                      '&:hover fieldset': { borderColor: '#001F3F' },
                      '&.Mui-focused fieldset': { borderColor: '#001F3F' },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} display="flex" justifyContent="center" mt={1}>
                <NavyButton
                  type="submit"
                  disabled={loading}
                  startIcon={!loading && <LoginIcon />}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </NavyButton>
              </Grid>
            </Grid>
          </form>
        </StyledPaper>
      </Fade>
    </BackgroundContainer>
  );
}