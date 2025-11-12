# Feedback email server

This small Express server accepts POST /submit-feedback and sends an email using SMTP (via nodemailer).

Setup
1. cd server
2. npm install
3. Copy `.env.example` to `.env` and fill SMTP credentials
4. npm start

Endpoint
- POST /submit-feedback
  - JSON body: { name, email?, feedback }
  - Returns JSON success/failure

If SMTP isn't configured the server will respond 200 and not send email (useful for development).
