// backend/src/security/jwt.js
'use strict';

const crypto = require('crypto');

function base64urlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecodeToString(input) {
  const b64 = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function signHmacSha256(data, secret) {
  return base64urlEncode(crypto.createHmac('sha256', secret).update(data).digest());
}

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (secret && String(secret).trim()) return String(secret);

  if (!global.__SVC_JWT_SECRET_WARNED__) {
    global.__SVC_JWT_SECRET_WARNED__ = true;
    // No bloquea en dev; en producción debe configurarse JWT_SECRET.
    console.warn('[jwt] Aviso: JWT_SECRET no está configurado. Usando secreto inseguro de desarrollo.');
  }
  return 'SVC_DEV_INSECURE_SECRET_CHANGE_ME';
}

function createToken(payload, { expiresInSeconds = 60 * 60 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedBody = base64urlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const signature = signHmacSha256(signingInput, getSecret());
  return `${signingInput}.${signature}`;
}

function verifyToken(token) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3) {
    const err = new Error('Token inválido.');
    err.code = 'TOKEN_INVALID';
    throw err;
  }

  const [encodedHeader, encodedBody, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expected = signHmacSha256(signingInput, getSecret());

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    const err = new Error('Firma inválida.');
    err.code = 'TOKEN_SIGNATURE';
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecodeToString(encodedBody));
  } catch {
    const err = new Error('Payload inválido.');
    err.code = 'TOKEN_PAYLOAD';
    throw err;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now >= payload.exp) {
    const err = new Error('Token expirado.');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  return payload;
}

module.exports = { createToken, verifyToken };
