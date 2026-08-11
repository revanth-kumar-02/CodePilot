export class Logger {
  private scope: string = '[CodePilot][Backend]';

  info(message: string, ...args: unknown[]): void {
    console.log(`${this.scope} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.scope} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.scope} ${message}`, ...args);
  }
}

export const logger = new Logger();
