import "./globals.css";

export const metadata = {
  title: "Cuentos - Personalized Children's Books",
  description:
    "Generate personalized stories for children with AI-powered illustrations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
