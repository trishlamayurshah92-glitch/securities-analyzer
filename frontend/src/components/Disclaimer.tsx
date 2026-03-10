export default function Disclaimer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900 mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-5 space-y-3 text-xs text-gray-500">

        <p className="font-semibold text-gray-400 uppercase tracking-wide">
          Important Disclaimers — Please Read
        </p>

        <p>
          <span className="font-medium text-gray-400">Not financial advice.</span>{' '}
          This tool is provided for <span className="font-medium">educational and informational purposes only</span>.
          Nothing on this site constitutes financial, investment, legal, or tax advice.
          AI-generated analysis may be incomplete, inaccurate, or outdated.
          Always consult a licensed financial advisor before making any investment decisions.
          Past performance is not indicative of future results.
        </p>

        <p>
          <span className="font-medium text-gray-400">Data sources &amp; licensing.</span>{' '}
          Market news is provided by{' '}
          <span className="font-medium text-gray-400">Finnhub</span> under their free-tier API
          (personal/non-commercial use). Price, fundamental, and analyst data is retrieved from{' '}
          <span className="font-medium text-gray-400">Yahoo Finance</span> via an unofficial API
          client. Yahoo Finance data is subject to{' '}
          <span className="font-medium">Yahoo&apos;s Terms of Service</span>, which restrict
          automated and commercial use. This tool is intended solely for personal, non-commercial,
          educational use. Do not redistribute or commercialize the data obtained through this
          application.
        </p>

        <p>
          <span className="font-medium text-gray-400">API rate limits &amp; data accuracy.</span>{' '}
          Finnhub free tier: <span className="font-medium">60 API calls per minute</span>; exceeding
          this will cause request failures. Yahoo Finance data may be delayed, incomplete, or
          subject to change without notice. All data is provided &quot;as is&quot; with no
          warranty of accuracy, completeness, or fitness for any particular purpose.
        </p>

        <p>
          <span className="font-medium text-gray-400">No liability.</span>{' '}
          The authors and operators of this tool accept no responsibility or liability for any
          losses, damages, or decisions made in reliance on information provided by this
          application. Use at your own risk.
        </p>

      </div>
    </footer>
  )
}
