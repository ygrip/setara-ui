export type TranscriptNormalizationRule =
  | 'whitespace'
  | 'punctuation-spacing'
  | 'semantic-version'
  | 'sprint-number';

export interface NormalizedTranscript {
  rawText: string;
  normalizedText: string;
  appliedRules: TranscriptNormalizationRule[];
}

const ONES: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};

const TENS: Readonly<Record<string, number>> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

const SMALL_NUMBER =
  '(?:one hundred|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)';
const VERSION_PATTERN = new RegExp(
  `\\b(?:version\\s+)?${SMALL_NUMBER}(?:\\s+point\\s+${SMALL_NUMBER})+\\b`,
  'gi'
);
const SPRINT_PATTERN = new RegExp(`\\bsprint\\s+(${SMALL_NUMBER})\\b`, 'gi');

export function normalizeTranscript(rawText: string, language = 'en'): NormalizedTranscript {
  const appliedRules: TranscriptNormalizationRule[] = [];
  let normalizedText = applyRule(rawText, canonicalizeWhitespace, 'whitespace', appliedRules);
  normalizedText = applyRule(normalizedText, canonicalizePunctuation, 'punctuation-spacing', appliedRules);

  if (isEnglish(language)) {
    normalizedText = applyRule(normalizedText, normalizeSemanticVersions, 'semantic-version', appliedRules);
    normalizedText = applyRule(normalizedText, normalizeSprintNumbers, 'sprint-number', appliedRules);
  }

  return { rawText, normalizedText, appliedRules };
}

function applyRule(
  input: string,
  transform: (value: string) => string,
  rule: TranscriptNormalizationRule,
  appliedRules: TranscriptNormalizationRule[]
): string {
  const output = transform(input);
  if (output !== input) appliedRules.push(rule);
  return output;
}

function canonicalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function canonicalizePunctuation(value: string): string {
  return value
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:!?])(?=\S)/g, '$1 ');
}

function normalizeSemanticVersions(value: string): string {
  return value.replace(VERSION_PATTERN, (match) => {
    const prefix = match.match(/^version\s+/i)?.[0] ?? '';
    const spokenVersion = match.slice(prefix.length);
    const components = spokenVersion.split(/\s+point\s+/i).map(parseSmallNumber);
    return components.some((component) => component === null)
      ? match
      : `${prefix}${components.join('.')}`;
  });
}

function normalizeSprintNumbers(value: string): string {
  return value.replace(SPRINT_PATTERN, (match, spokenNumber: string) => {
    const sprintPrefix = match.slice(0, match.length - spokenNumber.length);
    const number = parseSmallNumber(spokenNumber);
    return number === null ? match : `${sprintPrefix}${number}`;
  });
}

function parseSmallNumber(value: string): number | null {
  const normalized = value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized === 'one hundred') return 100;
  if (normalized in ONES) return ONES[normalized];

  const [tensWord, onesWord, ...remainder] = normalized.split(' ');
  if (remainder.length > 0 || !(tensWord in TENS)) return null;
  if (!onesWord) return TENS[tensWord];
  if (!(onesWord in ONES) || ONES[onesWord] === 0 || ONES[onesWord] > 9) return null;
  return TENS[tensWord] + ONES[onesWord];
}

function isEnglish(language: string): boolean {
  return language.toLowerCase() === 'en' || language.toLowerCase().startsWith('en-');
}
