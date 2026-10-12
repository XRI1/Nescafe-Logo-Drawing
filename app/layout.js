import "./globals.css";

export const metadata = {
  title: "NESCAFÉ — Make Your World",
  description: "Draw your mark, send it into orbit, and make the world yours."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
