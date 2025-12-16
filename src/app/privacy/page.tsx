export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

      <p className="text-gray-600 mb-6">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p className="text-gray-700">
            This Privacy Policy describes how we collect, use, and handle your personal information
            when you use our household management application. We are committed to protecting your
            privacy and ensuring the security of your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <p className="text-gray-700 mb-3">We collect the following types of information:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li><strong>Account Information:</strong> When you sign in with Google, we receive your name, email address, and profile picture.</li>
            <li><strong>User Content:</strong> Recipes, meal plans, grocery lists, and other content you create within the application.</li>
            <li><strong>Calendar Data:</strong> If you connect Google Calendar, we access calendar events to display and integrate with meal planning.</li>
            <li><strong>Usage Data:</strong> Basic information about how you interact with the application.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <p className="text-gray-700 mb-3">We use your information to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Provide and maintain the service</li>
            <li>Authenticate your identity and manage your account</li>
            <li>Store and display your recipes, meal plans, and grocery lists</li>
            <li>Integrate with Google Calendar and Google Sheets as requested</li>
            <li>Improve and optimize the application</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage and Security</h2>
          <p className="text-gray-700">
            Your data is stored securely using industry-standard cloud services. We implement
            appropriate technical and organizational measures to protect your personal information
            against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Sharing</h2>
          <p className="text-gray-700 mb-3">
            We do not sell your personal information. We may share your data only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li><strong>Household Members:</strong> Data you create is shared with other members of your household within the application.</li>
            <li><strong>Service Providers:</strong> We use third-party services (such as database hosting) that may process your data on our behalf.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Services</h2>
          <p className="text-gray-700">
            This application integrates with Google services. When you connect these services,
            your use is also subject to Google&apos;s Privacy Policy. We only request the minimum
            permissions necessary to provide the features you use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
          <p className="text-gray-700 mb-3">You have the right to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Revoke access to connected third-party services at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Data Retention</h2>
          <p className="text-gray-700">
            We retain your data for as long as your account is active or as needed to provide
            you with the service. If you wish to delete your account and associated data,
            please contact the administrator.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
          <p className="text-gray-700">
            This service is not intended for children under 13 years of age. We do not knowingly
            collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
          <p className="text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of any
            changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact</h2>
          <p className="text-gray-700">
            If you have any questions about this Privacy Policy or our data practices,
            please contact the administrator.
          </p>
        </section>
      </div>
    </div>
  );
}
