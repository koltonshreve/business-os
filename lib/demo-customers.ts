import type { CustomerRecord, CustomerIndustry, CustomerRevenueType } from '../types';

// ── Raw customer seed data ─────────────────────────────────────────────────────
// Format: [id, name, rawRevenue, industry, revenueType, notes?]
// rawRevenue values are scaled so the total equals TARGET_REVENUE after normalisation.
// percentOfTotal is computed at the bottom.

const TARGET_REVENUE = 1_228_000;

type Seed = [string, string, number, CustomerIndustry, CustomerRevenueType, string?];

const RAW: Seed[] = [
  // ── HEALTHCARE (18 accounts) ────────────────────────────────────────────────
  ['hc01', 'Meridian Healthcare Group',   128000, 'healthcare', 'recurring', 'Flagship account — multi-site managed services'],
  ['hc02', 'Vector Health Partners',        36000, 'healthcare', 'recurring'],
  ['hc03', 'Lakewood Health Systems',       22000, 'healthcare', 'recurring'],
  ['hc04', 'Mountain View Medical',         16000, 'healthcare', 'recurring'],
  ['hc05', 'Brightside Clinics LLC',        12000, 'healthcare', 'recurring'],
  ['hc06', 'ClearPath Diagnostics',          9000, 'healthcare', 'recurring'],
  ['hc07', 'Summit Behavioral Health',       7000, 'healthcare', 'mixed'],
  ['hc08', 'Redwood Care Group',             5500, 'healthcare', 'recurring'],
  ['hc09', 'Blue Ridge Medical',             5000, 'healthcare', 'recurring'],
  ['hc10', 'Valor Health Partners',          4400, 'healthcare', 'recurring'],
  ['hc11', 'Prestige Health Consulting',     3800, 'healthcare', 'project'],
  ['hc12', 'Cornerstone Medical',            3400, 'healthcare', 'recurring'],
  ['hc13', 'Horizon Home Health',            3000, 'healthcare', 'recurring'],
  ['hc14', 'Pacific Health Network',         2700, 'healthcare', 'recurring'],
  ['hc15', 'Northside Family Practice',      2400, 'healthcare', 'recurring'],
  ['hc16', 'Clearfield Orthopedics',         2100, 'healthcare', 'project'],
  ['hc17', 'Valley Wellness Centers',        1800, 'healthcare', 'mixed'],
  ['hc18', 'Summit Urgent Care',             1500, 'healthcare', 'recurring'],

  // ── PROFESSIONAL SERVICES (24 accounts) ────────────────────────────────────
  ['ps01', 'Apex Advisory Group',           88000, 'professional-services', 'recurring', 'Core retainer — strategy & ops advisory'],
  ['ps02', 'Coastal Pro Services',           26000, 'professional-services', 'recurring'],
  ['ps03', 'Pinnacle Consulting Group',      20000, 'professional-services', 'mixed'],
  ['ps04', 'Highbridge Strategy',            14000, 'professional-services', 'recurring'],
  ['ps05', 'Atlas Consulting Partners',      10000, 'professional-services', 'mixed'],
  ['ps06', 'Bridgewater Advisory',            8000, 'professional-services', 'recurring'],
  ['ps07', 'Granite Advisory LLC',            6000, 'professional-services', 'recurring'],
  ['ps08', 'Crestline Partners',              5500, 'professional-services', 'recurring'],
  ['ps09', 'BluePeak Consulting',             4800, 'professional-services', 'project'],
  ['ps10', 'Redwood Advisors',                4200, 'professional-services', 'recurring'],
  ['ps11', 'Northpoint Strategy',             3800, 'professional-services', 'project'],
  ['ps12', 'Cascade Consulting',              3400, 'professional-services', 'recurring'],
  ['ps13', 'Valley Advisory LLC',             3100, 'professional-services', 'recurring'],
  ['ps14', 'Pinnacle HR Solutions',           2800, 'professional-services', 'project'],
  ['ps15', 'Clear Vision Partners',           2500, 'professional-services', 'recurring'],
  ['ps16', 'Summit Tax Advisory',             2200, 'professional-services', 'recurring'],
  ['ps17', 'Bridgeview Consulting',           2000, 'professional-services', 'project'],
  ['ps18', 'Rockwood Strategy',               1800, 'professional-services', 'recurring'],
  ['ps19', 'Westland Advisors',               1600, 'professional-services', 'recurring'],
  ['ps20', 'Blue Horizon Consulting',         1400, 'professional-services', 'mixed'],
  ['ps21', 'Ironwood Advisory',               1200, 'professional-services', 'recurring'],
  ['ps22', 'Ridgeline Partners',              1100, 'professional-services', 'project'],
  ['ps23', 'Summit Growth Advisors',           900, 'professional-services', 'recurring'],
  ['ps24', 'Clearwater Consulting',            800, 'professional-services', 'recurring'],

  // ── SaaS / TECHNOLOGY (18 accounts) ────────────────────────────────────────
  ['st01', 'BlueSky Technologies',           80000, 'saas-technology', 'recurring', 'Multi-year enterprise license + integration services'],
  ['st02', 'Clearwater Systems',             30000, 'saas-technology', 'recurring'],
  ['st03', 'Nexus Software Inc',             18000, 'saas-technology', 'recurring'],
  ['st04', 'TechStart Solutions',            14000, 'saas-technology', 'recurring'],
  ['st05', 'Optima Cloud',                   11000, 'saas-technology', 'recurring'],
  ['st06', 'DataEdge Analytics',              8500, 'saas-technology', 'recurring'],
  ['st07', 'Quantum Analytics',               7000, 'saas-technology', 'recurring'],
  ['st08', 'Cloudnine Software',              6000, 'saas-technology', 'recurring'],
  ['st09', 'StreamLine Tech',                 5200, 'saas-technology', 'recurring'],
  ['st10', 'Apex Digital',                    4500, 'saas-technology', 'recurring'],
  ['st11', 'Velocity Systems',                3900, 'saas-technology', 'recurring'],
  ['st12', 'Nexgen Platforms',                3400, 'saas-technology', 'recurring'],
  ['st13', 'PeakVue Analytics',               2900, 'saas-technology', 'recurring'],
  ['st14', 'Prism Technologies',              2500, 'saas-technology', 'recurring'],
  ['st15', 'Orbital SaaS',                    2100, 'saas-technology', 'recurring'],
  ['st16', 'Vertex Digital',                  1800, 'saas-technology', 'recurring'],
  ['st17', 'Horizon Tech Solutions',          1500, 'saas-technology', 'recurring'],
  ['st18', 'Cascade Software',               1200, 'saas-technology', 'recurring'],

  // ── MANUFACTURING (15 accounts) ─────────────────────────────────────────────
  ['mf01', 'Granite Peak Manufacturing',    106000, 'manufacturing', 'mixed', 'Annual contract — process advisory + quarterly project work'],
  ['mf02', 'Ironwood Industrial',            30000, 'manufacturing', 'mixed'],
  ['mf03', 'Northgate Manufacturing',        16000, 'manufacturing', 'recurring'],
  ['mf04', 'Steel Valley Corp',              11000, 'manufacturing', 'mixed'],
  ['mf05', 'Precision Parts Inc',             8500, 'manufacturing', 'project'],
  ['mf06', 'Midwest Fabrication',             7000, 'manufacturing', 'mixed'],
  ['mf07', 'Lakeland Manufacturing',          5800, 'manufacturing', 'mixed'],
  ['mf08', 'Cornerstone Industries',          4900, 'manufacturing', 'mixed'],
  ['mf09', 'Summit Metalworks',               4200, 'manufacturing', 'project'],
  ['mf10', 'Ridgeline Products',              3600, 'manufacturing', 'mixed'],
  ['mf11', 'Valley Machining',                3000, 'manufacturing', 'project'],
  ['mf12', 'Westbrook Industrial',            2500, 'manufacturing', 'mixed'],
  ['mf13', 'Irongate Casting',                2100, 'manufacturing', 'project'],
  ['mf14', 'Clearfield Mfg',                  1700, 'manufacturing', 'mixed'],
  ['mf15', 'Prism Packaging',                 1400, 'manufacturing', 'project'],

  // ── CONSTRUCTION (13 accounts) ───────────────────────────────────────────────
  ['cn01', 'Summit Construction Inc',        75000, 'construction', 'project', 'GC — active 3-year program management engagement'],
  ['cn02', 'Ridgeline Construction',         18000, 'construction', 'project'],
  ['cn03', 'Ironwood Builders',              14000, 'construction', 'project'],
  ['cn04', 'Valley Contractors',             10500, 'construction', 'project'],
  ['cn05', 'Paramount Building Group',        8500, 'construction', 'project'],
  ['cn06', 'Apex Structures',                 7000, 'construction', 'project'],
  ['cn07', 'Northpoint Construction',         5500, 'construction', 'project'],
  ['cn08', 'Clearview Builds',                4500, 'construction', 'project'],
  ['cn09', 'Summit Roofing Co',               3800, 'construction', 'project'],
  ['cn10', 'Granite Builders LLC',            3100, 'construction', 'project'],
  ['cn11', 'Ridgeway Contractors',            2500, 'construction', 'project'],
  ['cn12', 'Cornerstone Build Group',         2000, 'construction', 'project'],
  ['cn13', 'Westfield Development',           1600, 'construction', 'project'],

  // ── DISTRIBUTION / LOGISTICS (12 accounts) ───────────────────────────────────
  ['dl01', 'Pacific Logistics Corp',         44000, 'distribution', 'mixed', 'West coast 3PL — managed transportation program'],
  ['dl02', 'Harbor Distribution',            24000, 'distribution', 'mixed'],
  ['dl03', 'Crossroads Logistics',           18000, 'distribution', 'recurring'],
  ['dl04', 'Summit Supply Chain',            12000, 'distribution', 'mixed'],
  ['dl05', 'Atlantic Freight Partners',       9500, 'distribution', 'recurring'],
  ['dl06', 'Mountain Pass Logistics',         7500, 'distribution', 'mixed'],
  ['dl07', 'Valley Distributors',             6000, 'distribution', 'mixed'],
  ['dl08', 'Ridgeline Supply',                4800, 'distribution', 'recurring'],
  ['dl09', 'Clearfield Distribution',         3800, 'distribution', 'mixed'],
  ['dl10', 'Northpoint Logistics',            3000, 'distribution', 'recurring'],
  ['dl11', 'Westbrook Distribution',          2300, 'distribution', 'mixed'],
  ['dl12', 'Ironwood Freight',                1800, 'distribution', 'mixed'],

  // ── FINANCIAL SERVICES (10 accounts) ─────────────────────────────────────────
  ['fs01', 'Westbrook Capital Partners',     52000, 'financial-services', 'recurring', 'RIA — ongoing financial advisory retainer'],
  ['fs02', 'Sterling Capital Group',         27000, 'financial-services', 'recurring'],
  ['fs03', 'Meridian Wealth Mgmt',           17000, 'financial-services', 'recurring'],
  ['fs04', 'Summit Investment Partners',     12000, 'financial-services', 'recurring'],
  ['fs05', 'BluePeak Financial',              8500, 'financial-services', 'recurring'],
  ['fs06', 'Crestview Wealth',                6500, 'financial-services', 'recurring'],
  ['fs07', 'Lakewood Capital',                5000, 'financial-services', 'recurring'],
  ['fs08', 'Ridgeline Finance',               3800, 'financial-services', 'recurring'],
  ['fs09', 'Valley Investment Group',         2800, 'financial-services', 'recurring'],
  ['fs10', 'Summit Trust Co',                 2000, 'financial-services', 'recurring'],

  // ── RETAIL (10 accounts) ─────────────────────────────────────────────────────
  ['rt01', 'Pinnacle Retail Group',          33000, 'retail', 'mixed', 'Multi-location specialty retail — e-comm + brick-and-mortar'],
  ['rt02', 'Summit Retail Partners',         18000, 'retail', 'mixed'],
  ['rt03', 'Ridgeline Commerce',             13000, 'retail', 'mixed'],
  ['rt04', 'Clearwater Retail',              10000, 'retail', 'mixed'],
  ['rt05', 'Valley Stores Inc',               7500, 'retail', 'mixed'],
  ['rt06', 'Westbrook Retail',                5800, 'retail', 'mixed'],
  ['rt07', 'Atlantic Commerce',               4200, 'retail', 'mixed'],
  ['rt08', 'Lakewood Retail',                 3000, 'retail', 'mixed'],
  ['rt09', 'Northside Shops',                 2200, 'retail', 'mixed'],
  ['rt10', 'Harbor Commerce',                 1600, 'retail', 'mixed'],
];

