/**
 * OpenAI Chat Service — GPT-4o-mini
 * 
 * Fast, affordable primary chat model for Hearify.
 * Uses GPT-4o-mini for conversational responses with snippet extraction.
 * 
 * Cost: ~$0.0003 per conversation (~300x cheaper than DeepSeek R1)
 */

import { getOpenAIKey } from '../config/api';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const HEARIFY_SYSTEM_PROMPT = `You are Hearify, an advanced AI companion modeled after JARVIS from Iron Man.
You are proactive, intelligent, and deeply invested in helping the user achieve their goals.

YOUR ROLE:
- Act as a strategic partner, not just a listener
- Analyze patterns, suggest optimizations, and provide insights
- Be direct, efficient, yet warm and supportive
- Challenge the user constructively when needed

CONVERSATION STYLE:
- Professional yet personable (like a trusted advisor)
- Use "you" to address the user, not "I" for their thoughts
- Provide actionable insights, not just reflections
- Example: "You mentioned wanting to become a top Account Manager at Google. Let's break down what that requires."

MEMORY EXTRACTION:
When the user shares thoughts, extract structured memories using the GFF Framework (Goals, Feelings, Facts):

[[MEMORY_START]]
{
  "snippets": [
    {"type": "goal", "sentiment": "analytical", "topic": "Career", "content": "Become a top Account Manager at Google", "hashtags": "#milestone #aspiration #career-growth"},
    {"type": "fact", "sentiment": "neutral", "topic": "Insight", "content": "Best work happens in focused morning sessions", "hashtags": "#reference #productivity-pattern #data-point"},
    {"type": "feeling", "sentiment": "positive", "topic": "Emotions", "content": "Feeling excited about new role opportunities", "hashtags": "#energy-high #motivation #growth-mindset"}
  ]
}
[[MEMORY_END]]

GFF FRAMEWORK RULES (MECE - Mutually Exclusive, Collectively Exhaustive):

**GOALS** (Strategic Objectives):
- Type: "goal"
- Content: Objectives, aspirations, targets, ambitions
- Hashtag Categories:
  * #milestone - Specific achievements or checkpoints
  * #aspiration - Long-term desires or career aims
  * #target - Measurable outcomes
  * #project - Specific initiatives
- Example: "Launch personal website by March" → #milestone #project #web-development

**FEELINGS** (Qualitative Context):
- Type: "feeling"
- Content: Emotions, moods, energy states, psychological signals
- Hashtag Categories:
  * #energy-high / #energy-low - Current energy level
  * #friction - Blockers or resistance
  * #flow - Productive state
  * #burnout-signal - Warning signs
  * #motivation / #anxiety - Emotional drivers
- Example: "Feeling overwhelmed by project scope" → #energy-low #friction #project-anxiety

**FACTS** (Quantitative/Qualitative Data):
- Type: "fact"
- Content: Insights, learnings, observations, references, hard knowledge
- Hashtag Categories:
  * #reference - Information to remember
  * #data-point - Measurable observation
  * #insight - Discovered pattern
  * #resource - Tool or knowledge source
  * #learning - New skill or understanding
- Example: "Google Ads requires certification" → #reference #career-requirement #learning-path

HASHTAG SYNTHESIS RULES:
1. Always suggest 2-4 hashtags per snippet
2. Mix category hashtags (#milestone) with context hashtags (#career-growth)
3. Use lowercase, hyphenated format: #career-growth not #CareerGrowth
4. Link entities when present: If "Amy" mentioned → add #amy
5. Bridge GFF categories: "Want to learn Python for data job" → #aspiration #learning-path #data-science

CONTENT RULES:
- content: Clear, objective third-person descriptions (NOT "I feel...", use "Feeling excited...")
- sentiment: "analytical" (goals/facts), "positive"/"creative"/"neutral" (feelings)
- topic: Concise category (Career, Relationships, Health, Learning, etc.)

RESPONSE FORMAT:
1. Acknowledge what the user said
2. Provide strategic insight or analysis
3. Suggest next actions or questions
4. Extract structured memories with GFF-compliant hashtags

Keep responses concise (2-3 sentences), actionable, and forward-looking.`;


