export interface PlatformRule {
  platform: 'leetcode' | 'generic' | string;
  language: string;
  className: string;
  requiresMain: boolean;
}

export class PlatformRules {
  public static getRule(hostnameOrUrl?: string | null, platformHint?: string | null): PlatformRule {
    const raw = `${hostnameOrUrl || ''} ${platformHint || ''}`.toLowerCase();

    if (raw.includes('leetcode')) {
      return {
        platform: 'leetcode',
        language: 'Java',
        className: 'Solution',
        requiresMain: false,
      };
    }

    return {
      platform: 'generic',
      language: 'Java',
      className: 'Main',
      requiresMain: true,
    };
  }
}
