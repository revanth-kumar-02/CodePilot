export type SupportedLanguage = 'java' | 'cpp' | 'c' | 'python' | 'javascript' | 'typescript';

export interface LanguageInfo {
  id: SupportedLanguage;
  displayName: string;
  aliases: string[];
  fileExtension: string;
  defaultVersionLabel: string;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  java: {
    id: 'java',
    displayName: 'Java',
    aliases: ['java', 'java17', 'java21', 'java8', 'java 17', 'java 21', 'java 8', 'java 25'],
    fileExtension: '.java',
    defaultVersionLabel: 'Java',
  },
  cpp: {
    id: 'cpp',
    displayName: 'C++',
    aliases: ['cpp', 'c++', 'g++', 'c++17', 'c++20', 'c++11', 'gcc c++'],
    fileExtension: '.cpp',
    defaultVersionLabel: 'C++',
  },
  c: {
    id: 'c',
    displayName: 'C',
    aliases: ['c', 'gcc', 'c11', 'c99', 'gcc c'],
    fileExtension: '.c',
    defaultVersionLabel: 'C',
  },
  python: {
    id: 'python',
    displayName: 'Python',
    aliases: ['python', 'python3', 'py', 'python 3', 'py3', 'python3.10', 'python3.11'],
    fileExtension: '.py',
    defaultVersionLabel: 'Python',
  },
  javascript: {
    id: 'javascript',
    displayName: 'JavaScript',
    aliases: ['javascript', 'js', 'node', 'nodejs', 'node.js'],
    fileExtension: '.js',
    defaultVersionLabel: 'JavaScript',
  },
  typescript: {
    id: 'typescript',
    displayName: 'TypeScript',
    aliases: ['typescript', 'ts'],
    fileExtension: '.ts',
    defaultVersionLabel: 'TypeScript',
  },
};

export const DEFAULT_LANGUAGE: SupportedLanguage = 'java';

export class LanguageRegistry {
  public static isSupported(lang: string): boolean {
    if (!lang) return false;
    const normalized = lang.toLowerCase().trim();
    return Object.values(SUPPORTED_LANGUAGES).some(
      (info) => info.id === normalized || info.aliases.includes(normalized)
    );
  }

  public static normalize(lang: string | null | undefined): SupportedLanguage {
    if (!lang) return DEFAULT_LANGUAGE;
    const normalized = lang.toLowerCase().trim();

    for (const info of Object.values(SUPPORTED_LANGUAGES)) {
      if (info.id === normalized || info.aliases.some((alias) => normalized.includes(alias))) {
        return info.id;
      }
    }

    return DEFAULT_LANGUAGE;
  }

  public static getInfo(lang: SupportedLanguage): LanguageInfo {
    return SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES.java;
  }

  public static getSupportedList(): LanguageInfo[] {
    return [
      SUPPORTED_LANGUAGES.java,
      SUPPORTED_LANGUAGES.cpp,
      SUPPORTED_LANGUAGES.c,
      SUPPORTED_LANGUAGES.python,
      SUPPORTED_LANGUAGES.javascript,
      SUPPORTED_LANGUAGES.typescript,
    ];
  }

  public static resolveVersionDisplay(lang: SupportedLanguage, detectedVersion?: string | null): string {
    const info = this.getInfo(lang);
    if (!detectedVersion || detectedVersion.trim() === '' || detectedVersion.toLowerCase().includes('unknown')) {
      return `${info.displayName} (Version unavailable)`;
    }

    const cleanVer = detectedVersion.trim();
    if (cleanVer.toLowerCase().startsWith(info.displayName.toLowerCase())) {
      return cleanVer;
    }

    return `${info.displayName} ${cleanVer}`;
  }
}
