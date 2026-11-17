import './globals.css';
import { Saira_Condensed, Figtree } from 'next/font/google';
import localFont from 'next/font/local';

import { AuthProvider } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';

// The four custom fonts below draw the rupee sign (U+20B9) like a ruble, so it is left out of their range and the browser uses a system font for it.
const disp = Saira_Condensed({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-disp' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });
const logo = localFont({ src: '../fonts/neofolie.woff', declarations: [{ prop: 'unicode-range', value: 'U+0000-20B8, U+20BA-10FFFF' }], variable: '--font-logo' });
const head = localFont({ src: '../fonts/osiris.otf', declarations: [{ prop: 'unicode-range', value: 'U+0000-20B8, U+20BA-10FFFF' }], variable: '--font-head' });
const title = localFont({ src: '../fonts/kreftin.otf', declarations: [{ prop: 'unicode-range', value: 'U+0000-20B8, U+20BA-10FFFF' }], variable: '--font-title' });
const small = localFont({ src: '../fonts/futura.ttf', declarations: [{ prop: 'unicode-range', value: 'U+0000-20B8, U+20BA-10FFFF' }], variable: '--font-small' });

export const metadata = { title: 'IKE Ops', manifest: '/manifest.webmanifest', icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' }, appleWebApp: { capable: true, title: 'IKE Ops', statusBarStyle: 'black-translucent' } };
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