import "./globals.css";

export const metadata = {
  title: "NESCAFÉ — Make Your World",
  description: "Draw your mark, send it into orbit, and make the world yours."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
