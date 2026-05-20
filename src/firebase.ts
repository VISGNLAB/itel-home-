import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Authentication helpers
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// User profile and usage helpers
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: any;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`/api/user/profile/${uid}`);
    if (!response.ok) return null;
    const profile = await response.json();
    return profile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

export const createUserProfile = async (user: FirebaseUser): Promise<UserProfile> => {
  const profile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
  };
  
  try {
    const response = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const updatedProfile = await response.json();
    sessionStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(updatedProfile));
    return updatedProfile;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

export const getDailyUsage = async (uid: string): Promise<number> => {
  try {
    const response = await fetch(`/api/user/usage/${uid}`);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error('Error getting daily usage:', error);
    return 0;
  }
};

export const incrementDailyUsage = async (uid: string) => {
  try {
    await fetch(`/api/user/usage/increment/${uid}`, { method: 'POST' });
  } catch (error) {
    console.error('Error incrementing daily usage:', error);
  }
};

// Render History
export interface RenderHistory {
  id?: string;
  userId: string;
  imageUrl: string;
  prompt: string;
  tier: string;
  location: string;
  city?: string;
  renderAngle?: string;
  createdAt: any;
  isVerified?: boolean;
  label?: string;
  sampleType?: 'render' | 'photo';
}

// R2 Upload Helper
export const uploadToR2 = async (imageBase64: string, folder: string = 'renders'): Promise<string> => {
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, folder })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const { url } = await response.json();
    return url;
  } catch (error) {
    console.error('R2 Upload Error:', error);
    // Fallback to base64 if upload fails (to maintain functionality)
    return imageBase64;
  }
};

export const saveRenderToHistory = async (render: Omit<RenderHistory, 'createdAt'>): Promise<string> => {
  try {
    // If the image is base64, try to upload to R2 first
    let finalImageUrl = render.imageUrl;
    if (render.imageUrl.startsWith('data:image')) {
      // Use 'sync-standard-library' folder for verified samples, otherwise default 'renders'
      const folder = render.isVerified ? 'sync-standard-library' : 'renders';
      finalImageUrl = await uploadToR2(render.imageUrl, folder);
    }

    const response = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...render, imageUrl: finalImageUrl })
    });
    const data = await response.json();
    
    // Clear history cache
    localStorage.removeItem(`user_history_${render.userId}`);
    
    return data.id;
  } catch (error) {
    console.error('Error saving render to history:', error);
    throw error;
  }
};

export const getUserHistory = async (uid: string, limitCount: number = 10): Promise<RenderHistory[]> => {
  // Try localStorage cache first
  const cacheKey = `user_history_${uid}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const results = JSON.parse(cached);
      return results.map((item: any) => ({
        ...item,
        createdAt: { toDate: () => new Date(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt) }
      }));
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }

  try {
    const response = await fetch(`/api/history/${uid}?limit=${limitCount}`);
    if (!response.ok) return [];
    const results = await response.json();
    
    localStorage.setItem(cacheKey, JSON.stringify(results));
    return results;
  } catch (error) {
    console.error('Error getting user history:', error);
    return [];
  }
};

export const getVerifiedExamples = async (tier?: string, limitCount: number = 10): Promise<RenderHistory[]> => {
  try {
    const response = await fetch('/api/verified-examples');
    if (!response.ok) return [];
    const results = await response.json();
    
    if (tier) {
      return results.filter((item: any) => item.tier === tier).slice(0, limitCount);
    }
    
    return results.slice(0, limitCount);
  } catch (error) {
    console.error('Error getting verified examples:', error);
    return [];
  }
};

export const verifyRender = async (renderId: string, label: string, renderAngle?: string): Promise<void> => {
  try {
    await fetch('/api/verify-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: renderId, isVerified: true, label, renderAngle })
    });
  } catch (error) {
    console.error('Error verifying render:', error);
  }
};

// Global Config Helpers
export const getSystemConfig = async (key: string): Promise<any | null> => {
  try {
    const response = await fetch(`/api/config/${key}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Error getting config ${key}:`, error);
    return null;
  }
};

export const updateSystemConfig = async (key: string, value: any): Promise<void> => {
  try {
    await fetch(`/api/config/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
  } catch (error) {
    console.error(`Error updating config ${key}:`, error);
    throw error;
  }
};
