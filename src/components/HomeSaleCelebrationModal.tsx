import { useState } from 'react';
import { Home, X, ChevronRight } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface HomeSaleCelebrationModalProps {
  mortgageName: string;
  saleDate: string;
  netProceeds: number | null;
  onAddNewMortgage: () => void;
  onClose: () => void;
}

export default function HomeSaleCelebrationModal({
  mortgageName,
  saleDate,
  netProceeds,
  onAddNewMortgage,
  onClose,
}: HomeSaleCelebrationModalProps) {
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 200);
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-transform duration-200 ${closing ? 'scale-95' : 'scale-100'}`}>
        <div className="bg-gradient-to-br from-amber-400 to-amber-500 p-8 text-center relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-amber-100 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4">
            <Home className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Home Sale Recorded!</h2>
          <p className="text-amber-100 text-sm">
            Your mortgage is paid off from your home sale on{' '}
            <span className="font-semibold text-white">{CalculationService.formatDate(saleDate)}</span>.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Mortgage Paid Off</span>
              <span className="font-semibold text-gray-800">{mortgageName}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Sale Date</span>
              <span className="font-semibold text-gray-800">{CalculationService.formatDate(saleDate)}</span>
            </div>
            {netProceeds !== null && netProceeds > 0 && (
              <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-600">Net Proceeds from Sale</span>
                <span className="font-bold text-emerald-600 text-base">
                  {CalculationService.formatCurrency(netProceeds)}
                </span>
              </div>
            )}
          </div>

          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-900 mb-3">Are you buying a new home?</p>
            <div className="space-y-2">
              <button
                onClick={onAddNewMortgage}
                className="w-full flex items-center justify-between bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                <span>Yes, Add New Mortgage</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                No, Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
