"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Mail, Lock, ArrowLeft } from 'lucide-react';
import PasswordField from "@/components/PasswordField";
import { validateSingleField } from "@shared/utils/validators";
import { 
  sendForgotPasswordEmail, 
  validateResetToken, 
  resetPassword 
} from '@/services/security/verificaitonService';

// Loading fallback komponent
function ResetPasswordLoading() {
  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif",
      backgroundColor: '#ffffff',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '40px',
        width: '100%',
        maxWidth: '600px',
        textAlign: 'center',
      }}>
        <h1 style={{
          color: '#2d3748',
          marginBottom: '20px',
          fontSize: '2rem'
        }}>Reset Password</h1>
        <p>Loading...</p>
      </div>
    </div>
  );
}

// Hovedlogikk komponent
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'request' | 'code' | 'password'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [tokenFromLink, setTokenFromLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hent token fra URL hvis det finnes
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setTokenFromLink(token);
      setStep('password'); // Hopp direkte til passord reset
    }
  }, [searchParams]);

  const showError = (message: string): void => {
    setError(message);
    setSuccess(null);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (message: string): void => {
    setSuccess(message);
    setError(null);
  };

  // Cooldown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestReset = async () => {
    if (!email.trim()) {
      showError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    try {
      const result = await sendForgotPasswordEmail(email);

      if (result.success) {
        showSuccess("Check your email for reset instructions with both a link and code! 📧");
        setStep('code');
        setResendCooldown(120);
      } else {
        showError(result.message);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        showError(error.message);
      } else {
        showError("Failed to send reset email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      showError("Please enter a 6-digit reset code");
      return;
    }

    setIsLoading(true);
    try {
      const result = await validateResetToken(code);

      if (result.isValid) {
        setStep('password');
      } else {
        showError("The reset code is invalid or expired. Please try again.");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        showError(error.message);
      } else {
        showError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    // Validation
    const passwordError = validateSingleField("password", newPassword);
    if (passwordError) {
      showError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const tokenOrCode = tokenFromLink || code;
      const result = await resetPassword(tokenOrCode, newPassword);

      if (result.success) {
        showSuccess("Your password has been updated successfully! ✅");
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        showError(result.message);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        showError(error.message);
      } else {
        showError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendResetEmail = async () => {
    if (resendCooldown > 0 || !email) return;
    await handleRequestReset();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getHeaderContent = () => {
    switch (step) {
      case 'request':
        return {
          icon: Key,
          title: 'Reset Password',
          subtitle: 'Enter your email to receive reset instructions'
        };
      case 'code':
        return {
          icon: Mail,
          title: 'Check Your Email',
          subtitle: 'Enter the 6-digit code we sent you'
        };
      case 'password':
        return {
          icon: Lock,
          title: 'Create New Password',
          subtitle: 'Choose a strong password for your account'
        };
    }
  };

  const headerContent = getHeaderContent();
  const IconComponent = headerContent.icon;

  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif",
      backgroundColor: '#ffffff',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '600px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Back Button */}
        <button
          onClick={() => router.push('/login')}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            marginBottom: '20px',
            fontSize: '16px'
          }}
        >
          <ArrowLeft size={20} style={{ marginRight: '8px' }} />
          Back to Login
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <div style={{
              backgroundColor: '#1C6B1C',
              borderRadius: '50%',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <IconComponent size={40} color="white" />
            </div>
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '8px'
          }}>
            {headerContent.title}
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#6b7280',
            marginBottom: step === 'code' ? '8px' : '0'
          }}>
            {headerContent.subtitle}
          </p>
          {step === 'code' && (
            <p style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#1C6B1C'
            }}>
              {email}
            </p>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: '8px',
            padding: '15px',
            margin: '20px 0',
            color: '#dc2626',
            textAlign: 'center'
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
            color: '#16a34a',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        {/* Step 1: Request Reset */}
        {step === 'request' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                Email Address:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '16px',
                  backgroundColor: '#f9fafb',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <button
              onClick={handleRequestReset}
              disabled={isLoading || !email.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: isLoading || !email.trim() ? '#9ca3af' : '#1C6B1C',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading || !email.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
              }}
            >
              {isLoading ? "Sending..." : "Send Reset Email"}
            </button>
          </div>
        )}

        {/* Step 2: Enter Code */}
        {step === 'code' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Enter reset code:
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '24px',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    letterSpacing: '4px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <button
                onClick={handleVerifyCode}
                disabled={code.length !== 6 || isLoading}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: code.length !== 6 || isLoading ? '#9ca3af' : '#1C6B1C',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: code.length !== 6 || isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>
            </div>

            <div style={{
              textAlign: 'center',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <p style={{ color: '#6b7280', marginBottom: '15px' }}>
                Didn&apos;t receive the email?
              </p>
              
              <button
                onClick={resendResetEmail}
                disabled={resendCooldown > 0 || isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  padding: '12px 24px',
                  border: `1px solid ${resendCooldown > 0 ? '#d1d5db' : '#1C6B1C'}`,
                  borderRadius: '8px',
                  background: resendCooldown > 0 ? '#f9fafb' : 'white',
                  color: resendCooldown > 0 ? '#9ca3af' : '#1C6B1C',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <span style={{ marginRight: '5px' }}>🔄</span>
                {resendCooldown > 0 ? `Resend in ${formatTime(resendCooldown)}` : 'Send Again'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Reset Password */}
        {step === 'password' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <PasswordField
              id="newPassword"
              label="New Password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(null);
              }}
              placeholder="Enter new password"
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="Confirm new password"
            />

            <button
              onClick={handleResetPassword}
              disabled={isLoading || !newPassword || !confirmPassword}
              style={{
                width: '100%',
                padding: '16px',
                background: isLoading || !newPassword || !confirmPassword ? '#9ca3af' : '#1C6B1C',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
              }}
            >
              {isLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Hovedkomponent med Suspense wrapper
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}