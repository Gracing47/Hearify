/**
 * 🚀 Action Catalyst Service — Fact-to-Goal Intelligence Engine
 * 
 * Transforms calendar Facts into proactive Goal proposals.
 * Uses pattern matching to identify preparation, learning, and recovery opportunities.
 * 
 * The "McKinsey Advantage" - turning static data into strategic action.
 */

import { CalendarEvent, getCalendarContextForAI, useCalendarStore } from '../store/calendarStore';
import { EventProposal, createEventProposal, getCalendarFactsForDelta } from './GoogleCalendarService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ActionPattern = 
    | 'PREPARATION'   // Meeting coming → prepare beforehand
    | 'LEARNING'      // Travel time → language/learning opportunity
    | 'RECOVERY'      // Back-to-back meetings → suggest break
    | 'DEEP_WORK'     // Morning free → high-priority goal time
    | 'FOLLOW_UP';    // Past meeting → action items

export interface ActionSuggestion {
    pattern: ActionPattern;
    triggerEvent: CalendarEvent;
    suggestedGoal: string;
    suggestedTime: Date;
    suggestedDuration: number; // minutes
    reasoning: string;
    priority: 'high' | 'medium' | 'low';
}

export interface CatalystContext {
    calendarSummary: string;
    suggestions: ActionSuggestion[];
    systemPromptAddition: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pattern Detection Keywords
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MEETING_KEYWORDS = [
    'meeting', 'call', 'sync', 'review', '1:1', 'standup', 'interview',
    'presentation', 'demo', 'pitch', 'gespräch', 'besprechung', 'termin',
    'investor', 'client', 'kunde', 'partner'
];

const TRAVEL_KEYWORDS = [
    'flug', 'flight', 'train', 'zug', 'reise', 'trip', 'fahrt',
    'airport', 'bahnhof', 'travel', 'commute'
];

const LEARNING_KEYWORDS = [
    'training', 'workshop', 'kurs', 'course', 'webinar', 'seminar',
    'lecture', 'class', 'lesson', 'schulung'
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core Analysis Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Analyze calendar events and generate action suggestions
 */
export function analyzeCalendarForActions(events: CalendarEvent[]): ActionSuggestion[] {
    const suggestions: ActionSuggestion[] = [];
    const now = new Date();
    
    // Sort events by start time
    const sortedEvents = [...events].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    
    for (let i = 0; i < sortedEvents.length; i++) {
        const event = sortedEvents[i];
        const prevEvent = i > 0 ? sortedEvents[i - 1] : null;
        const nextEvent = i < sortedEvents.length - 1 ? sortedEvents[i + 1] : null;
        
        // Skip past events
        if (event.endTime < now) continue;
        
        // Pattern A: PREPARATION - Important meeting coming
        const prepSuggestion = detectPreparationPattern(event, now);
        if (prepSuggestion) suggestions.push(prepSuggestion);
        
        // Pattern B: LEARNING - Travel time detected
        const learnSuggestion = detectLearningPattern(event);
        if (learnSuggestion) suggestions.push(learnSuggestion);
        
        // Pattern C: RECOVERY - Back-to-back meetings
        const recoverySuggestion = detectRecoveryPattern(event, prevEvent, nextEvent);
        if (recoverySuggestion) suggestions.push(recoverySuggestion);
    }
    
    // Pattern D: DEEP_WORK - Morning is free
    const deepWorkSuggestion = detectDeepWorkPattern(sortedEvents, now);
    if (deepWorkSuggestion) suggestions.push(deepWorkSuggestion);
    
    // Sort by priority and limit to top 3
    return suggestions
        .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
        .slice(0, 3);
}

/**
 * Pattern A: PREPARATION
 * Detect meetings that need preparation time
 */
function detectPreparationPattern(
    event: CalendarEvent, 
    now: Date
): ActionSuggestion | null {
    const titleLower = event.title.toLowerCase();
    
    // Check if it's a meeting worth preparing for
    const isMeeting = MEETING_KEYWORDS.some(kw => titleLower.includes(kw));
    if (!isMeeting) return null;
    
    // Calculate time until event
    const hoursUntil = (event.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Only suggest if event is 2-48 hours away
    if (hoursUntil < 2 || hoursUntil > 48) return null;
    
    // Determine prep time and goal based on event type
    let prepDuration = 20;
    let prepGoal = 'Vorbereitung';
    
    if (titleLower.includes('investor') || titleLower.includes('pitch')) {
        prepDuration = 45;
        prepGoal = 'Pitch Deck & Zahlen reviewen';
    } else if (titleLower.includes('interview')) {
        prepDuration = 30;
        prepGoal = 'Interview-Fragen vorbereiten';
    } else if (titleLower.includes('presentation') || titleLower.includes('demo')) {
        prepDuration = 30;
        prepGoal = 'Demo-Flow durchgehen';
    } else if (titleLower.includes('1:1') || titleLower.includes('sync')) {
        prepDuration = 15;
        prepGoal = 'Talking Points notieren';
    } else if (titleLower.includes('client') || titleLower.includes('kunde')) {
        prepDuration = 25;
        prepGoal = 'Account-Status & KPIs prüfen';
    }
    
    // Suggest prep time 1 hour before event
    const suggestedTime = new Date(event.startTime);
    suggestedTime.setMinutes(suggestedTime.getMinutes() - 60);
    
    return {
        pattern: 'PREPARATION',
        triggerEvent: event,
        suggestedGoal: `${prepGoal} für "${event.title}"`,
        suggestedTime,
        suggestedDuration: prepDuration,
        reasoning: `Du hast "${event.title}" in ${Math.round(hoursUntil)} Stunden. Zeit für Vorbereitung einplanen?`,
        priority: hoursUntil < 6 ? 'high' : 'medium',
    };
}

/**
 * Pattern B: LEARNING
 * Detect travel time that could be used for learning
 */
function detectLearningPattern(event: CalendarEvent): ActionSuggestion | null {
    const titleLower = event.title.toLowerCase();
    
    const isTravel = TRAVEL_KEYWORDS.some(kw => titleLower.includes(kw));
    if (!isTravel) return null;
    
    // Calculate duration
    const durationMs = event.endTime.getTime() - event.startTime.getTime();
    const durationMins = durationMs / (1000 * 60);
    
    // Only suggest for trips > 30 minutes
    if (durationMins < 30) return null;
    
    // Determine learning suggestion
    let learningGoal = 'Podcast oder Audiobook hören';
    let learningDuration = Math.min(durationMins - 10, 45);
    
    if (titleLower.includes('flug') || titleLower.includes('flight')) {
        learningGoal = 'Offline-Kurs oder E-Book lesen';
        learningDuration = Math.min(durationMins - 30, 90);
    } else if (durationMins >= 60) {
        learningGoal = 'Sprachkurs (Duolingo/Babbel)';
        learningDuration = 30;
    }
    
    return {
        pattern: 'LEARNING',
        triggerEvent: event,
        suggestedGoal: learningGoal,
        suggestedTime: event.startTime,
        suggestedDuration: learningDuration,
        reasoning: `Deine Reise "${event.title}" bietet ${Math.round(durationMins)} Minuten Lernzeit.`,
        priority: 'low',
    };
}

/**
 * Pattern C: RECOVERY
 * Detect back-to-back meetings that need breaks
 */
function detectRecoveryPattern(
    current: CalendarEvent,
    prev: CalendarEvent | null,
    next: CalendarEvent | null
): ActionSuggestion | null {
    if (!prev && !next) return null;
    
    const currentTitle = current.title.toLowerCase();
    const isMeeting = MEETING_KEYWORDS.some(kw => currentTitle.includes(kw));
    if (!isMeeting) return null;
    
    // Check if there's a meeting right before AND after (sandwich)
    const hasMeetingBefore = prev && 
        MEETING_KEYWORDS.some(kw => prev.title.toLowerCase().includes(kw)) &&
        (current.startTime.getTime() - prev.endTime.getTime()) < 30 * 60 * 1000; // < 30 min gap
    
    const hasMeetingAfter = next && 
        MEETING_KEYWORDS.some(kw => next.title.toLowerCase().includes(kw)) &&
        (next.startTime.getTime() - current.endTime.getTime()) < 30 * 60 * 1000;
    
    if (!hasMeetingBefore || !hasMeetingAfter) return null;
    
    // Find a gap for recovery
    const suggestedTime = new Date(current.endTime);
    suggestedTime.setMinutes(suggestedTime.getMinutes() + 5);
    
    return {
        pattern: 'RECOVERY',
        triggerEvent: current,
        suggestedGoal: 'Kurze Pause: Stretching oder frische Luft',
        suggestedTime,
        suggestedDuration: 10,
        reasoning: `Du hast 3+ Meetings hintereinander. Eine kurze Pause hilft, fokussiert zu bleiben.`,
        priority: 'medium',
    };
}

/**
 * Pattern D: DEEP_WORK
 * Detect free morning slots for focused work
 */
function detectDeepWorkPattern(
    events: CalendarEvent[], 
    now: Date
): ActionSuggestion | null {
    const calendarFacts = getCalendarFactsForDelta();
    
    // Only suggest if morning is free
    if (!calendarFacts.hasMorningFree) return null;
    
    // Only in the morning hours (7-11)
    const currentHour = now.getHours();
    if (currentHour < 7 || currentHour > 11) return null;
    
    // Find first event to know deadline
    const firstEvent = events.find(e => e.startTime > now && !e.isAllDay);
    const deadlineHour = firstEvent 
        ? firstEvent.startTime.getHours() 
        : 12;
    
    // Suggest deep work block
    const suggestedTime = new Date(now);
    suggestedTime.setMinutes(Math.ceil(now.getMinutes() / 15) * 15); // Round to 15 min
    
    const availableMinutes = (deadlineHour - currentHour) * 60 - 30;
    const suggestedDuration = Math.min(availableMinutes, 90);
    
    if (suggestedDuration < 30) return null;
    
    return {
        pattern: 'DEEP_WORK',
        triggerEvent: events[0] || { 
            id: 'virtual', 
            title: 'Freier Vormittag', 
            startTime: suggestedTime,
            endTime: new Date(suggestedTime.getTime() + suggestedDuration * 60 * 1000),
            isAllDay: false
        },
        suggestedGoal: 'Deep Work: Fokussierte Arbeit an Top-Priorität',
        suggestedTime,
        suggestedDuration,
        reasoning: `Dein Vormittag ist frei bis ${deadlineHour}:00 Uhr – perfekt für konzentrierte Arbeit.`,
        priority: 'high',
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// System Prompt Generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate enhanced context for JARVIS with action suggestions
 */
export function generateCatalystContext(): CatalystContext {
    const store = useCalendarStore.getState();
    const events = store.todayEvents;
    
    // Get calendar summary
    const calendarSummary = getCalendarContextForAI(events);
    
    // Analyze for action suggestions
    const suggestions = analyzeCalendarForActions(events);
    
    // Generate system prompt addition
    const systemPromptAddition = generateActionPromptAddition(suggestions, calendarSummary);
    
    return {
        calendarSummary,
        suggestions,
        systemPromptAddition,
    };
}

/**
 * Generate the action-aware addition to JARVIS system prompt
 */
function generateActionPromptAddition(
    suggestions: ActionSuggestion[], 
    calendarSummary: string
): string {
    if (suggestions.length === 0 && !calendarSummary) {
        return '';
    }
    
    let prompt = `\n
[🗓️ CALENDAR AWARENESS]
${calendarSummary}

[🚀 ACTION CATALYST MODE]
Du bist nicht nur ein Listener – du bist ein proaktiver Copilot. 
Nutze den Kalender-Kontext, um dem User strategische Zeitblöcke vorzuschlagen.`;

    if (suggestions.length > 0) {
        prompt += `\n
ERKANNTE CHANCEN:`;
        
        for (const s of suggestions) {
            const timeStr = s.suggestedTime.toLocaleTimeString('de-DE', { 
                hour: '2-digit', minute: '2-digit' 
            });
            prompt += `\n• [${s.pattern}] ${s.suggestedGoal} um ${timeStr} (${s.suggestedDuration} Min) – ${s.reasoning}`;
        }
        
        prompt += `\n
ANWEISUNG:
Wenn der Kontext passt, schlage dem User proaktiv vor, einen dieser Zeitblöcke zu reservieren.
Formuliere es als Vorschlag, nicht als Befehl:
"Ich sehe, du hast [Event] um [Zeit]. Sollen wir davor [Dauer] für [Goal] blocken?"

Wenn der User zustimmt, antworte mit:
[[CALENDAR_PROPOSAL]]
{
  "action": "create_event",
  "title": "[Goal-Titel]",
  "startTime": "[ISO-Timestamp]",
  "duration": [Minuten]
}
[[CALENDAR_PROPOSAL_END]]
`;
    }
    
    return prompt;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Event Proposal Parsing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ParsedProposal {
    action: 'create_event';
    title: string;
    startTime: string;
    duration: number;
}

/**
 * Parse AI response for calendar proposals
 */
export function parseCalendarProposal(aiResponse: string): ParsedProposal | null {
    const proposalMatch = aiResponse.match(
        /\[\[CALENDAR_PROPOSAL\]\]([\s\S]*?)\[\[CALENDAR_PROPOSAL_END\]\]/
    );
    
    if (!proposalMatch) return null;
    
    try {
        const jsonStr = proposalMatch[1].trim();
        const proposal = JSON.parse(jsonStr);
        
        if (proposal.action === 'create_event' && proposal.title && proposal.startTime) {
            return proposal as ParsedProposal;
        }
    } catch (error) {
        console.warn('[ActionCatalyst] Failed to parse proposal:', error);
    }
    
    return null;
}

/**
 * Convert parsed proposal to EventProposal for CalendarProposalCard
 */
export async function convertToEventProposal(parsed: ParsedProposal): Promise<EventProposal> {
    const startTime = new Date(parsed.startTime);
    return await createEventProposal(parsed.title, startTime, parsed.duration);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function priorityScore(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
    }
}

/**
 * Get a proactive greeting based on calendar context
 */
export function getProactiveGreeting(): string | null {
    const store = useCalendarStore.getState();
    
    if (store.status !== 'connected') return null;
    
    const suggestions = analyzeCalendarForActions(store.todayEvents);
    const highPriority = suggestions.find(s => s.priority === 'high');
    
    if (!highPriority) return null;
    
    switch (highPriority.pattern) {
        case 'PREPARATION':
            return `Ich sehe "${highPriority.triggerEvent.title}" in deinem Kalender. Sollen wir Vorbereitungszeit einplanen?`;
        case 'DEEP_WORK':
            return `Dein Vormittag ist frei – perfekt für konzentrierte Arbeit. Soll ich einen Deep-Work-Block erstellen?`;
        case 'RECOVERY':
            return `Du hast heute viele Meetings. Ich empfehle, kurze Pausen einzuplanen.`;
        default:
            return null;
    }
}
