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
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const PROJECTS_COLLECTION = 'projects';
const ACTIVE_PROJECT_KEY = 'crcp_active_project_id';

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
 * Fetch all projects for a specific user
 */
export async function getUserProjects(uid) {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION), 
      where('ownerUid', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const projects = [];
    querySnapshot.forEach((docSnap) => {
      projects.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort in memory by updatedAt descending
    return projects.sort((a, b) => {
      const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
      const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
      return tB - tA;
    });
  } catch (err) {
    console.error('Error fetching user projects from Firestore:', err);
    return [];
  }
}

/**
 * Create a new project in Firestore
 */
export async function createProject(uid, name, description = '') {
  if (!uid) throw new Error('User must be logged in to create a project.');
  
  const projectRef = doc(collection(db, PROJECTS_COLLECTION));
  const newProject = {
    name,
    description,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(projectRef, newProject);

  const initialReconstructed = {
    processedSNs: [],
    errorSNs: [],
    rows: [],
    errors: [],
    pmisRows: [],
    pmisAvailableYears: [],
    verifiedSNs: [],
    actualEndOfLifeMap: {},
    lastUpdated: new Date().toISOString(),
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
    lastUpdated: new Date().toISOString(),
  };

  const initialTraffic = {};

  // Store modules as subdocuments under projects/{projectId}/modules/{moduleName}
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'reconstructed'), initialReconstructed);
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'inservice'), initialInservice);
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'traffic'), initialTraffic);

  return { id: projectRef.id, ...newProject };
}

/**
 * Load project state from Firestore
 */
export async function loadProjectStateFromCloud(projectId) {
  if (!projectId) return null;
  try {
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
  } catch (err) {
    console.error(`Error loading state for project ${projectId}:`, err);
    return null;
  }
}

/**
 * Save state to Firestore for a specific project
 */
export async function saveProjectStateToCloud(projectId, state) {
  if (!projectId || !state) return;
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
    console.error(`Error saving state for project ${projectId} to cloud:`, err);
  }
}

/**
 * Delete project from Firestore
 */
export async function deleteProjectFromCloud(projectId) {
  if (!projectId) return;
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'reconstructed'));
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'inservice'));
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic'));
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
  } catch (err) {
    console.error(`Error deleting project ${projectId}:`, err);
  }
}
