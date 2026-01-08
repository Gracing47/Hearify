/**
 * 🧠 Entity Extraction Service — Named Entity Recognition & Coreference Resolution
 * 
 * Solves the "Amy Problem": Extracts and links entities (people, places, events)
 * across conversations using GPT-4o-mini for coreference resolution.
 * 
 * Features:
 * - Extracts entities from snippet content
 * - Resolves pronouns to entities (she → Amy)
 * - Stores entity properties (relationships, dates, locations)
 * - Tracks mentions across snippets
 * 
 * Database Schema:
 * - entities: Core entity records with properties JSON
 * - entity_mentions: Individual mentions with context
 * 
 * Cost: ~$0.0001 per extraction (GPT-4o-mini with structured output)
 */

import { getOpenAIKey } from '@/config/api';
import { getDb } from '@/db';

// ============================================================================
// TYPES
// ============================================================================

// Allowed entity types in database
export type EntityType = 'person' | 'date' | 'place' | 'event' | 'concept';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  properties: Record<string, any>;
  mentions: string[];
}

/**
 * Normalize entity type from GPT output to allowed database types
 * Maps organization/company/technology → concept
 */
function normalizeEntityType(rawType: string): EntityType {
  const normalized = rawType.toLowerCase().trim();
  
  // Map common variations to allowed types
  const typeMap: Record<string, EntityType> = {
    'person': 'person',
    'people': 'person',
    'human': 'person',
    'date': 'date',
    'time': 'date',
    'datetime': 'date',
    'place': 'place',
    'location': 'place',
    'city': 'place',
    'country': 'place',
    'event': 'event',
    'concept': 'concept',
    'organization': 'concept',
    'company': 'concept',
    'technology': 'concept',
    'product': 'concept',
    'brand': 'concept',
    'software': 'concept',
    'tool': 'concept',
  };
  
  return typeMap[normalized] || 'concept';
}

