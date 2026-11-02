import { Plus_Jakarta_Sans, Sora } from 'next/font/google';

// Same type pairing as attma.bio, so both apps read as one product: Sora for headings, Plus Jakarta Sans for body.
export const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const fontHeading = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['500', '600', '700'],
});
