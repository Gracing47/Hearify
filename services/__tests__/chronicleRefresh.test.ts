/**
 * Chronicle Refresh Debug Utility
 * 
 * Test if Chronicle updates when new snippets are saved
 */

import { getAllSnippets } from '@/db';
import { saveSnippetWithDedup } from '@/services/SemanticDedupService';
import { useContextStore } from '@/store/contextStore';

export async function testChronicleRefresh() {
  console.log('\n=== Chronicle Refresh Test ===\n');

  try {
    // 1. Get current count
    const beforeSnippets = await getAllSnippets();
    console.log('[Test] Before save:', beforeSnippets.length, 'snippets');

    // 2. Save a test snippet
    console.log('[Test] Saving test snippet...');
    const result = await saveSnippetWithDedup({
      content: 'Test snippet for Chronicle refresh verification',
      type: 'fact',
      sentiment: 'neutral',
      topic: 'Test',
      hashtags: '#test #debug',
    });

    console.log('[Test] Save result:', result);

    // 3. Wait a bit for DB write
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Check if count increased
    const afterSnippets = await getAllSnippets();
    console.log('[Test] After save:', afterSnippets.length, 'snippets');

    // 5. Check trigger value
    const triggerValue = useContextStore.getState().nodeRefreshTrigger;
    console.log('[Test] Current nodeRefreshTrigger:', triggerValue);

    // 6. Verify
    if (afterSnippets.length > beforeSnippets.length) {
      console.log('✅ Test PASSED: Snippet saved successfully');
      console.log('✅ Chronicle should refresh automatically');
    } else {
      console.log('❌ Test FAILED: Snippet count did not increase');
      console.log('Check save operation logs above');
    }

  } catch (error) {
    console.error('❌ Test ERROR:', error);
  }
}

/**
 * Manual trigger test - force Chronicle to refresh
 */
export function forceChronicleRefresh() {
  console.log('[Test] Forcing Chronicle refresh...');
  useContextStore.getState().triggerNodeRefresh();
  console.log('[Test] Trigger fired, Chronicle should reload');
}

/**
 * Check current state
 */
export async function checkChronicleState() {
  console.log('\n=== Chronicle State Check ===\n');

  try {
    const snippets = await getAllSnippets();
    const trigger = useContextStore.getState().nodeRefreshTrigger;
    const activeScreen = useContextStore.getState().activeScreen;

    console.log('Total snippets:', snippets.length);
    console.log('Refresh trigger value:', trigger);
    console.log('Active screen:', activeScreen);
    console.log('\nRecent snippets:');
    
    snippets.slice(0, 5).forEach((s, i) => {
      console.log(`${i + 1}. [${s.type}] ${s.content.substring(0, 50)}...`);
    });

  } catch (error) {
    console.error('State check failed:', error);
  }
}
