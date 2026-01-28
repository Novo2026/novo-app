import { useState } from 'react';
import { HELOCTracker } from './HELOCTracker';
import { CheckingTracker } from './CheckingTracker';
import { StorageService } from '../services/storage';

type TrackerView = 'checking' | 'heloc';

export function Tracker() {
  const featurePreferences = StorageService.getFeaturePreferences();
  const { helocEnabled, checkingEnabled } = featurePreferences;

  const getInitialView = (): TrackerView => {
    if (checkingEnabled && !helocEnabled) return 'checking';
    if (helocEnabled && !checkingEnabled) return 'heloc';
    return 'checking';
  };

  const [currentView, setCurrentView] = useState<TrackerView>(getInitialView());

  const showDropdown = helocEnabled && checkingEnabled;

  return (
    <div className="space-y-6">
      {showDropdown && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            What are you tracking?
          </label>
          <select
            value={currentView}
            onChange={(e) => setCurrentView(e.target.value as TrackerView)}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent font-semibold"
          >
            <option value="checking">Checking/Cash Flow Account</option>
            <option value="heloc">HELOC Account</option>
          </select>
        </div>
      )}

      {currentView === 'checking' && checkingEnabled && <CheckingTracker />}
      {currentView === 'heloc' && helocEnabled && <HELOCTracker />}

      {!checkingEnabled && !helocEnabled && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-4">No Trackers Enabled</h3>
          <p className="text-gray-600 mb-6">
            Enable the Checking Tracker or HELOC Tracker in Settings to start tracking your accounts.
          </p>
        </div>
      )}
    </div>
  );
}
