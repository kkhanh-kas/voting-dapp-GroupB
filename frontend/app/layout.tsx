import { Playfair_Display, JetBrains_Mono, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-body' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${jetbrains.variable} ${sourceSerif.variable} antialiased`}>
      <body className="bg-white text-black font-body">
        {/* Layer Texture Global */}
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.02] mix-blend-multiply bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        {children}
      </body>
    </html>
  );
}