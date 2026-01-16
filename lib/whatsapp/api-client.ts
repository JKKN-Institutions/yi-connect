/**
 * WhatsApp API Client - Full MCP Parity
 *
 * Calls the external Railway WhatsApp service for all WhatsApp operations.
 * Supports all 54 endpoints matching WhatsApp MCP capabilities.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

export interface StatusResponse {
  status: ConnectionStatus;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkSendResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    phone: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface Message {
  id: string;
  body: string;
  from: string;
  to: string;
  timestamp: number;
  fromMe: boolean;
  hasMedia: boolean;
  type: string;
}

export interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage?: string;
}

export interface Contact {
  id: string;
  name: string | null;
  pushname: string | null;
  isMyContact: boolean;
  isWAContact: boolean;
}

export interface GroupParticipant {
  id: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

function getServiceUrl(): string | undefined {
  return process.env.WHATSAPP_SERVICE_URL;
}

function getApiKey(): string | undefined {
  return process.env.WHATSAPP_API_KEY;
}

export function isServiceConfigured(): boolean {
  const url = getServiceUrl();
  const key = getApiKey();
  return !!(url && key);
}

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': getApiKey() || ''
  };
}

// =============================================================================
// BASE REQUEST
// =============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const serviceUrl = getServiceUrl();
  const apiKey = getApiKey();

  if (!serviceUrl) {
    throw new Error('WHATSAPP_SERVICE_URL not configured');
  }

  if (!apiKey) {
    throw new Error('WHATSAPP_API_KEY not configured');
  }

  const url = `${serviceUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp API] Error:`, data);
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('WhatsApp service unreachable. Is it running?');
    }
    throw error;
  }
}

// =============================================================================
// CATEGORY 1: CONNECTION MANAGEMENT (3 endpoints)
// =============================================================================

export async function connectWhatsAppAPI(): Promise<{
  success: boolean;
  status: ConnectionStatus;
  qrCode?: string | null;
  error?: string;
}> {
  return apiRequest('/connect', { method: 'POST' });
}

export async function getWhatsAppStatusAPI(): Promise<StatusResponse> {
  return apiRequest('/status');
}

export async function disconnectWhatsAppAPI(): Promise<{ success: boolean }> {
  return apiRequest('/disconnect', { method: 'POST' });
}

// =============================================================================
// CATEGORY 2: MESSAGING (10 endpoints)
// =============================================================================

export async function sendMessageAPI(
  recipient: string,
  message: string,
  options?: { reply_to?: string; reply_to_sender?: string }
): Promise<SendMessageResult> {
  return apiRequest('/messages', {
    method: 'POST',
    body: JSON.stringify({ recipient, message, ...options })
  });
}

export async function sendFileAPI(
  recipient: string,
  mediaPath: string
): Promise<SendMessageResult> {
  return apiRequest('/messages/file', {
    method: 'POST',
    body: JSON.stringify({ recipient, media_path: mediaPath })
  });
}

export async function sendAudioMessageAPI(
  recipient: string,
  mediaPath: string
): Promise<SendMessageResult> {
  return apiRequest('/messages/audio', {
    method: 'POST',
    body: JSON.stringify({ recipient, media_path: mediaPath })
  });
}

export async function listMessagesAPI(
  chatJid: string,
  options?: { limit?: number; include_context?: boolean }
): Promise<{ success: boolean; messages: Message[] }> {
  const params = new URLSearchParams();
  params.set('chat_jid', chatJid);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.include_context !== undefined) {
    params.set('include_context', String(options.include_context));
  }
  return apiRequest(`/messages?${params}`);
}

export async function forwardMessageAPI(
  sourceChatJid: string,
  messageId: string,
  targetChatJid: string
): Promise<{ success: boolean }> {
  return apiRequest('/messages/forward', {
    method: 'POST',
    body: JSON.stringify({
      source_chat_jid: sourceChatJid,
      message_id: messageId,
      target_chat_jid: targetChatJid
    })
  });
}

export async function editMessageAPI(
  messageId: string,
  chatJid: string,
  newContent: string
): Promise<{ success: boolean }> {
  return apiRequest(`/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ chat_jid: chatJid, new_content: newContent })
  });
}

export async function deleteMessageAPI(
  messageId: string,
  chatJid: string,
  forEveryone: boolean = true
): Promise<{ success: boolean }> {
  return apiRequest(`/messages/${messageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ chat_jid: chatJid, for_everyone: forEveryone })
  });
}

export async function sendReactionAPI(
  chatJid: string,
  messageId: string,
  reaction: string
): Promise<{ success: boolean }> {
  return apiRequest('/messages/react', {
    method: 'POST',
    body: JSON.stringify({ chat_jid: chatJid, message_id: messageId, reaction })
  });
}

export async function downloadMediaAPI(
  messageId: string,
  chatJid: string
): Promise<{ success: boolean; filePath?: string }> {
  return apiRequest('/messages/media', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId, chat_jid: chatJid })
  });
}

export async function sendBulkMessagesAPI(
  recipients: Array<{ phone: string; message: string }>,
  delayMs: number = 1500
): Promise<BulkSendResult> {
  return apiRequest('/messages/bulk', {
    method: 'POST',
    body: JSON.stringify({ recipients, delay_ms: delayMs })
  });
}

// =============================================================================
// CATEGORY 3: CHATS & CONTACTS (7 endpoints)
// =============================================================================

export async function searchContactsAPI(
  query: string
): Promise<{ success: boolean; contacts: Contact[] }> {
  return apiRequest(`/contacts/search?query=${encodeURIComponent(query)}`);
}

export async function listChatsAPI(options?: {
  limit?: number;
  include_last_message?: boolean;
}): Promise<{ success: boolean; chats: Chat[]; count: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.include_last_message !== undefined) {
    params.set('include_last_message', String(options.include_last_message));
  }
  return apiRequest(`/chats?${params}`);
}

export async function getChatAPI(
  chatJid: string
): Promise<{ success: boolean; chat: Chat }> {
  return apiRequest(`/chats/${encodeURIComponent(chatJid)}`);
}

export async function getDirectChatByContactAPI(
  phoneNumber: string
): Promise<{ success: boolean; chat: Chat }> {
  return apiRequest(`/contacts/${encodeURIComponent(phoneNumber)}/chat`);
}

export async function getContactChatsAPI(
  jid: string,
  options?: { limit?: number }
): Promise<{ success: boolean; chats: Chat[] }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  return apiRequest(`/contacts/${encodeURIComponent(jid)}/chats?${params}`);
}

export async function getLastInteractionAPI(
  jid: string
): Promise<{ success: boolean; message: Message | null }> {
  return apiRequest(`/contacts/${encodeURIComponent(jid)}/last`);
}

export async function markReadAPI(
  chatJid: string,
  messageIds: string[]
): Promise<{ success: boolean }> {
  return apiRequest('/messages/read', {
    method: 'POST',
    body: JSON.stringify({ chat_jid: chatJid, message_ids: messageIds })
  });
}

// =============================================================================
// CATEGORY 4: GROUP MANAGEMENT (17 endpoints)
// =============================================================================

export async function getJoinedGroupsAPI(): Promise<{
  success: boolean;
  groups: any[];
  count: number;
}> {
  return apiRequest('/groups');
}

export async function getGroupParticipantsAPI(
  groupJid: string
): Promise<{ success: boolean; participants: GroupParticipant[]; count: number }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/participants`);
}

export async function createGroupAPI(
  name: string,
  participants?: string[]
): Promise<{ success: boolean; gid: string }> {
  return apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, participants })
  });
}

export async function leaveGroupAPI(
  groupJid: string
): Promise<{ success: boolean }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/leave`, {
    method: 'POST'
  });
}

export async function setGroupNameAPI(
  groupJid: string,
  name: string
): Promise<{ success: boolean }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name })
  });
}

export async function setGroupDescriptionAPI(
  groupJid: string,
  description: string
): Promise<{ success: boolean }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description })
  });
}

export async function setGroupPhotoAPI(
  groupJid: string,
  photoPath: string
): Promise<{ success: boolean }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/photo`, {
    method: 'PATCH',
    body: JSON.stringify({ photo_path: photoPath })
  });
}

export async function addGroupMembersAPI(
  groupJid: string,
  participants: string[]
): Promise<{ success: boolean; result: any }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/members`, {
    method: 'POST',
    body: JSON.stringify({ participants })
  });
}

export async function removeGroupMembersAPI(
  groupJid: string,
  participants: string[]
): Promise<{ success: boolean; result: any }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/members`, {
    method: 'DELETE',
    body: JSON.stringify({ participants })
  });
}

export async function promoteGroupAdminAPI(
  groupJid: string,
  participants: string[]
): Promise<{ success: boolean; result: any }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/admins`, {
    method: 'POST',
    body: JSON.stringify({ participants })
  });
}

export async function demoteGroupAdminAPI(
  groupJid: string,
  participants: string[]
): Promise<{ success: boolean; result: any }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/admins`, {
    method: 'DELETE',
    body: JSON.stringify({ participants })
  });
}

export async function setGroupAnnounceAPI(
  groupJid: string,
  announce: boolean
): Promise<{ success: boolean }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/announce`, {
    method: 'PATCH',
    body: JSON.stringify({ announce })
  });
}

export async function setGroupLockedAPI(
  groupJid: string,
  locked: boolean
): Promise<{ success: boolean }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/locked`, {
    method: 'PATCH',
    body: JSON.stringify({ locked })
  });
}

export async function getGroupInviteLinkAPI(
  groupJid: string,
  reset: boolean = false
): Promise<{ success: boolean; inviteLink: string }> {
  return apiRequest(`/groups/${encodeURIComponent(groupJid)}/invite?reset=${reset}`);
}

export async function joinGroupWithLinkAPI(
  inviteLink: string
): Promise<{ success: boolean; groupId: string }> {
  return apiRequest('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ invite_link: inviteLink })
  });
}

export async function previewGroupLinkAPI(
  inviteLink: string
): Promise<{ success: boolean; group: any }> {
  return apiRequest(`/groups/preview?invite_link=${encodeURIComponent(inviteLink)}`);
}

export async function createPollAPI(
  chatJid: string,
  question: string,
  options: string[],
  maxSelections: number = 1
): Promise<{ success: boolean; messageId: string }> {
  return apiRequest('/groups/polls', {
    method: 'POST',
    body: JSON.stringify({
      chat_jid: chatJid,
      question,
      options,
      max_selections: maxSelections
    })
  });
}

// =============================================================================
// CATEGORY 5: NEWSLETTERS (7 endpoints)
// =============================================================================

export async function listSubscribedNewslettersAPI(): Promise<{
  success: boolean;
  newsletters: any[];
  count: number;
}> {
  return apiRequest('/newsletters');
}

export async function getNewsletterInfoAPI(
  jid: string
): Promise<{ success: boolean; newsletter: any }> {
  return apiRequest(`/newsletters/${encodeURIComponent(jid)}`);
}

export async function previewNewsletterLinkAPI(
  inviteLink: string
): Promise<{ success: boolean; newsletter: any }> {
  return apiRequest(`/newsletters/preview?invite_link=${encodeURIComponent(inviteLink)}`);
}

export async function followNewsletterAPI(
  jid: string
): Promise<{ success: boolean }> {
  return apiRequest(`/newsletters/${encodeURIComponent(jid)}/follow`, {
    method: 'POST'
  });
}

export async function unfollowNewsletterAPI(
  jid: string
): Promise<{ success: boolean }> {
  return apiRequest(`/newsletters/${encodeURIComponent(jid)}/unfollow`, {
    method: 'POST'
  });
}

export async function reactToNewsletterMessageAPI(
  jid: string,
  serverId: number,
  messageId: string,
  reaction: string
): Promise<{ success: boolean }> {
  return apiRequest(`/newsletters/${encodeURIComponent(jid)}/react`, {
    method: 'POST',
    body: JSON.stringify({
      server_id: serverId,
      message_id: messageId,
      reaction
    })
  });
}

export async function createNewsletterAPI(
  name: string,
  description?: string
): Promise<{ success: boolean; newsletter: any }> {
  return apiRequest('/newsletters', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  });
}

// =============================================================================
// CATEGORY 6: LID RESOLUTION (6 endpoints)
// =============================================================================

export async function resolveLidAPI(
  lid: string
): Promise<{ success: boolean; lid: string; phone_number?: string; name?: string }> {
  return apiRequest(`/lid/resolve?lid=${encodeURIComponent(lid)}`);
}

export async function resolvePhoneToLidAPI(
  phone: string
): Promise<{ success: boolean; phone: string; lid?: string }> {
  return apiRequest(`/lid/phone?phone=${encodeURIComponent(phone)}`);
}

export async function resolveBatchLidsAPI(
  lids?: string[],
  phones?: string[]
): Promise<{ success: boolean; lidResults: any; phoneResults: any }> {
  return apiRequest('/lid/batch', {
    method: 'POST',
    body: JSON.stringify({ lids, phones })
  });
}

export async function getLidCacheStatsAPI(): Promise<{
  success: boolean;
  total_mappings: number;
  with_names: number;
}> {
  return apiRequest('/lid/stats');
}

export async function listLidMappingsAPI(
  limit: number = 100
): Promise<{ success: boolean; mappings: any[]; count: number }> {
  return apiRequest(`/lid/mappings?limit=${limit}`);
}

export async function populateLidCacheAPI(): Promise<{
  success: boolean;
  groups_processed: number;
  mappings_added: number;
}> {
  return apiRequest('/lid/populate', { method: 'POST' });
}

// =============================================================================
// CATEGORY 7: PROFILE & STATUS (5 endpoints)
// =============================================================================

export async function setStatusMessageAPI(
  status: string
): Promise<{ success: boolean }> {
  return apiRequest('/profile/status', {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function getProfilePictureAPI(
  jid: string
): Promise<{ success: boolean; url?: string }> {
  return apiRequest(`/profile/${encodeURIComponent(jid)}/picture`);
}

export async function getUserInfoAPI(
  jids: string[]
): Promise<{ success: boolean; users: any[] }> {
  return apiRequest('/profile/users/info', {
    method: 'POST',
    body: JSON.stringify({ jids })
  });
}

export async function getBusinessProfileAPI(
  jid: string
): Promise<{ success: boolean; profile: any }> {
  return apiRequest(`/profile/business/${encodeURIComponent(jid)}`);
}

// =============================================================================
// CATEGORY 8: UTILITIES (2 endpoints)
// =============================================================================

export async function sendTypingIndicatorAPI(
  chatJid: string,
  typing: boolean = true
): Promise<{ success: boolean }> {
  return apiRequest('/typing', {
    method: 'POST',
    body: JSON.stringify({ chat_jid: chatJid, typing })
  });
}

export async function isOnWhatsAppAPI(
  phoneNumbers: string[]
): Promise<{
  success: boolean;
  summary: { total: number; registered: number; notRegistered: number };
  results: Array<{ phone: string; isRegistered: boolean }>;
}> {
  return apiRequest('/check', {
    method: 'POST',
    body: JSON.stringify({ phone_numbers: phoneNumbers })
  });
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export async function checkHealthAPI(): Promise<{ status: string; timestamp: string }> {
  const serviceUrl = getServiceUrl();
  if (!serviceUrl) {
    return { status: 'not_configured', timestamp: new Date().toISOString() };
  }

  try {
    const response = await fetch(`${serviceUrl}/health`);
    return await response.json();
  } catch {
    return { status: 'unreachable', timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

// Keep old function names for backward compatibility
export const sendGroupMessageAPI = sendMessageAPI;
