import { ReactNode } from 'react';

interface PageHeroProps {
  page: 'debts' | 'plan' | 'tracker' | 'savings' | 'smarter-payments' | 'progress' | 'home-ready' | 'what-if' | 'settings';
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

const PAGE_THEMES: Record<string, {
  gradient: string;
  motif: string;
}> = {
  debts: {
    gradient: 'linear-gradient(135deg, #152C47 0%, #1E3A5F 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" fill="none">
      <circle cx="20" cy="35" r="14" stroke="white" stroke-width="5" fill="none"/>
      <circle cx="50" cy="35" r="14" stroke="white" stroke-width="5" fill="none"/>
      <circle cx="80" cy="35" r="14" stroke="white" stroke-width="5" fill="none"/>
    </svg>`,
  },
  plan: {
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" fill="none">
      <polyline points="5,72 25,52 45,57 65,32 85,37 115,8" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="115" cy="8" r="6" fill="white"/>
      <circle cx="65" cy="32" r="4" fill="white" opacity="0.6"/>
      <circle cx="25" cy="52" r="4" fill="white" opacity="0.4"/>
    </svg>`,
  },
  tracker: {
    gradient: 'linear-gradient(135deg, #0F4C3A 0%, #1A6B52 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" fill="none">
      <path d="M0,45 Q30,20 60,45 Q90,70 120,45" stroke="white" stroke-width="3" fill="none"/>
      <path d="M0,55 Q30,30 60,55 Q90,80 120,55" stroke="white" stroke-width="2" fill="none" opacity="0.6"/>
      <path d="M0,35 Q30,10 60,35 Q90,60 120,35" stroke="white" stroke-width="2" fill="none" opacity="0.4"/>
    </svg>`,
  },
  savings: {
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #1A5276 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="45" r="25" fill="white"/>
      <ellipse cx="65" cy="42" rx="7" ry="5" fill="white"/>
      <rect x="28" y="15" width="24" height="8" rx="4" fill="white"/>
      <circle cx="52" cy="50" r="4" fill="#1A5276"/>
      <rect x="33" y="68" width="6" height="10" rx="3" fill="white"/>
      <rect x="45" y="68" width="6" height="10" rx="3" fill="white"/>
    </svg>`,
  },
  'smarter-payments': {
    gradient: 'linear-gradient(135deg, #7B3F00 0%, #B85C00 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
      <rect x="5" y="15" width="70" height="60" rx="6" fill="white"/>
      <rect x="5" y="15" width="70" height="18" rx="6" fill="white"/>
      <rect x="20" y="5" width="8" height="18" rx="4" fill="white"/>
      <rect x="52" y="5" width="8" height="18" rx="4" fill="white"/>
      <rect x="12" y="44" width="12" height="10" rx="2" fill="#B85C00" opacity="0.5"/>
      <rect x="34" y="44" width="12" height="10" rx="2" fill="#B85C00" opacity="0.7"/>
      <rect x="56" y="44" width="12" height="10" rx="2" fill="#B85C00" opacity="0.9"/>
    </svg>`,
  },
  progress: {
    gradient: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none">
      <rect x="10" y="60" width="14" height="20" rx="3" fill="white" opacity="0.4"/>
      <rect x="30" y="45" width="14" height="35" rx="3" fill="white" opacity="0.6"/>
      <rect x="50" y="28" width="14" height="52" rx="3" fill="white" opacity="0.8"/>
      <rect x="70" y="12" width="14" height="68" rx="3" fill="white"/>
    </svg>`,
  },
  'home-ready': {
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 80" fill="none">
      <polygon points="45,5 85,42 75,42 75,75 55,75 55,55 35,55 35,75 15,75 15,42 5,42" fill="white"/>
    </svg>`,
  },
  'what-if': {
    gradient: 'linear-gradient(135deg, #4A235A 0%, #6C3483 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="30" r="20" stroke="white" stroke-width="4" fill="none"/>
      <line x1="40" y1="50" x2="40" y2="58" stroke="white" stroke-width="4" stroke-linecap="round"/>
      <circle cx="40" cy="65" r="3" fill="white"/>
    </svg>`,
  },
  settings: {
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #2C3E50 100%)',
    motif: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="18" stroke="white" stroke-width="4" fill="none"/>
      <circle cx="40" cy="40" r="6" fill="white"/>
      <rect x="37" y="4" width="6" height="14" rx="3" fill="white"/>
      <rect x="37" y="62" width="6" height="14" rx="3" fill="white"/>
      <rect x="4" y="37" width="14" height="6" rx="3" fill="white"/>
      <rect x="62" y="37" width="14" height="6" rx="3" fill="white"/>
    </svg>`,
  },
};

export default function PageHero({ page, title, subtitle, children }: PageHeroProps) {
  const theme = PAGE_THEMES[page] || PAGE_THEMES.plan;

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-6"
      style={{ background: theme.gradient }}
    >
      <div
        className="absolute bottom-0 right-0 w-40 h-32 pointer-events-none"
        style={{ opacity: 0.08 }}
        dangerouslySetInnerHTML={{ __html: theme.motif }}
      />

      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,53,0.2) 0%, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      <div className="relative z-10 px-6 py-5 md:px-8 md:py-6">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-0.5">{title}</h2>
        {subtitle && <p className="text-white/60 text-sm">{subtitle}</p>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
