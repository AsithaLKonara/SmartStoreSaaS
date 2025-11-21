# QA Test Plans for Remaining Phases

**Created**: $(date)  
**Project**: SmartStoreSaaS  
**Status**: Test Plans Ready for Execution

---

## Overview

This document contains detailed test plans for QA phases that require manual testing or runtime verification. Each phase includes specific test cases, expected results, and commands/documentation needed for execution.

---

## Phase 3: Security Testing

### 3.1 Authentication & Authorization Testing

#### Test Cases:

**TC-AUTH-001: User Registration - Valid Data**
- **Action**: Register with valid data
- **Test Data**: 
  - Name: "Test User"
  - Email: "test@example.com"
  - Password: "Test1234!"
  - Organization: "Test Org"
- **Expected**: Registration succeeds, user created, redirected to dashboard
- **Command**: `curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d '{"name":"Test User","email":"test@example.com","password":"Test1234!","organizationName":"Test Org"}'`
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-002: User Registration - Duplicate Email**
- **Action**: Register with existing email
- **Expected**: 409 Conflict, error message "User with this email already exists"
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-003: User Registration - Weak Password**
- **Action**: Register with password < 8 characters
- **Expected**: 400 Bad Request, error message "Password must be at least 8 characters long"
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-004: User Registration - Invalid Email Format**
- **Action**: Register with invalid email format
- **Expected**: 400 Bad Request, error message "Invalid email format"
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-005: User Login - Valid Credentials**
- **Action**: Login with correct email and password
- **Expected**: Login succeeds, session created, redirected to dashboard
- **Command**: `curl -X POST http://localhost:3000/api/auth/signin -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test1234!"}'`
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-006: User Login - Invalid Credentials**
- **Action**: Login with incorrect password
- **Expected**: 401 Unauthorized, error message "Invalid credentials"
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-007: OAuth Login - Google**
- **Action**: Login with Google OAuth
- **Expected**: OAuth flow completes, user logged in
- **Note**: Requires Google OAuth configuration
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-008: Session Expiration**
- **Action**: Wait for session to expire (24h configured)
- **Expected**: User logged out, redirected to login
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-009: JWT Token Validation**
- **Action**: Access protected route with invalid token
- **Expected**: 403 Forbidden, error message "Invalid token"
- **Status**: [ ] Pass [ ] Fail

**TC-AUTH-010: Token Blacklisting**
- **Action**: Logout, then try to use logged-out token
- **Expected**: 401 Unauthorized, error message "Token has been revoked"
- **Status**: [ ] Pass [ ] Fail

### 3.2 Input Validation & XSS Testing

#### Test Cases:

**TC-XSS-001: XSS in Product Name**
- **Action**: Create product with name: `<script>alert('XSS')</script>`
- **Expected**: Script tags sanitized or escaped, no alert displayed
- **Status**: [ ] Pass [ ] Fail

**TC-XSS-002: XSS in Product Description**
- **Action**: Create product with description: `<img src=x onerror=alert(1)>`
- **Expected**: Image tag sanitized, no alert displayed
- **Status**: [ ] Pass [ ] Fail

**TC-SQL-001: SQL Injection in Product Name**
- **Action**: Create product with name: `'; DROP TABLE users; --`
- **Expected**: String treated as literal, no SQL executed (Prisma ORM prevents this)
- **Status**: [ ] Pass [ ] Fail

**TC-PATH-001: Path Traversal in File Upload**
- **Action**: Upload file with name: `../../../etc/passwd`
- **Expected**: Path sanitized, file stored safely
- **Status**: [ ] Pass [ ] Fail

### 3.3 Rate Limiting Testing

#### Test Cases:

**TC-RATE-001: Rate Limit Enforcement**
- **Action**: Send 110 rapid requests to `/api/products`
- **Command**: `for i in {1..110}; do curl http://localhost:3000/api/products; done`
- **Expected**: First 100 requests succeed, requests 101-110 return 429 Too Many Requests
- **Status**: [ ] Pass [ ] Fail

**TC-RATE-002: Rate Limit Reset**
- **Action**: Wait for rate limit window, then send more requests
- **Expected**: Rate limit resets, requests succeed again
- **Status**: [ ] Pass [ ] Fail

