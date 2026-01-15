// ===========================================================
// lib/meta/index.ts - Re-exports centralizados
// ===========================================================

// Core CAPI functions
export {
  sendCapiEvent,
  sendPurchaseEvent,
  sendScheduleEvent,
  buildCapiPayload,
  hashForMeta,
  generateServerEventId,
  type MetaEventName,
  type ActionSource,
  type CapiUserData,
  type CapiCustomData,
  type CapiEventInput,
  type CapiResponse,
} from './capi';

// Integration helpers
export {
  getMetaContext,
  ensureMetaContext,
  sendCapiPurchase,
  sendCapiSchedule,
  isCapiEventSent,
  type MetaEventContextData,
  type SendCapiPurchaseParams,
  type SendCapiScheduleParams,
} from './capi-integration';
