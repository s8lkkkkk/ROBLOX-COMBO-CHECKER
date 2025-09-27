// pages/index.js
export default function Home() {
  return (
    <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 36 }}>
      <h1>Login with Discord</h1>
      <p>Click the button to authorize (consent-based). Your allowed Discord data + IP will be forwarded to a webhook you control.</p>

      <a
        href="/api/auth/login"
        style={{
          display: 'inline-block',
          padding: '10px 18px',
          borderRadius: 8,
          background: '#5865F2',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 700,
        }}
      >
        Login with Discord
      </a>

      <p style={{ marginTop: 18, color: '#666' }}>
        Note: tokens are used server-side only to fetch consented info and are not stored or forwarded. The webhook receives only consenting user data, guilds (if allowed), and IP.
      </p>
    </main>
  );
}
