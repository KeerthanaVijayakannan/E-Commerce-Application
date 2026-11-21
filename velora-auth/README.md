# Velora Authentication UI — Firestore prototype

This starter uses the existing Firestore `Users` collection (capital U) for a learning/demo flow. It does **not** use Firebase Authentication.

## Pages
- `login.html`: matches email/password against a document in `Users`, reads `role` and `status`.
- `signup.html`: adds a customer document to `Users` with `role: customer`, `status: active`, `creditLimit: 0`.
- `forgot-password.html`: email + new password + confirm; updates the `password` field of the matching `Users` document.

## Run
Open this folder in VS Code and use Live Server, or start a local HTTP server from this folder. Do not open HTML using `file://`.

## Prototype warning
This prototype stores passwords in plaintext and lets the frontend read/update password records. It is not secure for real users and must not be deployed publicly. Use Firebase Authentication and trusted backend logic for production.

## Firestore
The scripts expect a `Users` collection with fields such as `email`, `name`, `password`, `role`, `status`, and optional `userId`, `mobile`, `creditLimit`. Firestore rules must allow the prototype's reads/writes for testing. Avoid permissive rules in a public app.
