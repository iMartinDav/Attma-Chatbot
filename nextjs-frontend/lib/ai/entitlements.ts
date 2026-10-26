/**
 * User entitlements and rate limiting configurations
 */

export type UserType = 'free' | 'pro' | 'enterprise';

export interface UserEntitlements {
  maxMessagesPerDay: number;
  maxFilesPerUpload: number;
  maxFileSize: number; // in bytes
  canUseAdvancedModels: boolean;
  canUseWebSearch: boolean;
  canUseBioflow: boolean;
  maxConcurrentRequests: number;
}

export const entitlementsByUserType: Record<UserType, UserEntitlements> = {
  free: {
    maxMessagesPerDay: 50,
    maxFilesPerUpload: 3,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    canUseAdvancedModels: false,
    canUseWebSearch: true,
    canUseBioflow: false,
    maxConcurrentRequests: 2,
  },
  pro: {
    maxMessagesPerDay: 500,
    maxFilesPerUpload: 10,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    canUseAdvancedModels: true,
    canUseWebSearch: true,
    canUseBioflow: true,
    maxConcurrentRequests: 5,
  },
  enterprise: {
    maxMessagesPerDay: 2000,
    maxFilesPerUpload: 50,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    canUseAdvancedModels: true,
    canUseWebSearch: true,
    canUseBioflow: true,
    maxConcurrentRequests: 10,
  },
};

// Helper functions
export function getUserEntitlements(userType: UserType): UserEntitlements {
  return entitlementsByUserType[userType];
}

export function canUserPerformAction(
  userType: UserType,
  action: keyof Omit<
    UserEntitlements,
    | 'maxMessagesPerDay'
    | 'maxFilesPerUpload'
    | 'maxFileSize'
    | 'maxConcurrentRequests'
  >,
): boolean {
  return entitlementsByUserType[userType][action];
}

export function isWithinLimit(
  userType: UserType,
  limitType: 'messages' | 'files' | 'fileSize' | 'concurrentRequests',
  currentValue: number,
): boolean {
  const entitlements = entitlementsByUserType[userType];

  switch (limitType) {
    case 'messages':
      return currentValue <= entitlements.maxMessagesPerDay;
    case 'files':
      return currentValue <= entitlements.maxFilesPerUpload;
    case 'fileSize':
      return currentValue <= entitlements.maxFileSize;
    case 'concurrentRequests':
      return currentValue <= entitlements.maxConcurrentRequests;
    default:
      return false;
  }
}
