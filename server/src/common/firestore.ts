import * as admin from 'firebase-admin';

import serviceAccount from '../../firebaseConfig.json';

export function setupFireStore() {
  initFirebase();
  return admin.firestore();
}

function initFirebase() {
  if (admin.apps.length <= 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}
