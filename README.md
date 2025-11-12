# Website + Feedback SMS

This repository contains a static website and a small Node.js Express server to send SMS when feedback is submitted.

Quick start (server)
1. Open a terminal and cd into the server folder:
   cd server
2. Install deps:
   npm install
3. Copy `.env.example` to `.env` and fill in your Twilio credentials and phone numbers.
4. Start the server:
   npm start

By default the server runs on port 3000. The feedback form in `feedback.html` posts to `http://localhost:3000/submit-feedback`.

Security
- Do not commit your `.env` with Twilio credentials.
- This sample server is minimal and intended for local/dev use. For production, add authentication, rate limiting, input validation, and secret management.
