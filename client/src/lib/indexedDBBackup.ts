const DB_NAME = 'legalnote_recording_backup';
const DB_VERSION = 1;
const CHUNKS_STORE = 'audio_chunks';
const SESSIONS_STORE = 'recording_sessions';

interface StoredChunk {
  id: string;
  sessionId: string;
  chunkNumber: number;
  data: Blob;
  timestamp: Date;
  uploaded: boolean;
}

interface StoredSession {
  id: string;
  caseId?: string;
  caseName?: string;
  clientName?: string;
  mimeType: string;
  startedAt: Date;
  lastActivityAt: Date;
  chunksStored: number;
  status: 'active' | 'interrupted' | 'completed' | 'recovered';
}

class IndexedDBBackup {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;

  constructor() {
    this.dbReady = this.initDB();
  }

  private initDB(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('[IndexedDB] Not available in this environment');
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database');
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] Backup database ready');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
          chunksStore.createIndex('sessionId', 'sessionId', { unique: false });
          chunksStore.createIndex('uploaded', 'uploaded', { unique: false });
        }

        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
          sessionsStore.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  async isReady(): Promise<boolean> {
    return this.dbReady;
  }

  async createSession(sessionId: string, mimeType: string, caseId?: string, caseName?: string, clientName?: string): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);

      const session: StoredSession = {
        id: sessionId,
        caseId,
        caseName,
        clientName,
        mimeType,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        chunksStored: 0,
        status: 'active',
      };

      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async storeChunk(sessionId: string, chunkNumber: number, data: Blob): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE, SESSIONS_STORE], 'readwrite');
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const sessionsStore = transaction.objectStore(SESSIONS_STORE);

      const chunk: StoredChunk = {
        id: `${sessionId}_${chunkNumber}`,
        sessionId,
        chunkNumber,
        data,
        timestamp: new Date(),
        uploaded: false,
      };

      chunksStore.put(chunk);

      const sessionRequest = sessionsStore.get(sessionId);
      sessionRequest.onsuccess = () => {
        const session = sessionRequest.result as StoredSession | undefined;
        if (session) {
          session.lastActivityAt = new Date();
          session.chunksStored = Math.max(session.chunksStored, chunkNumber + 1);
          sessionsStore.put(session);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async markChunkUploaded(sessionId: string, chunkNumber: number): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);

      const request = store.get(`${sessionId}_${chunkNumber}`);
      request.onsuccess = () => {
        const chunk = request.result as StoredChunk | undefined;
        if (chunk) {
          chunk.uploaded = true;
          store.put(chunk);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionChunks(sessionId: string): Promise<StoredChunk[]> {
    await this.dbReady;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const index = store.index('sessionId');

      const request = index.getAll(sessionId);
      request.onsuccess = () => {
        const chunks = request.result as StoredChunk[];
        chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
        resolve(chunks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingChunks(sessionId: string): Promise<StoredChunk[]> {
    const chunks = await this.getSessionChunks(sessionId);
    return chunks.filter(c => !c.uploaded);
  }

  async getInterruptedSessions(): Promise<StoredSession[]> {
    await this.dbReady;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SESSIONS_STORE], 'readonly');
      const store = transaction.objectStore(SESSIONS_STORE);

      const request = store.getAll();
      request.onsuccess = () => {
        const sessions = request.result as StoredSession[];
        const interrupted = sessions.filter(s => 
          s.status === 'active' || s.status === 'interrupted'
        );
        resolve(interrupted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markSessionInterrupted(sessionId: string): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);

      const request = store.get(sessionId);
      request.onsuccess = () => {
        const session = request.result as StoredSession | undefined;
        if (session) {
          session.status = 'interrupted';
          store.put(session);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markSessionCompleted(sessionId: string): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);

      const request = store.get(sessionId);
      request.onsuccess = () => {
        const session = request.result as StoredSession | undefined;
        if (session) {
          session.status = 'completed';
          store.put(session);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markSessionRecovered(sessionId: string): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);

      const request = store.get(sessionId);
      request.onsuccess = () => {
        const session = request.result as StoredSession | undefined;
        if (session) {
          session.status = 'recovered';
          store.put(session);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE, SESSIONS_STORE], 'readwrite');
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const sessionsStore = transaction.objectStore(SESSIONS_STORE);

      sessionsStore.delete(sessionId);

      const index = chunksStore.index('sessionId');
      const request = index.getAllKeys(sessionId);
      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => chunksStore.delete(key));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    await this.dbReady;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SESSIONS_STORE], 'readonly');
      const store = transaction.objectStore(SESSIONS_STORE);

      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async exportChunksAsBlob(sessionId: string): Promise<Blob | null> {
    const chunks = await this.getSessionChunks(sessionId);
    if (chunks.length === 0) return null;

    const session = await this.getSession(sessionId);
    const mimeType = session?.mimeType || 'audio/webm';

    const blobParts = chunks.map(c => c.data);
    return new Blob(blobParts, { type: mimeType });
  }

  async getTotalStoredBytes(): Promise<number> {
    await this.dbReady;
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);

      const request = store.getAll();
      request.onsuccess = () => {
        const chunks = request.result as StoredChunk[];
        const total = chunks.reduce((sum, chunk) => sum + chunk.data.size, 0);
        resolve(total);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBBackup = new IndexedDBBackup();

export type { StoredChunk, StoredSession };
