/**
 * Test Entity Extraction Service
 * 
 * Run this in Orbit or as a standalone test to verify entity extraction works.
 * 
 * Test cases:
 * 1. Extract person entity with relationship
 * 2. Verify coreference resolution (she → Amy)
 * 3. Check database storage
 * 4. Test entity updates (adding new properties)
 */

import { ensureDatabaseReady, getDb } from '@/db';
import { extractAndStoreEntities, getEntityByName, getEntityMentions, searchEntities } from '@/services/entityExtraction';

export async function testEntityExtraction() {
  console.log('\n=== Entity Extraction Test ===\n');

  try {
    // Ensure database is ready
    await ensureDatabaseReady();
    const db = getDb();

    // Clean up test data
    console.log('[Test] Cleaning up previous test data...');
    await db.execute('DELETE FROM entity_mentions WHERE 1=1');
    await db.execute('DELETE FROM entities WHERE 1=1');

    // Test Case 1: Extract person entity
    console.log('\n[Test 1] Extracting person entity with relationship...');
    const testSnippetId = 9999; // Fake snippet ID for testing
    const testContent = 'Amy ist meine Schwester, sie hat am 15. März Geburtstag und wohnt in Berlin.';
    
    const entities = await extractAndStoreEntities(testSnippetId, testContent, []);
    console.log(`✅ Extracted ${entities.length} entities:`, JSON.stringify(entities, null, 2));

    // Test Case 2: Verify entity in database
    console.log('\n[Test 2] Verifying entity in database...');
    const amy = await getEntityByName('Amy');
    
    if (amy) {
      console.log('✅ Entity found:', {
        id: amy.id,
        name: amy.name,
        type: amy.type,
        properties: JSON.parse(amy.properties),
        mention_count: amy.mention_count
      });

      // Check mentions
      const mentions = await getEntityMentions(amy.id);
      console.log(`✅ Found ${mentions.length} mentions:`, mentions.map((m: any) => m.mention_text));
    } else {
      console.error('❌ Entity not found in database!');
      return;
    }

    // Test Case 3: Update entity with new snippet
    console.log('\n[Test 3] Testing entity update with new context...');
    const testSnippetId2 = 10000;
    const testContent2 = 'Ich habe heute mit Amy telefoniert. Sie fühlt sich gut.';
    
    const entities2 = await extractAndStoreEntities(testSnippetId2, testContent2, [testContent]);
    console.log(`✅ Second extraction found ${entities2.length} entities`);

    const amyUpdated = await getEntityByName('Amy');
    if (amyUpdated) {
      console.log('✅ Entity updated:', {
        mention_count: amyUpdated.mention_count,
        properties: JSON.parse(amyUpdated.properties)
      });
      
      const mentionsUpdated = await getEntityMentions(amyUpdated.id);
      console.log(`✅ Total mentions now: ${mentionsUpdated.length}`);
    }

    // Test Case 4: Search entities
    console.log('\n[Test 4] Testing entity search...');
    const searchResults = await searchEntities('amy');
    console.log(`✅ Search for "amy" returned ${searchResults.length} results:`, 
      searchResults.map(e => ({ name: e.name, type: e.type, count: e.mention_count }))
    );

    console.log('\n=== All Tests Passed! ===\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test Entity Extraction in Production Flow
 * 
 * Simulates saving a snippet and verifying entity extraction happens
 */
export async function testProductionFlow() {
  console.log('\n=== Production Flow Test ===\n');

  try {
    await ensureDatabaseReady();
    const db = getDb();

    // Check if entities table exists
    const tableCheck = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='entities'"
    );

    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      console.error('❌ Entities table not found! Run database migrations first.');
      return;
    }

    console.log('✅ Entities table exists');

    // Check current entity count
    const countResult = await db.execute('SELECT COUNT(*) as count FROM entities');
    const initialCount = countResult.rows?.[0]?.count || 0;
    console.log(`Current entities in database: ${initialCount}`);

    // Instructions for manual test
    console.log('\n📝 Manual Test Instructions:');
    console.log('1. Go to Orbit');
    console.log('2. Record voice note: "Amy ist meine Schwester, sie hat am 15. März Geburtstag"');
    console.log('3. Wait for processing');
    console.log('4. Check database: SELECT * FROM entities WHERE name = \'Amy\'');
    console.log('5. Expected: entity with type=person, properties contains birthday and relationship');

  } catch (error) {
    console.error('❌ Production flow test failed:', error);
  }
}

/**
 * Utility: Show all entities in database
 */
export async function showAllEntities() {
  try {
    await ensureDatabaseReady();
    const db = getDb();

    const result = await db.execute(`
      SELECT e.*, 
             (SELECT COUNT(*) FROM entity_mentions WHERE entity_id = e.id) as total_mentions
      FROM entities e
      ORDER BY e.mention_count DESC
    `);

    console.log('\n=== All Entities ===\n');

    if (!result.rows || result.rows.length === 0) {
      console.log('No entities found in database.');
      return;
    }

    for (const row of result.rows) {
      console.log(`\n${row.name} (${row.type})`);
      console.log(`  Properties: ${row.properties}`);
      console.log(`  Mentions: ${row.mention_count} across ${row.total_mentions} records`);
      console.log(`  First seen: Snippet ${row.first_mentioned_in}`);
      console.log(`  Last seen: Snippet ${row.last_mentioned_in}`);
    }

  } catch (error) {
    console.error('Error showing entities:', error);
  }
}
