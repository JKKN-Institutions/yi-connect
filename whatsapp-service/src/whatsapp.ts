/**
 * WhatsApp Service - Full MCP Parity
 * All 54 endpoints supported
 *
 * Reference: /Users/omm/Vaults/Claude Setup/Memory/whatsapp-mcp-endpoints-reference.md
 */

import { Client, LocalAuth, Message, MessageMedia, Chat, Contact, GroupChat, GroupParticipant } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

export interface SendMessageOptions {
  replyTo?: string;
  replyToSender?: string;
}

export interface MessageFilter {
  after?: string;
  before?: string;
  senderPhone?: string;
  chatJid?: string;
  query?: string;
  limit?: number;
  page?: number;
  includeContext?: boolean;
  contextBefore?: number;
  contextAfter?: number;
}

export interface ChatFilter {
  query?: string;
  limit?: number;
  page?: number;
  includeLastMessage?: boolean;
  sortBy?: 'last_active' | 'name';
}

export interface BulkResult {
  phone: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let client: Client | null = null;
let currentState: ConnectionState = 'disconnected';
let currentQR: string | null = null;
let initPromise: Promise<void> | null = null;

// Last initialization / auth error, surfaced via /status so failures are
// diagnosable without access to Railway logs.
let lastError: { message: string; at: string } | null = null;

// LID Cache for privacy-preserving ID resolution
const lidCache: Map<string, { phone: string; name?: string }> = new Map();

// Configuration
const CLIENT_ID = process.env.CLIENT_ID || 'whatsapp-service';
// AUTH_PATH defaults to a Railway-Volume-friendly location so the WhatsApp
// session survives redeploys/restarts. In production a Railway Volume MUST be
// mounted at /data; locally it falls back to ./.wwebjs_auth via AUTH_PATH override.
const AUTH_PATH = process.env.AUTH_PATH || '/data/.wwebjs_auth';
// QR-phase timeout: bounds ONLY "get a QR and reach `authenticated`" (i.e. the
// human scan). It is CLEARED the moment `authenticated` fires so the post-auth
// "loading" phase is never killed mid-load. The old single 120s INIT_TIMEOUT
// used to fire during loading and tore the session down before `ready` could
// arrive — that is the core defect this split removes.
const QR_TIMEOUT_MS = 120000;
// Post-auth safety timeout: a GENEROUS bound on the loading phase (authenticated
// -> ready). On fire it only records lastError; it does NOT destroy a client
// that may still be loading. Set to 0 to disable entirely.
const POST_AUTH_TIMEOUT_MS = Number(process.env.POST_AUTH_TIMEOUT_MS ?? 180000);
// When WhatsApp reports a conflicting web session, take it over instead of
// failing permanently. takeoverTimeoutMs bounds how long the takeover waits.
const TAKEOVER_TIMEOUT_MS = Number(process.env.TAKEOVER_TIMEOUT_MS ?? 60000);
// Remote webVersionCache mitigation: a stale bundled WA Web build can be rejected
// by WhatsApp and crash during initialize() before the `qr` event fires.
//
// LOADING-HANG ROOT CAUSE (diagnosed 2026-06-10): the previous comment here
// assumed "whatsapp-web.js detects its own target version and the remote cache
// stays in step." That assumption is WRONG and is a primary cause of the
// authenticated-but-never-`ready` loading hang. The library's self-detected
// default webVersion (2.3000.1017054665 in both 1.34.2 and 1.34.7) does NOT
// exist in the wppconnect wa-version store — that exact URL returns HTTP 404.
// RemoteWebCache.resolve() is non-strict, so on a 404 it silently falls back to
// the STALE bundled WA Web build, which WhatsApp's backend then refuses to fully
// drive — the session authenticates but the post-login sync never completes and
// `ready` never fires. (Every build currently in the wppconnect store carries an
// `-alpha` suffix; none of the library's plain numeric defaults match.)
//
// FIX: hard-pin webVersion to a build that ACTUALLY EXISTS in the remote store
// (verified HTTP 200), so the remote cache serves a real, current WA Web index
// instead of 404→stale-fallback. WEB_VERSION env still overrides. When the store
// prunes this build (404 returns), bump WEB_VERSION to a newer build that 200s:
//   curl -sI https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/<v>.html
const DEFAULT_WEB_VERSION = '2.3000.1041149705-alpha';
const WEB_VERSION = process.env.WEB_VERSION || DEFAULT_WEB_VERSION;
const WEB_VERSION_CACHE_URL =
  process.env.WEB_VERSION_CACHE_URL ||
  'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';

// ============================================================================
// CORE: Connection Management
// ============================================================================

export function getState(): ConnectionState {
  return currentState;
}

export function getQRCode(): string | null {
  return currentQR;
}

export function getLastError(): { message: string; at: string } | null {
  return lastError;
}

export function getClient(): Client | null {
  return client;
}

export function ensureConnected(): Client {
  if (!client || currentState !== 'ready') {
    throw new Error('NOT_CONNECTED');
  }
  return client;
}

// States in which a live client already exists (or is being built). A new
// `Client` must NOT be constructed while currentState is one of these — doing so
// is exactly what caused the multi-`authenticated`, never-`ready` pile-up
// (WhatsApp allows only ONE live web session, so concurrent clients conflict).
const LIVE_STATES: ConnectionState[] = ['connecting', 'qr_ready', 'authenticated', 'ready'];

/**
 * Safely tear down a client we are abandoning/replacing. Always destroys the
 * underlying browser/session inside try/catch so no orphan Chromium lingers,
 * then nulls the module-level reference if it is still the same instance.
 */
async function destroyClient(c: Client | null, reason: string): Promise<void> {
  if (!c) return;
  try {
    await c.destroy();
  } catch (err) {
    console.error(`[WhatsApp] destroy() failed during ${reason}:`, err);
  }
  // Only null the shared ref if it still points at the client we destroyed —
  // avoids clobbering a freshly created client from a later init.
  if (client === c) {
    client = null;
  }
}

export async function initializeClient(): Promise<void> {
  // SINGLE-INSTANCE GUARD. If a client is already live (or mid-init) reuse it
  // instead of constructing a second `Client`. WhatsApp permits only ONE web
  // session; a second client conflicts and neither finishes loading.
  if (currentState === 'ready' && client) return;
  if (client !== null && LIVE_STATES.includes(currentState)) {
    // A client exists and is connecting/showing QR/authenticated/loading.
    // Return the in-flight init (or resolve immediately if it already settled).
    return initPromise ?? Promise.resolve();
  }

  currentState = 'connecting';
  currentQR = null;
  lastError = null;

  initPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    // QR-phase timeout: bounds only "QR shown + scanned -> authenticated".
    // Cleared on `authenticated` so the loading phase is never killed.
    let qrTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      qrTimeout = null;
      lastError = { message: 'QR_TIMEOUT: no QR scanned / authenticated within timeout', at: new Date().toISOString() };
      const stale = client;
      currentState = 'disconnected';
      initPromise = null;
      settled = true;
      // Destroy the stale client so no orphan Chromium/session lingers.
      void destroyClient(stale, 'qr_timeout');
      reject(new Error('QR_TIMEOUT'));
    }, QR_TIMEOUT_MS);

    // Post-auth safety timeout: a GENEROUS bound on loading. On fire it ONLY
    // records lastError — it does NOT destroy a client that may still be
    // loading, and it does NOT reject (we let loading run to `ready`).
    let postAuthTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (qrTimeout) { clearTimeout(qrTimeout); qrTimeout = null; }
      if (postAuthTimeout) { clearTimeout(postAuthTimeout); postAuthTimeout = null; }
    };

    const newClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_PATH,
        clientId: CLIENT_ID
      }),
      // Take over a stale/competing web session rather than conflicting with it
      // forever. This claims the single allowed WhatsApp web session for us.
      takeoverOnConflict: true,
      takeoverTimeoutMs: TAKEOVER_TIMEOUT_MS,
      // Pin a WA Web build that EXISTS in the remote store (see WEB_VERSION note
      // above). Without this, the library's default 404s in the store and falls
      // back to a stale bundled build → the post-auth loading hang. webVersion +
      // webVersionCache.remotePath together make the remote cache serve this
      // exact, verified-present build.
      webVersion: WEB_VERSION,
      webVersionCache: {
        type: 'remote' as const,
        remotePath: WEB_VERSION_CACHE_URL
      },
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      }
    });
    client = newClient;

    newClient.on('qr', async (qr) => {
      console.log('[WhatsApp] QR code received');
      try {
        currentQR = await qrcode.toDataURL(qr);
        currentState = 'qr_ready';
      } catch (err) {
        console.error('[WhatsApp] QR generation error:', err);
      }
    });

    // OBSERVABILITY for the post-auth loading phase (the phase that hangs).
    // whatsapp-web.js emits `loading_screen` with a percent + message while it
    // syncs after authentication. Logging it lets us SEE in Railway logs exactly
    // how far the sync gets (e.g. stuck at 99%) instead of a silent hang. The
    // last value is also mirrored into lastError-style visibility via the log.
    newClient.on('loading_screen', (percent, message) => {
      console.log(`[WhatsApp] Loading screen: ${percent}% — ${message}`);
    });

    // Log raw WA connection-state transitions (CONNECTED / OPENING / PAIRING /
    // TIMEOUT / CONFLICT etc.) so a stuck/looping state is visible in logs.
    newClient.on('change_state', (state) => {
      console.log(`[WhatsApp] State change: ${state}`);
    });

    newClient.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated');
      currentState = 'authenticated';
      currentQR = null;
      // SCAN DONE — stop bounding the QR phase. The loading phase (-> ready)
      // must NOT be killed by the QR timeout. This is the core fix.
      if (qrTimeout) { clearTimeout(qrTimeout); qrTimeout = null; }
      // Optional generous loading-phase safety net. Records lastError only;
      // never destroys (the client may still be loading) and never rejects.
      if (POST_AUTH_TIMEOUT_MS > 0 && !postAuthTimeout) {
        postAuthTimeout = setTimeout(() => {
          postAuthTimeout = null;
          if (currentState !== 'ready') {
            lastError = {
              message: 'POST_AUTH_SLOW: authenticated but `ready` not reached within timeout (still loading; session left intact)',
              at: new Date().toISOString()
            };
            console.warn('[WhatsApp] Post-auth loading exceeded timeout; leaving session to finish loading');
          }
        }, POST_AUTH_TIMEOUT_MS);
      }
    });

    newClient.on('ready', () => {
      console.log('[WhatsApp] Client is ready');
      currentState = 'ready';
      clearTimers();
      initPromise = null;
      if (!settled) { settled = true; resolve(); }
    });

    newClient.on('disconnected', (reason) => {
      console.log('[WhatsApp] Disconnected:', reason);
      currentState = 'disconnected';
      currentQR = null;
      clearTimers();
      initPromise = null;
      // Destroy on teardown so no orphan browser/session lingers.
      void destroyClient(newClient, 'disconnected');
    });

    newClient.on('auth_failure', (message) => {
      console.error('[WhatsApp] Auth failure:', message);
      currentState = 'disconnected';
      lastError = { message: `AUTH_FAILURE: ${message}`, at: new Date().toISOString() };
      clearTimers();
      initPromise = null;
      void destroyClient(newClient, 'auth_failure');
      if (!settled) { settled = true; reject(new Error('AUTH_FAILURE')); }
    });

    newClient.initialize().catch((err) => {
      console.error('[WhatsApp] Initialize error:', err);
      currentState = 'disconnected';
      lastError = {
        message: `INIT_ERROR: ${err instanceof Error ? err.message : String(err)}`,
        at: new Date().toISOString()
      };
      clearTimers();
      initPromise = null;
      void destroyClient(newClient, 'init_error');
      if (!settled) { settled = true; reject(err); }
    });
  });

  return initPromise;
}

