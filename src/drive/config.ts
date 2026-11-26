/**
 * The app's own Google OAuth Client ID (Web). Built in so anyone can back up with one click: each person
 * signs in with their own Google account and backups go to *their* Drive (scope drive.file: the app only
 * sees files it created). A host can still use their own Google Cloud project in Settings.
 */
export const DEFAULT_GOOGLE_CLIENT_ID = '211738025923-j67cqp7taivk4bd9d4f6a70utk9s6aq2.apps.googleusercontent.com';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
