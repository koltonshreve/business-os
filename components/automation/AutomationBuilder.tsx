import { useState, useCallback, useEffect } from 'react';
import { authHeaders, loadAuthSession } from '../../lib/auth';
import type { Automation, AutomationTrigger, AutomationAction, DealStage, TriggerType, ActionType } from '../../types';

// ── Seed automations ──────────────────────────────────────────────────────────

const SEED_AUTOMATIONS: Automation[] = [
  {
    id: 'auto-1',
    name: 'Low EBITDA Alert',
    enabled: true,
    trigger: { type: 'metric-below', metric: 'ebitda-margin', threshold: 10 },
    action: { type: 'in-app-alert', message: 'EBITDA margin dropped below 10% — review cost structure.' },
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    fireCount: 0,
  },
  {
    id: 'auto-2',
    name: 'Weekly Intelligence Report',
    enabled: true,
    trigger: { type: 'weekly' },
    action: { type: 'generate-report', reportType: 'weekly-insight' },
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    lastFiredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    fireCount: 3,
  },
  {
    id: 'auto-3',
    name: 'Deal Won Notification',
    enabled: false,
    trigger: { type: 'new-deal-stage', stage: 'closed-won' },
    action: { type: 'in-app-alert', message: 'New deal closed! Update forecast and revenue projections.' },
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    fireCount: 2,
  },
];

// ── Trigger / Action options ──────────────────────────────────────────────────

const TRIGGER_OPTIONS: { type: TriggerType; label: string; icon: string; hasMetric?: boolean; hasThreshold?: boolean; hasStage?: boolean }[] = [
  { type: 'metric-below',    label: 'Metric drops below threshold', icon: '↓', hasMetric: true, hasThreshold: true },
  { type: 'metric-above',    label: 'Metric rises above threshold', icon: '↑', hasMetric: true, hasThreshold: true },
  { type: 'weekly',          label: 'Every week (Monday)',          icon: '◷' },
  { type: 'monthly',         label: 'Every month (1st)',            icon: '◑' },
  { type: 'churn-detected',  label: 'Customer churn detected',      icon: '⚠' },
  { type: 'new-deal-stage',  label: 'Deal reaches a stage',         icon: '⬡', hasStage: true },
];

const METRIC_OPTIONS: { value: NonNullable<AutomationTrigger['metric']>; label: string; unit: string }[] = [
  { value: 'ebitda-margin',      label: 'EBITDA Margin',        unit: '%' },
  { value: 'gross-margin',       label: 'Gross Margin',         unit: '%' },
  { value: 'revenue-growth',     label: 'Revenue Growth MoM',   unit: '%' },
  { value: 'retention',          label: 'Retention Rate',       unit: '%' },
  { value: 'cash-runway',        label: 'Cash Runway',          unit: 'months' },
  { value: 'pipeline-coverage',  label: 'Pipeline Coverage',    unit: 'x' },
];

const STAGE_OPTIONS: { value: DealStage; label: string }[] = [
  { value: 'lead',          label: 'Lead' },
  { value: 'qualified',     label: 'Qualified' },
  { value: 'proposal',      label: 'Proposal' },
  { value: 'negotiation',   label: 'Negotiation' },
  { value: 'closed-won',    label: 'Closed Won' },
  { value: 'closed-lost',   label: 'Closed Lost' },
];

const ACTION_OPTIONS: { type: ActionType; label: string; icon: string; hasMessage?: boolean; hasReport?: boolean; hasWebhook?: boolean; hasNote?: boolean }[] = [
  { type: 'in-app-alert',    label: 'In-app alert',       icon: '🔔', hasMessage: true },
  { type: 'generate-report', label: 'Generate report',    icon: '📋', hasReport: true },
  { type: 'webhook',         label: 'Send webhook',        icon: '⟳',  hasWebhook: true },
  { type: 'add-note',        label: 'Add note to dashboard', icon: '📝', hasNote: true },
];

// ── Helper components ─────────────────────────────────────────────────────────

function TriggerLabel({ trigger }: { trigger: AutomationTrigger }) {
  const opt = TRIGGER_OPTIONS.find(t => t.type === trigger.type);
  if (!opt) return <span className="text-slate-400">Unknown trigger</span>;

  if (trigger.type === 'metric-below' || trigger.type === 'metric-above') {
    const metricOpt = METRIC_OPTIONS.find(m => m.value === trigger.metric);
    const dir = trigger.type === 'metric-below' ? 'drops below' : 'rises above';
    return (
      <span className="text-slate-300">
        {metricOpt?.label ?? trigger.metric} {dir} {trigger.threshold}{metricOpt?.unit}
      </span>
    );
  }
  if (trigger.type === 'new-deal-stage') {
    const stageOpt = STAGE_OPTIONS.find(s => s.value === trigger.stage);
    return <span className="text-slate-300">Deal reaches <strong className="text-sky-300">{stageOpt?.label ?? trigger.stage}</strong></span>;
  }
  return <span className="text-slate-300">{opt.label}</span>;
}

