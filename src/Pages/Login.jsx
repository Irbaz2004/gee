import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    alpha,
    Link
} from '@mui/material';
import {
    EmailOutlined as EmailIcon,
    LockOutlined as LockIcon,
    Visibility,
    VisibilityOff,
    Login as LoginIcon
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';

const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const BackgroundContainer = styled(Box)({
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
    backgroundSize: '400% 400%',
    animation: `${gradientAnimation} 15s ease infinite`,
    padding: '20px',
});

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: '48px 40px',
    borderRadius: 24,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    backgroundColor: '#ffffff',
    width: 'auto', // Allows paper to grow based on minWidth of children
    maxWidth: 450,
    textAlign: 'center',
    [theme.breakpoints.down('sm')]: {
        padding: '32px 24px',
    }
}));

const PrimaryButton = styled(Button)({
    backgroundColor: '#0f172a',
    color: 'white',
    borderRadius: 12,
    height: 52,
    minWidth: 200, // Makes the button substantial
    fontSize: '1rem',
    textTransform: 'none',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    '&:hover': {
        backgroundColor: '#ffffff',
        color : '#0f172a',
        transform: 'translateY(-2px)',
        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
    },
});

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
                setError(result.error || 'Invalid credentials');
            }
        } catch (err) {
            setError('Connection failed. Please try again.');
            console.error('Login error:', err); 
        } finally {
            setLoading(false);
        }
    };

    return (
        <BackgroundContainer>
            <Fade in={true} timeout={1000}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <StyledPaper elevation={0}>
                        {/* Brand Section */}
                        <Box mb={5}>
                            <Typography
                                variant="h4"
                                sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: -1, mb: 0.5 }}
                            >
                                GALAXY
                            </Typography>
                            <Typography
                                variant="overline"
                                sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 2, display: 'block' }}
                            >
                                Electricals & Electronics
                            </Typography>
                        </Box>

                        {error && (
                            <Alert severity="error" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }}>
                                {error}
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit}>
                            <Grid container spacing={2.5} sx={{ minWidth: { xs: '100%', sm: 350 },justifyContent: 'center' }}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Email Address"
                                        variant="outlined"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 3,
                                                backgroundColor: alpha('#0f172a', 0.02),
                                                minWidth: { sm: 350 } // Minimum width for desktop/tablet
                                            }
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Password"
                                        type={showPassword ? 'text' : 'password'}
                                        variant="outlined"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 3,
                                                backgroundColor: alpha('#0f172a', 0.02),
                                                minWidth: { sm: 350 }
                                            }
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Grid>

                                {/* Centered Button Group */}
                                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                    <PrimaryButton
                                        type="submit"
                                        disabled={loading}
                                        startIcon={!loading && <LoginIcon />}
                                    >
                                        {loading ? 'Authenticating...' : 'Sign In'}
                                    </PrimaryButton>
                                </Grid>
                            </Grid>
                        </form>
                    </StyledPaper>

                    {/* Footer / Agency Credit */}
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography 
                            variant="body2" 
                            sx={{ color: alpha('#ffffff', 0.5), display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                            Developed by 
                            <Link 
                                href="https://ruzix.in" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                sx={{ 
                                    color: '#ffffff', 
                                    fontWeight: 700, 
                                    textDecoration: 'none',
                                    '&:hover': { textDecoration: 'underline' } 
                                }}
                            >
                                Ruzix
                            </Link>
                        </Typography>
                    </Box>
                </Box>
            </Fade>
        </BackgroundContainer>
    );
}