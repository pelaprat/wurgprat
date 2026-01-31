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
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li
                key={step.id}
                className={`relative ${index !== steps.length - 1 ? "flex-1" : ""}`}
              >
                {/* Connector line — between circles only */}
                {index !== steps.length - 1 && (
                  <div
                    className={`absolute top-5 left-10 right-0 h-0.5 -translate-y-1/2 ${
                      isCompleted ? "bg-emerald-600" : "bg-gray-300"
                    }`}
                  />
                )}

                <div className="relative flex flex-col items-start">
                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
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

                  {/* Step label — below the circle, not inline */}
                  <span
                    className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                      isCompleted || isCurrent ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
