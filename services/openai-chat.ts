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

export interface ChatResult {
    snippets: Snippet[];
    response: string;
}

/**
 * Process user input with GPT-4o-mini (fast path)
 */
export async function processWithGPT(
    userInput: string,
    context: string[] = [],
    history: { role: 'user' | 'assistant', content: string }[] = []
): Promise<ChatResult> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const startTime = Date.now();

    try {
        const contextStr = context.length > 0
            ? `\n\n[NEURAL CONTEXT]\n${context.join('\n')}`
            : '';

        const recentHistory = history.slice(-10);

        const now = new Date();
        const timePrompt = `\n[CURRENT TIME] ${now.toLocaleString('de-DE', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: HEARIFY_SYSTEM_PROMPT + timePrompt },
                    ...recentHistory,
                    { role: 'user', content: userInput + contextStr }
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

        // Extract structured data
        const { cleanResponse, snippets } = extractStructuredData(rawContent);

        return {
            snippets,
            response: cleanResponse,
        };
    } catch (error) {
        console.error('[GPT-4o-mini] Error:', error);
        throw error;
    }
}

/**
 * Robust JSON extraction from the AI's response text
 */
function extractStructuredData(text: string): { cleanResponse: string, snippets: Snippet[] } {
    const memoryStart = text.indexOf('[[MEMORY_START]]');
    const memoryEnd = text.indexOf('[[MEMORY_END]]');

    if (memoryStart === -1) {
        return { cleanResponse: text, snippets: [] };
    }

    const cleanResponse = text.substring(0, memoryStart).trim();

    let jsonStr = '';
    if (memoryEnd !== -1) {
        jsonStr = text.substring(memoryStart + 16, memoryEnd).trim();
    } else {
        jsonStr = text.substring(memoryStart + 16).trim();
    }

    try {
        const sanitizedJson = jsonStr.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(sanitizedJson);

        return {
            cleanResponse,
            snippets: Array.isArray(parsed.snippets) ? parsed.snippets : []
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

        return { cleanResponse, snippets };
    }
}
