import { useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface ChunkingReadinessQuizProps {
  onComplete: (passed: boolean) => void;
  onClose: () => void;
}

interface QuizAnswer {
  question: string;
  answer: boolean | null;
  correctAnswer: boolean;
  explanation: string;
}

function ChunkingReadinessQuiz({ onComplete, onClose }: ChunkingReadinessQuizProps) {
  const [answers, setAnswers] = useState<QuizAnswer[]>([
    {
      question: 'Do you have at least $1,000 in emergency savings?',
      answer: null,
      correctAnswer: true,
      explanation: 'Emergency savings protect you from using HELOC for unexpected expenses'
    },
    {
      question: 'Has your income been stable for the last 3 months?',
      answer: null,
      correctAnswer: true,
      explanation: 'Stable income ensures you can consistently pay down the HELOC'
    },
    {
      question: 'Have you missed any debt payments in the last 6 months?',
      answer: null,
      correctAnswer: false,
      explanation: 'Payment consistency is critical before taking on velocity banking'
    },
    {
      question: 'Are you willing to track your HELOC balance daily/weekly?',
      answer: null,
      correctAnswer: true,
      explanation: 'Daily interest means frequent tracking is essential for success'
    },
    {
      question: 'Do you understand that chunking requires discipline to avoid new debt?',
      answer: null,
      correctAnswer: true,
      explanation: 'HELOC chunking only works if you don\'t accumulate new debt'
    }
  ]);

  const [showResults, setShowResults] = useState(false);

  const handleAnswer = (index: number, answer: boolean) => {
    const newAnswers = [...answers];
    newAnswers[index].answer = answer;
    setAnswers(newAnswers);
  };

  const allQuestionsAnswered = answers.every(a => a.answer !== null);

  const handleSubmit = () => {
    setShowResults(true);
  };

  const passed = answers.every(a => a.answer === a.correctAnswer);

  const handleProceed = () => {
    onComplete(passed);
  };

  if (showResults) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Readiness Assessment Results</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {passed ? (
              <div className="mb-6">
                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r mb-4">
                  <div className="flex items-start">
                    <CheckCircle className="w-6 h-6 text-green-500 mt-1 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900 text-lg mb-2">
                        You're Ready for HELOC Velocity Banking!
                      </h3>
                      <p className="text-green-800">
                        Based on your responses, you have the financial foundation and discipline needed to successfully implement HELOC chunking. You can now proceed to view chunking recommendations.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r mb-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Remember:</h4>
                  <ul className="space-y-1 text-blue-800 text-sm">
                    <li>• Track your HELOC balance regularly (daily or weekly)</li>
                    <li>• Only chunk debts with rates higher than your HELOC</li>
                    <li>• Pay down HELOC aggressively with your cash flow</li>
                    <li>• Avoid using HELOC for new purchases or lifestyle expenses</li>
                    <li>• Maintain your emergency fund throughout the process</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleProceed}
                    className="flex-1 px-6 py-3 bg-[#FF6B35] hover:bg-[#E55A2B] text-white font-semibold rounded-lg transition-colors"
                  >
                    View Chunking Recommendations
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-6 h-6 text-amber-500 mt-1 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-amber-900 text-lg mb-2">
                        Chunking May Not Be Right for You Yet
                      </h3>
                      <p className="text-amber-800">
                        Based on your responses, we recommend building a stronger financial foundation before using HELOC velocity banking. Focus on the areas below first.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <h4 className="font-semibold text-gray-900">Areas to Address:</h4>
                  {answers.map((answer, index) => {
                    if (answer.answer !== answer.correctAnswer) {
                      return (
                        <div key={index} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                          <p className="font-medium text-red-900 mb-1">{answer.question}</p>
                          <p className="text-red-800 text-sm">{answer.explanation}</p>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r mb-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Recommended Next Steps:</h4>
                  <ul className="space-y-1 text-blue-800 text-sm">
                    <li>• Build an emergency fund of at least $1,000 (ideally 3-6 months expenses)</li>
                    <li>• Focus on making consistent, on-time payments for all debts</li>
                    <li>• Use the debt avalanche method without HELOC for now</li>
                    <li>• Ask NOVO AI Coach for personalized guidance on building financial stability</li>
                    <li>• Retake this assessment once you've strengthened your foundation</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Need help understanding your results? Click "Ask NOVO" in the top-right corner for personalized guidance.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Chunking Readiness Assessment</h2>
              <p className="text-gray-600">
                Answer these questions honestly to determine if HELOC velocity banking is right for you at this time.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r mb-6">
            <p className="text-blue-800 text-sm">
              <strong>Why this matters:</strong> HELOC velocity banking requires financial stability and discipline. This quick assessment helps ensure you're set up for success.
            </p>
          </div>

          <div className="space-y-6 mb-6">
            {answers.map((answer, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-900 mb-3">
                  {index + 1}. {answer.question}
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleAnswer(index, true)}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      answer.answer === true
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-[#FF6B35]'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleAnswer(index, false)}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      answer.answer === false
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-[#FF6B35]'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSubmit}
              disabled={!allQuestionsAnswered}
              className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-colors ${
                allQuestionsAnswered
                  ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Submit Assessment
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>

          {!allQuestionsAnswered && (
            <p className="text-sm text-gray-500 text-center mt-3">
              Please answer all questions to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChunkingReadinessQuiz;
