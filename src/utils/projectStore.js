import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const PROJECTS_COLLECTION = 'projects';
const ACTIVE_PROJECT_KEY = 'crcp_active_project_id';

/**
 * Get the currently stored active project ID from localStorage (only stores active ID string)
 */
export function getActiveProjectId() {
  return localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
}

/**
 * Set the currently stored active project ID in localStorage
 */
export function setActiveProjectId(projectId) {
  if (projectId) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

/**
 * Fetch all cloud projects for a specific user from Firestore
 */
export async function getUserProjects(uid) {
  if (!uid) return [];
  const q = query(
    collection(db, PROJECTS_COLLECTION), 
    where('ownerUid', '==', uid)
  );
  const querySnapshot = await getDocs(q);
  const projects = [];
  querySnapshot.forEach((docSnap) => {
    projects.push({ id: docSnap.id, ...docSnap.data() });
  });

  return projects.sort((a, b) => {
    const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (new Date(a.updatedAt || 0).getTime());
    const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (new Date(b.updatedAt || 0).getTime());
    return tB - tA;
  });
}

/**
 * Create a new project in Firestore (100% Online Cloud Storage)
 */
export async function createProject(uid, name, description = '') {
  if (!uid) throw new Error('You must be signed in to create an online project.');

  const projectRef = doc(collection(db, PROJECTS_COLLECTION));
  const newProject = {
    name,
    description,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(projectRef, newProject);

  const nowIso = new Date().toISOString();

  const initialReconstructed = {
    processedSNs: [],
    errorSNs: [],
    rows: [],
    errors: [],
    pmisRows: [],
    pmisAvailableYears: [],
    verifiedSNs: [],
    actualEndOfLifeMap: {},
    lastUpdated: nowIso,
  };

  const initialInservice = {
    processedSNs: [],
    errorSNs: [],
    rows: [],
    errors: [],
    pmisRows: [],
    pmisAvailableYears: [],
    verifiedSNs: [],
    actualEndOfLifeMap: {},
    lastUpdated: nowIso,
  };

  // Store modules as subdocuments under projects/{projectId}/modules/{moduleName}
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'reconstructed'), initialReconstructed);
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'inservice'), initialInservice);
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'traffic'), {});

  return { id: projectRef.id, ...newProject };
}

/**
 * Load project state directly from Cloud Firestore
 */
export async function loadProjectStateFromCloud(projectId) {
  if (!projectId) return null;

  const projectDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
  if (!projectDoc.exists()) return null;

  const reconDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'reconstructed'));
  const inserviceDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'inservice'));
  const trafficDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic'));

  return {
    metadata: { id: projectDoc.id, ...projectDoc.data() },
    state: {
      version: 1,
      reconstructed: reconDoc.exists() ? reconDoc.data() : {},
      inservice: inserviceDoc.exists() ? inserviceDoc.data() : {},
      trafficAnalysis: trafficDoc.exists() ? trafficDoc.data() : {}
    }
  };
}

/**
 * Save project state directly to Cloud Firestore
 */
export async function saveProjectStateToCloud(projectId, state) {
  if (!projectId || !state) return;

  const batchUpdates = [];
  if (state.reconstructed) {
    batchUpdates.push(setDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'reconstructed'), state.reconstructed, { merge: true }));
  }
  if (state.inservice) {
    batchUpdates.push(setDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'inservice'), state.inservice, { merge: true }));
  }
  if (state.trafficAnalysis) {
    batchUpdates.push(setDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic'), state.trafficAnalysis, { merge: true }));
  }

  batchUpdates.push(updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
    updatedAt: serverTimestamp()
  }));

  await Promise.all(batchUpdates);
}

/**
 * Delete project directly from Cloud Firestore
 */
export async function deleteProjectFromCloud(projectId) {
  if (!projectId) return;

  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'reconstructed'));
  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'inservice'));
  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic'));
  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
}
