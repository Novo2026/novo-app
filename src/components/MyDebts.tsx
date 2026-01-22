import { useState } from 'react';
import { Plus, ArrowLeft, DollarSign } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import AddDebtModal from './AddDebtModal';
import AddChargeModal from './AddChargeModal';
import DebtDetailView from './DebtDetailView';
import type { Debt } from '../types';

interface MyDebtsProps {
  onDataUpdate: () => void;
}

export default function MyDebts({ onDataUpdate }: MyDebtsProps) {
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);

  const debts = StorageService.getDebts().filter(d => d.category !== 'HELOC');

  const handleAddCharge = (debtId: string) => {
    setSelectedDebtId(debtId);
    setShowAddCharge(true);
  };

  const handleViewDetail = (debt: Debt) => {
    setSelectedDebt(debt);
  };

  const handleBackToList = () => {
    setSelectedDebt(null);
  };

  const handleDebtAdded = () => {
    setShowAddDebt(false);
    onDataUpdate();
  };

  const handleChargeAdded = () => {
    setShowAddCharge(false);
    setSelectedDebtId(null);
    onDataUpdate();
  };

  if (selectedDebt) {
    return (
      <DebtDetailView
        debt={selectedDebt}
        onBack={handleBackToList}
        onDataUpdate={onDataUpdate}
      />
    );
  }

  if (debts.length === 0) {
    return (
      <>
        <div className="text-center py-16">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Debts Added Yet</h2>
          <p className="text-gray-600 mb-6">
            Add your first debt to start tracking your payoff progress.
          </p>
          <button
            onClick={() => setShowAddDebt(true)}
            className="inline-flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Your First Debt</span>
          </button>
        </div>

        {showAddDebt && (
          <AddDebtModal
            onClose={() => setShowAddDebt(false)}
            onSuccess={handleDebtAdded}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">My Debts</h2>
        <button
          onClick={() => setShowAddDebt(true)}
          className="inline-flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Debt</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {debts.map(debt => {
          const paidOff = debt.startingBalance - debt.currentBalance;
          const progress = (paidOff / debt.startingBalance) * 100;

          return (
            <div
              key={debt.id}
              className={`bg-white rounded-lg shadow-md border-2 transition-all hover:shadow-lg ${
                debt.isPaidOff ? 'border-[#27AE60]' : 'border-gray-200'
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-gray-800 mb-1">{debt.accountName}</h3>
                    <p className="text-sm text-gray-500">{debt.category}</p>
                  </div>
                  {debt.isPaidOff ? (
                    <span className="bg-[#27AE60] text-white text-xs font-bold px-3 py-1 rounded-full">
                      PAID OFF
                    </span>
                  ) : (
                    <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">
                      {debt.interestRate}% APR
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                  <p className={`text-3xl font-bold ${debt.isPaidOff ? 'text-[#27AE60]' : 'text-[#1E3A5F]'}`}>
                    {CalculationService.formatCurrency(debt.currentBalance)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Started at {CalculationService.formatCurrency(debt.startingBalance)}
                  </p>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Amount Paid Off: {CalculationService.formatCurrency(paidOff)}</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        debt.isPaidOff ? 'bg-[#27AE60]' : 'bg-[#2D9CDB]'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {!debt.isPaidOff && (
                  <div className="text-sm text-gray-600 mb-4">
                    <p>Minimum Payment: {CalculationService.formatCurrency(debt.minimumPayment)}</p>
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewDetail(debt)}
                    className="flex-1 bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white text-sm font-semibold py-2 px-4 rounded transition-colors"
                  >
                    View Details
                  </button>
                  {!debt.isPaidOff && (
                    <button
                      onClick={() => handleAddCharge(debt.id)}
                      className="bg-[#F2C94C] hover:bg-[#E0B73C] text-gray-800 text-sm font-semibold py-2 px-4 rounded transition-colors"
                    >
                      Add Charge
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAddDebt && (
        <AddDebtModal
          onClose={() => setShowAddDebt(false)}
          onSuccess={handleDebtAdded}
        />
      )}

      {showAddCharge && selectedDebtId && (
        <AddChargeModal
          debtId={selectedDebtId}
          onClose={() => {
            setShowAddCharge(false);
            setSelectedDebtId(null);
          }}
          onSuccess={handleChargeAdded}
        />
      )}
    </div>
  );
}
