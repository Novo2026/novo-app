import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { getBenTasks, saveBenTasks } from '../utils/milestoneEngine';
import type { BenTask } from '../utils/milestoneEngine';

export default function BenTaskPanel() {
  const [tasks, setTasks] = useState<BenTask[]>(getBenTasks());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const markComplete = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: true } : t);
    saveBenTasks(updated);
    setTasks(updated);
  };

  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const toShow = showCompleted ? tasks : pending;

  const milestoneLabel: Record<string, string> = {
    first_debt_paid: 'First Debt Paid Off',
    debt_10k: '$10K Paid Down',
    debt_25k: '$25K Paid Down',
    debt_50k: '$50K Paid Down',
    dti_under_43: 'DTI Under 43%',
    dti_under_36: 'DTI Under 36%',
    six_months_active: '6 Months Active',
    expenses_exceed_income: 'Expenses Exceed Income',
    home_ready: 'Home Ready',
    consistent_payments: 'Consistent Payments',
    surplus_increased: 'Surplus Increased',
    first_import: 'First Statement Import',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-navy" />
          <h3 className="font-bold text-gray-900">Your NOVO Outreach Tasks</h3>
          {pending.length > 0 && (
            <span className="bg-brand-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>
      </div>

      {toShow.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">
            {pending.length === 0 ? 'All caught up! No outreach needed right now.' : 'No tasks yet — milestones will appear here as clients make progress.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {toShow.map(task => (
            <div key={task.id} className={`p-4 ${task.completed ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => !task.completed && markComplete(task.id)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {task.completed
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-brand-orange transition-colors" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-brand-orange">{milestoneLabel[task.milestoneType] || task.milestoneType}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <button
                      onClick={() => setExpanded(expanded === task.id ? null : task.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expanded === task.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{task.summary}</p>

                  {expanded === task.id && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Client snapshot:</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{task.details}</p>
                      <a
                        href="https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-brand-orange hover:underline"
                      >
                        View booking calendar →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showCompleted ? 'Hide completed' : `Show ${completed.length} completed`}
          </button>
        </div>
      )}
    </div>
  );
}