### 3.4 Security Headers Testing

#### Test Cases:

**TC-HEADER-001: CORS Headers**
- **Action**: Check response headers for `/api/*` endpoints
- **Command**: `curl -I http://localhost:3000/api/products`
- **Expected**: CORS headers present (Access-Control-Allow-Origin, etc.)
- **Status**: [ ] Pass [ ] Fail

**TC-HEADER-002: Content Security Policy**
- **Action**: Check for CSP header
- **Expected**: CSP header present if configured
- **Status**: [ ] Pass [ ] Fail

**TC-HEADER-003: HTTPS Redirect**
- **Action**: Access production URL with HTTP
- **Expected**: Redirected to HTTPS
- **Status**: [ ] Pass [ ] Fail

---

## Phase 4: Error Handling & Resilience

### 4.1 Error Boundary Testing

#### Test Cases:

**TC-ERROR-001: React Error Boundary**
- **Action**: Trigger React error in component (e.g., access undefined property)
- **Expected**: Error boundary catches error, displays error UI
- **Status**: [ ] Pass [ ] Fail

**TC-ERROR-002: Error Logging**
- **Action**: Trigger error, check console/logs
- **Expected**: Error logged to console/error service
- **Status**: [ ] Pass [ ] Fail

**TC-ERROR-003: Production Error Handling**
- **Action**: Trigger error in production build
- **Expected**: Generic error message displayed, no sensitive info leaked
- **Status**: [ ] Pass [ ] Fail

### 4.2 API Error Handling Testing

#### Test Cases:

**TC-API-ERR-001: 401 Unauthorized**
- **Action**: Access protected endpoint without auth
- **Command**: `curl http://localhost:3000/api/products`
- **Expected**: 401 status, error message "Unauthorized"
- **Status**: [ ] Pass [ ] Fail

**TC-API-ERR-002: 400 Bad Request**
- **Action**: Send invalid request data
- **Command**: `curl -X POST http://localhost:3000/api/products -H "Content-Type: application/json" -d '{}'`
- **Expected**: 400 status, error message describing missing fields
- **Status**: [ ] Pass [ ] Fail

**TC-API-ERR-003: 404 Not Found**
- **Action**: Access non-existent endpoint
- **Command**: `curl http://localhost:3000/api/nonexistent`
- **Expected**: 404 status, error message "Route not found"
- **Status**: [ ] Pass [ ] Fail

**TC-API-ERR-004: 500 Internal Server Error**
- **Action**: Trigger database connection failure
- **Expected**: 500 status, generic error message (no sensitive info)
- **Status**: [ ] Pass [ ] Fail

**TC-API-ERR-005: Transaction Rollback**
- **Action**: Create order with insufficient stock
- **Expected**: Transaction rolls back, no partial data saved
- **Status**: [ ] Pass [ ] Fail

### 4.3 Circuit Breaker Testing

#### Test Cases:

**TC-CB-001: Circuit Breaker Activation**
- **Action**: Simulate service failures (5+ consecutive failures)
- **Expected**: Circuit breaker opens after threshold
- **Status**: [ ] Pass [ ] Fail

**TC-CB-002: Circuit Breaker Recovery**
- **Action**: Wait for timeout, then send successful request
- **Expected**: Circuit breaker closes, requests succeed
- **Status**: [ ] Pass [ ] Fail

---

## Phase 5: Input Validation

### 5.1 Form Validation Testing

#### Test Cases:

**TC-FORM-001: Required Fields**
- **Action**: Submit form without required fields
- **Expected**: Validation errors displayed, form not submitted
- **Status**: [ ] Pass [ ] Fail

**TC-FORM-002: Email Format Validation**
- **Action**: Enter invalid email format
- **Expected**: Error message "Invalid email format"
- **Status**: [ ] Pass [ ] Fail

**TC-FORM-003: Number Validation - Negative**
- **Action**: Enter negative price/quantity
- **Expected**: Error message "Value must be positive"
- **Status**: [ ] Pass [ ] Fail

**TC-FORM-004: SKU Uniqueness**
- **Action**: Create product with existing SKU
- **Expected**: Error message "SKU already exists"
- **Status**: [ ] Pass [ ] Fail

### 5.2 API Input Validation Testing

#### Test Cases:

