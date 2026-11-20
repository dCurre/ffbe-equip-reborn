// Link store for shared builds and unit collections: POST a JSON body -> {id}; GET /<id> -> the JSON.
// Runs on Cloudflare Workers (free plan), data in the KV namespace bound as LINKS.
const ALLOWED_ORIGINS = ['https://dcurre.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const MAX_BYTES = 200 * 1024;
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// The id comes from the content, so the same data always gets the same link.
// shortcut: 10 chars of SHA-256 (~58 bits), no collision handling; lengthen it if the store ever grows huge
async function idFor(text) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return Array.from(hash.slice(0, 10), b => ALPHABET[b % ALPHABET.length]).join('');
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
