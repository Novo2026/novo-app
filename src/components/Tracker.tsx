import { useState } from 'react';
import { HELOCTracker } from './HELOCTracker';
import { CheckingTracker } from './CheckingTracker';
import { StorageService } from '../services/storage';

type TrackerView = 'checking' | 'heloc';

interface TrackerProps {
  onDataUpdate?: () => void;
}

export function Tracker({ onDataUpdate }: TrackerProps) {
  const featurePreferences = StorageService.getFeaturePreferences();
  const { helocEnabled, checkingEnabled } = featurePreferences;

  const getInitialView = (): TrackerView => {
    if (checkingEnabled && !helocEnabled) return 'checking';
    if (helocEnabled && !checkingEnabled) return 'heloc';
    return 'checking';
  };

  const [currentView, setCurrentView] = useState<TrackerView>(getInitialView());

  const showViewTabs = helocEnabled && checkingEnabled;

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <div className="bg-brand-navy py-3 px-5">
        <h1 className="text-white text-lg font-medium leading-tight">Trackers</h1>
        <p className="text-white/65 text-xs mt-0.5">Your cash flow command center</p>
      </div>

      {showViewTabs && (
        <div className="bg-white border-b border-brand-gray-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
            <button
              type="button"
              onClick={() => setCurrentView('checking')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                currentView === 'checking'
                  ? 'border-brand-orange text-brand-navy'
                  : 'border-transparent text-brand-gray hover:text-brand-navy'
              }`}
            >
              Checking / Cash Flow
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('heloc')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                currentView === 'heloc'
                  ? 'border-brand-orange text-brand-navy'
                  : 'border-transparent text-brand-gray hover:text-brand-navy'
              }`}
            >
              HELOC Account
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === 'checking' && checkingEnabled && (
          <CheckingTracker onDataUpdate={onDataUpdate} />
        )}
        {currentView === 'heloc' && helocEnabled && (
          <HELOCTracker onDataUpdate={onDataUpdate} />
        )}

        {!checkingEnabled && !helocEnabled && (
          <div className="bg-white border border-brand-gray-border rounded-lg p-8 text-center">
            <h3 className="text-xl font-bold text-brand-navy mb-4">No Trackers Enabled</h3>
            <p className="text-brand-gray mb-6">
              Enable the Checking Tracker or HELOC Tracker in Settings to start tracking your accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
