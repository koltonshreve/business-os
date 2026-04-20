import { useState } from 'react';
import type { CompanySize, UserRole, BusinessGoal, OnboardingData } from '../../types';

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
}

const COMPANY_SIZES: { value: CompanySize; label: string; sub: string }[] = [
  { value: '1-5',    label: '1–5',    sub: 'Solo / micro' },
  { value: '6-20',   label: '6–20',   sub: 'Small team' },
  { value: '21-50',  label: '21–50',  sub: 'Growing' },
  { value: '51-200', label: '51–200', sub: 'Mid-market' },
  { value: '200+',   label: '200+',   sub: 'Enterprise' },
];

const ROLES: { value: UserRole; label: string; icon: string }[] = [
  { value: 'founder-ceo',  label: 'Founder / CEO',    icon: '◈' },
  { value: 'cfo',          label: 'CFO',               icon: '◇' },
  { value: 'vp-finance',   label: 'VP Finance',        icon: '◆' },
  { value: 'operations',   label: 'Operations',        icon: '⚙' },
  { value: 'sales',        label: 'Sales / RevOps',    icon: '↑' },
  { value: 'other',        label: 'Other',             icon: '•' },
];

const GOALS: { value: BusinessGoal; label: string; icon: string; color: string }[] = [
  { value: 'grow-revenue',         label: 'Grow revenue faster',       icon: '↑',  color: 'emerald' },
  { value: 'improve-margins',      label: 'Improve profit margins',     icon: '◆',  color: 'indigo' },
  { value: 'reduce-churn',         label: 'Reduce customer churn',      icon: '↻',  color: 'violet' },
  { value: 'close-more-deals',     label: 'Close more deals',           icon: '⬡',  color: 'sky' },
  { value: 'manage-cash',          label: 'Manage cash runway',         icon: '⚡',  color: 'amber' },
  { value: 'hire-and-scale',       label: 'Hire and scale team',        icon: '+',  color: 'cyan' },
  { value: 'prep-for-fundraise',   label: 'Prep for fundraise/exit',    icon: '✦',  color: 'rose' },
  { value: 'understand-numbers',   label: 'Understand my numbers',      icon: '◉',  color: 'slate' },
];

const GOAL_COLOR_MAP: Record<string, string> = {
  emerald: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-300',
  indigo:  'border-indigo-500/40 bg-indigo-500/8 text-indigo-300',
  violet:  'border-violet-500/40 bg-violet-500/8 text-violet-300',
  sky:     'border-sky-500/40 bg-sky-500/8 text-sky-300',
  amber:   'border-amber-500/40 bg-amber-500/8 text-amber-300',
  cyan:    'border-cyan-500/40 bg-cyan-500/8 text-cyan-300',
  rose:    'border-rose-500/40 bg-rose-500/8 text-rose-300',
  slate:   'border-slate-600/60 bg-slate-700/20 text-slate-300',
};

