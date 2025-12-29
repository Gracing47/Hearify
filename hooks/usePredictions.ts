import { usePredictionStore } from '@/store/predictionStore';

/**
 * Hook to get current predictions from the Ambient Connection Engine (ACE) store.
 * Surfaces relevant connections based on current user context.
 */
export const usePredictions = () => {
    return usePredictionStore(state => state.predictions);
};

/**
 * Hook to check if ACE is currently processing/searching for predictions.
 */
export const useACEProcessing = () => {
    return usePredictionStore(state => state.isProcessing);
};

/**
 * Hook to get the current performance tier of the ACE.
 */
export const useACETier = () => {
    return usePredictionStore(state => state.currentTier);
};
