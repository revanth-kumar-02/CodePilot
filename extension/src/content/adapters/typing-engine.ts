import { TypingSpeedConfig, DEFAULT_TYPING_SPEED } from '../../storage/settings-storage';

export class TypingEngine {
  private static currentConfig: TypingSpeedConfig = DEFAULT_TYPING_SPEED;

  public static configure(config?: Partial<TypingSpeedConfig>): void {
    if (config) {
      this.currentConfig = {
        ...this.currentConfig,
        ...config,
      };
    }
  }

  public static getConfig(): TypingSpeedConfig {
    return { ...this.currentConfig };
  }

  public static getCharacterDelay(char: string, customConfig?: TypingSpeedConfig): number {
    const cfg = customConfig || this.currentConfig;
    if (!cfg.enabled) return 0;

    const min = Math.max(5, cfg.minDelay);
    const max = Math.max(min, cfg.maxDelay);
    const base = min + Math.floor(Math.random() * (max - min + 1));

    if (char === '\n') {
      return Math.floor(base * 2.2);
    }
    if (char === ' ' || char === '\t') {
      return Math.floor(base * 1.3);
    }
    return base;
  }

  public static async delay(char: string, customConfig?: TypingSpeedConfig): Promise<void> {
    const ms = this.getCharacterDelay(char, customConfig);
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }
}
