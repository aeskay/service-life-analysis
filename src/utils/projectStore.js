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
import { auth, db } from '../config/firebase';

const PROJECTS_COLLECTION = 'projects';
const ACTIVE_PROJECT_KEY = 'crcp_active_project_id';
const CHUNK_SIZE = 40; // 40 items per doc ensures safe payload < 100KB (limit is 1000KB)

/**
 * Helper to wait for Firebase Auth to complete its initial state check
 */
export function waitForAuth() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

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

    return projects.sort((a, b) => {
      const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (new Date(a.updatedAt || 0).getTime());
      const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (new Date(b.updatedAt || 0).getTime());
      return tB - tA;
    });
  } catch (err) {
    console.warn('getUserProjects error:', err.message);
    return [];
  }
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
    actualYearConstMap: {},
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
    actualYearConstMap: {},
    lastUpdated: nowIso,
  };

  await saveModuleStateToCloud(projectRef.id, 'reconstructed', initialReconstructed);
  await saveModuleStateToCloud(projectRef.id, 'inservice', initialInservice);
  await setDoc(doc(db, PROJECTS_COLLECTION, projectRef.id, 'modules', 'traffic'), {});

  return { id: projectRef.id, ...newProject };
}

async function saveArrayChunks(projectId, moduleName, arrayName, dataArray) {
  if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) return 0;
  
  const chunksCount = Math.ceil(dataArray.length / CHUNK_SIZE);
  const promises = [];

  for (let i = 0; i < chunksCount; i++) {
    const chunk = dataArray.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkRef = doc(db, PROJECTS_COLLECTION, projectId, `${moduleName}_data`, `${arrayName}_chunk_${i}`);
    promises.push(setDoc(chunkRef, { items: chunk }));
  }

  await Promise.all(promises);
  return chunksCount;
}

async function loadArrayChunks(projectId, moduleName, arrayName, chunksCount) {
  if (!chunksCount || chunksCount <= 0) return [];
  
  const promises = [];
  for (let i = 0; i < chunksCount; i++) {
    const chunkRef = doc(db, PROJECTS_COLLECTION, projectId, `${moduleName}_data`, `${arrayName}_chunk_${i}`);
    promises.push(getDoc(chunkRef));
  }

  const snapshots = await Promise.all(promises);
  let combined = [];
  for (const snap of snapshots) {
    if (snap.exists() && snap.data()?.items) {
      combined = combined.concat(snap.data().items);
    }
  }
  return combined;
}

async function cleanupOldChunks(projectId, moduleName, arrayName, oldNum, newNum) {
  if (oldNum > newNum) {
    const deletePromises = [];
    for (let i = newNum; i < oldNum; i++) {
      const chunkRef = doc(db, PROJECTS_COLLECTION, projectId, `${moduleName}_data`, `${arrayName}_chunk_${i}`);
      deletePromises.push(deleteDoc(chunkRef));
    }
    await Promise.all(deletePromises);
  }
}

export async function saveModuleStateToCloud(projectId, moduleName, moduleData) {
  if (!projectId || !moduleData) return;

  const { rows = [], errors = [], pmisRows = [], ...meta } = moduleData;

  const manifestRef = doc(db, PROJECTS_COLLECTION, projectId, `${moduleName}_data`, '_manifest');
  const manifestSnap = await getDoc(manifestRef);
  const oldManifest = manifestSnap.exists() ? manifestSnap.data() : {};

  const rowsChunksCount = await saveArrayChunks(projectId, moduleName, 'rows', rows);
  const errorsChunksCount = await saveArrayChunks(projectId, moduleName, 'errors', errors);
  const pmisChunksCount = await saveArrayChunks(projectId, moduleName, 'pmisRows', pmisRows);

  await cleanupOldChunks(projectId, moduleName, 'rows', oldManifest.rowsChunksCount || 0, rowsChunksCount);
  await cleanupOldChunks(projectId, moduleName, 'errors', oldManifest.errorsChunksCount || 0, errorsChunksCount);
  await cleanupOldChunks(projectId, moduleName, 'pmisRows', oldManifest.pmisChunksCount || 0, pmisChunksCount);

  await setDoc(manifestRef, {
    rowsChunksCount,
    errorsChunksCount,
    pmisChunksCount,
    updatedAt: serverTimestamp(),
  });

  const metaRef = doc(db, PROJECTS_COLLECTION, projectId, 'modules', moduleName);
  await setDoc(metaRef, {
    ...meta,
    rowCount: rows.length,
    pmisRowCount: pmisRows.length,
    errorCount: errors.length,
    lastUpdated: new Date().toISOString(),
  });
}

