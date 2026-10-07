import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Silence verbose informational and internal stream backoff warnings in browser console
try {
  setLogLevel("silent");
} catch {
  // ignore
}

// Initialize Firebase
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must use firebaseConfig.firestoreDatabaseId
// Using experimentalForceLongPolling avoids WebChannel connection drops in container / iframe environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreInstance;
export const auth = getAuth(app);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively cleans an object for Firestore:
 * - Omits keys with `undefined` values (which Firestore rejects with "Unsupported field value: undefined").
 * - Converts `undefined` in arrays to `null`.
 * - Recursively processes nested objects.
 */
export function cleanFirestoreData<T>(input: T): T {
  if (input === undefined || input === null) {
    return null as any;
  }
  if (Array.isArray(input)) {
    return input.map((item) => (item === undefined ? null : cleanFirestoreData(item))) as any;
  }
  if (typeof input === "object" && !(input instanceof Date)) {
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        output[key] = cleanFirestoreData(value);
      }
    }
    return output as T;
  }
  return input;
}

// CRITICAL CONSTRAINT: Test connection on startup
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[Firebase] Offline or initial connection check:", error.message);
      return false;
    }
    // Any other error means online response received (even 404 not found is ok)
    return true;
  }
}

// Auto-run test connection
testConnection().catch(() => {});
