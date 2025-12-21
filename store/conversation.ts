/**
 * Zustand store for conversation state
 * 
 * Dev notes:
 * - Central state for conversation UI
 * - Tracks loading states for each stage of the neural loop
 */

import { create } from 'zustand';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    timestamp: number;
}

export interface ConversationState {
    messages: Message[];
    isTranscribing: boolean;
    isReasoning: boolean;
    isEmbedding: boolean;
    isSpeaking: boolean;
    error: string | null;
    pendingSnippets: { type: 'fact' | 'feeling' | 'goal', content: string, id: string }[];
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
}

export const useConversationStore = create<ConversationState & ConversationActions>((set) => ({
    // Initial state
    messages: [],
    isTranscribing: false,
    isReasoning: false,
    isEmbedding: false,
    isSpeaking: false,
    error: null,
    pendingSnippets: [],

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
    addPendingSnippet: (snippet) => set((state) => ({
        pendingSnippets: [...state.pendingSnippets, { ...snippet, id: Math.random().toString(36).substr(2, 9) }]
    })),
    removePendingSnippet: (id) => set((state) => ({
        pendingSnippets: state.pendingSnippets.filter(s => s.id !== id)
    })),
    clearMessages: () => set({ messages: [] }),
}));
