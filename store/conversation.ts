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
    timestamp: number;
}

export interface ConversationState {
    messages: Message[];
    isTranscribing: boolean;
    isReasoning: boolean;
    isEmbedding: boolean;
    isSpeaking: boolean;
    error: string | null;
}

export interface ConversationActions {
    addUserMessage: (content: string) => void;
    addAIResponse: (content: string) => void;
    setTranscribing: (value: boolean) => void;
    setReasoning: (value: boolean) => void;
    setEmbedding: (value: boolean) => void;
    setSpeaking: (value: boolean) => void;
    setError: (error: string | null) => void;
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

    addAIResponse: (content: string) => set((state) => ({
        messages: [
            ...state.messages,
            {
                id: Date.now().toString(),
                role: 'assistant',
                content,
                timestamp: Date.now(),
            },
        ],
    })),

    setTranscribing: (value: boolean) => set({ isTranscribing: value }),
    setReasoning: (value: boolean) => set({ isReasoning: value }),
    setEmbedding: (value: boolean) => set({ isEmbedding: value }),
    setSpeaking: (value: boolean) => set({ isSpeaking: value }),
    setError: (error: string | null) => set({ error }),
    clearMessages: () => set({ messages: [] }),
}));
