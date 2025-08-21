export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME || "Finance Starter",
  description: "A tiny Next.js starter you can deploy to Vercel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
