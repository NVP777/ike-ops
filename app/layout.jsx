import './globals.css';
import { Saira_Condensed, Figtree } from 'next/font/google';
import localFont from 'next/font/local';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';

const disp = Saira_Condensed({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-disp' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });
const logo = localFont({ src: '../fonts/neofolie.woff', variable: '--font-logo' });
const head = localFont({ src: '../fonts/osiris.otf', variable: '--font-head' });
const title = localFont({ src: '../fonts/kreftin.otf', variable: '--font-title' });
const small = localFont({ src: '../fonts/futura.ttf', variable: '--font-small' });

export const metadata = { title: 'IKE Ops' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#060507' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${disp.variable} ${body.variable} ${logo.variable} ${head.variable} ${title.variable} ${small.variable}`}>
      <body>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}