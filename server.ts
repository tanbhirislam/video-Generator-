import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (using client config for simplicity in this environment)
// In a real production app, you'd use a service account key.
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminDb = getFirestore();
const adminAuth = getAuth();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Middleware ---
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = async (req: any, res: any, next: any) => {
    const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    if (userData?.role === 'admin' || req.user.email === 'businessonline.6251@gmail.com') {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  };

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get user profile and credits
  app.get("/api/profile", authenticate, async (req: any, res) => {
    try {
      const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(userDoc.data());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Record video generation request and check credits
  app.post("/api/generate-video", authenticate, async (req: any, res) => {
    const { prompt, isKidsStory, templateId } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
      const userRef = adminDb.collection('users').doc(req.user.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      
      const settingsDoc = await adminDb.collection('settings').doc('global').get();
      const settings = settingsDoc.data();

      const isFree = settings?.freeMode || userData?.role === 'admin' || req.user.email === 'businessonline.6251@gmail.com';

      if (!isFree && (userData?.credits || 0) <= 0) {
        return res.status(403).json({ error: 'Insufficient credits' });
      }

      // Deduct credit if not free
      if (!isFree) {
        await userRef.update({ credits: FieldValue.increment(-1) });
      }

      // Create video record
      const videoRef = await adminDb.collection('videos').add({
        prompt,
        status: 'processing',
        userId: req.user.uid,
        isKidsStory: isKidsStory || false,
        templateId: templateId || null,
        createdAt: new Date().toISOString()
      });

      // Note: Actual AI generation is triggered from the frontend per platform guidelines
      // This endpoint handles the business logic (credits, records)
      res.json({ id: videoRef.id, status: 'processing' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get video status
  app.get("/api/video-status/:id", authenticate, async (req: any, res) => {
    try {
      const videoDoc = await adminDb.collection('videos').doc(req.params.id).get();
      if (!videoDoc.exists) return res.status(404).json({ error: 'Video not found' });
      
      const videoData = videoDoc.data();
      if (videoData?.userId !== req.user.uid && !await isAdminCheck(req.user.uid)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      res.json({ id: videoDoc.id, ...videoData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update user credits
  app.post("/api/admin/update-credits", authenticate, isAdmin, async (req, res) => {
    const { userId, amount } = req.body;
    try {
      await adminDb.collection('users').doc(userId).update({
        credits: FieldValue.increment(amount)
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Toggle Free Mode
  app.post("/api/admin/toggle-free-mode", authenticate, isAdmin, async (req, res) => {
    try {
      const settingsRef = adminDb.collection('settings').doc('global');
      const settingsDoc = await settingsRef.get();
      const currentMode = settingsDoc.data()?.freeMode || false;
      
      await settingsRef.set({ freeMode: !currentMode }, { merge: true });
      res.json({ success: true, freeMode: !currentMode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all users
  app.get("/api/admin/users", authenticate, isAdmin, async (req, res) => {
    try {
      const usersSnapshot = await adminDb.collection('users').get();
      const users = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper for isAdmin check outside middleware
  async function isAdminCheck(uid: string) {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    return userDoc.data()?.role === 'admin' || userDoc.data()?.email === 'businessonline.6251@gmail.com';
  }

  // --- Local Model Integration (Python Bridge) ---
  // This endpoint proxies requests to our Python worker (bridge.py)
  app.post("/api/generate-local", authenticate, async (req: any, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
      // 1. Check credits (same logic as before)
      const userRef = adminDb.collection('users').doc(req.user.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      
      if ((userData?.credits || 0) <= 0 && userData?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient credits' });
      }

      // 2. Call the Python Bridge (AnimateDiff / SVD)
      // Note: In a real setup, this would be a separate server on your GPU machine
      const pythonBridgeUrl = process.env.PYTHON_BRIDGE_URL || 'http://localhost:8000/generate';
      
      const pythonResponse = await fetch(pythonBridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!pythonResponse.ok) {
        throw new Error('Local model worker failed or is offline');
      }

      const { url: videoUrl, id: videoId } = await pythonResponse.json();

      // 3. Deduct credit and record the video
      await userRef.update({ credits: FieldValue.increment(-1) });
      
      const videoRef = await adminDb.collection('videos').add({
        prompt,
        status: 'completed',
        userId: req.user.uid,
        downloadUrl: videoUrl,
        model: 'local-animatediff',
        createdAt: new Date().toISOString()
      });

      res.json({ id: videoRef.id, url: videoUrl, status: 'completed' });
    } catch (error: any) {
      console.error('Local generation error:', error);
      res.status(500).json({ error: 'Local model integration error: ' + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
