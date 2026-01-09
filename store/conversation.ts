/**
 * 🧠 OrbitStore — Ambient Persistence Session Management
 * 
 * Tracks conversation sessions with lossless context transfer.
 * 
 * Key Concepts:
 * - Rolling Window: UI shows last 20 messages
 * - Full History: Lazy-loaded in background for session restoration
 * - Entity Buffer: Max 10 entities preserved during contextual clear
 * - Never Auto-End: Conversations persist until explicitly archived
 * 
 * State Machine (Q3C - Granular):
 * idle | transcribing | reasoning | retrieving | generating | speaking
 * 
 * German Labels (Q4A):
 * - transcribing: "Höre zu..."
 * - reasoning: "Denke nach..."
 * - retrieving: "Durchsuche Erinnerungen..."
 * - generating: "Formuliere Antwort..."
 * - speaking: "Spreche..."
 */

import type { Entity } from '@/db/schema';
import { create } from 'zustand';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    timestamp: number;
}

// 🎯 Granular Processing States (Q3C)
export type ProcessingState = 
    | 'idle' 
    | 'transcribing' 
    | 'reasoning' 
    | 'retrieving' 
    | 'generating' 
    | 'speaking';

// German labels for UI (Q4A)
export const PROCESSING_STATE_LABELS: Record<ProcessingState, string> = {
    idle: '',
    transcribing: 'Höre zu...',
    reasoning: 'Denke nach...',
    retrieving: 'Durchsuche Erinnerungen...',
    generating: 'Formuliere Antwort...',
    speaking: 'Spreche...',
};

export interface ConversationState {
    messages: Message[];
    isTranscribing: boolean;
    isReasoning: boolean;
    isEmbedding: boolean;
    isSpeaking: boolean;
    error: string | null;
    pendingSnippets: { type: 'fact' | 'feeling' | 'goal', content: string, id: string }[];
    
    // 🎯 Granular State (Q3C)
    processingState: ProcessingState;
    
    // === AMBIENT PERSISTENCE ===
    currentConversationId: number | null;
    sessionStartTime: number | null;
    lastSessionEntities: Entity[]; // Max 10, buffer for contextual clear
    isSessionActive: boolean;
}

export interface ConversationActions {
    addUserMessage: (content: string) => void;
    addAIResponse: (content: string, reasoning?: string) => void;
    setTranscribing: (value: boolean) => void;
    setReasoning: (value: boolean) => void;
    setEmbedding: (value: boolean) => void;
    setSpeaking: (value: boolean) => void;
    setError: (error: string | null) => void;
    addPendingSnippet: (snippet: { type: 'fact' | 'feeling' | 'goal', content: string }) => void;
    removePendingSnippet: (id: string) => void;
    clearMessages: () => void;
    
    // 🎯 Granular State Action (Q3C)
    setProcessingState: (state: ProcessingState) => void;
    
    // === AMBIENT PERSISTENCE ACTIONS ===
    startNewSession: () => Promise<number>;
    resumeSession: (conversationId: number) => Promise<void>;
    clearSession: (preserveContext: boolean) => void;
    updateSessionEntities: (entities: Entity[]) => void;
    archiveCurrentSession: () => Promise<void>;
}