// ── Normalise to TARGET_REVENUE ──────────────────────────────────────────────
const rawTotal = RAW.reduce((s, r) => s + r[2], 0);
const scale = TARGET_REVENUE / rawTotal;

export const DEMO_CUSTOMERS: CustomerRecord[] = RAW.map(([id, name, rawRev, industry, revenueType, notes]) => {
  const revenue = Math.round(rawRev * scale);
  return {
    id,
    name,
    revenue,
    percentOfTotal: parseFloat(((revenue / TARGET_REVENUE) * 100).toFixed(1)),
    industry,
    revenueType,
    ...(notes ? { notes } : {}),
  };
});

// ── Industry metadata ────────────────────────────────────────────────────────
export interface IndustryMeta {
  label: string;
  accent: string;
  icon: string;
  kpiLabel: string;       // primary KPI label shown in filter panel
  recurringNote: string;  // context shown for recurring revenue customers
  projectNote: string;    // context shown for project-based customers
}

export const INDUSTRY_META: Record<CustomerIndustry, IndustryMeta> = {
  'healthcare': {
    label: 'Healthcare',
    accent: 'text-rose-400',
    icon: '🏥',
    kpiLabel: 'Compliance contracts',
    recurringNote: 'HIPAA-compliant managed services with annual contract renewals',
    projectNote: 'Episodic consulting engagements — implementation, audits, or assessments',
  },
  'professional-services': {
    label: 'Professional Services',
    accent: 'text-indigo-400',
    icon: '📋',
    kpiLabel: 'Retainer vs project mix',
    recurringNote: 'Ongoing advisory retainer — predictable monthly revenue',
    projectNote: 'Scoped project engagement — fixed fee or T&M',
  },
  'saas-technology': {
    label: 'SaaS / Technology',
    accent: 'text-sky-400',
    icon: '💻',
    kpiLabel: 'Avg MRR per account',
    recurringNote: 'Subscription or license — high-predictability revenue stream',
    projectNote: 'Implementation, integration, or custom development work',
  },
  'manufacturing': {
    label: 'Manufacturing',
    accent: 'text-amber-400',
    icon: '⚙️',
    kpiLabel: 'Supply contract %',
    recurringNote: 'Standing supply agreement or managed services contract',
    projectNote: 'Capital project, retrofit, or one-time process improvement',
  },
  'construction': {
    label: 'Construction',
    accent: 'text-orange-400',
    icon: '🏗️',
    kpiLabel: 'Active projects',
    recurringNote: 'Program management or ongoing owner-rep engagement',
    projectNote: 'Defined-scope project — milestone-based billing',
  },
  'distribution': {
    label: 'Distribution',
    accent: 'text-teal-400',
    icon: '🚚',
    kpiLabel: 'Managed logistics %',
    recurringNote: 'Managed transportation or 3PL program',
    projectNote: 'Freight / warehousing assessment or one-time logistics project',
  },
  'financial-services': {
    label: 'Financial Services',
    accent: 'text-emerald-400',
    icon: '💼',
    kpiLabel: 'Assets under advisory',
    recurringNote: 'Advisory retainer — ongoing financial or investment advisory',
    projectNote: 'Transaction advisory, M&A support, or one-time analysis',
  },
  'retail': {
    label: 'Retail',
    accent: 'text-violet-400',
    icon: '🛍️',
    kpiLabel: 'E-comm vs brick-and-mortar',
    recurringNote: 'Ongoing managed services (loyalty, analytics, merchandising)',
    projectNote: 'Store expansion, rebranding, or one-time retail strategy project',
  },
};

export const ALL_INDUSTRIES = Object.keys(INDUSTRY_META) as CustomerIndustry[];