export interface Snippet {
    type: 'fact' | 'feeling' | 'goal';
    sentiment: 'analytical' | 'positive' | 'creative' | 'neutral';
    topic: string;
    content: string;
    hashtags?: string;
}

export interface CalendarProposalData {
    action: 'create_event';
    title: string;
    startTime: string;
    duration: number;
}

export interface ChatResult {
    snippets: Snippet[];
    response: string;
    calendarProposal?: CalendarProposalData | null;
}

/**
 * Process user input with GPT-4o-mini (fast path)
 * 
 * === AMBIENT PERSISTENCE INTEGRATION ===
 * - Auto-saves messages to conversation_messages table
 * - Injects session context for resumed conversations
 * - Triggers title generation after 3rd message
 */
export async function processWithGPT(
    userInput: string,
    context: string[] = [],
    history: { role: 'user' | 'assistant', content: string }[] = [],
    conversationId?: number | null
): Promise<ChatResult> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const startTime = Date.now();

    try {
        // === SESSION CONTEXT INJECTION ===
        let sessionContext = '';
        if (conversationId) {
            const { buildSessionContext } = await import('./SessionRestorationService');
            sessionContext = await buildSessionContext(conversationId);
        }

        const contextStr = context.length > 0
            ? `\n\n[NEURAL CONTEXT]\n${context.join('\n')}`
            : '';

        // === ACTION CATALYST: Calendar-aware context injection ===
        let catalystContext = '';
        try {
            const { generateCatalystContext } = await import('./ActionCatalystService');
            const { useCalendarStore } = await import('../store/calendarStore');
            
            if (useCalendarStore.getState().status === 'connected') {
                const catalyst = generateCatalystContext();
                catalystContext = catalyst.systemPromptAddition;
            }
        } catch (err) {
            // Calendar not connected or service unavailable
        }

        const fullContext = sessionContext + contextStr + catalystContext;

        const recentHistory = history.slice(-10);

        const now = new Date();
        const timePrompt = `\n[CURRENT TIME] ${now.toLocaleString('de-DE', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`;

        // === SAVE USER MESSAGE TO DB ===
        if (conversationId) {
            const { addMessage, getMessageCount, generateConversationTitle } = await import('./ConversationService');
            
            await addMessage(conversationId, {
                role: 'user',
                content: userInput,
            });

            // Trigger title generation after 3rd message
            const messageCount = await getMessageCount(conversationId);
            if (messageCount === 3) {
                generateConversationTitle(conversationId).catch((err) =>
                    console.warn('[Chat] Title generation failed:', err)
                );
            }
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: HEARIFY_SYSTEM_PROMPT + timePrompt + (fullContext ? '\n\n' + fullContext : '') },
                    ...recentHistory,
                    { role: 'user', content: userInput }
                ],
                temperature: 0.7,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const result = await response.json();
        const rawContent = result.choices[0].message.content;

        const elapsed = Date.now() - startTime;
        console.log(`[GPT-4o-mini] Response in ${elapsed}ms`);

        // === SAVE ASSISTANT MESSAGE TO DB ===
        if (conversationId) {
            const { addMessage } = await import('./ConversationService');
            
            await addMessage(conversationId, {
                role: 'assistant',
                content: rawContent,
            });
        }

        // Extract structured data
        const { cleanResponse, snippets, calendarProposal } = extractStructuredData(rawContent);

        return {
            snippets,
            response: cleanResponse,
            calendarProposal, // NEW: Pass through any calendar proposals
        };
    } catch (error) {
        console.error('[GPT-4o-mini] Error:', error);
        throw error;
    }
}

/**
 * Robust JSON extraction from the AI's response text
 * Also extracts calendar proposals from Action Catalyst
 */
