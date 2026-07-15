/**
 * Phase 3 — shared human-answer channel.
 *
 * Both the oversight gate (canUseTool approvals) and the `ask_user` tool read
 * human input through one AnswerProvider, so a single `--answers` script can
 * drive an entire non-interactive run for repeatable screen recordings, while
 * the default path blocks on real stdin for a live demo.
 *
 * Decision (Alok, 2026-07-08): real stdin with a scripted fallback.
 */

import { createInterface } from 'node:readline';

export interface AnswerProvider {
  /** Prompts the human (or replays the next scripted answer) and resolves to the reply. */
  ask(prompt: string): Promise<string>;
  /** True when answers come from a script rather than a live keyboard. */
  readonly scripted: boolean;
}

/**
 * Builds an AnswerProvider. If `scriptedAnswers` is provided and non-empty,
 * answers are dequeued from it (and echoed to the console so a recording shows
 * the "input"); once exhausted it falls back to empty strings. Otherwise every
 * question blocks on real stdin.
 */
export function createAnswerProvider(scriptedAnswers?: string[]): AnswerProvider {
  if (scriptedAnswers && scriptedAnswers.length > 0) {
    const queue = [...scriptedAnswers];
    return {
      scripted: true,
      async ask(prompt: string): Promise<string> {
        console.log(prompt);
        const answer = (queue.shift() ?? '').trim();
        console.log(
          `  [scripted answer] ${answer === '' ? '(empty → default)' : answer}`,
        );
        return answer;
      },
    };
  }

  return {
    scripted: false,
    async ask(prompt: string): Promise<string> {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = await new Promise<string>((resolve) => {
          rl.question(`${prompt} `, resolve);
        });
        return answer.trim();
      } finally {
        rl.close();
      }
    },
  };
}
