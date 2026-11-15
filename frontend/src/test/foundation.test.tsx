import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from '../app/App';
import { formatINR, formatIndianNumber, formatPercentDelta } from '../lib/formatters/currency';
import { ApiError } from '../lib/api/errors';

describe('TradeWise Frontend Foundation', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Formatting Utilities', () => {
    it('formats Indian currency properly with ₹ symbol and two decimal places', () => {
      expect(formatINR(1234567.89)).toBe('₹12,34,567.89');
      expect(formatINR(0)).toBe('₹0.00');
      expect(formatINR(-500)).toBe('-₹500.00');
    });

    it('formats Indian numbering system properly with custom and default decimals', () => {
      expect(formatIndianNumber(10000000, 0)).toBe('1,00,00,000');
      expect(formatIndianNumber(123456, 0)).toBe('1,23,456');
      expect(formatIndianNumber(123456.78)).toBe('1,23,456.78');
    });

    it('formats percentage deltas with sign and 2 decimal places', () => {
      expect(formatPercentDelta(5.2)).toBe('+5.20%');
      expect(formatPercentDelta(-3.14)).toBe('-3.14%');
      expect(formatPercentDelta(0)).toBe('0.00%');
    });
  });

  describe('API Error Handling', () => {
    it('creates ApiError instances with status code, message, and error details', () => {
      const err = new ApiError(401, {
        message: 'Unauthorized access',
        code: 'UNAUTHORIZED',
        details: { reason: 'session_expired' },
      });
      expect(err.name).toBe('ApiError');
      expect(err.message).toBe('Unauthorized access');
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.details).toEqual({ reason: 'session_expired' });
    });
  });

  describe('Application Shell & Theme Integration', () => {
    it('renders the foundation bootstrap page with correct heading', async () => {
      render(<App />);
      expect(screen.getByText('Foundation Active')).toBeInTheDocument();
      expect(screen.getByText('Frontend Foundation Reconstructed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Switch to/i })).toBeInTheDocument();
    });

    it('toggles theme between dark and light, updates localStorage and data-theme', async () => {
      const user = userEvent.setup();
      render(<App />);

      const toggleButton = screen.getByRole('button', { name: /Switch to/i });
      const initialTheme = document.documentElement.getAttribute('data-theme');
      expect(['light', 'dark']).toContain(initialTheme);

      await user.click(toggleButton);

      const updatedTheme = document.documentElement.getAttribute('data-theme');
      expect(updatedTheme).not.toBe(initialTheme);
      expect(localStorage.getItem('tradewise_theme')).toBe(updatedTheme);
    });
  });
});
