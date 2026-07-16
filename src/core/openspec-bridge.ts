import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

export interface OpenSpecBridgeOptions {
  changeName: string;
  cwd: string;
}

export type OpenSpecEvent = 'proposed' | 'applied' | 'archived';

export interface PhaseRecommendation {
  target: string;
  message: string;
  command: string;
}

export class OpenSpecBridge {
  private opts: OpenSpecBridgeOptions;

  constructor(opts: OpenSpecBridgeOptions) {
    this.opts = opts;
  }

  async translateEvent(event: OpenSpecEvent, changeName: string): Promise<PhaseRecommendation> {
    switch (event) {
      case 'proposed':
        return {
          target: 'design',
          message: `Proposal "${changeName}" created. Recommended phase: DESIGN`,
          command: 'ivy state set design',
        };
      case 'applied':
        return {
          target: 'verify',
          message: `Implementation "${changeName}" complete. Recommended phase: VERIFY`,
          command: 'ivy state set verify',
        };
      case 'archived': {
        const hasWorktree = this.checkWorktree(changeName);
        if (hasWorktree) {
          return {
            target: 'archive',
            message: `Change "${changeName}" archived. Worktree found. Run: ivy worktree cleanup ${changeName}`,
            command: `ivy worktree cleanup ${changeName}`,
          };
        }
        return {
          target: 'archive',
          message: `Change "${changeName}" archived.`,
          command: '',
        };
      }
    }
  }

  async recommendPhase(recommendation: PhaseRecommendation): Promise<void> {
    logger.header('Phase Recommendation');
    logger.divider();
    logger.info(`  ${recommendation.message}`);
    if (recommendation.command) {
      logger.info('');
      logger.info(`  Run: \`${recommendation.command}\``);
      logger.info('  (Phase will NOT be auto-promoted — user confirmation required)');
    }
    logger.divider();
  }

  private checkWorktree(changeName: string): boolean {
    try {
      const output = execSync('git worktree list', {
        cwd: this.opts.cwd,
        encoding: 'utf-8',
      });
      return output.split('\n').some((line) => line.includes(changeName));
    } catch {
      return false;
    }
  }
}
