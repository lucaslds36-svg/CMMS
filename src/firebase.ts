import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch, 
  deleteDoc, 
  getDocs, 
  serverTimestamp, 
  Timestamp,
  updateDoc,
  increment
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { UserProfile } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    return await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google Login Error:', error);
    throw error;
  }
};

export { getRedirectResult };

export const logout = async () => {
  return signOut(auth);
};

export const loginWithEmail = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

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
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as T));
    callback(data);
  }, (error) => {
    console.error(`Error in snapshot listener for collection ${collectionName}:`, error);
  });
};

const sanitizeData = (data: any) => {
  if (typeof data !== 'object' || data === null) return data;
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !(sanitized[key] instanceof Timestamp)) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  });
  return sanitized;
};

export const createDocument = async (collectionName: string, data: any, id?: string) => {
  const sanitizedData = sanitizeData(data);
  if (id) {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, sanitizedData);
    return id;
  } else {
    const newDocRef = doc(collection(db, collectionName));
    await setDoc(newDocRef, sanitizedData);
    return newDocRef.id;
  }
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  const sanitizedData = sanitizeData(data);
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, sanitizedData);
};

export const deleteDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

export const resetCollection = async (collectionName: string) => {
  const q = query(collection(db, collectionName));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
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

export const setUserProfile = async (profile: UserProfile) => {
  const docRef = doc(db, 'users', profile.uid);
  await setDoc(docRef, profile, { merge: true });
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ... (previous imports)

const CHUNK_SIZE = 800 * 1024; // 800KB

const saveDataChunked = async (docRef: any, data: string) => {
  const batch = writeBatch(db);
  const chunks = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.substring(i, i + CHUNK_SIZE));
  }

  // Save metadata
  batch.set(docRef, {
    key: docRef.id,
    isChunked: true,
    chunkCount: chunks.length,
    updatedAt: serverTimestamp()
  });

  // Save chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunkRef = doc(docRef.parent, `${docRef.id}_part_${i}`);
    batch.set(chunkRef, { data: chunks[i] });
  }

  await batch.commit();
};

const loadDataChunked = async (docRef: any): Promise<string | null> => {
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;

  const data = docSnap.data() as any;
  if (!data.isChunked) return data.data;

  const chunkCount = data.chunkCount;
  let fullData = '';
  for (let i = 0; i < chunkCount; i++) {
    const chunkRef = doc(docRef.parent, `${docRef.id}_part_${i}`);
    const chunkSnap = await getDoc(chunkRef);
    if (chunkSnap.exists()) {
      fullData += (chunkSnap.data() as any).data;
    }
  }
  return fullData;
};

export const saveDatabaseEntry = async (uid: string, key: string, data: string) => {
  const path = `users/${uid}/databaseEntries/${key}`;
  try {
    const docRef = doc(db, 'users', uid, 'databaseEntries', key);
    if (data.length > CHUNK_SIZE) {
      await saveDataChunked(docRef, data);
    } else {
      await setDoc(docRef, {
        uid,
        key,
        data,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const loadDatabaseEntry = async (uid: string, key: string): Promise<string | null> => {
  const path = `users/${uid}/databaseEntries/${key}`;
  try {
    const docRef = doc(db, 'users', uid, 'databaseEntries', key);
    return await loadDataChunked(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const saveGlobalData = async (key: string, data: string) => {
  const path = `globalData/${key}`;
  try {
    const docRef = doc(db, 'globalData', key);
    if (data.length > CHUNK_SIZE) {
      await saveDataChunked(docRef, data);
    } else {
      await setDoc(docRef, {
        key,
        data,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const loadGlobalData = async (key: string): Promise<string | null> => {
  const path = `globalData/${key}`;
  try {
    const docRef = doc(db, 'globalData', key);
    return await loadDataChunked(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const subscribeToDocument = <T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
) => {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as T);
    } else {
      callback(null);
    }
  });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const q = query(collection(db, 'users'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export { 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch, 
  deleteDoc, 
  getDocs, 
  serverTimestamp, 
  Timestamp
};
export type { User };
