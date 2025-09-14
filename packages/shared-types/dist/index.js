"use strict";
// =============================================================================
// CORE SESSION TYPES
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSessionEvent = isSessionEvent;
exports.isOpenAIEvent = isOpenAIEvent;
exports.isFunctionCallItem = isFunctionCallItem;
exports.isMessageItem = isMessageItem;
// =============================================================================
// TYPE GUARDS
// =============================================================================
function isSessionEvent(message) {
    return ['sessions_list', 'session_created', 'session_updated', 'session_closed'].includes(message.type);
}
function isOpenAIEvent(message) {
    return 'sessionId' in message && 'timestamp' in message && !isSessionEvent(message);
}
function isFunctionCallItem(item) {
    return item.type === 'function_call' && !!item.name && !!item.call_id;
}
function isMessageItem(item) {
    return item.type === 'message' && !!item.role;
}
