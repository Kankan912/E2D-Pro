import { supabase } from '@/integrations/supabase/client';

import { logger } from "@/lib/logger";
export type SessionType = 'super_admin' | 'editor' | 'readonly';

export interface SessionConfig {
  role_type: SessionType;
  session_duration_minutes: number;
  inactivity_timeout_minutes: number;
  warning_before_logout_seconds: number;
}

export interface Permission {
  resource: string;
  permission: string;
}

/**
 * Détermine le type de session selon le rôle et les permissions
 */
export const getRoleSessionType = (
  roleName: string | null, 
  permissions: Permission[]
): SessionType => {
  // Super Admin - rôle administrateur
  if (roleName && ['administrateur', 'Administrateur', 'admin', 'super_admin'].includes(roleName)) {
    return 'super_admin';
  }
  
  // Éditeur - a des permissions d'écriture/suppression/mise à jour/création
  const hasEditPermissions = permissions.some(p => 
    ['write', 'delete', 'update', 'create'].includes(p.permission)
  );
  
  if (hasEditPermissions) {
    return 'editor';
  }
  
  // Lecture seule par défaut
  return 'readonly';
};

/**
 * Récupère la configuration de session depuis la base de données
 */
export const fetchSessionConfig = async (roleType: SessionType): Promise<SessionConfig | null> => {
  const { data, error } = await supabase
    .from('session_config')
    .select('*')
    .eq('role_type', roleType)
    .single();

  if (error) {
    logger.error('❌ [SessionUtils] Error fetching session config:', error);
    return null;
  }

  return data as SessionConfig;
};

/**
 * Configuration par défaut si la base n'est pas accessible
 */
export const getDefaultSessionConfig = (roleType: SessionType): SessionConfig => {
  const defaults: Record<SessionType, SessionConfig> = {
    super_admin: {
      role_type: 'super_admin',
      session_duration_minutes: 1440, // 24h
      inactivity_timeout_minutes: 180, // 3h
      warning_before_logout_seconds: 120 // 2min
    },
    editor: {
      role_type: 'editor',
      session_duration_minutes: 240, // 4h
      inactivity_timeout_minutes: 30, // 30min
      warning_before_logout_seconds: 60 // 1min
    },
    readonly: {
      role_type: 'readonly',
      session_duration_minutes: 150, // 2h30
      inactivity_timeout_minutes: 15, // 15min
      warning_before_logout_seconds: 30 // 30s
    }
  };

  return defaults[roleType];
};

/**
 * Calcule le temps restant en minutes depuis une date
 */
export const calculateRemainingTime = (
  startTime: Date,
  durationMinutes: number
): number => {
  const now = new Date();
  const elapsedMs = now.getTime() - startTime.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  return Math.max(0, durationMinutes - elapsedMinutes);
};

/**
 * Formate le temps en format lisible
 */
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
};