export async function loadModuleStateFromCloud(projectId, moduleName) {
  const metaRef = doc(db, PROJECTS_COLLECTION, projectId, 'modules', moduleName);
  const metaSnap = await getDoc(metaRef);

  const meta = metaSnap.exists() ? metaSnap.data() : {};

  const manifestRef = doc(db, PROJECTS_COLLECTION, projectId, `${moduleName}_data`, '_manifest');
  const manifestSnap = await getDoc(manifestRef);
  const manifest = manifestSnap.exists() ? manifestSnap.data() : {};

  const [rows, errors, pmisRows] = await Promise.all([
    loadArrayChunks(projectId, moduleName, 'rows', manifest.rowsChunksCount || 0),
    loadArrayChunks(projectId, moduleName, 'errors', manifest.errorsChunksCount || 0),
    loadArrayChunks(projectId, moduleName, 'pmisRows', manifest.pmisChunksCount || 0),
  ]);

  return {
    ...meta,
    rows: rows.length > 0 ? rows : (meta.rows || []),
    errors: errors.length > 0 ? errors : (meta.errors || []),
    pmisRows: pmisRows.length > 0 ? pmisRows : (meta.pmisRows || []),
  };
}

export async function saveTrafficStateToCloud(projectId, trafficData) {
  if (!projectId || !trafficData) return;

  const reconRes = trafficData.reconstructed?.results || [];
  const insvcRes = trafficData.inservice?.results || [];

  const manifestRef = doc(db, PROJECTS_COLLECTION, projectId, 'traffic_data', '_manifest');
  const manifestSnap = await getDoc(manifestRef);
  const oldManifest = manifestSnap.exists() ? manifestSnap.data() : {};

  const reconChunksCount = await saveArrayChunks(projectId, 'traffic', 'recon_results', reconRes);
  const insvcChunksCount = await saveArrayChunks(projectId, 'traffic', 'insvc_results', insvcRes);

  await cleanupOldChunks(projectId, 'traffic', 'recon_results', oldManifest.reconChunksCount || 0, reconChunksCount);
  await cleanupOldChunks(projectId, 'traffic', 'insvc_results', oldManifest.insvcChunksCount || 0, insvcChunksCount);

  await setDoc(manifestRef, {
    reconChunksCount,
    insvcChunksCount,
    updatedAt: serverTimestamp(),
  });

  const { reconstructed, inservice, ...trafficMeta } = trafficData;
  const reconClean = { ...reconstructed, results: [] };
  const insvcClean = { ...inservice, results: [] };

  const metaRef = doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic');
  await setDoc(metaRef, {
    ...trafficMeta,
    reconstructedMeta: reconClean,
    inserviceMeta: insvcClean,
    lastUpdated: new Date().toISOString(),
  });
}

export async function loadTrafficStateFromCloud(projectId) {
  const metaRef = doc(db, PROJECTS_COLLECTION, projectId, 'modules', 'traffic');
  const metaSnap = await getDoc(metaRef);

  const meta = metaSnap.exists() ? metaSnap.data() : {};

  const manifestRef = doc(db, PROJECTS_COLLECTION, projectId, 'traffic_data', '_manifest');
  const manifestSnap = await getDoc(manifestRef);
  const manifest = manifestSnap.exists() ? manifestSnap.data() : {};

  const [reconResults, insvcResults] = await Promise.all([
    loadArrayChunks(projectId, 'traffic', 'recon_results', manifest.reconChunksCount || 0),
    loadArrayChunks(projectId, 'traffic', 'insvc_results', manifest.insvcChunksCount || 0),
  ]);

  return {
    ...meta,
    reconstructed: {
      ...(meta.reconstructedMeta || {}),
      results: reconResults,
    },
    inservice: {
      ...(meta.inserviceMeta || {}),
      results: insvcResults,
    }
  };
}

/**
 * Load project state directly from Cloud Firestore
 */
export async function loadProjectStateFromCloud(projectId) {
  if (!projectId) return null;
  const user = await waitForAuth();
  if (!user) return null;

  try {
    const projectDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
    if (!projectDoc.exists()) return null;

    const [reconstructed, inservice, trafficAnalysis] = await Promise.all([
      loadModuleStateFromCloud(projectId, 'reconstructed'),
      loadModuleStateFromCloud(projectId, 'inservice'),
      loadTrafficStateFromCloud(projectId),
    ]);

    return {
      metadata: { id: projectDoc.id, ...projectDoc.data() },
      state: {
        version: 1,
        reconstructed,
        inservice,
        trafficAnalysis,
      }
    };
  } catch (err) {
    console.warn('loadProjectStateFromCloud skipped (unauthorized or network error):', err.message);
    return null;
  }
}

/**
 * Save project state directly to Cloud Firestore
 */
export async function saveProjectStateToCloud(projectId, state) {
  if (!projectId || !state) return;
  const user = await waitForAuth();
  if (!user) return;

  try {
    const promises = [];
    if (state.reconstructed) {
      promises.push(saveModuleStateToCloud(projectId, 'reconstructed', state.reconstructed));
    }
    if (state.inservice) {
      promises.push(saveModuleStateToCloud(projectId, 'inservice', state.inservice));
    }
    if (state.trafficAnalysis) {
      promises.push(saveTrafficStateToCloud(projectId, state.trafficAnalysis));
    }

    promises.push(updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
      updatedAt: serverTimestamp()
    }));

    await Promise.all(promises);
  } catch (err) {
    console.warn('saveProjectStateToCloud skipped (unauthorized or network error):', err.message);
  }
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
