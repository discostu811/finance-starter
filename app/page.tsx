'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [server, setServer] = useState<string>("(checking...)");

  useEffect(() => {
    fetch('/api/ping')
      .then(r => r.json())
      .then(d => setServer(d?.ok ? '✅ API reachable' : '❌ API failed'))
      .catch(() => setServer('❌ API failed'));
  }, []);

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        {process.env.NEXT_PUBLIC_SITE_NAME || 'Finance Starter'}
      </h1>
      <p style={{ opacity: 0.8 }}>
        Next.js + API + ready for Codespaces and Vercel.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Smoke tests</h2>
        <ul>
          <li>Client-side rendering works ✅</li>
          <li>Environment variable visible on client: <code>NEXT_PUBLIC_SITE_NAME</code></li>
          <li>Server API route status: <strong>{server}</strong></li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Next steps</h2>
        <ol>
          <li>Open this repo in <strong>GitHub Codespaces</strong> and run <code>npm install</code>.</li>
          <li>Run <code>npm run dev</code> and verify the page + API.</li>
          <li>Push commits. Then import the repo to <strong>Vercel</strong>.</li>
        </ol>
      </section>
    </main>
  );
}
