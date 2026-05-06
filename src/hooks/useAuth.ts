import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

type AuthUser = {
  uid: string;
  email?: string | null;
  name?: string;
  role?: string;
  isLocked?: boolean;
};

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          name: String(userData.name || ''),
          role: String(userData.role || '').toUpperCase(),
          isLocked: Boolean(userData.isLocked),
        });
      } catch {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          role: '',
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return { currentUser };
}