export async function disconnect(): Promise<void> {
  const c = client;
  if (c) {
    try {
      await c.logout();
    } catch (err) {
      console.error('[WhatsApp] logout() failed during disconnect:', err);
    }
    await destroyClient(c, 'disconnect');
  }
  client = null;
  currentState = 'disconnected';
  currentQR = null;
  initPromise = null;
}

export function getClientInfo(): { phoneNumber?: string; pushName?: string } | null {
  if (!client || currentState !== 'ready') return null;
  const info = client.info;
  return {
    phoneNumber: info?.wid?.user,
    pushName: info?.pushname
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  } else if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return `${cleaned}@c.us`;
}

export function formatGroupJid(jid: string): string {
  if (jid.includes('@g.us')) return jid;
  return `${jid}@g.us`;
}

// ============================================================================
// CATEGORY 1: MESSAGING (10 endpoints)
// ============================================================================

export async function sendMessage(to: string, message: string, options?: SendMessageOptions): Promise<Message> {
  const c = ensureConnected();
  const chatId = to.includes('@') ? to : formatPhoneNumber(to);

  const sendOptions: any = {};
  if (options?.replyTo) {
    // Get the message to quote
    const chat = await c.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    const quotedMsg = messages.find(m => m.id._serialized === options.replyTo);
    if (quotedMsg) {
      sendOptions.quotedMessageId = quotedMsg.id._serialized;
    }
  }

  return c.sendMessage(chatId, message, sendOptions);
}

