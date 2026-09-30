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
const LOCAL_PROJECTS_KEY = 'crcp_local_projects_list';

/**
 * Get the currently stored active project ID from localStorage
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
 * Local fallback helpers
 */
function getLocalProjectsList() {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalProjectsList(list) {
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(list));
}

function saveLocalProjectState(projectId, state) {
  localStorage.setItem(`crcp_project_state_${projectId}`, JSON.stringify(state));
}

function getLocalProjectState(projectId) {
  try {
    const raw = localStorage.getItem(`crcp_project_state_${projectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch all projects for a specific user
 */
export async function getUserProjects(uid) {
  const localList = getLocalProjectsList();

  if (!uid) return localList;

  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION), 
      where('ownerUid', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const cloudProjects = [];
    querySnapshot.forEach((docSnap) => {
      cloudProjects.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Merge cloud and local projects uniquely
    const map = new Map();
    localList.forEach(p => map.set(p.id, p));
    cloudProjects.forEach(p => map.set(p.id, p));

    const merged = Array.from(map.values());
    return merged.sort((a, b) => {
      const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (new Date(a.updatedAt || 0).getTime());
      const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (new Date(b.updatedAt || 0).getTime());
      return tB - tA;
    });
  } catch (err) {
    console.warn('Firestore fetch failed (using local project cache):', err);
    return localList;
  }
}

/**
 * Create a new project in Firestore (with localStorage fallback)
 */
export async function createProject(uid, name, description = '') {
  const projId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const now = new Date().toISOString();

  const newProject = {
    id: projId,
    name,
    description,
    ownerUid: uid || 'guest',
    createdAt: now,
    updatedAt: now,
  };

  const initialReconstructed = {
    processedSNs: [],
    errorSNs: [],
    rows: [],
    errors: [],
    pmisRows: [],
    pmisAvailableYears: [],
    verifiedSNs: [],
    actualEndOfLifeMap: {},
    lastUpdated: now,
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
    lastUpdated: now,
  };

  const initialState = {
    version: 1,
    reconstructed: initialReconstructed,
    inservice: initialInservice,
    trafficAnalysis: {}
  };

  // 1. Always save locally first so creation NEVER fails
  const localList = getLocalProjectsList();
  localList.unshift(newProject);
  saveLocalProjectsList(localList);
  saveLocalProjectState(projId, initialState);

  // 2. Sync to Cloud Firestore if connected & authorized
  if (uid) {
    try {
      const projectRef = doc(db, PROJECTS_COLLECTION, projId);
      await setDoc(projectRef, {
        name,
        description,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, PROJECTS_COLLECTION, projId, 'modules', 'reconstructed'), initialReconstructed);
      await setDoc(doc(db, PROJECTS_COLLECTION, projId, 'modules', 'inservice'), initialInservice);
      await setDoc(doc(db, PROJECTS_COLLECTION, projId, 'modules', 'traffic'), {});
    } catch (cloudErr) {
      console.warn('Firestore permission error (saved to local project cache):', cloudErr);
    }
  }

  return newProject;
}

/**
 * Load project state from Firestore or local fallback
 */
export async function loadProjectStateFromCloud(projectId) {
  if (!projectId) return null;

  // Try cloud load
  try {
    const projectDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
    if (projectDoc.exists()) {
      const reconDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'reconstructed'));
      const inserviceDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'inservice'));
      const trafficDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic'));

      const cloudState = {
        version: 1,
        reconstructed: reconDoc.exists() ? reconDoc.data() : {},
        inservice: inserviceDoc.exists() ? inserviceDoc.data() : {},
        trafficAnalysis: trafficDoc.exists() ? trafficDoc.data() : {}
      };

      saveLocalProjectState(projectId, cloudState);
      return {
        metadata: { id: projectDoc.id, ...projectDoc.data() },
        state: cloudState
      };
    }
  } catch (err) {
    console.warn(`Firestore read failed for project ${projectId}, loading local cache:`, err);
  }

  // Local fallback
  const localState = getLocalProjectState(projectId);
  if (localState) {
    return {
      metadata: { id: projectId, name: 'Local Project' },
      state: localState
    };
  }

  return null;
}

/**
 * Save state to Firestore & local fallback for a specific project
 */
export async function saveProjectStateToCloud(projectId, state) {
  if (!projectId || !state) return;

  // Always update local cache
  saveLocalProjectState(projectId, state);

  // Sync to Cloud Firestore
  try {
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
  } catch (err) {
    console.warn(`Firestore save skipped for ${projectId}:`, err);
  }
}

/**
 * Delete project from Firestore & local fallback
 */
export async function deleteProjectFromCloud(projectId) {
  if (!projectId) return;

  // Local delete
  const localList = getLocalProjectsList().filter(p => p.id !== projectId);
  saveLocalProjectsList(localList);
  localStorage.removeItem(`crcp_project_state_${projectId}`);

  // Cloud delete
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'reconstructed'));
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'inservice'));
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic'));
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
  } catch (err) {
    console.warn(`Firestore delete skipped for ${projectId}:`, err);
  }
}
