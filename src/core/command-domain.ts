/**
 * Command Domain Registry -- v0.18 Layer 3 metadata.
 * Maps CLI commands to functional domains for structured help grouping.
 * Read-only data: no routing, no execution gating, no switch on domain.
 */

export type CommandDomain = 'platform' | 'system' | 'workflow' | 'inspect' | 'lifecycle';

export interface CommandDomainEntry {
  command: string;
  domain: CommandDomain;
}

export const COMMAND_DOMAIN_REGISTRY: CommandDomainEntry[] = [
  { command: 'init', domain: 'lifecycle' },
  { command: 'init --wizard', domain: 'system' },
  { command: 'status', domain: 'inspect' },
  { command: 'validate', domain: 'lifecycle' },
  { command: 'doctor', domain: 'system' },
  { command: 'doctor --platforms', domain: 'platform' },
  { command: 'doctor --env', domain: 'system' },
  { command: 'doctor --ecosystem', domain: 'inspect' },
  { command: 'doctor --memory', domain: 'inspect' },
  { command: 'uninstall', domain: 'lifecycle' },
  { command: 'update', domain: 'system' },
  { command: 'analytics', domain: 'inspect' },
  { command: 'dashboard', domain: 'inspect' },
  { command: 'suggest', domain: 'workflow' },
  { command: 'review', domain: 'workflow' },
  { command: 'check', domain: 'lifecycle' },
  { command: 'explain', domain: 'inspect' },
  { command: 'rules', domain: 'inspect' },
  { command: 'rules generate', domain: 'inspect' },
  { command: 'rules analyze', domain: 'inspect' },
  { command: 'rules validate', domain: 'inspect' },
  { command: 'rules audit', domain: 'inspect' },
  { command: 'archive', domain: 'lifecycle' },
  { command: 'verify', domain: 'lifecycle' },
  { command: 'audit', domain: 'inspect' },
  { command: 'trace', domain: 'inspect' },
  { command: 'fingerprint', domain: 'inspect' },
  { command: 'release', domain: 'lifecycle' },
  { command: 'export', domain: 'lifecycle' },
  { command: 'state', domain: 'lifecycle' },
  { command: 'workflow', domain: 'workflow' },
  { command: 'explore', domain: 'inspect' },
  { command: 'capability', domain: 'inspect' },
  { command: 'feedback', domain: 'inspect' },
  { command: 'knowledge', domain: 'inspect' },
  { command: 'migrate', domain: 'workflow' },
  { command: 'superpowers install', domain: 'platform' },
  { command: 'mcp', domain: 'system' },
];

export function getCommandsByDomain(): Record<CommandDomain, CommandDomainEntry[]> {
  const groups: Record<CommandDomain, CommandDomainEntry[]> = {
    platform: [], system: [], workflow: [], inspect: [], lifecycle: [],
  };
  for (const entry of COMMAND_DOMAIN_REGISTRY) {
    groups[entry.domain].push(entry);
  }
  return groups;
}

export function getDomainForCommand(commandName: string): CommandDomain | undefined {
  // Match longest prefix first (e.g. "rules generate" before "rules")
  const sorted = [...COMMAND_DOMAIN_REGISTRY].sort((a, b) => b.command.length - a.command.length);
  return sorted.find(e => commandName.startsWith(e.command))?.domain;
}
