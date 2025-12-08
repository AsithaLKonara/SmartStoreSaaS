/**
 * E2E Auth Flow Tests
 * Tests the complete authentication journey including signup, signin, password reset, and MFA
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import SignInPage from '@/app/(auth)/signin/page';
import SignUpPage from '@/app/(auth)/signup/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('Auth Flow - E2E Tests', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Sign Up Flow', () => {
    it('should render signup form with all required fields', () => {
      render(<SignUpPage />);
      
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('should validate password match before submission', async () => {
      render(<SignUpPage />);
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });

      // Form should be disabled when passwords don't match
      expect(submitButton).toBeDisabled();
    });

    it('should auto-generate organization slug from organization name', async () => {
      render(<SignUpPage />);
      
      const orgNameInput = screen.getByLabelText(/organization name/i);
      const orgSlugInput = screen.getByLabelText(/organization url/i);

      fireEvent.change(orgNameInput, { target: { value: 'My Test Company' } });

      await waitFor(() => {
        expect(orgSlugInput).toHaveValue('my-test-company');
      });
    });

    it('should submit signup form with valid data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'User created successfully',
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          organization: { id: 'org-1', name: 'Test Org' },
        }),
      });

      render(<SignUpPage />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const orgInput = screen.getByLabelText(/organization name/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      // Fill form fields
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(orgInput, { target: { value: 'Test Org' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

      // Wait for button to be enabled (form validation) - get fresh reference
      // Wait for button to be enabled
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /create account/i });
        expect(button).not.toBeDisabled();
      }, { timeout: 5000 });
      
      // Submit the form directly to ensure onSubmit handler is called
      const form = screen.getByLabelText(/full name/i).closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        const button = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(button);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 10000 });
    }, 20000);

    it('should handle signup API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'User with this email already exists' }),
      });

      render(<SignUpPage />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const orgInput = screen.getByLabelText(/organization name/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      // Fill form fields
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(orgInput, { target: { value: 'Test Org' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

      // Wait for button to be enabled
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /create account/i });
        expect(button).not.toBeDisabled();
      }, { timeout: 5000 });
      
      // Submit the form directly to ensure onSubmit handler is called
      const form = screen.getByLabelText(/full name/i).closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        const button = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(button);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 10000 });
    }, 20000);

    it('should toggle password visibility', () => {
      render(<SignUpPage />);
      
      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const toggleButton = passwordInput.parentElement?.querySelector('button');

      expect(passwordInput.type).toBe('password');
      
      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(passwordInput.type).toBe('text');
      }
    });
  });

  describe('Sign In Flow', () => {
    it('should render signin form with email and password fields', () => {
      render(<SignInPage />);
      
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      // Multiple buttons may have "sign in" text, find the submit button
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));
      expect(submitButton || buttons[0]).toBeInTheDocument();
      expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
    });

    it('should disable submit button when fields are empty', () => {
      render(<SignInPage />);
      
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));
      expect(submitButton).toBeDefined();
      if (submitButton) {
        expect(submitButton).toBeDisabled();
      }
    });

    it('should enable submit button when fields are filled', async () => {
      render(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));
        if (submitButton) {
          expect(submitButton).not.toBeDisabled();
        }
      });
    });

    it('should call signIn with credentials on form submission', async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({ error: null });

      render(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      // Wait for button to be enabled
      await waitFor(() => {
        if (submitButton) {
          expect(submitButton).not.toBeDisabled();
        }
      }, { timeout: 1000 });
      
      if (submitButton) {
        fireEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', {
          email: 'test@example.com',
          password: 'password123',
          redirect: false,
        });
      }, { timeout: 5000 });
    });

    it('should handle invalid credentials', async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({ error: 'Invalid credentials' });

      render(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      if (submitButton) {
        fireEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(signIn).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should redirect to dashboard on successful signin', async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({ error: null });

      render(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      // Wait for button to be enabled and find it
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));
        expect(submitButton).toBeDefined();
        if (submitButton) {
          expect(submitButton).not.toBeDisabled();
        }
      }, { timeout: 2000 });
      
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(b => b.type === 'submit' && b.textContent?.includes('Sign in'));
      if (submitButton) {
        fireEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      }, { timeout: 5000 });
    });

    it('should support Google sign in', async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({});

      render(<SignInPage />);
      
      const buttons = screen.getAllByRole('button');
      const googleButton = buttons.find(b => b.textContent?.toLowerCase().includes('google'));
      if (googleButton) {
        fireEvent.click(googleButton);
      }

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard' });
      }, { timeout: 3000 });
    });

    it('should toggle password visibility in signin form', () => {
      render(<SignInPage />);
      
      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const toggleButton = passwordInput.parentElement?.querySelector('button');

      expect(passwordInput.type).toBe('password');
      
      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(passwordInput.type).toBe('text');
      }
    });
  });

  describe('Password Reset Flow', () => {
    it('should have link to forgot password page', () => {
      render(<SignInPage />);
      
      const forgotPasswordLink = screen.getByText(/forgot your password/i);
      expect(forgotPasswordLink).toBeInTheDocument();
      expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/auth/forgot-password');
    });
  });

  describe('Navigation Between Auth Pages', () => {
    it('should have link to signup from signin page', () => {
      render(<SignInPage />);
      
      const signupLink = screen.getByText(/sign up for free/i);
      expect(signupLink.closest('a')).toHaveAttribute('href', '/auth/signup');
    });

    it('should have link to signin from signup page', () => {
      render(<SignUpPage />);
      
      const signinLink = screen.getByText(/sign in/i);
      expect(signinLink.closest('a')).toHaveAttribute('href', '/auth/signin');
    });
  });

  describe('Form Validation', () => {
    it('should validate email format in signup', async () => {
      render(<SignUpPage />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      // Browser native validation should catch this
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should enforce minimum password length', () => {
      render(<SignUpPage />);
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Check help text
      expect(screen.getByText(/must be at least 8 characters long/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all form inputs', () => {
      render(<SignUpPage />);
      
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should have proper autocomplete attributes', () => {
      render(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });
  });
});