// Suggested first questions keyed by primary goal
const FIRST_QUESTIONS: Record<string, string> = {
  'grow-revenue':       "What's driving our revenue growth and what's the single biggest lever to accelerate it?",
  'improve-margins':    "Where is margin being lost and what's the fastest path to improving EBITDA by 2 points?",
  'reduce-churn':       "Which customers are at highest churn risk right now and what should I do about it?",
  'close-more-deals':   "What does our pipeline look like and where are deals getting stuck?",
  'manage-cash':        "What's our current cash runway and what actions would extend it the most?",
  'hire-and-scale':     "At our current revenue per employee, what's the right headcount for our growth rate?",
  'prep-for-fundraise': "How do our margins and growth rate compare to LMM benchmarks for a fundraise?",
  'understand-numbers': "Give me a plain-English summary of where this business actually stands right now.",
};

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [companySize, setCompanySize] = useState<CompanySize | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [goals, setGoals] = useState<BusinessGoal[]>([]);

  // 3 steps: 0=Company+Role, 1=Goals, 2=Launch
  const totalSteps = 3;

  const toggleGoal = (g: BusinessGoal) => {
    setGoals(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const handleFinish = () => {
    const data: OnboardingData = {
      companyName: companyName.trim() || 'My Company',
      companySize: companySize ?? '6-20',
      industry: 'Professional Services',
      role: role ?? 'founder-ceo',
      goals: goals.length > 0 ? goals : ['understand-numbers'],
      completedAt: new Date().toISOString(),
    };
    try { localStorage.setItem('bos_onboarding', JSON.stringify(data)); } catch { /* ignore */ }
    onComplete(data);
  };

  const canProceed0 = companyName.trim().length > 0 && companySize !== null && role !== null;
  const canProceed1 = goals.length > 0;

  const steps = [
    { label: 'Setup',   canProceed: canProceed0 },
    { label: 'Goals',   canProceed: canProceed1 },
    { label: 'Launch',  canProceed: true },
  ];

  const suggestedQuestion = goals.length > 0
    ? FIRST_QUESTIONS[goals[0]] ?? FIRST_QUESTIONS['understand-numbers']
    : FIRST_QUESTIONS['understand-numbers'];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#060a12]">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg viewBox="0 0 12 12" fill="white" className="w-5 h-5">
              <rect x="1" y="1" width="4" height="4" rx="0.5"/>
              <rect x="7" y="1" width="4" height="4" rx="0.5"/>
              <rect x="1" y="7" width="4" height="4" rx="0.5"/>
              <rect x="7" y="7" width="4" height="4" rx="0.5"/>
            </svg>
          </div>
          <div>
            <div className="text-[17px] font-bold text-slate-100">Business OS</div>
            <div className="text-[11px] text-slate-500">AI-powered operating intelligence</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-7">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all duration-300 ${i < step ? 'bg-indigo-500' : i === step ? 'bg-indigo-500/60' : 'bg-slate-800'}`}/>
              <div className={`text-[10px] font-medium ${i <= step ? 'text-indigo-400' : 'text-slate-700'}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6">

          {/* Step 0: Company + Role (combined) */}
          {step === 0 && (
            <div>
              <div className="mb-5">
                <div className="text-[16px] font-bold text-slate-100 mb-1">Set up your workspace</div>
                <div className="text-[12px] text-slate-500">Takes 30 seconds. Personalizes your dashboard and AI benchmarks.</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-2">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    autoFocus
                    className="w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-xl px-4 py-3 text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                    onKeyDown={e => { if (e.key === 'Enter' && canProceed0) setStep(1); }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-2">Team Size</label>
                  <div className="grid grid-cols-5 gap-2">
                    {COMPANY_SIZES.map(sz => (
                      <button
                        key={sz.value}
                        onClick={() => setCompanySize(sz.value)}
                        className={`flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border text-center transition-all ${
                          companySize === sz.value
                            ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                            : 'border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-[13px] font-bold">{sz.label}</span>
                        <span className="text-[9px] text-slate-500">{sz.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-2">Your Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          role === r.value
                            ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                            : 'border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-[13px] font-bold flex-shrink-0 w-4">{r.icon}</span>
                        <span className="text-[11px] font-medium">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Goals */}
          {step === 1 && (
            <div>
              <div className="mb-5">
                <div className="text-[16px] font-bold text-slate-100 mb-1">What are your top priorities?</div>
                <div className="text-[12px] text-slate-500">Select up to 3. We'll surface the most relevant insights for you.</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => {
                  const selected = goals.includes(g.value);
                  const maxReached = goals.length >= 3 && !selected;
                  return (
                    <button
                      key={g.value}
                      onClick={() => !maxReached && toggleGoal(g.value)}
                      disabled={maxReached}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${
                        selected
                          ? GOAL_COLOR_MAP[g.color] + ' border-opacity-100'
                          : maxReached
                          ? 'border-slate-800/40 text-slate-600 cursor-not-allowed opacity-50'
                          : 'border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[14px] font-bold flex-shrink-0 w-5 text-center">{g.icon}</span>
                      <span className="text-[11px] font-medium leading-tight">{g.label}</span>
                    </button>
                  );
                })}
              </div>
              {goals.length > 0 && (
                <div className="mt-3 text-[11px] text-slate-500 text-center">{goals.length}/3 selected</div>
              )}
            </div>
          )}

          {/* Step 2: Launch */}
          {step === 2 && (
            <div>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3">
                  <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
                    <path d="M4 10l4 4 8-8" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-[16px] font-bold text-slate-100 mb-1">
                  {companyName.trim() || 'Your workspace'} is ready
                </div>
                <div className="text-[12px] text-slate-400">Two ways to get started:</div>
              </div>

              <div className="space-y-2.5">
                {/* Upload data */}
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-4 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg viewBox="0 0 14 14" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
                      <path d="M7 9V2M4 5l3-3 3 3M2 11v1a1 1 0 001 1h8a1 1 0 001-1v-1"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-200">Upload your data</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Drop a CSV from QuickBooks, Xero, or any export. AI analysis runs instantly.</div>
                  </div>
                </div>

                {/* First AI question */}
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-4 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400">
                      <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-200">Ask the AI CFO</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">Suggested first question based on your goals:</div>
                    <div className="text-[11px] text-indigo-300/80 italic mt-1.5 leading-snug">"{suggestedQuestion}"</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={onSkip}
            className="text-[12px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-colors"
              >
                Back
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!steps[step].canProceed}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-sm"
              >
                Get started →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
