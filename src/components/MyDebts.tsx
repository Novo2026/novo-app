import { useState } from 'react';
import { Plus, ArrowLeft, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import AddDebtModal from './AddDebtModal';
import AddChargeModal from './AddChargeModal';
import DebtDetailView from './DebtDetailView';
import EditDebtModal from './EditDebtModal';
import type { Debt } from '../types';

interface MyDebtsProps {
  onDataUpdate: () => void;
}

export default function MyDebts({ onDataUpdate }: MyDebtsProps) {
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [showEditDebt, setShowEditDebt] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);

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

  const handleEditClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDebt(debt);
    setShowEditDebt(true);
  };

  const handleDeleteClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingDebt(debt);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deletingDebt) {
      StorageService.deleteDebt(deletingDebt.id);
      setShowDeleteConfirm(false);
      setDeletingDebt(null);
      onDataUpdate();
    }
  };

  const handleDebtEdited = () => {
    setShowEditDebt(false);
    setEditingDebt(null);
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
                debt.isPaidOff && debt.transferredToHELOC ? 'border-[#F2994A]' :
                debt.isPaidOff ? 'border-[#27AE60]' : 'border-gray-200'
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-gray-800 mb-1">{debt.accountName}</h3>
                    <p className="text-sm text-gray-500">{debt.category}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {debt.isPaidOff ? (
                      <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${
                        debt.transferredToHELOC ? 'bg-[#F2994A]' : 'bg-[#27AE60]'
                      }`}>
                        {debt.transferredToHELOC ? 'TRANSFERRED' : 'PAID OFF'}
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">
                        {debt.interestRate}% APR
                      </span>
                    )}
                    <button
                      onClick={(e) => handleEditClick(debt, e)}
                      className="p-1.5 text-gray-500 hover:text-[#2D9CDB] hover:bg-blue-50 rounded transition-colors"
                      title="Edit debt"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(debt, e)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete debt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                  <p className={`text-3xl font-bold ${
                    debt.isPaidOff && debt.transferredToHELOC ? 'text-[#F2994A]' :
                    debt.isPaidOff ? 'text-[#27AE60]' : 'text-[#1E3A5F]'
                  }`}>
                    {CalculationService.formatCurrency(debt.currentBalance)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Started at {CalculationService.formatCurrency(debt.startingBalance)}
                  </p>
                  {debt.transferredToHELOC && (
                    <p className="text-xs text-[#F2994A] font-semibold mt-2">
                      Transferred to HELOC
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Amount Paid Off: {CalculationService.formatCurrency(paidOff)}</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        debt.isPaidOff && debt.transferredToHELOC ? 'bg-[#F2994A]' :
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

      {showEditDebt && editingDebt && (
        <EditDebtModal
          debt={editingDebt}
          onClose={() => {
            setShowEditDebt(false);
            setEditingDebt(null);
          }}
          onSuccess={handleDebtEdited}
        />
      )}

      {showDeleteConfirm && deletingDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Debt</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingDebt.accountName}</strong>? This will also delete all associated payment history. This cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingDebt(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
