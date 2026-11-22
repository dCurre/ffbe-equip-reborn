import { Injectable, signal } from '@angular/core';
import { LINK_STORE_URL } from './link-store';

// Google login and storage of the user's data (inventory, units, espers, ...) in the hidden app folder of the user's own
// Google Drive.
//
// - Login uses Google Identity Services (code model). The popup gives a one-time code that the Worker (see `worker/`)
//   exchanges with Google using the client secret, which only the Worker knows. The Google refresh token stays in the
//   Worker: the browser keeps only an opaque session id, so the session lasts until the user logs out.
// - The access token lasts about 1 hour and is kept in localStorage so it survives reloads. When it expires, the Worker
//   renews it with the session id: no popup and no click. The token only grants access to the app folder (drive.appdata
//   scope), not to the user's other files.
// - Files keep the names the old site used, e.g. units_GL.json, itemInventory_GL.json.

const CLIENT_ID = '391730182542-pfup98mjhmllb4o14ap3gsmpfojb1j6v.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GOOGLE_LIBRARY = 'https://accounts.google.com/gsi/client';
const TOKEN_STORAGE_KEY = 'googleDriveToken';
const SESSION_STORAGE_KEY = 'googleDriveSession';
const FILES_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
/** The token counts as expired a bit before Google says so, to avoid failing in the middle of a save. */
const EXPIRY_MARGIN_MS = 60 * 1000;

interface CodeResponse {
  code?: string;
  error?: string;
  error_description?: string;
}

/** Only the part of the Google Identity Services API that is used here. */
interface GoogleAccounts {
  oauth2: {
    initCodeClient(config: {
      client_id: string;
      scope: string;
      ux_mode: 'popup';
      callback: (response: CodeResponse) => void;
      error_callback: (error: { message?: string }) => void;
    }): { requestCode(): void };
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

/** An error from the Drive API or the login Worker; `status` 401 means the session is over (it is then removed). */
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
  /** True while a session is stored: expired access tokens are renewed through the Worker. */
  readonly loggedIn = signal(this.getSession() !== null);

  /** List of the files of the app folder, fetched once and kept up to date by `writeJson`. */
  private appFiles: Promise<DriveFile[]> | null = null;
  /** One renewal at a time. */
  private pendingRefresh: Promise<void> | null = null;

  /** Opens the Google login popup. Must be called from a click, or the browser blocks the popup. */
  async login(): Promise<void> {
    const accounts = await this.loadGoogleLibrary();
    const code = await new Promise<string>((resolve, reject) => {
      accounts.oauth2
        .initCodeClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          ux_mode: 'popup',
          callback: (response) =>
            response.code ? resolve(response.code) : reject(new Error(response.error_description || response.error)),
          // e.g. popup closed by the user or blocked by the browser
          error_callback: (error) => reject(new Error(error?.message || 'Login cancelled')),
        })
        .requestCode();
    });
    const response = await this.authPost('login', { code });
    if (response.status === 409) {
      throw new Error(
        'Google did not give a long session. Remove "FFBE Equip Reborn" from myaccount.google.com/permissions, then log in again.',
      );
    }
    if (!response.ok) throw new Error('Login failed, try again.');
    const { sessionId, accessToken, expiresIn } = await response.json();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    this.storeAccessToken(accessToken, expiresIn);
    this.loggedIn.set(true);
  }

  logout(): void {
    const sessionId = this.getSession();
    this.clearSession();
    if (sessionId) this.authPost('logout', { sessionId }).catch(() => {});
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

  private getSession(): string | null {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private getToken(): string | null {
    try {
      const stored = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) ?? 'null');
      if (stored?.accessToken && stored.expiresAt > Date.now() + EXPIRY_MARGIN_MS) return stored.accessToken;
    } catch {
      // missing or malformed: renew it
    }
    return null;
  }

  private storeAccessToken(accessToken: string, expiresInSeconds: number): void {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }),
    );
  }

  /** Ends the session: the page shows the "Log in" button and the next Drive request fails with 401. */
  private clearSession(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
    this.appFiles = null;
    this.loggedIn.set(false);
  }

  private authPost(action: 'login' | 'refresh' | 'logout', body: object): Promise<Response> {
    return fetch(`${LINK_STORE_URL}/auth/${action}`, {
      method: 'POST',
      keepalive: true, // lets the logout request finish even though the page reloads right after
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** Gets a new access token from the Worker. Only a dead session (401) logs the user out; network errors keep it. */
  private refresh(): Promise<void> {
    this.pendingRefresh ??= (async () => {
      const sessionId = this.getSession();
      if (!sessionId) throw new DriveError('Not logged in', 401);
      let response: Response;
      try {
        response = await this.authPost('refresh', { sessionId });
      } catch {
        throw new DriveError('The login service is not reachable', 0);
      }
      if (response.status === 401) {
        this.clearSession();
        throw new DriveError('Not logged in', 401);
      }
      if (!response.ok) throw new DriveError(`Login renewal failed (${response.status})`, response.status);
      const { accessToken, expiresIn } = await response.json();
      this.storeAccessToken(accessToken, expiresIn);
    })().finally(() => (this.pendingRefresh = null));
    return this.pendingRefresh;
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

  /** Authenticated call to the Drive API. */
  private async driveRequest(url: string, options: RequestInit = {}, retry = true): Promise<Response> {
    if (!this.getToken()) await this.refresh();
    const token = this.getToken();
    if (!token) throw new DriveError('Not logged in', 401);
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers as Record<string, string> | undefined) };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401 && retry) {
        // the token was revoked before expiring: drop it and renew once
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return this.driveRequest(url, options, false);
      }
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