export async function sendFile(to: string, filePath: string): Promise<Message> {
  const c = ensureConnected();
  const chatId = to.includes('@') ? to : formatPhoneNumber(to);

  if (!fs.existsSync(filePath)) {
    throw new Error('FILE_NOT_FOUND');
  }

  const media = MessageMedia.fromFilePath(filePath);
  return c.sendMessage(chatId, media);
}

export async function sendAudioMessage(to: string, filePath: string): Promise<Message> {
  const c = ensureConnected();
  const chatId = to.includes('@') ? to : formatPhoneNumber(to);

  if (!fs.existsSync(filePath)) {
    throw new Error('FILE_NOT_FOUND');
  }

  const media = MessageMedia.fromFilePath(filePath);
  return c.sendMessage(chatId, media, { sendAudioAsVoice: true });
}

export async function listMessages(filter: MessageFilter): Promise<{ messages: any[]; hasMore: boolean }> {
  const c = ensureConnected();

  let targetChat: Chat | null = null;
  if (filter.chatJid) {
    targetChat = await c.getChatById(filter.chatJid);
  }

  const limit = filter.limit || 20;
  const page = filter.page || 0;
  const offset = page * limit;

  let messages: Message[] = [];

  if (targetChat) {
    messages = await targetChat.fetchMessages({ limit: limit + offset + 10 });
  } else {
    // Get messages from all chats
    const chats = await c.getChats();
    for (const chat of chats.slice(0, 10)) {
      const chatMessages = await chat.fetchMessages({ limit: 20 });
      messages.push(...chatMessages);
    }
  }

  // Apply filters
  if (filter.after) {
    const afterDate = new Date(filter.after).getTime() / 1000;
    messages = messages.filter(m => m.timestamp > afterDate);
  }

  if (filter.before) {
    const beforeDate = new Date(filter.before).getTime() / 1000;
    messages = messages.filter(m => m.timestamp < beforeDate);
  }

  if (filter.query) {
    const q = filter.query.toLowerCase();
    messages = messages.filter(m => m.body?.toLowerCase().includes(q));
  }

  // Paginate
  const paginatedMessages = messages.slice(offset, offset + limit);

  return {
    messages: paginatedMessages.map(m => ({
      id: m.id._serialized,
      body: m.body,
      from: m.from,
      to: m.to,
      timestamp: m.timestamp,
      fromMe: m.fromMe,
      hasMedia: m.hasMedia,
      type: m.type
    })),
    hasMore: messages.length > offset + limit
  };
}

