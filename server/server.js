const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// SMTP config
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const ALERT_TO = process.env.ALERT_TO || 'altheaparrocha0@gmail.com';

const FEEDBACK_FILE = path.join(__dirname, 'feedbacks.json');

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// simple in-memory token store for admin sessions (will reset on restart)
const validTokens = new Map();

function ensureFeedbackFile() {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) {
      fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf8');
    }
  } catch (err) {
    console.error('Error ensuring feedback file', err);
  }
}

async function readFeedbacks() {
  ensureFeedbackFile();
  const raw = await fs.promises.readFile(FEEDBACK_FILE, 'utf8');
  try {
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

async function writeFeedbacks(list) {
  await fs.promises.writeFile(FEEDBACK_FILE, JSON.stringify(list, null, 2), 'utf8');
}

async function appendFeedback(entry) {
  const list = await readFeedbacks();
  list.push(entry);
  await writeFeedbacks(list);
}

app.post('/submit-feedback', async (req, res) => {
  const { name, email, feedback } = req.body || {};
  if (!name || !feedback) return res.status(400).json({ success: false, message: 'name and feedback required' });

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex'),
    name: String(name),
    email: email ? String(email) : '',
    feedback: String(feedback),
    createdAt: new Date().toISOString()
  };

  try {
    await appendFeedback(entry);
  } catch (err) {
    console.error('Failed to save feedback', err);
  }

  const html = `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
    ${email ? `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` : ''}
    <p><strong>Feedback:</strong></p>
    <p>${escapeHtml(feedback)}</p>`;

  if (!transporter) {
    console.warn('SMTP not configured — skipping email send');
    return res.json({ success: true, message: 'Feedback received (email not sent - SMTP not configured)' });
  }

  try {
    const mailOptions = {
      from: `${SMTP_USER}`,
      to: ALERT_TO,
      subject: `New feedback from ${name}`,
      html,
      text: `${name}${email ? ` (${email})` : ''}\n\n${feedback}`,
    };
    if (email) mailOptions.replyTo = email;
    const info = await transporter.sendMail(mailOptions);
    return res.json({ success: true, message: 'Feedback received and emailed', info });
  } catch (err) {
    console.error('Error sending email', err);
    return res.status(500).json({ success: false, message: 'Failed to send email', error: err.message });
  }
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
  if (!username || !password) return res.status(400).json({ success: false, message: 'username and password required' });
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    validTokens.set(token, { username, createdAt: Date.now() });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'invalid credentials' });
});

app.post('/admin/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  const token = parts.length === 2 ? parts[1] : null;
  if (token && validTokens.has(token)) {
    validTokens.delete(token);
  }
  return res.json({ success: true });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  const token = parts.length === 2 ? parts[1] : null;
  if (!token || !validTokens.has(token)) return res.status(401).json({ success: false, message: 'unauthorized' });
  next();
}

app.get('/admin/feedbacks', requireAuth, async (req, res) => {
  try {
    const list = await readFeedbacks();
    return res.json({ success: true, feedbacks: list.reverse() });
  } catch (err) {
    console.error('Failed to read feedbacks', err);
    return res.status(500).json({ success: false, message: 'failed to read feedbacks' });
  }
});

app.get('/', (req, res) => res.send('Feedback email server running'));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
