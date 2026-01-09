/**
 * 🧠 Conversation Service — Ambient Persistence Layer
 * 
 * Manages threaded conversation sessions with lossless context transfer.
 * 
 * Key Concepts:
 * - Conversations: Thread containers with AI-generated titles & summaries
 * - Messages: Original transcript for perfect session restore
 * - Snippets: Extracted GFF truths (linked via conversation_id)
 * 
 * State Machine:
 * - Active: Currently in progress (is_active = 1)
 * - Archived: Completed sessions (is_active = 0)
 * 
 * Context Injection Strategy:
 * - Hybrid Approach: Summary + Entities + Last 5 Messages
 * - Rolling Window: UI shows last 20 messages, full history lazy-loaded
 */

import { getDb, isDatabaseReady } from '@/db';
import type { ContextMetadata, Conversation, ConversationMessage } from '@/db/schema';

// Re-export types for convenience
export type { ContextMetadata, Conversation, ConversationMessage };

// ============================================================================
// CONVERSATION CRUD
// ============================================================================

/**
 * Create a new conversation session
 */
export async function createConversation(params?: {
  title?: string;
  metadata?: ContextMetadata;
}): Promise<number> {
  if (!isDatabaseReady()) {
    throw new Error('Database not ready');
  }

  const db = getDb();
  const now = Date.now();

  const result = await db.execute(
    `INSERT INTO conversations (
      title, start_timestamp, last_update, summary, 
      context_metadata, gff_breakdown, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params?.title || 'Untitled Session',
      now,
      now,
      '',
      JSON.stringify(params?.metadata || {}),
      JSON.stringify({ goals: 0, facts: 0, feelings: 0 }),
      1,
      now,
    ]
  );

  console.log(`[Conversation] Created session ${result.insertId}`);
  return result.insertId!;
}

/**
 * Get conversation by ID
 */
export async function getConversation(id: number): Promise<Conversation | null> {
  if (!isDatabaseReady()) return null;

  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM conversations WHERE id = ?',
    [id]
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as unknown as Conversation;
}

/**
 * Get active conversation (currently in progress)
 */
export async function getActiveConversation(): Promise<Conversation | null> {
  if (!isDatabaseReady()) return null;

  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM conversations WHERE is_active = 1 ORDER BY last_update DESC LIMIT 1'
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as unknown as Conversation;
}

/**
 * Get all conversations (paginated, most recent first)
 */
export async function getAllConversations(
  limit: number = 50,
  offset: number = 0
): Promise<(Conversation & { message_count: number })[]> {
  if (!isDatabaseReady()) return [];

  const db = getDb();
  const result = await db.execute(
    `SELECT c.*, 
      (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id) as message_count
     FROM conversations c 
     ORDER BY c.last_update DESC 
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return (result.rows || []) as unknown as (Conversation & { message_count: number })[];
}

/**
 * Update conversation metadata (title, summary, GFF breakdown)
 */
export async function updateConversation(
  id: number,
  updates: {
    title?: string;
    summary?: string;
    context_metadata?: ContextMetadata;
    gff_breakdown?: { goals: number; facts: number; feelings: number };
    is_active?: boolean;
  }
): Promise<void> {
  if (!isDatabaseReady()) return;

  const db = getDb();
  const now = Date.now();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updates.summary);
  }
  if (updates.context_metadata !== undefined) {
    fields.push('context_metadata = ?');
    values.push(JSON.stringify(updates.context_metadata));
  }
  if (updates.gff_breakdown !== undefined) {
    fields.push('gff_breakdown = ?');
    values.push(JSON.stringify(updates.gff_breakdown));
  }
  if (updates.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.is_active ? 1 : 0);
  }

  fields.push('last_update = ?');
  values.push(now);

  if (fields.length === 0) return;

  values.push(id);

  await db.execute(
    `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  console.log(`[Conversation] Updated session ${id}:`, Object.keys(updates));
}

/**
 * Archive conversation (set is_active = 0)
 */
export async function archiveConversation(id: number): Promise<void> {
  await updateConversation(id, { is_active: false });
}

/**
 * Delete conversation and all associated messages
 */
export async function deleteConversation(id: number): Promise<void> {
  if (!isDatabaseReady()) return;

  const db = getDb();

  // Messages are cascade deleted automatically
  await db.execute('DELETE FROM conversations WHERE id = ?', [id]);

  console.log(`[Conversation] Deleted session ${id}`);
}

// ============================================================================
// MESSAGE CRUD
// ============================================================================

/**
 * Add message to conversation
 */
export async function addMessage(
  conversationId: number,
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: { reasoning?: string; model?: string };
  }
): Promise<number> {
  if (!isDatabaseReady()) {
    throw new Error('Database not ready');
  }

  const db = getDb();
  const now = Date.now();

  const result = await db.execute(
    `INSERT INTO conversation_messages (
      conversation_id, role, content, timestamp, metadata
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      conversationId,
      message.role,
      message.content,
      now,
      JSON.stringify(message.metadata || {}),
    ]
  );

  // Update conversation's last_update
  await db.execute(
    'UPDATE conversations SET last_update = ? WHERE id = ?',
    [now, conversationId]
  );

  return result.insertId!;
}