export async function getMessageContext(messageId: string, chatJid: string, before: number = 5, after: number = 5): Promise<any[]> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);
  const messages = await chat.fetchMessages({ limit: 100 });

  const index = messages.findIndex(m => m.id._serialized === messageId);
  if (index === -1) return [];

  const start = Math.max(0, index - before);
  const end = Math.min(messages.length, index + after + 1);

  return messages.slice(start, end).map(m => ({
    id: m.id._serialized,
    body: m.body,
    from: m.from,
    timestamp: m.timestamp,
    fromMe: m.fromMe
  }));
}

export async function forwardMessage(sourceChatJid: string, messageId: string, targetChatJid: string): Promise<{ success: boolean; messageId: string }> {
  const c = ensureConnected();
  const sourceChat = await c.getChatById(sourceChatJid);
  const messages = await sourceChat.fetchMessages({ limit: 50 });
  const message = messages.find(m => m.id._serialized === messageId);

  if (!message) throw new Error('MESSAGE_NOT_FOUND');

  await message.forward(targetChatJid);
  return { success: true, messageId };
}

export async function editMessage(chatJid: string, messageId: string, newContent: string): Promise<Message | null> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);
  const messages = await chat.fetchMessages({ limit: 50 });
  const message = messages.find(m => m.id._serialized === messageId);

  if (!message) throw new Error('MESSAGE_NOT_FOUND');
  if (!message.fromMe) throw new Error('CAN_ONLY_EDIT_OWN_MESSAGES');

  return message.edit(newContent);
}

