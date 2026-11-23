import { DriveError } from '../services/google-drive';
import { Toast } from '../services/toast';
import { STRINGS } from '../../strings/en';

const isSessionExpired = (error: unknown): boolean => error instanceof DriveError && error.status === 401;

/** Tells the user why the data could not be read from Google Drive. */
export function showLoadError(toast: Toast, error: unknown): void {
  toast.show(
    isSessionExpired(error)
      ? 'Your Google session has expired: please log in again'
      : 'Error while loading your data from Google Drive',
    isSessionExpired(error) ? 'warn' : 'error',
  );
}

/** Tells the user why the data could not be saved; returns true when it is worth trying again (not an expired session, which reloads the page). */
export function showSaveError(toast: Toast, error: unknown): boolean {
  if (isSessionExpired(error)) {
    toast.show(
      STRINGS.driveErrors.yourGoogleSessionHas,
      'error',
    );
    setTimeout(() => window.location.reload(), 4000);
    return false;
  }
  toast.show(STRINGS.driveErrors.errorWhileSavingThe, 'error');
  return true;
}
