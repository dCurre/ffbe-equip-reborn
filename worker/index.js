// Link store for shared builds and unit collections: POST a JSON body -> {id}; GET /<id> -> the JSON.
// Google login sessions: POST /auth/login {code} -> {sessionId, accessToken, expiresIn}; POST /auth/refresh {sessionId}
// -> {accessToken, expiresIn}; POST /auth/logout {sessionId}. The Google refresh token never leaves the Worker: it is
// kept in KV under "session:<sessionId>" and the browser only holds the opaque sessionId.
// Runs on Cloudflare Workers (free plan), data in the KV namespace bound as LINKS. Secret: GOOGLE_CLIENT_SECRET
// (npx wrangler secret put GOOGLE_CLIENT_SECRET).
const GOOGLE_CLIENT_ID = '391730182542-pfup98mjhmllb4o14ap3gsmpfojb1j6v.apps.googleusercontent.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const ALLOWED_ORIGINS = ['https://dcurre.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4200'];
const MAX_BYTES = 200 * 1024;
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// The id comes from the content, so the same data always gets the same link.
// shortcut: 10 chars of SHA-256 (~58 bits), no collision handling; lengthen it if the store ever grows huge
async function idFor(text) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return Array.from(hash.slice(0, 10), b => ALPHABET[b % ALPHABET.length]).join('');
}

const sessionKey = id => `session:${id}`;

async function googleToken(env, params) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        body: new URLSearchParams({client_id: GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params})
    });
    return {ok: response.ok, data: await response.json()};
}

// Returns [body, status]; the caller wraps it in the CORS reply.
async function handleAuth(action, request, env) {
    let input;
    try {
        input = await request.json();
    } catch (e) {
        return ['{"error":"invalid json"}', 400];
    }
    const tokens = data => JSON.stringify({accessToken: data.access_token, expiresIn: data.expires_in});

    if (action === 'login') {
        if (typeof input.code !== 'string') return ['{"error":"missing code"}', 400];
        const {ok, data} = await googleToken(env, {code: input.code, redirect_uri: 'postmessage', grant_type: 'authorization_code'});
        if (!ok) return ['{"error":"google rejected the code"}', 401];
        if (!data.refresh_token) return ['{"error":"no refresh token"}', 409];
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const sessionId = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        await env.LINKS.put(sessionKey(sessionId), data.refresh_token);
        return [JSON.stringify({sessionId, accessToken: data.access_token, expiresIn: data.expires_in}), 200];
    }

    const sessionId = typeof input.sessionId === 'string' && input.sessionId.length === 43 ? input.sessionId : null;
    const refreshToken = sessionId && await env.LINKS.get(sessionKey(sessionId));
    if (!refreshToken) return ['{"error":"unknown session"}', 401];

    if (action === 'refresh') {
        const {ok, data} = await googleToken(env, {refresh_token: refreshToken, grant_type: 'refresh_token'});
        if (ok) return [tokens(data), 200];
        // invalid_grant: access revoked from the Google account. Other errors are transient: keep the session.
        if (data.error === 'invalid_grant') {
            await env.LINKS.delete(sessionKey(sessionId));
            return ['{"error":"session revoked"}', 401];
        }
        return ['{"error":"google unavailable"}', 502];
    }
    // logout
    await env.LINKS.delete(sessionKey(sessionId));
    await fetch(GOOGLE_REVOKE_URL, {method: 'POST', body: new URLSearchParams({token: refreshToken})});
    return ['{}', 200];
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin');
        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
            return new Response('Forbidden', {status: 403});
        }
        const cors = {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Vary': 'Origin'
        };
        const reply = (body, status = 200) => new Response(body, {status, headers: {...cors, 'Content-Type': 'application/json'}});

        if (request.method === 'OPTIONS') {
            return new Response(null, {status: 204, headers: cors});
        }
        const path = new URL(request.url).pathname;
        const auth = /^\/auth\/(login|refresh|logout)$/.exec(path);
        if (auth) {
            if (request.method !== 'POST') return reply('{"error":"method not allowed"}', 405);
            return reply(...await handleAuth(auth[1], request, env));
        }
        if (request.method === 'POST') {
            const text = await request.text();
            if (text.length > MAX_BYTES) {
                return reply('{"error":"too large"}', 413);
            }
            try {
                JSON.parse(text);
            } catch (e) {
                return reply('{"error":"invalid json"}', 400);
            }
            const id = await idFor(text);
            if (await env.LINKS.get(id) === null) {
                await env.LINKS.put(id, text);
            }
            return reply(JSON.stringify({id}));
        }
        if (request.method === 'GET') {
            const id = new URL(request.url).pathname.slice(1);
            const value = /^[A-Za-z0-9]{10}$/.test(id) ? await env.LINKS.get(id) : null;
            return value === null ? reply('{"error":"not found"}', 404) : reply(value);
        }
        return reply('{"error":"method not allowed"}', 405);
    }
};
