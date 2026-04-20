import { getQuestionBank } from './questions.js';
import { loadSettings } from './storage.js';

export function normalizeText(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function closeEnough(a, b) {
  if (a.length < 5 || b.length < 5) return false;
  const d = levenshtein(a, b);
  return d <= 1 || d / Math.max(a.length, b.length) <= 0.15;
}

export function isAnswerCorrect(input, question) {
  const cleanedInput = normalizeText(input);
  if (!cleanedInput) return false;

  const answers = Array.isArray(question.answers)
    ? question.answers.map(normalizeText)
    : [];

  if (question.matchType === 'contains') {
    for (const ans of answers) {
      if (cleanedInput.includes(ans)) return true;
      if (closeEnough(cleanedInput, ans)) return true;
    }
    return false;
  }

  for (const ans of answers) {
    if (cleanedInput === ans) return true;
    if (closeEnough(cleanedInput, ans)) return true;
  }

  return false;
}

export function getUnusedQuestions(usedQuestionIds) {
  const bank = getQuestionBank();
  const used = new Set(usedQuestionIds);
  const settings = loadSettings();

  return bank.filter((q) => !used.has(q.id) && q.difficulty === settings.difficulty);
}

export function chooseQuestionForItem(item, usedQuestionIds, shuffleFn) {
  if (item.question) return item.question;

  const available = getUnusedQuestions(usedQuestionIds);
  if (available.length === 0) return null;

  const q = shuffleFn(available)[0];
  item.question = q;
  return q;
}
