import { AlertTriangle, XCircle, Shield, Phone, Mail } from 'lucide-react';

interface ChunkingRiskAssessmentProps {
  className?: string;
}

function ChunkingRiskAssessment({ className = '' }: ChunkingRiskAssessmentProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-8 h-8 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-2xl font-bold">Chunking Risks - Be Honest With Yourself</h3>
            <p className="text-sm opacity-90 mt-1">This strategy is NOT for everyone</p>
          </div>
        </div>

        <div className="bg-white/10 rounded-lg p-5 mb-6">
          <h4 className="font-bold text-lg mb-4 flex items-center space-x-2">
            <XCircle className="w-5 h-5" />
            <span>Do NOT Chunk If:</span>
          </h4>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">❌</div>
              <div>
                <p className="font-semibold">You have less than $1,000 emergency fund</p>
                <p className="text-sm opacity-90">You need a safety net before using leverage</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">❌</div>
              <div>
                <p className="font-semibold">Your income is unstable or you might lose your job</p>
                <p className="text-sm opacity-90">Chunking requires reliable cash flow to work</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">❌</div>
              <div>
                <p className="font-semibold">You struggle with impulse spending or debt discipline</p>
                <p className="text-sm opacity-90">One spending binge can derail your entire strategy</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">❌</div>
              <div>
                <p className="font-semibold">You've missed payments in the last 6 months</p>
                <p className="text-sm opacity-90">Get current first, then consider advanced strategies</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">❌</div>
              <div>
                <p className="font-semibold">Your HELOC rate is higher than the debt you're chunking</p>
                <p className="text-sm opacity-90">You'd be moving debt from low to high interest</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-orange-500/30 rounded-lg p-5 mb-6 border-l-4 border-orange-400">
          <h4 className="font-bold text-lg mb-4">What Could Go Wrong:</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="text-xl">⚠️</div>
              <div>
                <p className="font-semibold">Income drops → Can't pay back HELOC → Balance grows</p>
                <p className="opacity-90">Job loss, pay cut, or reduced hours can break the cycle</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-xl">⚠️</div>
              <div>
                <p className="font-semibold">Emergency expense → Have to draw more from HELOC → Cycle breaks</p>
                <p className="opacity-90">Medical bills, car repairs, or home repairs can force additional draws</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-xl">⚠️</div>
              <div>
                <p className="font-semibold">Lifestyle inflation → Spend HELOC on non-essentials → Debt increases</p>
                <p className="opacity-90">Easy access to credit can tempt unnecessary purchases</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-500/20 rounded-lg p-5 mb-6 border-l-4 border-green-400">
          <h4 className="font-bold text-lg mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Safety Rules (Follow These or Don't Chunk):</span>
          </h4>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div>
                <p className="font-semibold">Never chunk more than 3x your monthly cash flow</p>
                <p className="text-sm opacity-90">If you have $2,000/month extra, don't chunk more than $6,000</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div>
                <p className="font-semibold">Always keep $5,000+ available on HELOC for emergencies</p>
                <p className="text-sm opacity-90">Don't max out your HELOC limit with chunks</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div>
                <p className="font-semibold">Track your HELOC balance weekly (minimum)</p>
                <p className="text-sm opacity-90">Set calendar reminders and log into your account regularly</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-lg">
                4
              </div>
              <div>
                <p className="font-semibold">If HELOC balance isn't dropping, STOP and reassess</p>
                <p className="text-sm opacity-90">Immediately pause chunking if balance grows for 2+ months</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-lg">
                5
              </div>
              <div>
                <p className="font-semibold">Build 3-6 months emergency fund BEFORE aggressive chunking</p>
                <p className="text-sm opacity-90">Start with small chunks until you have a solid safety net</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-5">
          <h4 className="font-bold text-lg mb-4">Need Help? Get Expert Guidance</h4>
          <p className="mb-4 text-sm">
            If you're unsure whether chunking is right for you, or want personalized advice on velocity banking strategies, reach out to Ben Hulshof:
          </p>
          <div className="space-y-3">
            <a
              href="mailto:ben@windmillmortgage.com"
              className="flex items-center space-x-3 bg-white/20 hover:bg-white/30 rounded-lg p-3 transition-colors"
            >
              <Mail className="w-5 h-5" />
              <div>
                <div className="font-semibold">Email</div>
                <div className="text-sm opacity-90">ben@windmillmortgage.com</div>
              </div>
            </a>
            <a
              href="tel:614-327-2213"
              className="flex items-center space-x-3 bg-white/20 hover:bg-white/30 rounded-lg p-3 transition-colors"
            >
              <Phone className="w-5 h-5" />
              <div>
                <div className="font-semibold">Phone</div>
                <div className="text-sm opacity-90">614-327-2213</div>
              </div>
            </a>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 text-sm opacity-90">
            <p>
              <strong>Ask NOVO AI Coach:</strong> Type your questions about chunking risks, safety guidelines, or whether velocity banking is right for your situation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChunkingRiskAssessment;