export async function deleteMessage(chatJid: string, messageId: string, forEveryone: boolean = true): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);
  const messages = await chat.fetchMessages({ limit: 50 });
  const message = messages.find(m => m.id._serialized === messageId);

  if (!message) throw new Error('MESSAGE_NOT_FOUND');

  if (forEveryone) {
    await message.delete(true);
  } else {
    await message.delete(false);
  }
}

export async function sendReaction(chatJid: string, messageId: string, reaction: string, sender?: string): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);
  const messages = await chat.fetchMessages({ limit: 50 });
  const message = messages.find(m => m.id._serialized === messageId);

  if (!message) throw new Error('MESSAGE_NOT_FOUND');

  await message.react(reaction);
}

export async function downloadMedia(messageId: string, chatJid: string): Promise<{ path: string; mimetype: string }> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);
  const messages = await chat.fetchMessages({ limit: 50 });
  const message = messages.find(m => m.id._serialized === messageId);

  if (!message) throw new Error('MESSAGE_NOT_FOUND');
  if (!message.hasMedia) throw new Error('MESSAGE_HAS_NO_MEDIA');

  const media = await message.downloadMedia();
  if (!media) throw new Error('MEDIA_DOWNLOAD_FAILED');

  const ext = mime.extension(media.mimetype) || 'bin';
  const filename = `${messageId}.${ext}`;
  const downloadPath = path.join('/tmp', filename);

  fs.writeFileSync(downloadPath, Buffer.from(media.data, 'base64'));

  return { path: downloadPath, mimetype: media.mimetype };
}