export const useConversationStore = create<ConversationState & ConversationActions>((set, get) => ({
    // Initial state
    messages: [],
    isTranscribing: false,
    isReasoning: false,
    isEmbedding: false,
    isSpeaking: false,
    error: null,
    pendingSnippets: [],
    processingState: 'idle' as ProcessingState,
    
    // Ambient Persistence state
    currentConversationId: null,
    sessionStartTime: null,
    lastSessionEntities: [],
    isSessionActive: false,

    // Actions
    addUserMessage: (content: string) => set((state) => ({
        messages: [
            ...state.messages,
            {
                id: Date.now().toString(),
                role: 'user',
                content,
                timestamp: Date.now(),
            },
        ],
    })),

    addAIResponse: (content: string, reasoning?: string) => set((state) => ({
        messages: [
            ...state.messages,
            {
                id: Date.now().toString(),
                role: 'assistant',
                content,
                reasoning,
                timestamp: Date.now(),
            },
        ],
    })),

    setTranscribing: (value: boolean) => set({ isTranscribing: value }),
    setReasoning: (value: boolean) => set({ isReasoning: value }),
    setEmbedding: (value: boolean) => set({ isEmbedding: value }),
    setSpeaking: (value: boolean) => set({ isSpeaking: value }),
    setError: (error: string | null) => set({ error }),
    
    // 🎯 Granular State Setter (Q3C)
    setProcessingState: (state: ProcessingState) => set({ processingState: state }),
    
    addPendingSnippet: (snippet) => set((state) => ({
        pendingSnippets: [...state.pendingSnippets, { ...snippet, id: Math.random().toString(36).substr(2, 9) }]
    })),
    removePendingSnippet: (id) => set((state) => ({
        pendingSnippets: state.pendingSnippets.filter(s => s.id !== id)
    })),
    clearMessages: () => set({ messages: [] }),
    
    // === AMBIENT PERSISTENCE ACTIONS ===
    
    /**
     * Start a new conversation session
     */
    startNewSession: async () => {
        const { createConversation } = await import('@/services/ConversationService');
        const conversationId = await createConversation();
        
        set({
            currentConversationId: conversationId,
            sessionStartTime: Date.now(),
            isSessionActive: true,
            messages: [],
            lastSessionEntities: [],
        });
        
        console.log('[OrbitStore] Started new session:', conversationId);
        return conversationId;
    },
    
    /**
     * Resume an existing conversation
     */
    resumeSession: async (conversationId: number) => {
        const { getConversation, getMessages } = await import('@/services/ConversationService');
        const { getAllSnippets } = await import('@/db');
        
        const conversation = await getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        
        // Load messages from DB
        const dbMessages = await getMessages(conversationId);
        
        // Convert to store format
        const messages: Message[] = dbMessages.map((m) => ({
            id: m.id.toString(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            reasoning: m.metadata ? JSON.parse(m.metadata).reasoning : undefined,
            timestamp: m.timestamp,
        }));
        
        // Load entities from snippets linked to this conversation
        const allSnippets = await getAllSnippets();
        const snippets = allSnippets.filter(s => s.conversation_id === conversationId);
        const entityNames = new Set<string>();
        
        for (const snippet of snippets) {
            if (snippet.entities) {
                const entities = JSON.parse(snippet.entities);
                entities.forEach((e: Entity) => entityNames.add(e.name));
            }
        }
        
        // Build entity buffer (simplified, without full Entity objects)
        // In production, you'd query entities table
        const entities: Entity[] = Array.from(entityNames).slice(0, 10).map((name, i) => ({
            id: i,
            name,
            type: 'concept',
            importance: 0.8,
            first_mention: Date.now(),
            last_mention: Date.now(),
            mention_count: 1,
            created_at: Date.now(),
        }));
        
        set({
            currentConversationId: conversationId,
            sessionStartTime: conversation.start_timestamp,
            isSessionActive: true,
            messages,
            lastSessionEntities: entities,
        });
        
        console.log('[OrbitStore] Resumed session:', conversationId, `${messages.length} messages`);
    },
    
    /**
     * Clear session UI (optionally preserve entity context)
     */
    clearSession: (preserveContext: boolean) => {
        const state = get();
        
        if (preserveContext) {
            // Keep entity buffer but clear messages
            set({
                messages: [],
                currentConversationId: null,
                sessionStartTime: null,
                isSessionActive: false,
            });
            console.log('[OrbitStore] Contextual clear: preserved', state.lastSessionEntities.length, 'entities');
        } else {
            // Full reset
            set({
                messages: [],
                currentConversationId: null,
                sessionStartTime: null,
                lastSessionEntities: [],
                isSessionActive: false,
            });
            console.log('[OrbitStore] Full clear');
        }
    },
    
    /**
     * Update entity buffer during active session
     */
    updateSessionEntities: (entities: Entity[]) => {
        set({ lastSessionEntities: entities.slice(0, 10) }); // Max 10
    },
    
    /**
     * Archive current session and reset state
     */
    archiveCurrentSession: async () => {
        const state = get();
        
        if (state.currentConversationId) {
            const { archiveConversation } = await import('@/services/ConversationService');
            await archiveConversation(state.currentConversationId);
            
            console.log('[OrbitStore] Archived session:', state.currentConversationId);
        }
        
        set({
            currentConversationId: null,
            sessionStartTime: null,
            isSessionActive: false,
            messages: [],
            lastSessionEntities: [],
        });
    },
}));
