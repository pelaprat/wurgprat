export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>

      <p className="text-gray-600 mb-6">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p className="text-gray-700">
            By accessing and using this application, you accept and agree to be bound by the terms
            and provision of this agreement. If you do not agree to abide by these terms, please
            do not use this service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
          <p className="text-gray-700">
            This application provides household management tools including meal planning, recipe
            management, grocery list creation, and calendar integration. The service is provided
            &quot;as is&quot; and may be modified or discontinued at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
          <p className="text-gray-700">
            You are responsible for maintaining the confidentiality of your account and password.
            You agree to accept responsibility for all activities that occur under your account.
            You must be at least 13 years of age to use this service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User Conduct</h2>
          <p className="text-gray-700">
            You agree not to use the service for any unlawful purpose or in any way that could
            damage, disable, or impair the service. You agree not to attempt to gain unauthorized
            access to any part of the service or its related systems.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Intellectual Property</h2>
          <p className="text-gray-700">
            The content, features, and functionality of this service are owned by the service
            provider and are protected by copyright, trademark, and other intellectual property laws.
            You retain ownership of any content you create or upload to the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Services</h2>
          <p className="text-gray-700">
            This application integrates with third-party services including Google Calendar and
            Google Sheets. Your use of these integrations is subject to the respective terms of
            service of those providers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disclaimer of Warranties</h2>
          <p className="text-gray-700">
            This service is provided &quot;as is&quot; without warranties of any kind, either express or
            implied. We do not warrant that the service will be uninterrupted, secure, or error-free.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
          <p className="text-gray-700">
            In no event shall the service provider be liable for any indirect, incidental, special,
            consequential, or punitive damages arising out of or related to your use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to Terms</h2>
          <p className="text-gray-700">
            We reserve the right to modify these terms at any time. We will notify users of any
            material changes by posting the new terms on this page. Your continued use of the
            service after such modifications constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
          <p className="text-gray-700">
            If you have any questions about these Terms of Service, please contact the administrator.
          </p>
        </section>
      </div>
    </div>
  );
}
