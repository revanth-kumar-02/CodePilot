import { TabRuntimeState, WindowRuntimeState } from './runtime-state';

export type RuntimeEventType =
  | 'TAB_CREATED'
  | 'TAB_UPDATED'
  | 'TAB_REMOVED'
  | 'TAB_ACTIVATED'
  | 'WINDOW_FOCUSED'
  | 'WINDOW_CREATED'
  | 'WINDOW_REMOVED'
  | 'CONTENT_SCRIPT_READY'
  | 'CONTENT_SCRIPT_UNAVAILABLE';

export interface RuntimeEventMap {
  TAB_CREATED: TabRuntimeState;
  TAB_UPDATED: TabRuntimeState;
  TAB_REMOVED: number;
  TAB_ACTIVATED: { tabId: number; windowId: number };
  WINDOW_FOCUSED: number;
  WINDOW_CREATED: WindowRuntimeState;
  WINDOW_REMOVED: number;
  CONTENT_SCRIPT_READY: { tabId: number; timestamp: number };
  CONTENT_SCRIPT_UNAVAILABLE: { tabId: number; reason: string };
}

type EventListener<T> = (data: T) => void;

export class RuntimeEventEmitter {
  // Use explicit handler map for type safety
  private listeners: Map<RuntimeEventType, Set<EventListener<unknown>>> = new Map();

  public on<K extends RuntimeEventType>(event: K, listener: EventListener<RuntimeEventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown>);
  }

  public off<K extends RuntimeEventType>(event: K, listener: EventListener<RuntimeEventMap[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as EventListener<unknown>);
    }
  }

  public emit<K extends RuntimeEventType>(event: K, data: RuntimeEventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[CodePilot][EventEmitter] Listener error on ${event}:`, error);
        }
      });
    }
  }
}
