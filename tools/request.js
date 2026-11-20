// Minimal replacement of the deprecated `request` package, on top of the native fetch (Node >= 18).
// Supports only what the extraction tools use: get(url, cb), head(url, cb), request(url).pipe(stream).
// fetch already decompresses gzip, so the `gzip` option is accepted and ignored.
import { Readable } from 'node:stream';

function send(method, url, options, callback) {
    if (typeof options === 'function') callback = options;
    fetch(url, { method })
        .then(async (res) => {
            const body = method === 'HEAD' ? '' : await res.text();
            callback(null, { statusCode: res.status, headers: Object.fromEntries(res.headers) }, body);
        })
        .catch((error) => callback(error));
}

function request(url) {
    return {
        pipe(dest) {
            fetch(url)
                .then((res) => Readable.fromWeb(res.body).pipe(dest))
                .catch((error) => dest.destroy(error));
            return dest;
        },
    };
}
request.get = (url, options, callback) => send('GET', url, options, callback);
request.head = (url, options, callback) => send('HEAD', url, options, callback);

export default request;