/**
 * Get messages for a conversation (with pagination)
 */
export async function getMessages(
  conversationId: number,
  limit?: number,
  offset: number = 0
): Promise<ConversationMessage[]> {
  if (!isDatabaseReady()) return [];

  const db = getDb();

  const query = limit
    ? 'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?'
    : 'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC';

  const params = limit ? [conversationId, limit, offset] : [conversationId];

  const result = await db.execute(query, params);

  return (result.rows || []) as unknown as ConversationMessage[];
}

/**
 * Get last N messages for context injection
 */
export async function getLastMessages(
  conversationId: number,
  count: number = 5
): Promise<ConversationMessage[]> {
  if (!isDatabaseReady()) return [];

  const db = getDb();

  const result = await db.execute(
    `SELECT * FROM conversation_messages 
     WHERE conversation_id = ? 
     ORDER BY timestamp DESC 
     LIMIT ?`,
    [conversationId, count]
  );

  // Reverse to chronological order
  return ((result.rows || []) as unknown as ConversationMessage[]).reverse();
}

/**
 * Get message count for a conversation
 */
export async function getMessageCount(conversationId: number): Promise<number> {
  if (!isDatabaseReady()) return 0;

  const db = getDb();

  const result = await db.execute(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE conversation_id = ?',
    [conversationId]
  );

  return Number(result.rows?.[0]?.count || 0);
}

/**
 * Delete all messages in a conversation
 */
export async function clearMessages(conversationId: number): Promise<void> {
  if (!isDatabaseReady()) return;

  const db = getDb();

  await db.execute(
    'DELETE FROM conversation_messages WHERE conversation_id = ?',
    [conversationId]
  );

  console.log(`[Conversation] Cleared messages for session ${conversationId}`);
}

// ============================================================================
// SESSION TITLE GENERATION
// ============================================================================

/**
 * Generate AI title for conversation after 3rd message
 * Format: [GFF Icon] [Short Title]
 * Example: "◆ Goal: Spanish Learning (Barcelona Context)"
 */
export async function generateConversationTitle(
  conversationId: number
): Promise<string> {
  const messages = await getMessages(conversationId);

  if (messages.length < 3) {
    return 'Untitled Session';
  }

  try {
    // Build context from messages
    const messageTexts = messages
      .filter((m) => m.role !== 'system')
      .slice(0, 5)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // Call GPT-4o-mini for title generation
    const { getOpenAIKey } = await import('@/config/api');
    const apiKey = await getOpenAIKey();

    if (!apiKey) {
      console.warn('[Conversation] No OpenAI key, using default title');
      return 'Session ' + new Date().toLocaleDateString();
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Generate a concise title for this conversation session.
Format: [GFF Icon] [Title]
Icons: ◆ (Goal), ♥ (Feeling), ● (Fact), ◇ (Mixed)
Max 50 characters. Be specific and context-aware.
Examples:
- "◆ Goal: Spanish Learning (Barcelona Trip)"
- "♥ Feeling: Work-Life Balance Reflection"
- "● Fact: Google Ads Certification Notes"`,
          },
          {
            role: 'user',
            content: `Generate title for:\n\n${messageTexts}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      throw new Error('Title generation failed');
    }

    const result = await response.json();
    const title = result.choices[0].message.content.trim();

    // Update conversation with generated title
    await updateConversation(conversationId, { title });

    console.log(`[Conversation] Generated title for ${conversationId}: ${title}`);
    return title;
  } catch (error) {
    console.error('[Conversation] Title generation error:', error);
    return 'Session ' + new Date().toLocaleDateString();
  }
}

// ============================================================================
// STATISTICS & UTILITIES
// ============================================================================

/**
 * Get conversation statistics
 */
export async function getConversationStats(): Promise<{
  total: number;
  active: number;
  archived: number;
  totalMessages: number;
}> {
  if (!isDatabaseReady()) {
    return { total: 0, active: 0, archived: 0, totalMessages: 0 };
  }

  const db = getDb();

  const [totalRes, activeRes, messagesRes] = await Promise.all([
    db.execute('SELECT COUNT(*) as count FROM conversations'),
    db.execute('SELECT COUNT(*) as count FROM conversations WHERE is_active = 1'),
    db.execute('SELECT COUNT(*) as count FROM conversation_messages'),
  ]);

  const total = Number(totalRes.rows?.[0]?.count || 0);
  const active = Number(activeRes.rows?.[0]?.count || 0);
  const totalMessages = Number(messagesRes.rows?.[0]?.count || 0);

  return {
    total,
    active,
    archived: total - active,
    totalMessages,
  };
}