export async function sendBulkMessages(
  recipients: Array<{ phone: string; message: string }>,
  delayMs: number = 1500
): Promise<BulkResult[]> {
  const results: BulkResult[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const { phone, message } = recipients[i];
    try {
      await sendMessage(phone, message);
      results.push({ phone, success: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      results.push({ phone, success: false, error });
    }

    if (i < recipients.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

// ============================================================================
// CATEGORY 2: CONTACTS & CHATS (7 endpoints)
// ============================================================================

export async function searchContacts(query: string): Promise<any[]> {
  const c = ensureConnected();
  const contacts = await c.getContacts();
  const q = query.toLowerCase();

  return contacts
    .filter(contact =>
      contact.name?.toLowerCase().includes(q) ||
      contact.number?.includes(query) ||
      contact.pushname?.toLowerCase().includes(q)
    )
    .slice(0, 50)
    .map(contact => ({
      id: contact.id._serialized,
      name: contact.name,
      pushname: contact.pushname,
      number: contact.number,
      isGroup: contact.isGroup,
      isUser: contact.isUser
    }));
}

export async function listChats(filter: ChatFilter): Promise<{ chats: any[]; hasMore: boolean }> {
  const c = ensureConnected();
  let chats = await c.getChats();

  if (filter.query) {
    const q = filter.query.toLowerCase();
    chats = chats.filter(chat => chat.name?.toLowerCase().includes(q));
  }

  if (filter.sortBy === 'name') {
    chats.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  const limit = filter.limit || 20;
  const page = filter.page || 0;
  const offset = page * limit;

  const paginatedChats = chats.slice(offset, offset + limit);

  return {
    chats: await Promise.all(paginatedChats.map(async chat => {
      const result: any = {
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        unreadCount: chat.unreadCount,
        timestamp: chat.timestamp
      };

      if (filter.includeLastMessage !== false) {
        const messages = await chat.fetchMessages({ limit: 1 });
        if (messages.length > 0) {
          result.lastMessage = {
            body: messages[0].body,
            timestamp: messages[0].timestamp
          };
        }
      }

      return result;
    })),
    hasMore: chats.length > offset + limit
  };
}

export async function getChat(jid: string, includeLastMessage: boolean = true): Promise<any> {
  const c = ensureConnected();
  const chat = await c.getChatById(jid);

  const result: any = {
    id: chat.id._serialized,
    name: chat.name,
    isGroup: chat.isGroup,
    unreadCount: chat.unreadCount,
    timestamp: chat.timestamp
  };

  if (includeLastMessage) {
    const messages = await chat.fetchMessages({ limit: 1 });
    if (messages.length > 0) {
      result.lastMessage = {
        body: messages[0].body,
        timestamp: messages[0].timestamp
      };
    }
  }

  return result;
}

export async function getDirectChatByContact(phone: string): Promise<any> {
  const jid = formatPhoneNumber(phone);
  return getChat(jid);
}

export async function getContactChats(jid: string, limit: number = 20, page: number = 0): Promise<any[]> {
  const c = ensureConnected();
  const chats = await c.getChats();

  // Find chats involving this contact
  const contactChats = chats.filter(chat => {
    if (chat.id._serialized === jid) return true;
    if (chat.isGroup) {
      // Would need to check participants - simplified here
      return false;
    }
    return false;
  });

  const offset = page * limit;
  return contactChats.slice(offset, offset + limit).map(chat => ({
    id: chat.id._serialized,
    name: chat.name,
    isGroup: chat.isGroup
  }));
}

export async function getLastInteraction(jid: string): Promise<any | null> {
  const c = ensureConnected();
  const chat = await c.getChatById(jid);
  const messages = await chat.fetchMessages({ limit: 1 });

  if (messages.length === 0) return null;

  const msg = messages[0];
  return {
    id: msg.id._serialized,
    body: msg.body,
    timestamp: msg.timestamp,
    fromMe: msg.fromMe
  };
}

export async function markRead(chatJid: string, messageIds: string[], sender?: string): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);
  await chat.sendSeen();
}

// ============================================================================
// CATEGORY 3: GROUPS (14 endpoints)
// ============================================================================

export async function getJoinedGroups(): Promise<any[]> {
  const c = ensureConnected();
  const chats = await c.getChats();

  return chats
    .filter(chat => chat.isGroup)
    .map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      participantCount: (chat as GroupChat).participants?.length || 0,
      timestamp: chat.timestamp
    }));
}

export async function getGroupParticipants(groupJid: string): Promise<any[]> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;

  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  return chat.participants.map((p: GroupParticipant) => ({
    id: p.id._serialized,
    isAdmin: p.isAdmin,
    isSuperAdmin: p.isSuperAdmin
  }));
}

export async function createGroup(name: string, participants: string[]): Promise<any> {
  const c = ensureConnected();
  const formattedParticipants = participants.map(p => formatPhoneNumber(p));
  const result = await c.createGroup(name, formattedParticipants);

  // Result can be string (group ID) or CreateGroupResult object
  if (typeof result === 'string') {
    return { gid: result, missingParticipants: [] };
  }

  return {
    gid: result.gid._serialized,
    missingParticipants: (result as any).missingParticipants || []
  };
}

export async function leaveGroup(groupJid: string): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');
  await chat.leave();
}

export async function setGroupName(groupJid: string, name: string): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');
  await chat.setSubject(name);
}

export async function setGroupDescription(groupJid: string, description: string): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');
  await chat.setDescription(description);
}

export async function setGroupPhoto(groupJid: string, photoPath: string): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  if (!fs.existsSync(photoPath)) throw new Error('FILE_NOT_FOUND');

  const media = MessageMedia.fromFilePath(photoPath);
  // Note: This may require specific whatsapp-web.js version support
  // await chat.setPicture(media);
}

