# DawinOS v2.0 - Security Guide

## Overview

This document outlines the security architecture and best practices for DawinOS v2.0.

## Authentication

### Firebase Authentication

DawinOS uses Firebase Authentication with the following providers:

- **Email/Password**: Primary authentication method
- **Google Sign-In**: SSO for Google Workspace users

### Session Management

- Sessions are managed by Firebase Auth SDK
- Tokens automatically refresh
- Session persistence: `LOCAL` (survives browser restart)

### Multi-Factor Authentication

MFA can be enabled per user for enhanced security.

## Authorization

### Role-Based Access Control (RBAC)

| Role | Description | Permissions |
|------|-------------|-------------|
| `super_admin` | System administrator | Full access |
| `admin` | Subsidiary admin | Subsidiary-wide access |
| `ceo` | Executive | Strategy, reports, approvals |
| `hr_manager` | HR lead | HR module access |
| `finance_manager` | Finance lead | Financial module access |
| `manager` | Department manager | Team access |
| `employee` | Regular user | Self-service access |

### Permission Structure

Permissions follow the pattern: `module:action`

```
hr:read        - Read HR data
hr:write       - Create/update HR data
hr:admin       - Full HR access
hr:payroll     - Payroll access
hr:approve     - Approval authority
```

### Subsidiary Isolation

- All data is scoped to subsidiaries via `subsidiaryId`
- Users can only access data from their assigned subsidiary
- Cross-subsidiary access requires `super_admin` role

## Firestore Security Rules

### Rule Structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function hasPermission(permission) {
      return isAuthenticated() && 
        permission in getUserDoc().data.permissions;
    }
    
    function isSubsidiaryDoc() {
      return resource.data.subsidiaryId == 
        getUserDoc().data.subsidiaryId;
    }
    
    // Collection rules
    match /employees/{employeeId} {
      allow read: if hasPermission('hr:read') && isSubsidiaryDoc();
      allow write: if hasPermission('hr:write') && isSubsidiaryDoc();
    }
  }
}
```

### Key Security Patterns

1. **Authentication Required**: All rules require `isAuthenticated()`
2. **Permission Checks**: Actions require specific permissions
3. **Subsidiary Isolation**: Data access limited to user's subsidiary
4. **Audit Trail**: Critical collections are append-only

## Data Protection

### Sensitive Data

| Data Type | Protection |
|-----------|------------|
| Passwords | Managed by Firebase Auth (hashed) |
| Payroll | Restricted to `hr:payroll` permission |
| Personal Info | Restricted to HR and self |
| Financial | Restricted to `finance:*` permissions |

### Data at Rest

- Firestore data encrypted at rest by Google
- Storage files encrypted at rest

### Data in Transit

- All connections use HTTPS/TLS
- Firebase SDK handles secure connections

## Content Security Policy

The application enforces CSP headers:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https:;
connect-src 'self' https://*.firebaseio.com https://*.googleapis.com;
```

## Security Headers

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

## Audit Logging

### Logged Events

- User authentication (login/logout)
- Permission changes
- Data modifications (create/update/delete)
- Failed access attempts
- Administrative actions

### Audit Log Structure

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: object;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
  subsidiaryId: string;
}
```

### Log Retention

- Audit logs are immutable (no update/delete)
- Retained for 7 years for compliance

## Vulnerability Management

### Dependency Scanning

- Weekly npm audit via GitHub Actions
- Snyk integration for vulnerability detection
- CodeQL analysis on all PRs

### Security Scanning Workflow

```yaml
name: Security Scan
on:
  schedule:
    - cron: '0 6 * * 1'  # Weekly
  push:
    branches: [main, develop]
```

## Incident Response

### Security Issue Reporting

Report security issues to: security@dawingroup.com

### Response Process

1. **Triage**: Assess severity and impact
2. **Contain**: Limit damage if active exploit
3. **Investigate**: Determine root cause
4. **Remediate**: Deploy fixes
5. **Review**: Post-incident analysis

## Compliance

### Uganda Data Protection

DawinOS handles personal data in compliance with:

- Uganda Data Protection and Privacy Act
- Employee data retention requirements
- Financial record keeping requirements

### Best Practices

1. Collect only necessary data
2. Provide data access to subjects
3. Secure data transmission and storage
4. Maintain audit trails
5. Regular security reviews

## Security Checklist

### Development

- [ ] No hardcoded secrets in code
- [ ] Environment variables for sensitive config
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (Firestore handles this)
- [ ] XSS prevention (React handles this)

### Deployment

- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] No debug mode in production

### Monitoring

- [ ] Error tracking enabled (Sentry)
- [ ] Audit logging enabled
- [ ] Failed login monitoring
- [ ] Unusual activity alerts

## Contact

For security concerns, contact:
- **Security Team**: security@dawingroup.com
- **Emergency**: +256 XXX XXX XXX
