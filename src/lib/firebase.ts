import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  Firestore,
} from 'firebase/firestore';

// Import the auto-provisioned Firebase config
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
  measurementId: config.measurementId,
};

// Singleton App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth with Google Provider & Browser Local Persistence
export const auth = getAuth(app);

const ensureLocalPersistence = async (): Promise<void> => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn('browserLocalPersistence initialization notice:', err);
  }
};
ensureLocalPersistence();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore with offline persistence (persistentLocalCache)
// Uses experimentalForceLongPolling to reliably connect in iframe/preview environments
let dbInstance: Firestore;
const configuredDbId = (config as any).firestoreDatabaseId || '(default)';
const targetDbId = configuredDbId === '(default)' ? undefined : configuredDbId;

try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      experimentalForceLongPolling: true,
    },
    targetDbId
  );
} catch (err) {
  try {
    dbInstance = initializeFirestore(
      app,
      {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
      },
      targetDbId
    );
  } catch {
    dbInstance = getFirestore(app, targetDbId);
  }
}

export const db = dbInstance;

/**
 * خريطة رسائل أخطاء المصادقة باللغة العربية البسيطة
 */
export function getArabicAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مسجل بالفعل في المنصة، يرجى تسجيل الدخول مباشرة أو استعادة كلمة المرور.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة، تأكد من كتابته مثل (name@example.com).';
    case 'auth/user-not-found':
      return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني، يرجى التسجيل أولاً.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور.';
    case 'auth/weak-password':
      return 'كلمة المرور قصيرة أو ضعيفة، يجب أن تحتوي على 6 أحرف أو أرقام على الأقل.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة الدخول بحساب Google قبل اكتمال العملية.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بخوادم السحابة، يرجى التحقق من اتصال الإنترنت.';
    case 'auth/too-many-requests':
      return 'تم حظر المحاولات مؤقتاً لتكرار المحاولة، يرجى الانتظار دقيقة والمحاولة مجدداً.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب، يرجى التواصل مع إدارة المنصة.';
    default:
      return error?.message || 'حدث خطأ أثناء المصادقة، يرجى المحاولة لاحقاً.';
  }
}

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  ensureLocalPersistence,
};
export type { User };