**TC-API-VAL-001: CSV Import Validation**
- **Action**: Upload CSV with invalid data
- **Expected**: Validation errors shown, invalid rows highlighted
- **Status**: [ ] Pass [ ] Fail

**TC-API-VAL-002: Excel Import Validation**
- **Action**: Upload Excel with invalid data
- **Expected**: Validation errors shown
- **Status**: [ ] Pass [ ] Fail

**TC-API-VAL-003: File Upload - Type Restriction**
- **Action**: Upload non-allowed file type
- **Expected**: Error message "File type not allowed"
- **Status**: [ ] Pass [ ] Fail

**TC-API-VAL-004: File Upload - Size Limit**
- **Action**: Upload file exceeding size limit
- **Expected**: Error message "File size exceeds limit"
- **Status**: [ ] Pass [ ] Fail

---

## Phase 6: Database & Data Integrity

### 6.1 Data Isolation Testing

#### Test Cases:

**TC-DB-001: Organization Data Isolation**
- **Action**: Create two test organizations, verify Org A cannot access Org B's data
- **Expected**: API routes return only current organization's data
- **Status**: [ ] Pass [ ] Fail

**TC-DB-002: Transaction Integrity**
- **Action**: Create order with transaction, simulate failure mid-transaction
- **Expected**: Transaction rolls back, no partial data saved
- **Status**: [ ] Pass [ ] Fail

**TC-DB-003: Foreign Key Constraints**
- **Action**: Try to delete organization with existing users
- **Expected**: Error or cascade delete as configured
- **Status**: [ ] Pass [ ] Fail

---

## Phase 7: Performance Testing

### 7.1 Frontend Performance

#### Test Cases:

**TC-PERF-001: Lighthouse Performance Score**
- **Action**: Run Lighthouse audit on production build
- **Expected**: Performance score > 80
- **Command**: Chrome DevTools > Lighthouse > Generate Report
- **Status**: [ ] Pass [ ] Fail

**TC-PERF-002: Lighthouse Accessibility Score**
- **Action**: Run Lighthouse accessibility audit
- **Expected**: Accessibility score > 90
- **Status**: [ ] Pass [ ] Fail

**TC-PERF-003: Bundle Size**
- **Action**: Check production build bundle size
- **Command**: `npm run build` and review output
- **Expected**: Bundle size reasonable (< 500KB main bundle)
- **Status**: [ ] Pass [ ] Fail

### 7.2 API Performance Testing

#### Test Cases:

**TC-API-PERF-001: Simple Query Response Time**
- **Action**: Time GET request to `/api/products`
- **Expected**: Response time < 200ms
- **Command**: `curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/products`
- **Status**: [ ] Pass [ ] Fail

**TC-API-PERF-002: Complex Query Response Time**
- **Action**: Time complex analytics query
- **Expected**: Response time < 1s
- **Status**: [ ] Pass [ ] Fail

**TC-API-PERF-003: Load Testing**
- **Action**: Send 100 concurrent requests
- **Expected**: All requests handled, response times acceptable
- **Status**: [ ] Pass [ ] Fail

---

## Phase 8: Accessibility Testing

### 8.1 Automated Accessibility Testing

#### Test Cases:

**TC-A11Y-001: Lighthouse Accessibility Audit**
- **Action**: Run Lighthouse accessibility audit
- **Expected**: Score > 90, no critical issues
- **Status**: [ ] Pass [ ] Fail

**TC-A11Y-002: axe DevTools Scan**
- **Action**: Run axe DevTools browser extension
- **Expected**: No critical violations
- **Status**: [ ] Pass [ ] Fail

### 8.2 Manual Accessibility Testing

#### Test Cases:

**TC-A11Y-003: Keyboard Navigation**
- **Action**: Navigate entire app using only keyboard (Tab, Enter, Escape)
- **Expected**: All interactive elements accessible, focus indicators visible
- **Status**: [ ] Pass [ ] Fail

**TC-A11Y-004: Screen Reader Testing**
- **Action**: Test with VoiceOver (Mac) or NVDA (Windows)
- **Expected**: All content readable, proper ARIA labels
- **Status**: [ ] Pass [ ] Fail

