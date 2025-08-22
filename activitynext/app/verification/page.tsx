"use client"
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { API_BASE_URL } from '@/constants/api/routes';

interface ApiResponse {
  success: boolean;
  message?: string;
  emailSent?: boolean;
}

export default function EmailVerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const email = searchParams.get('email') || 'user@example.com';
  const token = searchParams.get('token');

  const showError = (message: string): void => {
    setError(message);
    setSuccess('');
    setTimeout(() => setError(''), 5000);
  };

  const showSuccess = (message: string): void => {
    setSuccess(message);
    setError('');
  };

  const verifyWithToken = useCallback(async (tokenToVerify: string): Promise<void> => {
    setIsVerifying(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToVerify })
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        showSuccess('Email verified successfully! Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        showError(data.message || 'Invalid verification token');
      }
    } catch {
      showError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [router]);

  // Auto-verify if token in URL
  useEffect(() => {
    if (token) {
      verifyWithToken(token);
    }
  }, [token, verifyWithToken]);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const verifyCode = async (): Promise<void> => {
    if (code.length !== 6) {
      showError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code })
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        showSuccess('Email verified successfully! Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        showError(data.message || 'Invalid verification code');
      }
    } catch {
      showError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const resendEmail = async (): Promise<void> => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data: ApiResponse = await response.json();
      
      if (data.emailSent) {
        showSuccess(data.message || 'Verification email sent!');
        setResendCooldown(120); // 2 minutes
      } else {
        showError(data.message || 'Failed to send email');
      }
    } catch {
      showError('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const goToLogin = (): void => {
    router.push('/login');
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && code.length === 6) {
      verifyCode();
    }
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif",
      backgroundColor: '#ffffffff',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '40px',
        width: '100%',
        maxWidth: '800px', // ✅ Økt fra 500px til 800px
        textAlign: 'center',
      }}>
        <h1 style={{
          color: '#2d3748',
          marginBottom: '20px',
          fontSize: '2rem' // ✅ Større overskrift
        }}>Check Your Email</h1>

        {/* Error/Success Messages */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: '8px',
            padding: '15px',
            margin: '20px 0',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #1C6B1C',
            borderRadius: '8px',
            padding: '15px',
            margin: '20px 0',
            color: '#16a34a'
          }}>
            {success}
          </div>
        )}
        
        <div style={{
          background: '#f0fdf4',
          border: '2px solid #1C6B1C',
          borderRadius: '8px',
          padding: '30px', // ✅ Økt padding
          margin: '30px 0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <Mail size={80} color="white" style={{
              backgroundColor: '#1C6B1C',
              padding: '12px',
              borderRadius: '12px'
            }} />
          </div>
          <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>We&apos;ve sent a verification email to:</p>
          <div style={{
            fontWeight: 'bold',
            color: '#1C6B1C',
            fontSize: '1.2rem', // ✅ Større tekst for email
            wordBreak: 'break-word'
          }}>{email}</div>
        </div>

        {/* ✅ Responsivt grid layout for store skjermer */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr', // 2 kolonner på desktop
          gap: '20px',
          margin: '30px 0'
        }}>
          {/* Instruksjoner */}
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '25px',
            textAlign: 'left'
          }}>
            <h3 style={{ marginTop: 0, color: '#2d3748', fontSize: '1.3rem' }}>How to verify your account:</h3>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '15px 0',
              padding: '15px',
              background: 'white',
              borderRadius: '6px'
            }}>
              <div style={{
                background: '#1C6B1C',
                color: 'white',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>1</div>
              <div style={{ fontSize: '1rem' }}>
                <strong>Web Users:</strong> Click the &quot;Verify on Web&quot; button in the email
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '15px 0',
              padding: '15px',
              background: 'white',
              borderRadius: '6px'
            }}>
              <div style={{
                background: '#1C6B1C',
                color: 'white',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>2</div>
              <div style={{ fontSize: '1rem' }}>
                <strong>Mobile App:</strong> Click &quot;Open in App&quot; or enter the 6-digit code
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '15px 0',
              padding: '15px',
              background: 'white',
              borderRadius: '6px'
            }}>
              <div style={{
                background: '#1C6B1C',
                color: 'white',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>3</div>
              <div style={{ fontSize: '1rem' }}>
                <strong>Having trouble?</strong> Use the manual link at the bottom of the email
              </div>
            </div>
          </div>

          {/* Code input seksjon */}
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '25px'
          }}>
            <h4 style={{ marginTop: 0, fontSize: '1.3rem' }}>Mobile App Users</h4>
            <p style={{ fontSize: '1rem', marginBottom: '20px' }}>Enter the 6-digit code from your email:</p>
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              onKeyPress={handleKeyPress}
              placeholder="123456"
              style={{
                width: '100%',
                padding: '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '20px',
                textAlign: 'center',
                letterSpacing: '6px',
                fontFamily: 'monospace',
                margin: '15px 0',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={verifyCode}
              disabled={isVerifying || code.length !== 6}
              style={{
                background: isVerifying || code.length !== 6 ? '#9ca3af' : '#1C6B1C',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                cursor: isVerifying || code.length !== 6 ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                width: '100%',
                transition: 'background 0.3s',
                fontWeight: '600'
              }}
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        </div>

        {/* Bunnseksjon */}
        <div style={{
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', marginBottom: '20px' }}>Didn&apos;t receive the email?</p>
          
          <div style={{
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={resendEmail}
              disabled={resendCooldown > 0 || isResending}
              style={{
                background: resendCooldown > 0 || isResending ? '#9ca3af' : '#1C6B1C',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                cursor: resendCooldown > 0 || isResending ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                transition: 'background 0.3s',
                fontWeight: '600',
                minWidth: '150px'
              }}
            >
              {isResending ? 'Sending...' : 'Send Again'}
            </button>
            
            <button
              onClick={goToLogin}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background 0.3s',
                fontWeight: '600',
                minWidth: '150px'
              }}
            >
              Back to Login
            </button>
          </div>
          
          {resendCooldown > 0 && (
            <div style={{
              color: '#6b7280',
              fontSize: '14px',
              marginTop: '15px'
            }}>
              You can request a new email in {resendCooldown} seconds
            </div>
          )}
        </div>
      </div>
    </div>
  );
}