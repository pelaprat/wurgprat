"use client";

interface Step {
  id: string;
  label: string;
  href: string;
}

interface WizardProgressProps {
  steps: Step[];
  currentStep: string;
}

export default function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="mb-6">
      {/* Mobile: Simple step counter */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">
            Step {currentIndex + 1} of {steps.length}
          </span>
          <span className="text-sm text-gray-500">
            {steps[currentIndex]?.label}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: Full step indicator */}
      <nav className="hidden sm:block" aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isUpcoming = index > currentIndex;

            return (
              <li
                key={step.id}
                className={`relative ${index !== steps.length - 1 ? "flex-1 pr-8" : ""}`}
              >
                <div className="flex items-center">
                  {/* Step circle */}
                  <div
                    className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      isCompleted
                        ? "bg-emerald-600 border-emerald-600"
                        : isCurrent
                        ? "bg-white border-emerald-600"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span
                        className={`text-sm font-semibold ${
                          isCurrent ? "text-emerald-600" : "text-gray-500"
                        }`}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Step label */}
                  <span
                    className={`ml-3 text-sm font-medium whitespace-nowrap ${
                      isCompleted || isCurrent ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Connector line */}
                  {index !== steps.length - 1 && (
                    <div className="absolute top-5 left-10 w-full h-0.5 -translate-y-1/2">
                      <div
                        className={`h-full transition-colors ${
                          isCompleted ? "bg-emerald-600" : "bg-gray-300"
                        }`}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
