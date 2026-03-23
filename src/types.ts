export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  credits: number;
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface StoryTemplate {
  id: string;
  title: string;
  description: string;
  basePrompt: string;
  icon: string;
  color: string;
}

export interface VideoRecord {
  id: string;
  prompt: string;
  status: VideoStatus;
  downloadUrl?: string;
  audioUrl?: string;
  userId: string;
  createdAt: string;
  isKidsStory?: boolean;
  templateId?: string;
}

export interface GlobalSettings {
  freeMode: boolean;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
