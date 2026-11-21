import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Modes, chosen from the environment:
//   smtp    SMTP_HOST is set: real delivery through nodemailer.
//   memory  MAIL_TRANSPORT=memory: nothing leaves the process; messages collect in `outbox` (tests).
//   log     no SMTP configured: the app runs, nothing is delivered, and callers are told so.
const defaultMode = process.env.MAIL_TRANSPORT === 'memory' ? 'memory' : env.mail.host ? 'smtp' : 'log';

export const outbox = [];

// What went wrong, in terms an admin can act on. The raw SMTP detail goes to the
// server log only; it is never sent to the browser.
export const FAILURE_TEXT = {
  config: 'Email is not set up on the server yet. Ask the administrator to add the SMTP settings.',
  auth: 'The mail server refused the sign-in. The administrator needs to check SMTP_USER and SMTP_PASS (for Gmail, an App Password).',
  network: 'The mail server could not be reached. Check the internet connection and try again.',
  recipient: 'The mail server rejected this email address. Check that the address is correct.',
  rejected: 'The mail server did not accept the message. Try again, or contact the guest another way.',
  unknown: 'The email could not be sent because of an unexpected problem. Try again shortly.',
};

// Sorts a nodemailer error into one of the categories above.
export function classifyMailError(error) {
  const code = String(error?.code || '');
  const status = Number(error?.responseCode) || 0;
  const command = String(error?.command || '');
  if (code === 'ECONFIG') return 'config';
  if (code === 'EAUTH' || status === 535 || status === 534 || status === 530 || command === 'AUTH PLAIN' || command === 'AUTH LOGIN') return 'auth';
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EDNS', 'ETLS', 'EHOSTUNREACH'].includes(code)) return 'network';
  if (code === 'EENVELOPE' || /^RCPT/i.test(command) || status === 550 || status === 551 || status === 553 || status === 552) return 'recipient';
  if (code === 'EMESSAGE' || /^DATA/i.test(command) || (status >= 500 && status < 600)) return 'rejected';
  return 'unknown';
}

// One line per failure, with the fields needed to diagnose it. Credentials and
// message bodies are never logged.
function logFailure(context, error, category) {
  console.error(`[mail ${category}] ${context} | code=${error?.code || '-'} command=${error?.command || '-'} responseCode=${error?.responseCode || '-'} response=${JSON.stringify(String(error?.response || '').slice(0, 200))} message=${JSON.stringify(String(error?.message || '').slice(0, 200))}`);
}

// A mailer owns one transporter. The app uses a single instance (below); tests
// can build another with different settings.
export function createMailer(config, mode = 'smtp') {
  const transport = mode === 'smtp'
    ? nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      pool: true,
    })
    : nodemailer.createTransport({ jsonTransport: true });
  let simulated = null;

  // Sends one message and always resolves with the outcome; it never throws.
  //   ok        true only if the server accepted every recipient
  //   accepted  addresses the SMTP server took responsibility for
  //   rejected  addresses it refused
  // "Accepted" means the mail server took the message. It does not promise the
  // message reached the inbox: spam filters and the recipient's server decide that.
  async function deliver({ to, subject, html, text, attachments, replyTo }) {
    const recipients = [].concat(to).filter(Boolean);
    if (!recipients.length) return { ok: false, category: 'recipient', accepted: [], rejected: [], userMessage: FAILURE_TEXT.recipient };
    if (mode === 'log') return { ok: false, category: 'config', accepted: [], rejected: recipients, userMessage: FAILURE_TEXT.config, notSent: true };
    if (mode === 'smtp' && config.user && !config.pass) {
      return { ok: false, category: 'config', accepted: [], rejected: recipients, userMessage: FAILURE_TEXT.config, detail: 'SMTP_USER is set but SMTP_PASS is empty.' };
    }

    try {
      if (simulated) {
        const error = simulated;
        simulated = null;
        throw error;
      }
      const info = await transport.sendMail({ from: config.from, to: recipients, subject, html, text, attachments, replyTo });
      const smtp = mode === 'smtp';
      const accepted = smtp ? (info.accepted || []).map(String) : recipients;
      const rejected = smtp ? (info.rejected || []).map(String) : [];
      if (mode === 'memory') outbox.push({ to: recipients, subject, html, text, attachments: (attachments || []).map((a) => a.filename), replyTo });
      if (!accepted.length || rejected.length) {
        console.error(`[mail recipient] subject=${JSON.stringify(subject)} accepted=${accepted.length} rejected=${JSON.stringify(rejected)} response=${JSON.stringify(String(info.response || '').slice(0, 200))}`);
        return { ok: false, category: 'recipient', accepted, rejected, userMessage: FAILURE_TEXT.recipient, response: info.response };
      }
      return { ok: true, accepted, rejected, messageId: info.messageId, response: info.response };
    } catch (error) {
      const category = classifyMailError(error);
      logFailure(`subject=${JSON.stringify(subject)}`, error, category);
      return { ok: false, category, accepted: [], rejected: recipients, userMessage: FAILURE_TEXT[category], detail: error.code || error.message };
    }
  }

  async function verify() {
    if (mode === 'log') return { ok: false, mode, category: 'config', error: 'SMTP_HOST is empty in backend/.env.' };
    if (mode === 'memory') return { ok: true, mode };
    if (config.user && !config.pass) return { ok: false, mode, category: 'config', error: 'SMTP_USER is set but SMTP_PASS is empty. For Gmail, paste a 16-letter App Password into SMTP_PASS in backend/.env.' };
    try {
      await transport.verify();
      return { ok: true, mode };
    } catch (error) {
      const category = classifyMailError(error);
      logFailure('startup verify', error, category);
      return { ok: false, mode, category, error: FAILURE_TEXT[category] };
    }
  }

  return {
    mode,
    deliver,
    verify,
    // Tests only: make the next delivery fail with this error. Ignored outside memory mode.
    simulateFailure(error) { if (mode === 'memory') simulated = error; },
  };
}

const mailer = createMailer(env.mail, defaultMode);

export const mailMode = mailer.mode;
export const deliver = mailer.deliver;
export const verifyMail = mailer.verify;
export const simulateFailure = mailer.simulateFailure;

// Sends one message; throws if it was not accepted. Used by the mail:test script.
export async function sendMail(message) {
  const result = await deliver(message);
  if (!result.ok) throw Object.assign(new Error(result.detail || result.userMessage), { category: result.category, result });
  return result;
}

// For emails that must never break the request that caused them (a booking, a
// status change). The outcome is logged, not thrown; the result is returned for
// callers that want to look at it.
export async function notify(message) {
  const result = await deliver(message);
  if (!result.ok) {
    const why = result.notSent ? 'SMTP is not configured, message not sent' : `${result.category}`;
    console.error(`[mail not delivered] ${why} | to=${[].concat(message.to).join(',')} subject=${JSON.stringify(message.subject)}`);
    return null;
  }
  return result;
}
