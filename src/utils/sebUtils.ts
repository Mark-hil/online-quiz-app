/**
 * Safe Exam Browser (SEB) detection and launch helpers.
 */

export function isSafeExamBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  return ua.includes('SEB') || Boolean((window as any).SafeExamBrowser);
}

export function getSebConfigUrl(quizId?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const query = quizId ? `?quizId=${encodeURIComponent(quizId)}` : '';
  return `${origin}/api/exam/seb-config${query}`;
}

export function getSebLaunchUri(quizId?: string): string {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'sebs://' : 'seb://';
  const query = quizId ? `?quizId=${encodeURIComponent(quizId)}` : '';
  return `${protocol}${window.location.host}/api/exam/seb-config${query}`;
}

export function launchInSafeExamBrowser(quizId?: string): void {
  if (typeof window === 'undefined') return;
  window.location.href = getSebLaunchUri(quizId);
}

