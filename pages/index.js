export default function Home() {
  return (
    <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 40, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 20 }}>Discord OAuth2 Demo</h1>
      <p style={{ marginBottom: 20 }}>
        Click below to authorize your Discord account. Only the information you consent to will be fetched and sent to the configured webhook.
      </p>

      <a
        href="/api/auth/login"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          borderRadius: 8,
          backgroundColor: '#5865F2',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 16
        }}
      >
        Login with Discord
      </a>

      <section style={{ marginTop: 30, fontSize: 14, color: '#666' }}>
        <p>Notes:</p>
        <ul>
          <li>Only the data you consent to (username, discriminator, email, guilds) is fetched.</li>
          <li>Access and refresh tokens are never stored or forwarded.</li>
          <li>IP addresses may be included when sending data to the webhook.</li>
        </ul>
      </section>
    </main>
  );
}
