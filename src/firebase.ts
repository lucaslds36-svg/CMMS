import { initializeApp } from 'firebase/app';
import { UserProfile } from './types';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  getRedirectResult
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  onSnapshot, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export const loginWithEmail = (email: string, password: string) => 
  signInWithEmailAndPassword(auth, email, password);

export const registerWithEmail = async (email: string, password: string, displayName: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });
  return userCredential;
};

export const subscribeToCollection = <T>(
  collectionName: string,
  callback: (data: T[]) => void
) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    callback(data);
  });
};

export const createDocument = async (collectionName: string, data: any, id?: string) => {
  if (id) {
    await setDoc(doc(db, collectionName, id), data);
  } else {
    await addDoc(collection(db, collectionName), data);
  }
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  await updateDoc(doc(db, collectionName, id), data);
};

export const deleteDocument = async (collectionName: string, id: string) => {
  await deleteDoc(doc(db, collectionName, id));
};

export const resetCollection = async (collectionName: string) => {
  const q = query(collection(db, collectionName));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
};

export const setUserProfile = async (profile: any) => {
  await setDoc(doc(db, 'users', profile.uid), profile);
};

export const getAllUsers = async () => {
  const q = query(collection(db, 'users'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveDatabaseEntry = async (uid: string, key: string, data: any) => {
  if (data === undefined || data === null) return;
  await setDoc(doc(db, `users/${uid}/database`, key), { 
    data: JSON.stringify(data),
    updatedAt: new Date().toISOString()
  });
};

export const loadDatabaseEntry = async (uid: string, key: string) => {
  try {
    const docRef = doc(db, `users/${uid}/database`, key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const val = docSnap.data().data;
      if (val && val !== "undefined" && val !== "null") {
        return JSON.parse(val);
      }
    }
  } catch (e) {
    console.error(`Failed to load/parse ${key} from Firestore`, e);
  }
  return null;
};

export const saveGlobalData = async (key: string, data: any) => {
  if (data === undefined || data === null) return;
  await setDoc(doc(db, 'globalData', key), { 
    data: JSON.stringify(data),
    updatedAt: new Date().toISOString()
  });
};

export const loadGlobalData = async (key: string) => {
  try {
    const docRef = doc(db, 'globalData', key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const val = docSnap.data().data;
      if (val && val !== "undefined" && val !== "null") {
        return JSON.parse(val);
      }
    }
  } catch (e) {
    // If it's a permission error, we might want to log it specifically
    if (e instanceof Error && e.message.includes('permission')) {
      console.warn(`Permission denied loading global ${key}. This is expected if you are not an admin.`);
    } else {
      console.error(`Failed to load/parse global ${key} from Firestore`, e);
    }
  }
  return null;
};

export { getRedirectResult };