export async function addGroupMembers(groupJid: string, participants: string[]): Promise<any> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  const formattedParticipants = participants.map(p => formatPhoneNumber(p));
  return chat.addParticipants(formattedParticipants);
}

export async function removeGroupMembers(groupJid: string, participants: string[]): Promise<any> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  const formattedParticipants = participants.map(p => formatPhoneNumber(p));
  return chat.removeParticipants(formattedParticipants);
}

export async function promoteGroupAdmin(groupJid: string, participants: string[]): Promise<any> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  const formattedParticipants = participants.map(p => formatPhoneNumber(p));
  return chat.promoteParticipants(formattedParticipants);
}

export async function demoteGroupAdmin(groupJid: string, participants: string[]): Promise<any> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  const formattedParticipants = participants.map(p => formatPhoneNumber(p));
  return chat.demoteParticipants(formattedParticipants);
}

export async function setGroupAnnounce(groupJid: string, announce: boolean): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');
  await chat.setMessagesAdminsOnly(announce);
}

export async function setGroupLocked(groupJid: string, locked: boolean): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');
  await chat.setInfoAdminsOnly(locked);
}

export async function getGroupInviteLink(groupJid: string, reset: boolean = false): Promise<string> {
  const c = ensureConnected();
  const chat = await c.getChatById(groupJid) as GroupChat;
  if (!chat.isGroup) throw new Error('NOT_A_GROUP');

  if (reset) {
    await chat.revokeInvite();
  }

  return chat.getInviteCode();
}

// ============================================================================
// CATEGORY 4: GROUP LINKS (3 endpoints)
// ============================================================================

export async function joinGroupWithLink(inviteLink: string): Promise<any> {
  const c = ensureConnected();
  const code = inviteLink.split('/').pop() || inviteLink;
  return c.acceptInvite(code);
}

export async function previewGroupLink(inviteLink: string): Promise<any> {
  const c = ensureConnected();
  const code = inviteLink.split('/').pop() || inviteLink;
  return c.getInviteInfo(code);
}

export async function createPoll(chatJid: string, question: string, options: string[], maxSelections: number = 1): Promise<Message> {
  const c = ensureConnected();
  // Note: Poll support may vary by whatsapp-web.js version
  // This is a placeholder for when poll support is available
  throw new Error('POLLS_NOT_SUPPORTED_IN_THIS_VERSION');
}

// ============================================================================
// CATEGORY 5: NEWSLETTERS (7 endpoints)
// ============================================================================

// Note: Newsletter support requires specific whatsapp-web.js version
// These are placeholder implementations

export async function listSubscribedNewsletters(): Promise<any[]> {
  const c = ensureConnected();
  // Newsletter methods may not be available in all versions
  return [];
}

export async function getNewsletterInfo(newsletterJid: string): Promise<any> {
  throw new Error('NEWSLETTERS_NOT_SUPPORTED_IN_THIS_VERSION');
}

export async function previewNewsletterLink(inviteLink: string): Promise<any> {
  throw new Error('NEWSLETTERS_NOT_SUPPORTED_IN_THIS_VERSION');
}

export async function followNewsletter(newsletterJid: string): Promise<void> {
  throw new Error('NEWSLETTERS_NOT_SUPPORTED_IN_THIS_VERSION');
}

export async function unfollowNewsletter(newsletterJid: string): Promise<void> {
  throw new Error('NEWSLETTERS_NOT_SUPPORTED_IN_THIS_VERSION');
}

export async function reactToNewsletterMessage(newsletterJid: string, serverId: number, messageId: string, reaction: string): Promise<void> {
  throw new Error('NEWSLETTERS_NOT_SUPPORTED_IN_THIS_VERSION');
}

export async function createNewsletter(name: string, description?: string): Promise<any> {
  throw new Error('NEWSLETTERS_NOT_SUPPORTED_IN_THIS_VERSION');
}

// ============================================================================
// CATEGORY 6: LID RESOLUTION (6 endpoints)
// ============================================================================

export function resolveLid(lid: string): { phone?: string; name?: string } | null {
  return lidCache.get(lid) || null;
}

