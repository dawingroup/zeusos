/**
 * Memos module — written context for finance, administrative and operational
 * decisions, routed through the people named under Through to the people
 * named under To, signed, numbered and issued as a frozen PDF.
 * (DawinOS stream G port — docs/PHASE_6_G_MEMOS.md.)
 */
export * from './types/memo';
export * from './constants/memoTemplates';
export * from './constants/memoStatus';
export * from './utils/memoApproval';
export * from './utils/memoRoute';
export * from './utils/memoTasks';
export * from './utils/memoNumber';
export * from './utils/memoProse';
export * from './utils/memoPrefill';
export * from './utils/memoDeletion';
export * from './services/memoService';
export * from './services/memoActions';
export * from './services/memoCommentService';
export { WriteMemoButton, type WriteMemoButtonProps } from './components/WriteMemoButton';
export * from './hooks/useMemos';
export * from './hooks/useMemoDoc';
export * from './hooks/useMemoComments';
export * from './hooks/useMemoActor';
// The PDF document model is pure; the renderer (./pdf/memoPdf) is imported
// lazily by the pages so @react-pdf stays out of the main bundle.
export * from './pdf/memoDocData';
