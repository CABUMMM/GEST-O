# Firestore Security Specification Audit

This document details the security specification in place for the Ipatinga Domiciliary Visits Manager application.

## 1. Safety-First Principle
A default-deny rule is declared globally for all paths:
```javascript
match /{document=**} {
  allow read, write: if false;
}
```

## 2. Secure Access Controllers
Custom reusable helper methods validate authentication context dynamically:
- `isSignedIn()`: Checks that the request contains an active authentication token.
- `isValidId(id)`: Prevents ID pollution attacks by specifying maximum length (128 char limit) and alphanumeric patterns.

## 3. Row-Level Rules Matrices
Each matching collection enforce custom conditions:

| Route Path | Read Permit | Create/Update Permit | Delete Permit | Size constraints | ID poisoned checks |
|---|---|---|---|---|---|
| `users/{userId}` | `isSignedIn()` | `isSignedIn()` | `isSignedIn()` | Size checks on Id | Regex matched ^[a-zA-Z0-9_\-]+$ |
| `visits/{visitId}` | `isSignedIn()` | `isSignedIn()` | `isSignedIn()` | Size checks on Id | Regex matched ^[a-zA-Z0-9_\-]+$ |
| `territories/{territoryId}`| `isSignedIn()` | `isSignedIn()` | `isSignedIn()` | Size checks on Id | Regex matched ^[a-zA-Z0-9_\-]+$ |
