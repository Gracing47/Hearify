/**
 * 📊 TELEMETRY SERVICE — Neural Horizon v2.0
 * 
 * Event logging infrastructure for measuring UX quality.
 * All events logged to console (expandable to backend later).
 * 
 * Key Metrics (Section 6 of spec):
 * - Snap regret rate (< 5% target)
 * - Camera interruptions
 * - Selection latency
 * - Label collision count
 * - Average FPS
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface ZoomStartEvent {
    type: 'zoom_start';
    timestamp: number;
    initialScale: number;
    ctcState: string;
}

export interface ZoomEndEvent {
    type: 'zoom_end';
    timestamp: number;
    finalScale: number;
    velocityAtEnd: number;
    snapApplied: boolean;
    snapTargetId?: string;
}

export interface SnapAppliedEvent {
    type: 'snap_applied';
    timestamp: number;
    nodeId: string;
    distanceFromCenter: number;
    userReversedWithin3s?: boolean; // Computed post-hoc
}

export interface CameraMoveEvent {
    type: 'camera_move';
    timestamp: number;
    cause: 'user' | 'system';
    duration: number;
    displacement: { x: number; y: number };
}

export interface LabelRenderEvent {
    type: 'label_render';
    timestamp: number;
    visibleCount: number;
    lodLevel: number;
    collisionCount: number;
}

export interface NodeSelectionEvent {
    type: 'node_selection';
    timestamp: number;
    nodeId: string;
    timeSinceLastSelection: number;
    ctcState: string;
}

export interface CTCTransitionEvent {
    type: 'ctc_transition';
    timestamp: number;
    fromState: string;
    toState: string;
    trigger: string;
}

export interface FrameDropEvent {
    type: 'frame_drop';
    timestamp: number;
    fps: number;
    nodeCount: number;
    visibleLabels: number;
}

export type TelemetryEvent =
    | ZoomStartEvent
    | ZoomEndEvent
    | SnapAppliedEvent
    | CameraMoveEvent
    | LabelRenderEvent
    | NodeSelectionEvent
    | CTCTransitionEvent
    | FrameDropEvent;

// ============================================================================
// SESSION METRICS
// ============================================================================

export interface SessionMetrics {
    // Interaction quality
    snapRegretRate: number;           // % of snaps immediately reversed
    cameraInterruptions: number;      // User cancels ongoing motion
    selectionLatency: number;         // ms from tap to modal open

    // Comprehension
    timeToFirstMeaningfulSelection: number;  // TTC proxy
    lostSignalEvents: number;         // Minimap auto-appears

    // Engagement
    averageTimeInModal: number;       // ms
    connectionsCreatedPerSession: number;

    // Performance
    averageFPS: number;
    frameDrops: number;               // Frames < 55fps
    labelCollisionCount: number;      // Per render
}

// ============================================================================
// TELEMETRY SERVICE
// ============================================================================

class TelemetryServiceClass {
    private events: TelemetryEvent[] = [];
    private sessionStart: number = Date.now();
    private snapEvents: Map<string, { timestamp: number; nodeId: string }> = new Map();
    private lastSelectionTime: number = 0;
    private modalOpenTime: number = 0;
    private modalTimes: number[] = [];
    private fpsSamples: number[] = [];
    private frameDropCount: number = 0;
    private lostSignalCount: number = 0;
    private connectionsCreated: number = 0;
    private collisionCounts: number[] = [];

    // Reset session
    startSession() {
        this.events = [];
        this.sessionStart = Date.now();
        this.snapEvents.clear();
        this.lastSelectionTime = 0;
        this.modalOpenTime = 0;
        this.modalTimes = [];
        this.fpsSamples = [];
        this.frameDropCount = 0;
        this.lostSignalCount = 0;
        this.connectionsCreated = 0;
        this.collisionCounts = [];

        console.log('[Telemetry] Session started');
    }

    // Log event
    log(event: TelemetryEvent) {
        this.events.push(event);

        // Special handling for snap regret tracking
        if (event.type === 'snap_applied') {
            this.snapEvents.set(event.nodeId, {
                timestamp: event.timestamp,
                nodeId: event.nodeId
            });
        }

        // Track modal times
        if (event.type === 'node_selection') {
            if (this.modalOpenTime > 0) {
                this.modalTimes.push(event.timestamp - this.modalOpenTime);
            }
            this.modalOpenTime = event.timestamp;
        }

        // Track label collisions
        if (event.type === 'label_render') {
            this.collisionCounts.push(event.collisionCount);
        }

        // Track frame drops
        if (event.type === 'frame_drop') {
            this.frameDropCount++;
            this.fpsSamples.push(event.fps);
        }

        // Console log for debugging
        if (__DEV__) {
            console.log(`[Telemetry] ${event.type}:`, JSON.stringify(event, null, 2));
        }
    }

    // Convenience loggers
    logZoomStart(scale: number, ctcState: string) {
        this.log({
            type: 'zoom_start',
            timestamp: Date.now(),
            initialScale: scale,
            ctcState,
        });
    }

    logZoomEnd(scale: number, velocity: number, snapApplied: boolean, snapTargetId?: string) {
        this.log({
            type: 'zoom_end',
            timestamp: Date.now(),
            finalScale: scale,
            velocityAtEnd: velocity,
            snapApplied,
            snapTargetId,
        });
    }

    logSnap(nodeId: string, distance: number) {
        this.log({
            type: 'snap_applied',
            timestamp: Date.now(),
            nodeId,
            distanceFromCenter: distance,
        });
    }

    logCameraMove(cause: 'user' | 'system', duration: number, displacement: { x: number; y: number }) {
        this.log({
            type: 'camera_move',
            timestamp: Date.now(),
            cause,
            duration,
            displacement,
        });
    }

    logLabelRender(visibleCount: number, lodLevel: number, collisionCount: number) {
        this.log({
            type: 'label_render',
            timestamp: Date.now(),
            visibleCount,
            lodLevel,
            collisionCount,
        });
    }

    logNodeSelection(nodeId: string, ctcState: string) {
        const now = Date.now();
        this.log({
            type: 'node_selection',
            timestamp: now,
            nodeId,
            timeSinceLastSelection: this.lastSelectionTime > 0 ? now - this.lastSelectionTime : 0,
            ctcState,
        });
        this.lastSelectionTime = now;
    }

    logCTCTransition(fromState: string, toState: string, trigger: string) {
        this.log({
            type: 'ctc_transition',
            timestamp: Date.now(),
            fromState,
            toState,
            trigger,
        });
    }

    logFrameDrop(fps: number, nodeCount: number, visibleLabels: number) {
        this.log({
            type: 'frame_drop',
            timestamp: Date.now(),
            fps,
            nodeCount,
            visibleLabels,
        });
    }

    logLostSignal() {
        this.lostSignalCount++;
    }

    logConnectionCreated() {
        this.connectionsCreated++;
    }

    // Check for snap regret (pan back within 3s of snap)
    checkSnapRegret(nodeId: string) {
        const snapEvent = this.snapEvents.get(nodeId);
        if (snapEvent && Date.now() - snapEvent.timestamp < 3000) {
            // Update the event with regret flag
            const eventIndex = this.events.findIndex(
                e => e.type === 'snap_applied' && (e as SnapAppliedEvent).nodeId === nodeId
            );
            if (eventIndex !== -1) {
                (this.events[eventIndex] as SnapAppliedEvent).userReversedWithin3s = true;
            }
            return true;
        }
        return false;
    }

    // Calculate session metrics
    getSessionMetrics(): SessionMetrics {
        const snapEvents = this.events.filter(e => e.type === 'snap_applied') as SnapAppliedEvent[];
        const regretfulSnaps = snapEvents.filter(e => e.userReversedWithin3s === true);
        const snapRegretRate = snapEvents.length > 0
            ? (regretfulSnaps.length / snapEvents.length) * 100
            : 0;

        const selectionEvents = this.events.filter(e => e.type === 'node_selection') as NodeSelectionEvent[];
        const firstSelection = selectionEvents[0];
        const timeToFirstSelection = firstSelection
            ? firstSelection.timestamp - this.sessionStart
            : 0;

        const avgModalTime = this.modalTimes.length > 0
            ? this.modalTimes.reduce((a, b) => a + b, 0) / this.modalTimes.length
            : 0;

        const avgFPS = this.fpsSamples.length > 0
            ? this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length
            : 60;

        const avgCollisions = this.collisionCounts.length > 0
            ? this.collisionCounts.reduce((a, b) => a + b, 0) / this.collisionCounts.length
            : 0;

        const cameraInterruptions = this.events.filter(
            e => e.type === 'camera_move' && (e as CameraMoveEvent).cause === 'user'
        ).length;

        return {
            snapRegretRate,
            cameraInterruptions,
            selectionLatency: avgModalTime,
            timeToFirstMeaningfulSelection: timeToFirstSelection,
            lostSignalEvents: this.lostSignalCount,
            averageTimeInModal: avgModalTime,
            connectionsCreatedPerSession: this.connectionsCreated,
            averageFPS: avgFPS,
            frameDrops: this.frameDropCount,
            labelCollisionCount: Math.round(avgCollisions),
        };
    }

    // Export events (for debugging/analytics)
    exportEvents(): TelemetryEvent[] {
        return [...this.events];
    }

    // Get summary report
    getSummaryReport(): string {
        const metrics = this.getSessionMetrics();
        const duration = Math.round((Date.now() - this.sessionStart) / 1000);

        return `
═══════════════════════════════════════
   NEURAL HORIZON TELEMETRY REPORT
═══════════════════════════════════════
Session Duration: ${duration}s
Events Logged: ${this.events.length}

📊 INTERACTION QUALITY
  Snap Regret Rate: ${metrics.snapRegretRate.toFixed(1)}% (target: <5%)
  Camera Interruptions: ${metrics.cameraInterruptions}
  Selection Latency: ${metrics.selectionLatency.toFixed(0)}ms

🧭 COMPREHENSION
  Time to First Selection: ${metrics.timeToFirstMeaningfulSelection}ms
  Lost Signal Events: ${metrics.lostSignalEvents}

💡 ENGAGEMENT
  Avg Time in Modal: ${metrics.averageTimeInModal.toFixed(0)}ms
  Connections Created: ${metrics.connectionsCreatedPerSession}

⚡ PERFORMANCE
  Average FPS: ${metrics.averageFPS.toFixed(1)} (target: ≥58)
  Frame Drops: ${metrics.frameDrops}
  Label Collisions/Render: ${metrics.labelCollisionCount}
═══════════════════════════════════════
`;
    }
}

// Singleton export
export const TelemetryService = new TelemetryServiceClass();

// Initialize session on import
if (typeof global !== 'undefined') {
    TelemetryService.startSession();
}