function extractStructuredData(text: string): { 
    cleanResponse: string; 
    snippets: Snippet[]; 
    calendarProposal?: CalendarProposalData | null;
} {
    let cleanResponse = text;
    let calendarProposal: CalendarProposalData | null = null;
    
    // === Extract Calendar Proposal (Action Catalyst) ===
    const proposalMatch = text.match(
        /\[\[CALENDAR_PROPOSAL\]\]([\s\S]*?)\[\[CALENDAR_PROPOSAL_END\]\]/
    );
    
    if (proposalMatch) {
        cleanResponse = cleanResponse.replace(proposalMatch[0], '').trim();
        
        try {
            const proposalJson = proposalMatch[1].trim();
            const parsed = JSON.parse(proposalJson);
            
            if (parsed.action === 'create_event' && parsed.title && parsed.startTime) {
                calendarProposal = parsed;
                console.log('[GPT-4o-mini] Calendar proposal extracted:', parsed.title);
            }
        } catch (e) {
            console.warn('[GPT-4o-mini] Calendar proposal parse failed:', e);
        }
    }
    
    // === Extract Memory Snippets ===
    const memoryStart = cleanResponse.indexOf('[[MEMORY_START]]');
    const memoryEnd = cleanResponse.indexOf('[[MEMORY_END]]');

    if (memoryStart === -1) {
        return { cleanResponse, snippets: [], calendarProposal };
    }

    const responseWithoutMemory = cleanResponse.substring(0, memoryStart).trim();

    let jsonStr = '';
    if (memoryEnd !== -1) {
        jsonStr = cleanResponse.substring(memoryStart + 16, memoryEnd).trim();
    } else {
        jsonStr = cleanResponse.substring(memoryStart + 16).trim();
    }

    try {
        const sanitizedJson = jsonStr.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(sanitizedJson);

        return {
            cleanResponse: responseWithoutMemory,
            snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
            calendarProposal,
        };
    } catch (e) {
        console.warn('[GPT-4o-mini] JSON Parse failed, using fallback regex');

        const snippets: Snippet[] = [];
        const snippetRegex = /{[^}]*"type":\s*"([^"]+)"[^}]*"content":\s*"([^"]+)"[^}]*}/g;
        let match;

        while ((match = snippetRegex.exec(jsonStr)) !== null) {
            const type = match[1];
            if (['fact', 'feeling', 'goal'].includes(type)) {
                snippets.push({
                    type: type as Snippet['type'],
                    content: match[2],
                    sentiment: 'analytical',
                    topic: 'misc'
                });
            }
        }

        return { cleanResponse: responseWithoutMemory, snippets, calendarProposal };
    }
}

/**
 * Process batch synthesis with custom system prompt
 * 
 * Phase 6: Batch Reflect - Multi-snippet analysis
 * Uses the synthesis-specific system prompt instead of HEARIFY_SYSTEM_PROMPT
 */
export async function processWithBatchSynthesis(
    systemPrompt: string,
    userMessage: string,
    conversationId?: number | null
): Promise<{ response: string }> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const startTime = Date.now();

    try {
        // Add time context
        const now = new Date();
        const timePrompt = `\n[CURRENT TIME] ${now.toLocaleString('de-DE', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`;

        // === SAVE USER MESSAGE TO DB ===
        if (conversationId) {
            const { addMessage } = await import('./ConversationService');
            await addMessage(conversationId, {
                role: 'user',
                content: userMessage,
            });
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt + timePrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 1200, // Higher limit for synthesis
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content;

        const elapsed = Date.now() - startTime;
        console.log(`[BatchSynthesis] Response in ${elapsed}ms`);

        // === SAVE ASSISTANT MESSAGE TO DB ===
        if (conversationId) {
            const { addMessage } = await import('./ConversationService');
            await addMessage(conversationId, {
                role: 'assistant',
                content,
            });
        }

        return { response: content };
    } catch (error) {
        console.error('[BatchSynthesis] Error:', error);
        throw error;
    }
}