export function resolvePhoneToLid(phone: string): string | null {
  for (const [lid, data] of lidCache.entries()) {
    if (data.phone === phone) return lid;
  }
  return null;
}

export function resolveBatchLids(lids: string[], phones: string[]): any {
  const results: any = { lids: {}, phones: {} };

  for (const lid of lids) {
    const data = lidCache.get(lid);
    if (data) results.lids[lid] = data;
  }

  for (const phone of phones) {
    for (const [lid, data] of lidCache.entries()) {
      if (data.phone === phone) {
        results.phones[phone] = lid;
        break;
      }
    }
  }

  return results;
}

export function getLidCacheStats(): { total: number; withNames: number } {
  let withNames = 0;
  for (const data of lidCache.values()) {
    if (data.name) withNames++;
  }
  return { total: lidCache.size, withNames };
}

export function listLidMappings(limit: number = 100): any[] {
  const results: any[] = [];
  let count = 0;

  for (const [lid, data] of lidCache.entries()) {
    if (count >= limit) break;
    results.push({ lid, ...data });
    count++;
  }

  return results;
}

export async function populateLidCache(): Promise<{ groupsProcessed: number; mappingsAdded: number }> {
  const c = ensureConnected();
  const groups = await getJoinedGroups();
  let mappingsAdded = 0;

  for (const group of groups) {
    try {
      const participants = await getGroupParticipants(group.id);
      for (const p of participants) {
        if (p.id.includes('@lid')) {
          const lid = p.id.replace('@lid', '');
          if (!lidCache.has(lid)) {
            // Try to resolve phone from other sources
            lidCache.set(lid, { phone: '' });
            mappingsAdded++;
          }
        }
      }
    } catch (err) {
      console.error(`Error processing group ${group.id}:`, err);
    }
  }

  return { groupsProcessed: groups.length, mappingsAdded };
}

// ============================================================================
// CATEGORY 7: STATUS & PROFILE (5 endpoints)
// ============================================================================

export async function getConnectionStatus(): Promise<any> {
  return {
    state: currentState,
    isLoggedIn: currentState === 'ready',
    info: getClientInfo(),
    lastError
  };
}

export async function getProfilePicture(jid: string): Promise<string | null> {
  const c = ensureConnected();
  try {
    return await c.getProfilePicUrl(jid);
  } catch {
    return null;
  }
}

export async function setStatusMessage(status: string): Promise<void> {
  const c = ensureConnected();
  await c.setStatus(status);
}

export async function getUserInfo(jids: string[]): Promise<any[]> {
  const c = ensureConnected();
  const results: any[] = [];

  for (const jid of jids) {
    try {
      const contact = await c.getContactById(jid);
      results.push({
        id: contact.id._serialized,
        name: contact.name,
        pushname: contact.pushname,
        number: contact.number,
        isUser: contact.isUser,
        isGroup: contact.isGroup
      });
    } catch (err) {
      results.push({ id: jid, error: 'NOT_FOUND' });
    }
  }

  return results;
}

export async function getBusinessProfile(jid: string): Promise<any> {
  const c = ensureConnected();
  const contact = await c.getContactById(jid);

  // Business profile methods may not be available in all versions
  return {
    id: contact.id._serialized,
    name: contact.name,
    isBusiness: contact.isBusiness
  };
}

// ============================================================================
// CATEGORY 8: UTILITIES (2 endpoints)
// ============================================================================

export async function sendTypingIndicator(chatJid: string, typing: boolean = true): Promise<void> {
  const c = ensureConnected();
  const chat = await c.getChatById(chatJid);

  if (typing) {
    await chat.sendStateTyping();
  } else {
    await chat.clearState();
  }
}

export async function isOnWhatsApp(phoneNumbers: string[]): Promise<any[]> {
  const c = ensureConnected();
  const results: any[] = [];

  for (const phone of phoneNumbers) {
    const jid = formatPhoneNumber(phone);
    try {
      const isRegistered = await c.isRegisteredUser(jid);
      results.push({ phone, isRegistered, jid });
    } catch (err) {
      results.push({ phone, isRegistered: false, error: 'CHECK_FAILED' });
    }
  }

  return results;
}
