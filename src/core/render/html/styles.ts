export const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    background: #0a0e14;
    color: #bfbdb6;
    padding: 24px;
    max-width: 960px;
    margin: 0 auto;
  }
  header { margin-bottom: 32px; }
  header h1 { color: #ffb454; font-size: 18px; }
  header .meta { color: #565b66; font-size: 12px; margin-top: 8px; }
  section { margin-bottom: 24px; }
  section h2 { color: #59c2ff; font-size: 14px; margin-bottom: 12px; border-bottom: 1px solid #1f2430; padding-bottom: 4px; }
  .bar-wrap { display: flex; align-items: center; margin: 4px 0; }
  .bar-label { width: 200px; font-size: 12px; color: #8a9199; }
  .bar-track { flex: 1; height: 16px; background: #1f2430; border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; background: #59c2ff; border-radius: 2px; }
  .bar-pct { width: 48px; text-align: right; font-size: 12px; color: #bfbdb6; margin-left: 8px; }
  .row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
  .row .label { color: #8a9199; }
  .row .value { color: #bfbdb6; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { background: #1f2430; border-radius: 6px; padding: 16px; text-align: center; }
  .kpi .val { font-size: 28px; color: #ffb454; }
  .kpi .lbl { font-size: 11px; color: #8a9199; margin-top: 4px; }
  footer { margin-top: 48px; font-size: 11px; color: #565b66; border-top: 1px solid #1f2430; padding-top: 12px; }
  details { margin: 8px 0; }
  details summary { cursor: pointer; color: #59c2ff; font-size: 13px; }
  details .content { padding: 8px 0 0 16px; }
`;
