/**
 * FX Exposure Service
 *
 * FX risk management, exposure tracking, and hedging recommendations.
 *
 * @module services/fx
 */

export { FXExposureService } from './fx-exposure-service.js';
export type {
  IFXRateProvider,
  IExposureDataSource,
  IHedgeRepository,
} from './fx-exposure-service.js';

export type {
  CurrencyPair,
  FXRate,
  FXRateSource,
  FXExposure,
  ExposureType,
  ExposurePosition,
  ExposureSource,
  ExposureCertainty,
  HedgeInstrument,
  HedgeInstrumentType,
  HedgeStatus,
  HedgingPolicy,
  HedgeRecommendation,
  FXTradeRequest,
  FXTradeResult,
  VaRResult,
  VaRMethod,
  FXExposureSummary,
  CurrencyExposureSummary,
  MaturityBucket,
  FXAlert,
  FXAlertType,
} from './types.js';
