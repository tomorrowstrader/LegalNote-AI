import ConsentForm from '../ConsentForm'

export default function ConsentFormExample() {
  return (
    <div className="max-w-2xl p-6">
      <ConsentForm onConsentChange={(hasConsent, text) => console.log('Consent changed:', hasConsent, text)} />
    </div>
  )
}
