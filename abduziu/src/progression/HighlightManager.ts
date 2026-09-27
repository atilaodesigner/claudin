import type { EventBus, HighlightPayload } from '../core/EventBus';

/**
 * CLIP MOMENTS. Records absurd moments with enough data to build replays/clips later
 * (the event stream is the contract for a future replay system).
 */
export class HighlightManager {
  readonly moments: HighlightPayload[] = [];

  constructor(private readonly bus: EventBus) {}

  reset(): void {
    this.moments.length = 0;
  }

  record(h: HighlightPayload): void {
    this.moments.push(h);
    this.bus.emit('highlight', h);
    switch (h.kind) {
      case 'jet_capture':
        this.bus.emit('highlight:jet_capture', h);
        break;
      case 'building_abduction':
        this.bus.emit('highlight:building_abduction', h);
        break;
      case 'frenzy':
        this.bus.emit('highlight:frenzy', h);
        break;
      case 'boss':
        this.bus.emit('highlight:boss', h);
        break;
      default:
        break;
    }
  }

  /** Best moments for the results screen. */
  top(n: number): HighlightPayload[] {
    return [...this.moments].sort((a, b) => b.score - a.score).slice(0, n);
  }
}
