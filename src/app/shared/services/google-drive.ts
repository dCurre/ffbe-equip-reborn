import { Injectable, signal } from '@angular/core';

// Google login and storage of the user's data (inventory, units, espers, ...) in the hidden app folder of the user's own
// Google Drive, done directly from the browser: the site has no server.
//
// - Login uses Google Identity Services (token model). Only the OAuth client ID is needed: it is public by design, Google
//   accepts it only from the authorized origins of the Google Cloud project. There is no client secret.
// - The access token lasts about 1 hour and is kept in localStorage so it survives reloads. When it expires the service
//   tries to renew it silently; browsers block that popup without a click, so the next click on the page renews it and
//   reloads. If Google needs a real login, the user logs in again by hand. The token only grants access to the app folder
//   (drive.appdata scope), not to the user's other files.
// - Files keep the names the old site used, e.g. units_GL.json, itemInventory_GL.json.

const CLIENT_ID = '391730182542-pfup98mjhmllb4o14ap3gsmpfojb1j6v.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GOOGLE_LIBRARY = 'https://accounts.google.com/gsi/client';
const TOKEN_STORAGE_KEY = 'googleDriveToken';
const FILES_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
/** The token counts as expired a bit before Google says so, to avoid failing in the middle of a save. */
const EXPIRY_MARGIN_MS = 60 * 1000;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/** Only the part of the Google Identity Services API that is used here. */
interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback: (error: { message?: string }) => void;
    }): { requestAccessToken(options: { prompt?: string }): void };
    revoke(token: string, done: () => void): void;
  };
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccounts };
  }
}

interface DriveFile {
  id: string;
  name: string;
}

/** An error from the Drive API; `status` 401 means not logged in or token expired (the stored token is then removed). */
export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleDrive {
  /** True while a token is stored, even an expired one: a request renews it silently when needed. */
  readonly loggedIn = signal(this.hasStoredToken());

  /** List of the files of the app folder, fetched once and kept up to date by `writeJson`. */
  private appFiles: Promise<DriveFile[]> | null = null;
  private renewalFailed = false;
  /** One login request at a time: the login button and the click renewal share the same popup. */
  private pendingToken: Promise<void> | null = null;

  /** Opens the Google login popup. Must be called from a click, or the browser blocks the popup. */
  login(): Promise<void> {
    return this.requestToken(undefined);
  }

  logout(): void {
    const token = this.getToken();
    this.clearToken();
    if (token) window.google?.accounts?.oauth2.revoke(token, () => {});
  }

  /** Reads a JSON file of the app folder; returns `emptyValue` if the file does not exist yet. */
  async readJson<T>(fileName: string, emptyValue: T): Promise<T> {
    const file = (await this.listAppFiles()).find((f) => f.name === fileName);
    if (!file) return emptyValue;
    const response = await this.driveRequest(`${FILES_API}/${file.id}?alt=media`);
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : emptyValue;
  }

  /** Writes a JSON file of the app folder, creating it the first time. */
  async writeJson(fileName: string, data: unknown): Promise<void> {
    const files = await this.listAppFiles();
    const file = files.find((f) => f.name === fileName);
    const content = JSON.stringify(data);
    if (file) {
      await this.driveRequest(`${UPLOAD_API}/${file.id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      });
      return;
    }
    const boundary = `ffbe-equip-reborn-${Date.now()}`;
    const metadata = { name: fileName, parents: ['appDataFolder'] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const response = await this.driveRequest(`${UPLOAD_API}?uploadType=multipart&fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    files.push((await response.json()) as DriveFile);
  }

  private hasStoredToken(): boolean {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  private getToken(): string | null {
    try {
      const stored = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) ?? 'null');
      if (stored?.accessToken && stored.expiresAt > Date.now() + EXPIRY_MARGIN_MS) return stored.accessToken;
    } catch {
      // missing or malformed: not logged in
    }
    return null;
  }

  private storeToken(accessToken: string, expiresInSeconds: number): void {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }),
    );
    this.loggedIn.set(true);
  }

  private clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
    this.appFiles = null;
    this.loggedIn.set(false);
  }

  /** Asks Google for a new token without the account chooser: it works only if the user is still signed in and already granted access. */
  private refresh(): Promise<void> {
    return this.requestToken('');
  }

  /** The automatic renewal popup is blocked without a click: the next click anywhere on the page retries it. */
  private armClickRenewal(): void {
    if (this.renewalFailed) return;
    this.renewalFailed = true;
    document.addEventListener(
      'click',
      () => {
        this.renewalFailed = false;
        this.refresh().then(
          () => window.location.reload(),
          () => this.clearToken(), // Google needs a real login: the page shows the "Log in" button
        );
      },
      { once: true },
    );
  }

  /** The Google library is loaded the first time it is needed (up to 5 s). */
  private loadGoogleLibrary(): Promise<GoogleAccounts> {
    return new Promise((resolve, reject) => {
      if (!document.querySelector(`script[src="${GOOGLE_LIBRARY}"]`)) {
        const script = document.createElement('script');
        script.src = GOOGLE_LIBRARY;
        script.async = true;
        document.head.appendChild(script);
      }
      let attempts = 0;
      const check = () => {
        const accounts = window.google?.accounts;
        if (accounts?.oauth2) resolve(accounts);
        else if (++attempts > 50) {
          reject(
            new Error(
              'The Google login library is not loaded. Check your connection or ad blocker, then reload the page.',
            ),
          );
        } else setTimeout(check, 100);
      };
      check();
    });
  }

  private requestToken(prompt: string | undefined): Promise<void> {
    this.pendingToken ??= this.loadGoogleLibrary()
      .then(
        (accounts) =>
          new Promise<void>((resolve, reject) => {
            const tokenClient = accounts.oauth2.initTokenClient({
              client_id: CLIENT_ID,
              scope: SCOPE,
              callback: (response) => {
                if (response.error) {
                  reject(new Error(response.error_description || response.error));
                } else {
                  this.storeToken(response.access_token, response.expires_in);
                  resolve();
                }
              },
              // e.g. popup closed by the user or blocked by the browser
              error_callback: (error) => reject(new Error(error?.message || 'Login cancelled')),
            });
            tokenClient.requestAccessToken(prompt === undefined ? {} : { prompt });
          }),
      )
      .finally(() => (this.pendingToken = null));
    return this.pendingToken;
  }

  /** Authenticated call to the Drive API. */
  private async driveRequest(url: string, options: RequestInit = {}): Promise<Response> {
    let token = this.getToken();
    if (!token && this.hasStoredToken() && !this.renewalFailed) {
      try {
        await this.refresh();
      } catch {
        this.armClickRenewal();
      }
      token = this.getToken();
    }
    if (!token) throw new DriveError('Not logged in', 401);
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers as Record<string, string> | undefined) };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) this.clearToken();
      throw new DriveError(`Google Drive request failed (${response.status})`, response.status);
    }
    return response;
  }

  private listAppFiles(): Promise<DriveFile[]> {
    this.appFiles ??= this.driveRequest(`${FILES_API}?spaces=appDataFolder&fields=files(id,name)&pageSize=1000`)
      .then((response) => response.json())
      .then((result: { files?: DriveFile[] }) => result.files ?? [])
      .catch((error) => {
        this.appFiles = null;
        throw error;
      });
    return this.appFiles;
  }
}
