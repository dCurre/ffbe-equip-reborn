// Google login and storage of the user's data (inventory, units, espers, ...) in the hidden app folder
// of the user's own Google Drive, done directly from the browser: the site has no server.
//
// - Login uses Google Identity Services (token model): https://accounts.google.com/gsi/client must be
//   loaded by the page. Only the OAuth client ID is needed (it is public by design: Google only accepts it
//   from the authorized origins configured in the Google Cloud project). There is no client secret.
// - The access token lasts about 1 hour; it is kept in localStorage so it survives page changes, and the
//   user logs in again when it expires. It only grants access to the app folder (drive.appdata scope),
//   not to the user's other files.
// - Files are stored with the same names the old server used, e.g. units_GL.json, itemInventory_GL.json.
const googleDrive = (function () {
    const CLIENT_ID = '391730182542-pfup98mjhmllb4o14ap3gsmpfojb1j6v.apps.googleusercontent.com';
    const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
    const TOKEN_STORAGE_KEY = 'googleDriveToken';
    const FILES_API = 'https://www.googleapis.com/drive/v3/files';
    const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
    // Consider the token expired a bit before Google does, to avoid failing in the middle of a save
    const EXPIRY_MARGIN_MS = 60 * 1000;

    // List of the files of the app folder, fetched once per page and kept up to date by writeJson
    let appFilesPromise = null;

    function getToken() {
        try {
            const stored = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY));
            if (stored && stored.accessToken && stored.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
                return stored.accessToken;
            }
        } catch (e) { /* missing or malformed: not logged in */ }
        return null;
    }

    function storeToken(accessToken, expiresInSeconds) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
            accessToken: accessToken,
            expiresAt: Date.now() + expiresInSeconds * 1000
        }));
    }

    function clearToken() {
        try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch (e) { /* localStorage unavailable */ }
        appFilesPromise = null;
    }

    function isLoggedIn() {
        return getToken() !== null;
    }

    // Opens the Google login popup. Must be called from a user action (click), or the popup is blocked.
    function login() {
        return new Promise(function (resolve, reject) {
            if (!window.google || !google.accounts || !google.accounts.oauth2) {
                reject(new Error("The Google login library is not loaded. Check your connection or ad blocker, then reload the page."));
                return;
            }
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPE,
                callback: function (response) {
                    if (response.error) {
                        reject(new Error(response.error_description || response.error));
                    } else {
                        storeToken(response.access_token, response.expires_in);
                        resolve();
                    }
                },
                error_callback: function (error) {
                    // e.g. popup closed by the user or blocked by the browser
                    reject(new Error(error && error.message ? error.message : "Login cancelled"));
                }
            });
            tokenClient.requestAccessToken();
        });
    }

    function logout() {
        const token = getToken();
        clearToken();
        if (token && window.google && google.accounts && google.accounts.oauth2) {
            google.accounts.oauth2.revoke(token, function () {});
        }
    }

    // Authenticated call to the Drive API. Rejects with an Error having a `status` (401 = not logged in or
    // token expired: the stored token is then removed).
    async function driveRequest(url, options = {}) {
        const token = getToken();
        if (!token) {
            const error = new Error("Not logged in");
            error.status = 401;
            throw error;
        }
        const headers = Object.assign({ "Authorization": "Bearer " + token }, options.headers || {});
        const response = await fetch(url, Object.assign({}, options, { headers: headers }));
        if (!response.ok) {
            if (response.status === 401) {
                clearToken();
            }
            const error = new Error("Google Drive request failed (" + response.status + ")");
            error.status = response.status;
            throw error;
        }
        return response;
    }

    function listAppFiles() {
        if (!appFilesPromise) {
            appFilesPromise = driveRequest(FILES_API + "?spaces=appDataFolder&fields=files(id,name)&pageSize=1000")
                .then(response => response.json())
                .then(result => result.files || [])
                .catch(error => {
                    appFilesPromise = null;
                    throw error;
                });
        }
        return appFilesPromise;
    }

    // Reads a JSON file of the app folder; returns emptyValue if the file doesn't exist yet
    async function readJson(fileName, emptyValue) {
        const files = await listAppFiles();
        const file = files.find(f => f.name === fileName);
        if (!file) {
            return emptyValue;
        }
        const response = await driveRequest(FILES_API + "/" + file.id + "?alt=media");
        const text = await response.text();
        return text ? JSON.parse(text) : emptyValue;
    }

    // Writes a JSON file of the app folder, creating it the first time
    async function writeJson(fileName, data) {
        const files = await listAppFiles();
        const file = files.find(f => f.name === fileName);
        const content = JSON.stringify(data);
        if (file) {
            await driveRequest(UPLOAD_API + "/" + file.id + "?uploadType=media", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: content
            });
        } else {
            const boundary = "ffbe-equip-reborn-" + Date.now();
            const metadata = { name: fileName, parents: ["appDataFolder"] };
            const body =
                "--" + boundary + "\r\n" +
                "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
                JSON.stringify(metadata) + "\r\n" +
                "--" + boundary + "\r\n" +
                "Content-Type: application/json\r\n\r\n" +
                content + "\r\n" +
                "--" + boundary + "--";
            const response = await driveRequest(UPLOAD_API + "?uploadType=multipart&fields=id,name", {
                method: "POST",
                headers: { "Content-Type": "multipart/related; boundary=" + boundary },
                body: body
            });
            files.push(await response.json());
        }
    }

    return { isLoggedIn, login, logout, readJson, writeJson };
})();