function ActionLabel({ action }: { action: AutomationAction }) {
  const opt = ACTION_OPTIONS.find(a => a.type === action.type);
  if (!opt) return <span className="text-slate-400">Unknown action</span>;
  if (action.type === 'in-app-alert') return <span className="text-slate-300">Alert: <em className="not-italic text-amber-300">"{action.message?.slice(0, 50)}{(action.message?.length ?? 0) > 50 ? '…' : ''}"</em></span>;
  if (action.type === 'generate-report') return <span className="text-slate-300">Generate {action.reportType === 'board-deck' ? 'board deck' : 'weekly report'}</span>;
  if (action.type === 'webhook') return <span className="text-slate-300">POST to <code className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono">{action.webhookUrl?.slice(0, 40) ?? 'webhook URL'}</code></span>;
  if (action.type === 'add-note') return <span className="text-slate-300">Note: "{action.noteText?.slice(0, 40)}"</span>;
  return <span className="text-slate-300">{opt.label}</span>;
}

// ── New Automation Form ───────────────────────────────────────────────────────

function AutomationForm({ onSave, onCancel }: { onSave: (a: Automation) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('metric-below');
  const [metric, setMetric] = useState<AutomationTrigger['metric']>('ebitda-margin');
  const [threshold, setThreshold] = useState<number>(10);
  const [stage, setStage] = useState<DealStage>('closed-won');
  const [actionType, setActionType] = useState<ActionType>('in-app-alert');
  const [message, setMessage] = useState('');
  const [reportType, setReportType] = useState<'weekly-insight' | 'board-deck'>('weekly-insight');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [noteText, setNoteText] = useState('');

  const triggerOpt = TRIGGER_OPTIONS.find(t => t.type === triggerType)!;
  const actionOpt  = ACTION_OPTIONS.find(a => a.type === actionType)!;

  const buildTrigger = (): AutomationTrigger => {
    const base: AutomationTrigger = { type: triggerType };
    if (triggerOpt.hasMetric) base.metric = metric;
    if (triggerOpt.hasThreshold) base.threshold = threshold;
    if (triggerOpt.hasStage) base.stage = stage;
    return base;
  };

  const buildAction = (): AutomationAction => {
    const base: AutomationAction = { type: actionType };
    if (actionOpt.hasMessage) base.message = message;
    if (actionOpt.hasReport) base.reportType = reportType;
    if (actionOpt.hasWebhook) base.webhookUrl = webhookUrl;
    if (actionOpt.hasNote) base.noteText = noteText;
    return base;
  };

  const canSave = name.trim().length > 0 && (
    (actionType === 'in-app-alert' && message.trim().length > 0) ||
    (actionType === 'generate-report') ||
    (actionType === 'webhook' && webhookUrl.trim().startsWith('http')) ||
    (actionType === 'add-note' && noteText.trim().length > 0)
  );

  const handleSave = () => {
    const a: Automation = {
      id: `auto-${Date.now()}`,
      name: name.trim(),
      enabled: true,
      trigger: buildTrigger(),
      action: buildAction(),
      createdAt: new Date().toISOString(),
      fireCount: 0,
    };
    onSave(a);
  };

  const selectCls = "w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none transition-colors";
  const inputCls  = "w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors";
  const labelCls  = "block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5";

  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5">
      <div className="text-[13px] font-semibold text-slate-100 mb-4">New Automation</div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className={labelCls}>Automation Name</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Low margin alert"
            autoFocus className={inputCls}
          />
        </div>

        {/* IF: Trigger */}
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">IF</span>
            <span className="text-[11px] text-slate-500">trigger condition</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Trigger</label>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value as TriggerType)} className={selectCls}>
                {TRIGGER_OPTIONS.map(t => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
            </div>

            {triggerOpt.hasMetric && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Metric</label>
                  <select value={metric} onChange={e => setMetric(e.target.value as AutomationTrigger['metric'])} className={selectCls}>
                    {METRIC_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Threshold ({METRIC_OPTIONS.find(m => m.value === metric)?.unit})</label>
                  <input
                    type="number" value={threshold} onChange={e => setThreshold(parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {triggerOpt.hasStage && (
              <div>
                <label className={labelCls}>Deal Stage</label>
                <select value={stage} onChange={e => setStage(e.target.value as DealStage)} className={selectCls}>
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* THEN: Action */}
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">THEN</span>
            <span className="text-[11px] text-slate-500">action to take</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Action</label>
              <div className="grid grid-cols-2 gap-2">
                {ACTION_OPTIONS.map(a => (
                  <button
                    key={a.type}
                    onClick={() => setActionType(a.type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-[11px] transition-all ${
                      actionType === a.type
                        ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-300 font-medium'
                        : 'border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-[14px]">{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {actionOpt.hasMessage && (
              <div>
                <label className={labelCls}>Alert Message</label>
                <input type="text" value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="What should the alert say?"
                  className={inputCls}
                />
              </div>
            )}

            {actionOpt.hasReport && (
              <div>
                <label className={labelCls}>Report Type</label>
                <select value={reportType} onChange={e => setReportType(e.target.value as 'weekly-insight' | 'board-deck')} className={selectCls}>
                  <option value="weekly-insight">Weekly Intelligence Report</option>
                  <option value="board-deck">Board Deck</option>
                </select>
              </div>
            )}

            {actionOpt.hasWebhook && (
              <div>
                <label className={labelCls}>Webhook URL</label>
                <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/…"
                  className={inputCls}
                />
              </div>
            )}

            {actionOpt.hasNote && (
              <div>
                <label className={labelCls}>Note Text</label>
                <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder="Note to add to dashboard…"
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 mt-5">
        <button onClick={onCancel}
          className="px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={!canSave}
          className="px-5 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all">
          Save automation
        </button>
      </div>
    </div>
  );
}

// ── Main AutomationBuilder ────────────────────────────────────────────────────

export default function AutomationBuilder() {
  const loadAutomations = (): Automation[] => {
    try {
      const raw = localStorage.getItem('bos_automations');
      if (raw) return JSON.parse(raw) as Automation[];
    } catch { /* ignore */ }
    return SEED_AUTOMATIONS;
  };

  const [automations, setAutomationsState] = useState<Automation[]>(loadAutomations);
  const [showForm, setShowForm] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<Record<string, 'idle' | 'sending' | 'ok' | 'err'>>({});

  const testWebhook = async (auto: Automation) => {
    if (!auto.action.webhookUrl) return;
    setWebhookStatus(s => ({ ...s, [auto.id]: 'sending' }));
    try {
      const r = await fetch('/api/automations/fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ webhookUrl: auto.action.webhookUrl, payload: { automationName: auto.name, trigger: auto.trigger, action: auto.action } }),
      });
      setWebhookStatus(s => ({ ...s, [auto.id]: r.ok ? 'ok' : 'err' }));
      setTimeout(() => setWebhookStatus(s => ({ ...s, [auto.id]: 'idle' })), 3000);
    } catch {
      setWebhookStatus(s => ({ ...s, [auto.id]: 'err' }));
      setTimeout(() => setWebhookStatus(s => ({ ...s, [auto.id]: 'idle' })), 3000);
    }
  };

  // Hydrate from DB prefs on mount
  useEffect(() => {
    if (!loadAuthSession()) return;
    fetch('/api/user/prefs', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { automations?: Automation[] } | null) => {
        if (prefs?.automations && prefs.automations.length > 0) {
          setAutomationsState(prefs.automations);
          try { localStorage.setItem('bos_automations', JSON.stringify(prefs.automations)); } catch { /* ignore */ }
        } else {
          // Push local automations up to DB
          const local = loadAutomations();
          fetch('/api/user/prefs', {
            method: 'PATCH', headers: authHeaders(),
            body: JSON.stringify({ automations: local }),
          }).catch(() => null);
        }
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback((list: Automation[]) => {
    setAutomationsState(list);
    try { localStorage.setItem('bos_automations', JSON.stringify(list)); } catch { /* ignore */ }
    if (loadAuthSession()) {
      fetch('/api/user/prefs', {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ automations: list }),
      }).catch(() => null);
    }
  }, []);

  const toggle = (id: string) => {
    save(automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const deleteAuto = (id: string) => {
    save(automations.filter(a => a.id !== id));
  };

  const addAutomation = (a: Automation) => {
    save([...automations, a]);
    setShowForm(false);
  };

  const enabledCount = automations.filter(a => a.enabled).length;
  const totalFires   = automations.reduce((s, a) => s + a.fireCount, 0);

  const triggerIcon = (type: TriggerType) => {
    const opt = TRIGGER_OPTIONS.find(t => t.type === type);
    return opt?.icon ?? '•';
  };

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Rules',    value: String(enabledCount),          color: 'text-emerald-400' },
          { label: 'Total Rules',     value: String(automations.length),     color: 'text-slate-200' },
          { label: 'Total Fired',     value: String(totalFires),             color: 'text-indigo-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">{stat.label}</div>
            <div className={`text-[22px] font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-slate-200">IF / THEN Automations</div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-xl transition-all ${
            showForm
              ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-transparent'
          }`}
        >
          {showForm ? '× Cancel' : '+ New Rule'}
        </button>
      </div>

      {/* New automation form */}
      {showForm && (
        <AutomationForm onSave={addAutomation} onCancel={() => setShowForm(false)}/>
      )}

      {/* Automation list */}
      {automations.length === 0 && !showForm ? (
        <div className="bg-slate-900/40 border border-slate-800/40 border-dashed rounded-2xl p-10 text-center">
          <div className="text-slate-700 text-[13px] mb-2">No automations yet</div>
          <div className="text-slate-600 text-[11px]">Click "New Rule" to create your first IF/THEN automation.</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {automations.map(auto => (
            <div
              key={auto.id}
              className={`bg-slate-900/50 border rounded-xl px-4 py-4 transition-all ${
                auto.enabled ? 'border-slate-700/50' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button
                  onClick={() => toggle(auto.id)}
                  className={`flex-shrink-0 mt-0.5 w-8 h-5 rounded-full transition-all relative ${
                    auto.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${auto.enabled ? 'left-3.5' : 'left-0.5'}`}/>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13px] font-semibold text-slate-100">{auto.name}</span>
                    {auto.lastFiredAt && (
                      <span className="text-[10px] text-slate-600">
                        last fired {new Date(auto.lastFiredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {auto.fireCount > 0 && (
                      <span className="text-[10px] font-medium bg-slate-800/60 border border-slate-700/40 text-slate-400 px-1.5 py-0.5 rounded-full">
                        {auto.fireCount}× fired
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5 text-[11px] bg-slate-800/50 border border-slate-700/40 rounded-lg px-2.5 py-1">
                      <span className="text-indigo-400 font-bold text-[10px] mr-0.5">IF</span>
                      <span className="text-[13px]">{triggerIcon(auto.trigger.type)}</span>
                      <TriggerLabel trigger={auto.trigger}/>
                    </span>
                    <span className="text-slate-700 text-[12px]">→</span>
                    <span className="flex items-center gap-1.5 text-[11px] bg-slate-800/50 border border-slate-700/40 rounded-lg px-2.5 py-1">
                      <span className="text-emerald-400 font-bold text-[10px] mr-0.5">THEN</span>
                      <span className="text-[13px]">{ACTION_OPTIONS.find(a => a.type === auto.action.type)?.icon}</span>
                      <ActionLabel action={auto.action}/>
                    </span>
                  </div>
                </div>

                {/* Test webhook button */}
                {auto.action.type === 'webhook' && auto.action.webhookUrl && (
                  <button
                    onClick={() => testWebhook(auto)}
                    disabled={webhookStatus[auto.id] === 'sending'}
                    title="Test this webhook"
                    className={`flex-shrink-0 px-2 py-1 text-[10px] font-semibold rounded-lg border transition-colors mt-0.5 ${
                      webhookStatus[auto.id] === 'ok'  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/8' :
                      webhookStatus[auto.id] === 'err' ? 'text-red-400 border-red-500/30 bg-red-500/8' :
                      'text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/10'
                    }`}
                  >
                    {webhookStatus[auto.id] === 'sending' ? '…' : webhookStatus[auto.id] === 'ok' ? '✓ sent' : webhookStatus[auto.id] === 'err' ? '✗ fail' : 'Test'}
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => deleteAuto(auto.id)}
                  className="flex-shrink-0 p-1.5 text-slate-700 hover:text-red-400 rounded-lg transition-colors mt-0.5"
                  title="Delete automation"
                >
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
                    <path d="M1.5 3h9M4 3V2h4v1M5 5.5v3M7 5.5v3M2 3l.8 7.2A1 1 0 003.8 11h4.4a1 1 0 001-.8L10 3"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="bg-indigo-500/[0.04] border border-indigo-500/10 rounded-xl px-4 py-3">
        <div className="text-[11px] text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Automations</strong> are evaluated when you run a report or refresh KPIs. Webhooks and report generation require your data to be loaded. Toggle any rule off to pause it without deleting.
        </div>
      </div>
    </div>
  );
}
