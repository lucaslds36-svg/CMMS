import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
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
// Use the named database if provided, otherwise fallback to default
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Google Login Error:', error);
    throw error;
  }
};

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
    handleFirestoreError(error, OperationType.GET, collectionName);
  });
};

const sanitizeData = (data: any): any => {
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Timestamp || data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  
  // Handle Firestore FieldValue (serverTimestamp, increment, etc.)
  // They don't have a common public class, but they are not plain objects
  if (data.constructor && data.constructor.name === 'FieldValue') return data;
  // Fallback for different environments/minification
  if (data._methodName || (typeof data.toFirestore === 'function')) return data;

  const sanitized: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      sanitized[key] = sanitizeData(data[key]);
    }
  });
  return sanitized;
};

export const createDocument = async (collectionName: string, data: any, id?: string) => {
  const path = id ? `${collectionName}/${id}` : collectionName;
  try {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  const path = `${collectionName}/${id}`;
  try {
    const sanitizedData = sanitizeData(data);
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, sanitizedData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  const path = `${collectionName}/${id}`;
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const resetCollection = async (collectionName: string) => {
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, collectionName);
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const setUserProfile = async (profile: UserProfile) => {
  const path = `users/${profile.uid}`;
  try {
    const docRef = doc(db, 'users', profile.uid);
    await setDoc(docRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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

/**
 * Subscribes to a global data document and handles chunked data reconstruction.
 */
export const subscribeToGlobalData = (
  key: string,
  callback: (data: string | null) => void
) => {
  const docRef = doc(db, 'globalData', key);
  
  return onSnapshot(docRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.data();
    if (!data.isChunked) {
      callback(data.data);
      return;
    }

    // If chunked, we need to fetch all chunks
    try {
      const chunkCount = data.chunkCount;
      let fullData = '';
      for (let i = 0; i < chunkCount; i++) {
        const chunkRef = doc(db, 'globalData', `${key}_part_${i}`);
        const chunkSnap = await getDoc(chunkRef);
        if (chunkSnap.exists()) {
          fullData += chunkSnap.data().data;
        }
      }
      callback(fullData);
    } catch (error) {
      console.error(`Error loading chunked data for ${key}:`, error);
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `globalData/${key}`);
  });
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
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `${collectionName}/${docId}`);
  });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
  }
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
