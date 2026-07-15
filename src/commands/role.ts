import { readYaml, patchYaml } from '../utils/yaml.js';
import { defaultRoleRegistry } from '../core/role-registry.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import os from 'os';

export async function runRoleShow(cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  const ivyDir = path.join(projectPath, '.ivy');
  const projectYaml = await readYaml(path.join(ivyDir, 'project.yaml'));

  if (!projectYaml) {
    logger.error('未找到 .ivy/project.yaml，请先运行 ivy init');
    return 1;
  }

  const roleId = (projectYaml.role as string) ?? 'developer';
  await defaultRoleRegistry.load();
  const role = defaultRoleRegistry.get(roleId);

  if (!role) {
    logger.error(`未知角色: ${roleId}`);
    return 1;
  }

  logger.info(`${role.icon}  ${role.name}`);
  logger.info(`   ${role.description}`);
  return 0;
}

export async function runRoleList(): Promise<number> {
  await defaultRoleRegistry.load();
  const roles = defaultRoleRegistry.getAll();

  logger.info('');
  logger.info('可用角色：');
  logger.info('');
  for (const role of roles) {
    logger.info(`  ${role.icon}  ${role.name.padEnd(12)} ${role.description}`);
  }
  logger.info('');
  return 0;
}

export async function runRoleSet(roleId: string, cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  const ivyDir = path.join(projectPath, '.ivy');
  const projectYamlPath = path.join(ivyDir, 'project.yaml');

  const existing = await readYaml(projectYamlPath);
  if (!existing) {
    logger.error('未找到 .ivy/project.yaml，请先运行 ivy init');
    return 1;
  }

  await defaultRoleRegistry.load();
  const role = defaultRoleRegistry.get(roleId);

  if (!role) {
    logger.error(`未知角色: ${roleId}`);
    logger.info('可用角色: ' + defaultRoleRegistry.getAll().map(r => r.id).join(', '));
    return 1;
  }

  await patchYaml(projectYamlPath, { role: roleId });
  logger.info(`${role.icon}  已切换为: ${role.name}`);
  logger.info(`   ${role.description}`);
  return 0;
}
