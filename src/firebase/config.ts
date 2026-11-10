import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const firestoreDbId =
  (firebaseConfig as any).firestoreDatabaseId ||
  'ai-studio-calculadorademac-0cde1f4d-2674-40c3-af4a-d7ead0019dbd';

/* CRITICAL: The app will break without this line */
export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);

// Test connection on boot per Firebase skill guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
      return false;
    }
    // Any permission error on test/connection is normal since test/connection has no read rule
    return true;
  }
}

// Auto sign-in anonymously if not signed in so user always has valid request.auth.uid
export function initAuthSession(onUser: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn('Anonymous sign-in error:', err);
      }
    } else {
      onUser(user);
    }
  });
}
