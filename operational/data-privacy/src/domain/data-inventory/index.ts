/**
 * Data Inventory Domain Module
 * GDPR Article 30 - Records of Processing Activities
 */

// Models
export type {
  ProcessingActivity,
  ActivityStatus,
  LawfulBasis,
  DataCategory,
  SpecialCategory,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityQueryFilter,
} from './models/processing-activity.js';

export {
  hasSpecialCategoryData,
  hasThirdCountryTransfers,
  shouldRequireDPIA,
  isReviewDue,
  calculateNextReviewDate,
  canArchive,
  validateSpecialCategoryBasis,
} from './models/processing-activity.js';

// Repository
export type { ActivityRepository } from './repositories/activity.repository.js';

// Service
export { ActivityService } from './services/activity.service.js';
export type { ServiceResult, ServiceError } from './services/activity.service.js';
