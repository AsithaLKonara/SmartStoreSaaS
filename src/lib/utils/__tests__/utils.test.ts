import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhoneNumber,
  isValidEmail,
  isValidPhone,
  generateOrderNumber,
  generateSKU,
  debounce,
  throttle,
  formatFileSize,
  generateSlug,
  truncateText,
  capitalize,
  toTitleCase,
  generateRandomString,
  deepClone,
  isEmpty,
  getInitials,
  getStatusColor,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateNumber,
  validatePositiveNumber,
  chunk,
  unique,
  removeDuplicates,
  groupBy,
} from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'conditional', false && 'not-included');
      expect(result).toContain('base');
      expect(result).toContain('conditional');
      expect(result).not.toContain('not-included');
    });

    it('should handle undefined and null values', () => {
      const result = cn('base', undefined, null, 'valid');
      expect(result).toContain('base');
      expect(result).toContain('valid');
    });

    it('should handle empty strings', () => {
      const result = cn('base', '', 'valid');
      expect(result).toContain('base');
      expect(result).toContain('valid');
    });
  });

  describe('Currency formatting', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toContain('1,000');
      expect(formatCurrency(1000, 'USD')).toContain('$');
    });

    it('should handle decimal values', () => {
      expect(formatCurrency(99.99)).toContain('99.99');
    });
  });

  describe('Date formatting', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);
      expect(formatted).toBeDefined();
    });

    it('should format date-time correctly', () => {
      const date = new Date('2024-01-15T10:30:00');
      const formatted = formatDateTime(date);
      expect(formatted).toContain('2024');
      expect(formatted).toContain('10:30');
    });
  });

  describe('Phone number formatting', () => {
    it('should format phone number correctly', () => {
      expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
    });

    it('should handle invalid phone numbers', () => {
      expect(formatPhoneNumber('abc')).toBe('abc');
    });
  });

  describe('Email validation', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('Phone validation', () => {
    it('should validate correct phone numbers', () => {
      expect(isValidPhone('1234567890')).toBe(true);
      expect(isValidPhone('+1-234-567-8900')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abc')).toBe(false);
    });
  });

  describe('Order number generation', () => {
    it('should generate order number', () => {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toContain('ORD-');
      expect(orderNumber.length).toBeGreaterThan(10);
    });

    it('should generate unique order numbers', () => {
      const order1 = generateOrderNumber();
      const order2 = generateOrderNumber();
      expect(order1).not.toBe(order2);
    });
  });

  describe('SKU generation', () => {
    it('should generate SKU with default prefix', () => {
      const sku = generateSKU();
      expect(sku).toContain('SKU-');
    });

    it('should generate SKU with custom prefix', () => {
      const sku = generateSKU('PROD');
      expect(sku).toContain('PROD-');
    });
  });

  describe('Debounce function', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Throttle function', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('File size formatting', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toContain('KB');
      expect(formatFileSize(1048576)).toContain('MB');
    });
  });

  describe('Slug generation', () => {
    it('should generate slug from text', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('Test & Example!')).toBe('test-example');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Test@#$%^&*()')).toBe('test');
    });
  });

  describe('Text truncation', () => {
    it('should truncate long text', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...');
    });

    it('should not truncate short text', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });
  });

  describe('Capitalization', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
    });

    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
    });
  });

  describe('Random string generation', () => {
    it('should generate random string of specified length', () => {
      const str = generateRandomString(10);
      expect(str.length).toBe(10);
    });

    it('should generate unique strings', () => {
      const str1 = generateRandomString(10);
      const str2 = generateRandomString(10);
      expect(str1).not.toBe(str2);
    });
  });

  describe('Deep clone', () => {
    it('should deep clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });
  });

  describe('Empty check', () => {
    it('should detect empty objects', () => {
      expect(isEmpty({})).toBe(true);
      expect(isEmpty({ a: 1 })).toBe(false);
    });

    it('should detect empty arrays', () => {
      expect(isEmpty([])).toBe(true);
      expect(isEmpty([1])).toBe(false);
    });

    it('should detect null and undefined', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });
  });

  describe('Initials', () => {
    it('should get initials from name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('John')).toBe('J');
    });
  });

  describe('Status color', () => {
    it('should return correct color for status', () => {
      expect(getStatusColor('delivered')).toBe('green');
      expect(getStatusColor('cancelled')).toBe('red');
      expect(getStatusColor('pending')).toBe('yellow');
    });
  });

  describe('Validation helpers', () => {
    it('should validate required fields', () => {
      expect(validateRequired('value')).toBe(true);
      expect(validateRequired('')).toBe(false);
      expect(validateRequired(null)).toBe(false);
    });

    it('should validate min length', () => {
      expect(validateMinLength('hello', 3)).toBe(true);
      expect(validateMinLength('hi', 3)).toBe(false);
    });

    it('should validate max length', () => {
      expect(validateMaxLength('hello', 10)).toBe(true);
      expect(validateMaxLength('hello world', 5)).toBe(false);
    });

    it('should validate numbers', () => {
      expect(validateNumber(123)).toBe(true);
      expect(validateNumber('123')).toBe(true);
      expect(validateNumber('abc')).toBe(false);
    });

    it('should validate positive numbers', () => {
      expect(validatePositiveNumber(5)).toBe(true);
      expect(validatePositiveNumber(-5)).toBe(false);
      expect(validatePositiveNumber(0)).toBe(false);
    });
  });

  describe('Array utilities', () => {
    it('should chunk array', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(chunk(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should get unique values', () => {
      const arr = [1, 2, 2, 3, 3, 3];
      expect(unique(arr)).toEqual([1, 2, 3]);
    });

    it('should remove duplicates', () => {
      const arr = [1, 2, 2, 3, 3, 3];
      expect(removeDuplicates(arr)).toEqual([1, 2, 3]);
    });

    it('should group by key', () => {
      const arr = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const grouped = groupBy(arr, 'category');
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
    });
  });
});

