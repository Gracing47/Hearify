/**
 * 🗓️ CalendarProposalCard — Smart Event Proposal UI
 * 
 * Q6B: JARVIS schlägt vor → User bestätigt mit Tap
 * Q7C: Shows alternatives when conflict detected
 * 
 * Appears in Orbit when AI suggests blocking time for a goal
 */

import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    Layout,
    SlideInRight
} from 'react-native-reanimated';

import { EventProposal, TimeSlot, createEvent } from '../services/GoogleCalendarService';
import * as Haptics from '../utils/haptics';

interface CalendarProposalCardProps {
    proposal: EventProposal;
    onConfirm?: (eventId: string) => void;
    onDismiss?: () => void;
    onSelectAlternative?: (slot: TimeSlot) => void;
}

export const CalendarProposalCard = ({ 
    proposal, 
    onConfirm, 
    onDismiss,
    onSelectAlternative 
}: CalendarProposalCardProps) => {
    const [isCreating, setIsCreating] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(proposal.hasConflict);

    const formatTime = (date: Date) => 
        date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const formatDate = (date: Date) =>
        date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

    const handleConfirm = async () => {
        setIsCreating(true);
        Haptics.light();

        try {
            const result = await createEvent(
                proposal.title,
                proposal.startTime,
                proposal.endTime,
                proposal.description
            );

            if (result.success && result.eventId) {
                Haptics.speaking(); // success haptic
                onConfirm?.(result.eventId);
            } else {
                Haptics.error();
                console.error('[CalendarProposal] Create failed:', result.error);
            }
        } catch (error) {
            Haptics.error();
            console.error('[CalendarProposal] Error:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleAlternativeSelect = (slot: TimeSlot) => {
        Haptics.light();
        onSelectAlternative?.(slot);
    };

    return (
        <Animated.View
            entering={SlideInRight.delay(200).duration(400)}
            exiting={FadeOut.duration(300)}
            layout={Layout.springify()}
            style={styles.container}
        >
            <BlurView intensity={35} tint="dark" style={styles.blur}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.icon}>📅</Text>
                    <View style={styles.headerText}>
                        <Text style={styles.label}>Terminvorschlag</Text>
                        {proposal.hasConflict && (
                            <View style={styles.conflictBadge}>
                                <Text style={styles.conflictText}>⚠️ Konflikt</Text>
                            </View>
                        )}
                    </View>
                    <Pressable onPress={onDismiss} hitSlop={12}>
                        <Text style={styles.closeBtn}>✕</Text>
                    </Pressable>
                </View>

                {/* Event Details */}
                <View style={styles.eventDetails}>
                    <Text style={styles.eventTitle}>{proposal.title}</Text>
                    <Text style={styles.eventTime}>
                        {formatDate(proposal.startTime)} • {formatTime(proposal.startTime)} - {formatTime(proposal.endTime)}
                    </Text>
                </View>

                {/* Conflict Warning */}
                {proposal.hasConflict && (
                    <Animated.View 
                        entering={FadeIn.delay(300)} 
                        style={styles.conflictWarning}
                    >
                        <Text style={styles.warningText}>
                            Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.
                        </Text>
                    </Animated.View>
                )}

                {/* Alternative Slots (Q7C) */}
                {showAlternatives && proposal.alternativeSlots && proposal.alternativeSlots.length > 0 && (
                    <Animated.View entering={FadeIn.delay(400)} style={styles.alternatives}>
                        <Text style={styles.alternativesLabel}>Freie Zeitfenster:</Text>
                        {proposal.alternativeSlots.map((slot, idx) => (
                            <Pressable 
                                key={idx}
                                style={styles.alternativeSlot}
                                onPress={() => handleAlternativeSelect(slot)}
                            >
                                <Text style={styles.alternativeTime}>
                                    {formatTime(slot.start)} - {formatTime(slot.end)}
                                </Text>
                                <Text style={styles.selectText}>Auswählen →</Text>
                            </Pressable>
                        ))}
                    </Animated.View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    {!proposal.hasConflict || showAlternatives ? (
                        <>
                            <Pressable 
                                style={styles.dismissBtn}
                                onPress={onDismiss}
                            >
                                <Text style={styles.dismissText}>Später</Text>
                            </Pressable>
                            <Pressable 
                                style={[
                                    styles.confirmBtn,
                                    proposal.hasConflict && styles.confirmBtnConflict
                                ]}
                                onPress={handleConfirm}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.confirmText}>
                                        {proposal.hasConflict ? 'Trotzdem erstellen' : 'Termin erstellen'}
                                    </Text>
                                )}
                            </Pressable>
                        </>
                    ) : (
                        <Pressable 
                            style={styles.showAltBtn}
                            onPress={() => setShowAlternatives(true)}
                        >
                            <Text style={styles.showAltText}>Alternativen anzeigen</Text>
                        </Pressable>
                    )}
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginVertical: 8,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    blur: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    icon: {
        fontSize: 20,
        marginRight: 10,
    },
    headerText: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        letterSpacing: 0.3,
    },
    conflictBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    conflictText: {
        fontSize: 10,
        color: '#f87171',
        fontWeight: '600',
    },
    closeBtn: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.3)',
        padding: 4,
    },
    eventDetails: {
        marginBottom: 12,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.95)',
        marginBottom: 4,
    },
    eventTime: {
        fontSize: 13,
        color: 'rgba(165, 180, 252, 0.9)',
    },
    conflictWarning: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
    },
    warningText: {
        fontSize: 12,
        color: '#fca5a5',
        lineHeight: 16,
    },
    alternatives: {
        marginBottom: 12,
    },
    alternativesLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: 8,
    },
    alternativeSlot: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 6,
    },
    alternativeTime: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.85)',
        fontWeight: '500',
    },
    selectText: {
        fontSize: 12,
        color: '#a5b4fc',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    dismissBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    dismissText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
    },
    confirmBtn: {
        flex: 2,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        alignItems: 'center',
    },
    confirmBtnConflict: {
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
    },
    confirmText: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '600',
    },
    showAltBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        alignItems: 'center',
    },
    showAltText: {
        fontSize: 13,
        color: '#a5b4fc',
        fontWeight: '500',
    },
});
