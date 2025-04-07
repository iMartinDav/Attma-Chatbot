import React from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Send } from 'lucide-react';
import type { Locale } from '@/lib/internationalization/config';

// X icon component for modern Twitter/X branding
const XIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      fill="currentColor"
    />
  </svg>
);

// Define consistent branding color
const GENIE_PINK = '#25C6A3';

interface FooterProps {
  locale: Locale;
  dictionary: any; // This will be refined
}

const Footer = ({ locale, dictionary }: FooterProps) => {
  // Add null check to prevent accessing properties of undefined
  const footer = dictionary?.common?.footer || {}; // Access footer from common section
  const nav = dictionary?.common?.nav || {}; // Access nav from common section

  // Define fallbacks for all footer values
  const companyInfo =
    footer.companyInfo ||
    'Revolutionizing biological research with AI-powered bioinformatics analysis.';
  const stayUpdated = footer.stayUpdated || 'Stay Updated';
  const newsletterText =
    footer.newsletterText ||
    'Subscribe to our newsletter for the latest updates and research breakthroughs.';
  const newsletterPlaceholder = footer.newsletterPlaceholder || 'Your email';
  const newsletterDisclaimer =
    footer.newsletterDisclaimer ||
    'By subscribing, you agree to our Privacy Policy and consent to receive updates.';
  const rights = footer.rights || 'All rights reserved';
  const privacy = footer.privacy || 'Privacy Policy';
  const terms = footer.terms || 'Terms of Service';
  const cookies = footer.cookies || 'Cookie Policy';
  const productTitle = footer.productTitle || 'Product';
  const companyTitle = footer.companyTitle || 'Company';
  const aboutUs = footer.aboutUs || 'About Us';
  const careers = footer.careers || 'Careers';
  const docs = footer.docs || 'Documentation';

  // Navigation fallbacks
  const featuresText = nav.features || 'Features';
  const pricingText = nav.pricing || 'Pricing';
  const casesText = nav.cases || 'Case Studies';
  const blogText = nav.blog || 'Blog';
  const contactText = nav.contact || 'Contact';

  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/30 bg-gradient-to-b from-background/50 via-background/80 to-background relative overflow-hidden z-0">
      {/* Elegant background elements - simplified without motion */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Main purple glow in bottom left corner */}
        <div
          className="absolute -left-36 -bottom-36 size-[600px] rounded-full bg-purple-500/20 blur-[100px] opacity-30"
          aria-hidden="true"
        />

        {/* Secondary smaller accent lights */}
        <div
          className="absolute top-40 right-20 size-[200px] rounded-full bg-purple-400/10 blur-[50px] opacity-20"
          aria-hidden="true"
        />
        <div
          className="absolute -right-20 -bottom-20 size-[300px] rounded-full bg-pink-500/10 blur-[80px] opacity-15"
          aria-hidden="true"
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-7xl py-16 md:py-20 relative">
        {/* Main footer grid with glassmorphism effect */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 backdrop-blur-sm">
          {/* Company Info - Using consistent header logo style */}
          <div className="lg:col-span-4 space-y-6">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2.5 transition-transform hover:scale-105"
              aria-label="Attma home page"
            >
              <span className="font-bold text-2xl tracking-tight">
                <span style={{ color: GENIE_PINK }}>Attma</span>
                <span className="ml-0.5 text-foreground/80 font-normal text-sm align-text-top">
                  beta
                </span>
              </span>
            </Link>

            <p className="text-muted-foreground/90 max-w-md leading-relaxed">
              {companyInfo}
            </p>

            <div className="flex items-center gap-5 pt-2">
              <a
                href="https://github.com"
                aria-label="GitHub"
                className="text-foreground/60 hover:text-primary transition-colors duration-300 hover:scale-110"
              >
                <Github className="size-5" />
              </a>
              <a
                href="https://x.com"
                aria-label="X (formerly Twitter)"
                className="text-foreground/60 hover:text-primary transition-colors duration-300 hover:scale-110"
              >
                <XIcon />
              </a>
              <a
                href="https://linkedin.com"
                aria-label="LinkedIn"
                className="text-foreground/60 hover:text-primary transition-colors duration-300 hover:scale-110"
              >
                <Linkedin className="size-5" />
              </a>
            </div>
          </div>

          {/* Navigation links in a modern 3-column layout */}
          <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8">
            {/* Product Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-foreground/90">
                {productTitle}
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href={`/${locale}/#features`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {featuresText}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/pricing`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {pricingText}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/#cases`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {casesText}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/blog`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {blogText}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/documentation`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {docs}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-foreground/90">
                {companyTitle}
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href={`/${locale}/about`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {aboutUs}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/careers`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {careers}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/contact`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {contactText}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-foreground/90">Legal</h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href={`/${locale}/privacy`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {privacy}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/terms`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {terms}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/cookies`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {cookies}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Newsletter - with modern floating input design */}
          <div className="lg:col-span-3 space-y-5">
            <h3 className="font-medium text-sm text-foreground/90">
              {stayUpdated}
            </h3>
            <p className="text-muted-foreground text-sm">{newsletterText}</p>
            <div className="relative mt-2 max-w-sm">
              <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background/30 backdrop-blur-sm transition-all duration-300 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                <div className="flex">
                  <Input
                    type="email"
                    placeholder={newsletterPlaceholder}
                    className="flex-1 border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="m-1 bg-background/70 hover:bg-primary/10 hover:text-primary rounded-lg"
                  >
                    <Send className="size-4" />
                    <span className="sr-only">Subscribe</span>
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              {newsletterDisclaimer}
            </p>
          </div>
        </div>

        {/* Copyright bar with elegant separator dots */}
        <div className="mt-16 pt-6 border-t border-border/10 flex flex-col md:flex-row justify-between items-center text-muted-foreground/60 text-xs gap-4">
          <p>
            &copy; {currentYear} Attma AI. {rights}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/privacy`}
              className="hover:text-foreground transition-colors"
            >
              {privacy}
            </Link>
            <div
              className="size-1 rounded-full bg-border/40"
              aria-hidden="true"
            />
            <Link
              href={`/${locale}/terms`}
              className="hover:text-foreground transition-colors"
            >
              {terms}
            </Link>
            <div
              className="size-1 rounded-full bg-border/40"
              aria-hidden="true"
            />
            <Link
              href={`/${locale}/cookies`}
              className="hover:text-foreground transition-colors"
            >
              {cookies}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