**TC-A11Y-005: Color Contrast**
- **Action**: Check text contrast ratios
- **Expected**: WCAG AA compliance (4.5:1 for normal text)
- **Status**: [ ] Pass [ ] Fail

**TC-A11Y-006: Alt Text on Images**
- **Action**: Check all images have alt text
- **Expected**: All images have descriptive alt text
- **Status**: [ ] Pass [ ] Fail

---

## Phase 10: Third-Party Integrations

### 10.1 Payment Gateway Testing

#### Test Cases:

**TC-INT-PAY-001: Stripe Payment Processing**
- **Action**: Process test payment with Stripe test keys
- **Expected**: Payment processed successfully, order created
- **Status**: [ ] Pass [ ] Fail

**TC-INT-PAY-002: Stripe Webhook Handling**
- **Action**: Send test webhook from Stripe
- **Expected**: Webhook received and processed correctly
- **Status**: [ ] Pass [ ] Fail

**TC-INT-PAY-003: PayPal Payment Processing**
- **Action**: Process test payment with PayPal sandbox
- **Expected**: Payment processed successfully
- **Status**: [ ] Pass [ ] Fail

**TC-INT-PAY-004: Payment Failure Handling**
- **Action**: Simulate declined card
- **Expected**: Error handled gracefully, user notified
- **Status**: [ ] Pass [ ] Fail

### 10.2 Messaging Service Testing

#### Test Cases:

**TC-INT-MSG-001: WhatsApp Message Sending**
- **Action**: Send test WhatsApp message
- **Expected**: Message sent successfully
- **Status**: [ ] Pass [ ] Fail

**TC-INT-MSG-002: SMS Sending (Twilio)**
- **Action**: Send test SMS
- **Expected**: SMS sent successfully
- **Status**: [ ] Pass [ ] Fail

**TC-INT-MSG-003: Email Sending**
- **Action**: Send test email via SMTP
- **Expected**: Email sent successfully
- **Status**: [ ] Pass [ ] Fail

**TC-INT-MSG-004: Integration Failure Handling**
- **Action**: Simulate integration service failure
- **Expected**: Error handled gracefully, user notified
- **Status**: [ ] Pass [ ] Fail

---

## Phase 11: Deployment & Environment

### 11.1 Environment Variables Verification

#### Test Cases:

**TC-ENV-001: Required Environment Variables**
- **Action**: Check all required env vars are documented in env.example
- **Expected**: All required vars documented
- **Status**: [ ] Pass [ ] Fail

**TC-ENV-002: Missing Environment Variables**
- **Action**: Run app with missing required env vars
- **Expected**: App fails gracefully with clear error message
- **Status**: [ ] Pass [ ] Fail

**TC-ENV-003: Secrets in Code**
- **Action**: Search codebase for hardcoded secrets
- **Expected**: No secrets in code
- **Status**: [ ] Pass [ ] Fail

### 11.2 Docker Testing

#### Test Cases:

**TC-DOCKER-001: Docker Build**
- **Action**: Build Docker image
- **Command**: `npm run docker:build`
- **Expected**: Build succeeds
- **Status**: [ ] Pass [ ] Fail

**TC-DOCKER-002: Docker Compose Start**
- **Action**: Start all services
- **Command**: `npm run docker:up`
- **Expected**: All services start correctly
- **Status**: [ ] Pass [ ] Fail

**TC-DOCKER-003: Health Checks**
- **Action**: Check health endpoint after startup
- **Command**: `curl http://localhost:3000/api/health`
- **Expected**: 200 OK, health status returned
- **Status**: [ ] Pass [ ] Fail

### 11.3 Production Build Testing

#### Test Cases:

**TC-BUILD-001: Production Build**
- **Action**: Run production build
- **Command**: `npm run build`
- **Expected**: Build succeeds, no errors
- **Status**: [ ] Pass [ ] Fail

**TC-BUILD-002: Production Server Start**
- **Action**: Start production server
- **Command**: `npm start`
- **Expected**: Server starts, application accessible
- **Status**: [ ] Pass [ ] Fail

---

## Test Execution Log

### Date: _______________
### Tester: _______________

#### Summary:
- Total Test Cases: ___
- Passed: ___
- Failed: ___
- Pass Rate: ___%

#### Notes:
_____________________________________________________________