export interface Entity {
  id: number;
  name: string;
  type: string;
  properties: string;
  first_mentioned_in: number;
  last_mentioned_in: number;
  mention_count: number;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract entities from snippet content using GPT-4o-mini
 * Uses structured output for reliable JSON parsing
 */
export async function extractAndStoreEntities(
  snippetId: number,
  content: string,
  context: string[] = []
): Promise<ExtractedEntity[]> {
  try {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      console.warn('[Entity] OpenAI API key not configured, skipping extraction');
      return [];
    }

    // Build context from recent snippets
    const contextText = context.length > 0
      ? `\n\nRecent context:\n${context.join('\n')}`
      : '';

    // Call GPT-4o-mini with structured output
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract entities from text. Use coreference resolution to link pronouns to entities.

Output JSON format:
{
  "entities": [
    {
      "name": "Amy",
      "type": "person",
      "properties": { "relationship": "sister", "birthday": "1995-03-15" },
      "mentions": ["Amy", "she", "her", "my sister"]
    }
  ]
}

Rules:
- Extract people, places, dates, events, and concepts
- Link pronouns to their referents (she → Amy)
- Include relationship context in properties
- Extract dates in ISO format (YYYY-MM-DD)
- Keep mentions list comprehensive`
          },
          {
            role: 'user',
            content: `Text: "${content}"${contextText}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const result = await response.json();
    const parsed = JSON.parse(result.choices[0].message.content);
    const rawEntities = parsed.entities || [];

    // Normalize entity types before storing
    const entities: ExtractedEntity[] = rawEntities.map((e: any) => ({
      name: e.name,
      type: normalizeEntityType(e.type),
      properties: e.properties || {},
      mentions: e.mentions || [e.name],
    }));

    // Store in database
    for (const entity of entities) {
      await upsertEntity(entity, snippetId, content);
    }

    console.log(`[Entity] Extracted ${entities.length} entities from snippet ${snippetId}`);
    return entities;

  } catch (error) {
    console.error('[Entity] Extraction failed:', error);
    return [];
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Insert or update entity in database
 * Merges properties if entity already exists
 */
async function upsertEntity(
  entity: ExtractedEntity,
  snippetId: number,
  snippetContent: string
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  try {
    // Check if entity exists (case-insensitive name match)
    const existing = await db.execute(
      'SELECT * FROM entities WHERE name = ? COLLATE NOCASE AND type = ?',
      [entity.name, entity.type]
    );

    let entityId: number;

    if (existing.rows && existing.rows.length > 0) {
      // Update existing entity
      const existingEntity = existing.rows[0] as unknown as Entity;
      entityId = existingEntity.id;

      // Merge properties
      const oldProps = JSON.parse(existingEntity.properties || '{}');
      const newProps = { ...oldProps, ...entity.properties };

      await db.execute(
        `UPDATE entities 
         SET properties = ?,
             last_mentioned_in = ?,
             mention_count = mention_count + 1,
             updated_at = ?
         WHERE id = ?`,
        [JSON.stringify(newProps), snippetId, now, entityId]
      );

      console.log(`[Entity] Updated entity ${entity.name} (ID: ${entityId})`);

    } else {
      // Create new entity
      const result = await db.execute(
        `INSERT INTO entities (name, type, properties, first_mentioned_in, last_mentioned_in, mention_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          entity.name,
          entity.type,
          JSON.stringify(entity.properties),
          snippetId,
          snippetId,
          now,
          now,
        ]
      );
      entityId = result.insertId!;

      console.log(`[Entity] Created entity ${entity.name} (ID: ${entityId})`);
    }

    // Store all mentions
    for (const mention of entity.mentions) {
      await storeMention(entityId, snippetId, mention, snippetContent);
    }

  } catch (error) {
    console.error(`[Entity] Failed to upsert entity ${entity.name}:`, error);
  }
}

/**
 * Store individual mention with surrounding context
 */
async function storeMention(
  entityId: number,
  snippetId: number,
  mentionText: string,
  snippetContent: string
): Promise<void> {
  const db = getDb();
  const context = extractContext(snippetContent, mentionText);
  const now = Date.now();

  try {
    await db.execute(
      `INSERT INTO entity_mentions (entity_id, snippet_id, mention_text, context, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [entityId, snippetId, mentionText, context, now]
    );

  } catch (error) {
    console.error(`[Entity] Failed to store mention "${mentionText}":`, error);
  }
}

/**
 * Extract surrounding context for a mention (sentence containing the mention)
 */
function extractContext(text: string, mention: string): string {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const mentionLower = mention.toLowerCase();

  // Find sentence containing mention
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(mentionLower)) {
      return sentence.trim();
    }
  }

  // Fallback: return first 200 chars
  return text.slice(0, 200);
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all entities of a specific type
 */
export async function getEntitiesByType(type: string): Promise<Entity[]> {
  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM entities WHERE type = ? ORDER BY mention_count DESC',
    [type]
  );
  return (result.rows || []) as unknown as Entity[];
}

/**
 * Get entity by name (case-insensitive)
 */
export async function getEntityByName(name: string): Promise<Entity | null> {
  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM entities WHERE name = ? COLLATE NOCASE LIMIT 1',
    [name]
  );
  return result.rows && result.rows.length > 0 ? result.rows[0] as unknown as Entity : null;
}

/**
 * Get all mentions for an entity
 */
export async function getEntityMentions(entityId: number) {
  const db = getDb();
  const result = await db.execute(
    `SELECT em.*, s.content, s.timestamp
     FROM entity_mentions em
     JOIN snippets s ON em.snippet_id = s.id
     WHERE em.entity_id = ?
     ORDER BY em.created_at DESC`,
    [entityId]
  );
  return result.rows || [];
}

/**
 * Search entities by name (fuzzy match)
 */
export async function searchEntities(query: string, limit: number = 10): Promise<Entity[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM entities 
     WHERE name LIKE ? COLLATE NOCASE 
     ORDER BY mention_count DESC 
     LIMIT ?`,
    [`%${query}%`, limit]
  );
  return (result.rows || []) as unknown as Entity[];
}
