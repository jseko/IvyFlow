import type { CapabilityManifest } from './capability-registry.js';
import { confirm } from '@inquirer/prompts';
import { logger } from '../utils/logger.js';

export interface AuditModule {
  icon: string;
  name: string;
  networkPermission: string;
  filePermission: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AuditReport {
  modules: AuditModule[];
  totalExternalConnections: number;
  overallRisk: 'low' | 'medium' | 'high';
}

function riskColor(level: string): string {
  switch (level) {
    case 'low': return '🟢 低';
    case 'medium': return '🟡 中';
    case 'high': return '🔴 高';
    default: return level;
  }
}

function riskOrder(level: string): number {
  switch (level) {
    case 'high': return 2;
    case 'medium': return 1;
    case 'low': return 0;
    default: return 0;
  }
}

function pad(str: string, width: number): string {
  const visualLen = [...str].length;
  if (visualLen >= width) return str;
  return str + ' '.repeat(width - visualLen);
}

function renderRow(icon: string, name: string, network: string, file: string, risk: string): string {
  return `│ ${icon} ${pad(name, 17)}│ ${pad(network, 9)}│ ${pad(file, 9)}│ ${pad(risk, 9)}│`;
}

const KERNEL_MODULE: AuditModule = {
  icon: '🍃',
  name: '内核',
  networkPermission: '无',
  filePermission: '写入配置',
  riskLevel: 'low',
};

export class SecurityAuditor {
  audit(selectedManifests: CapabilityManifest[]): AuditReport {
    const modules: AuditModule[] = [KERNEL_MODULE];

    let totalExternal = 0;
    let maxRisk: 'low' | 'medium' | 'high' = 'low';

    for (const m of selectedManifests) {
      if (m.network_permission && m.network_permission !== 'none' && m.network_permission !== '无') {
        totalExternal++;
      }
      if (riskOrder(m.risk_level) > riskOrder(maxRisk)) {
        maxRisk = m.risk_level;
      }
      modules.push({
        icon: m.icon,
        name: m.display_name,
        networkPermission: m.network_permission,
        filePermission: m.file_permission,
        riskLevel: m.risk_level,
      });
    }

    return { modules, totalExternalConnections: totalExternal, overallRisk: maxRisk };
  }

  renderTable(report: AuditReport): void {
    logger.info('');
    logger.info('  安装前安全评估：');
    logger.info('');
    logger.info('  ┌────────────────────┬──────────┬──────────┬──────────┐');
    logger.info(`  │ 模块               │ 网络权限 │ 文件权限 │ 风险等级 │`);
    logger.info('  ├────────────────────┼──────────┼──────────┼──────────┤');

    for (const mod of report.modules) {
      logger.info(`  ${renderRow(mod.icon, mod.name, mod.networkPermission, mod.filePermission, riskColor(mod.riskLevel))}`);
    }

    logger.info('  ├────────────────────┼──────────┼──────────┼──────────┤');
    const extStr = `${report.totalExternalConnections} 外部连接`;
    logger.info(`  │ 总计               │ ${pad(extStr, 9)}│          │ ${pad(riskColor(report.overallRisk), 9)}│`);
    logger.info('  └────────────────────┴──────────┴──────────┴──────────┘');
    logger.info('');
  }

  async confirmInstall(): Promise<boolean> {
    return confirm({
      message: '确认安装？',
      default: true,
    });
  }
}

export const defaultSecurityAuditor = new SecurityAuditor();
