'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  MoonIcon,
  SunIcon,
  Menu,
  X,
  ArrowRight,
  LaptopIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/lib/internationalization/config';
import { LanguageSwitcher } from './language-switcher';

export const ATTMA_COLOR_CLASS = "text-[#80f1e5]";
export const ATTMA_BOLD_CLASS = "text-ultra-bold";

// ------ Types ------
export interface NavItem {
  name: string;
  href: string;
  label: string;
  isSection?: boolean;
  comingSoon?: boolean;
}

export interface HeaderProps {
  locale: Locale;
  dictionary: any;
}

// ------ Header Component ------

const Header = ({ locale, dictionary }: HeaderProps) => {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState<string>('');
  const nav = dictionary?.common?.nav || {};
  const cta = dictionary?.common?.cta || {};

  // Define navigation items with translations
  const navItems: NavItem[] = [
    {
      name: nav.features || 'Features',
      href: `/${locale}/#features`,
      label: 'Explore genomic analysis features',
      isSection: true,
    },
    {
      name: nav.pricing || 'Pricing',
      href: `/${locale}/pricing`,
      label: 'View pricing plans',
    },
    {
      name: nav.cases || 'Case Studies',
      href: `/${locale}/#cases`,
      label: 'Read success stories',
      isSection: true,
    },
    {
      name: nav.blog || 'Blog',
      href: `/${locale}/blog`,
      label: 'Read our articles',
      comingSoon: true,
    },
    {
      name: nav.contact || 'Contact',
      href: `/${locale}/contact`,
      label: 'Get in touch with our research team',
      isSection: false,
    },
  ];

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
      if (pathname === `/${locale}`) {
        const sections = document.querySelectorAll('section[id]');
        let currentActiveSection = '';
        sections.forEach((section) => {
          const sectionTop = section.getBoundingClientRect().top;
          const sectionHeight = section.getBoundingClientRect().height;
          if (sectionTop <= 100 && sectionTop + sectionHeight > 100) {
            currentActiveSection = `#${section.id}`;
          }
        });

        setActiveHash(currentActiveSection);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [locale, pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleHashChange = () => {
        setActiveHash(window.location.hash || '');
      };
      handleHashChange();
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  useEffect(() => setMounted(true), []);

  // Handle menu state
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [mobileMenuOpen]);

  // Handle scroll locking during menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isActiveLink = useCallback(
    (href: string, isSection?: boolean) => {
      if (isSection && pathname === `/${locale}`) {
        const hrefHash = href.split('#')[1] ? `#${href.split('#')[1]}` : '';
        return hrefHash === activeHash;
      }
      if (!href.includes('#')) {
        return pathname === href || pathname.startsWith(`${href}/`);
      }

      return false;
    },
    [activeHash, pathname, locale],
  );

  const toggleTheme = useCallback(() => {
    if (!mounted) return;
    // Cycle through themes: system -> light -> dark -> system
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  }, [theme, setTheme, mounted]);

  const getThemeIcon = useCallback(() => {
    if (!mounted) return null;

    if (theme === 'system') {
      return <LaptopIcon className="size-5" />;
    }
    return resolvedTheme === 'dark' ? (
      <SunIcon className="size-5" />
    ) : (
      <MoonIcon className="size-5" />
    );
  }, [resolvedTheme, theme, mounted]);

  const getThemeAriaLabel = useCallback(() => {
    if (theme === 'system') {
      return 'Using system theme preference, click to switch to light mode';
    }
    return resolvedTheme === 'dark'
      ? 'Currently in dark mode, click to switch to light mode'
      : 'Currently in light mode, click to switch to dark mode';
  }, [resolvedTheme, theme]);

  const handleBlogClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full backdrop-blur-md transition-all duration-300',
        scrolled
          ? 'border-b border-border/40 bg-background/95 shadow-sm'
          : 'bg-background/80',
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 max-w-7xl">
        {/* Logo */}
        <Logo locale={locale} />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              item={item}
              locale={locale}
              isActiveLink={isActiveLink}
              handleBlogClick={handleBlogClick}
            />
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden md:flex items-center">
            <LanguageSwitcher currentLocale={locale} />

            {/* Theme Toggle with Dropdown */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={getThemeAriaLabel()}
                    className="ml-1 lg:ml-2"
                  >
                    {getThemeIcon()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setTheme('light')}
                    className={theme === 'light' ? 'bg-accent/50' : ''}
                  >
                    <SunIcon className="size-4 mr-2" /> Light
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme('dark')}
                    className={theme === 'dark' ? 'bg-accent/50' : ''}
                  >
                    <MoonIcon className="size-4 mr-2" /> Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme('system')}
                    className={theme === 'system' ? 'bg-accent/50' : ''}
                  >
                    <LaptopIcon className="size-4 mr-2" /> System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 lg:ml-2"
                aria-label="Loading theme"
              >
                <div className="size-5 opacity-0" />
              </Button>
            )}

            {/* Console Button */}
            <Link href={`/${locale}/chat`} className="ml-3 lg:ml-5">
              <Button
                size="sm"
                className="px-4 font-medium bg-[#25C6A3] hover:opacity-90 transition-opacity border-0"
              >
                <span className="mr-1.5">{cta.console || 'Go to Console'}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <span className="sr-only">
              {mobileMenuOpen ? 'Close menu' : 'Open menu'}
            </span>
            {mobileMenuOpen ? (
              <X className="size-5 text-[#25C6A3]" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            className="md:hidden bg-background border-b border-border/40 shadow-lg overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <nav className="flex flex-col space-y-1 p-4 relative">
              {navItems.map((item) => (
                <MobileNavLink
                  key={item.name}
                  item={item}
                  locale={locale}
                  isActiveLink={isActiveLink}
                  onClose={() => setMobileMenuOpen(false)}
                  handleBlogClick={handleBlogClick}
                />
              ))}
            </nav>

            <motion.div
              className="flex items-center justify-between p-4 border-t border-border/40"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <LanguageSwitcher currentLocale={locale} />

              {/* Mobile Theme Toggle with Dropdown */}
              {mounted ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={getThemeAriaLabel()}
                    >
                      {getThemeIcon()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setTheme('light')}
                      className={theme === 'light' ? 'bg-accent/50' : ''}
                    >
                      <SunIcon className="size-4 mr-2" /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('dark')}
                      className={theme === 'dark' ? 'bg-accent/50' : ''}
                    >
                      <MoonIcon className="size-4 mr-2" /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('system')}
                      className={theme === 'system' ? 'bg-accent/50' : ''}
                    >
                      <LaptopIcon className="size-4 mr-2" /> System
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="icon" aria-label="Toggle theme">
                  <div className="size-5 opacity-0" />
                </Button>
              )}
            </motion.div>

            <div className="p-4 pt-2 pb-6">
              <Link href={`/${locale}/chat`} className="block w-full">
                <Button className="w-full font-medium bg-[#25C6A3] hover:opacity-90 transition-opacity border-0 shadow-sm">
                  {cta.console || 'Go to Console'}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

// ------ Sub-components ------

// Logo Component
const Logo = memo(({ locale }: { locale: Locale }) => {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/${locale}`}
        className="flex items-center gap-0.5 transition-transform hover:scale-105"
        aria-label="Attma home page"
      >
        <Image
          src="/images/attma-logo.svg"
          alt="Attma Logo"
          width={40}
          height={40}
          className="h-10 w-auto object-contain"
          priority
        />
        <span className="font-bold text-xl tracking-tight">
          <span className={`${ATTMA_COLOR_CLASS} ${ATTMA_BOLD_CLASS}`}>Attma</span>
          <span className="ml-0.5 text-foreground/80 font-normal text-sm align-text-top">
            beta
          </span>
        </span>
      </Link>
    </div>
  );
});

Logo.displayName = 'Logo';

// NavLink Component for Desktop Navigation
interface NavLinkProps {
  item: NavItem;
  locale: Locale;
  isActiveLink: (href: string, isSection?: boolean) => boolean;
  handleBlogClick: (e: React.MouseEvent) => void;
}

const NavLink = memo(
  ({ item, isActiveLink, handleBlogClick }: NavLinkProps) => {
    if (item.comingSoon) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleBlogClick}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-all',
                  'text-muted-foreground hover:text-foreground cursor-not-allowed',
                )}
                aria-label={`${item.label} (Coming Soon)`}
              >
                {item.name}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="center"
              sideOffset={5}
              className="bg-background border border-border"
              style={
                {
                  '--tooltip-arrow-color': ATTMA_COLOR_CLASS,
                  '--tooltip-background-color': 'var(--background)',
                } as React.CSSProperties
              }
            >
              <p>Coming Soon</p>
              <style jsx global>{`
              .tooltip-arrow {
                fill: var(--tooltip-arrow-color);
              }
              [data-side="bottom"] .tooltip-arrow {
                top: -5px;
                filter: drop-shadow(0 -1px 0 var(--border));
              }
            `}</style>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link
        href={item.href}
        aria-label={item.label}
        className={cn(
          'rounded-md px-3 py-2 text-sm font-medium transition-all',
          isActiveLink(item.href, item.isSection)
            ? `text-foreground after:block after:h-0.5 after:bg-[#3DEACD] after:mt-0.5`
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {item.name}
      </Link>
    );
  },
);

NavLink.displayName = 'NavLink';

// MobileNavLink Component for Mobile Navigation
interface MobileNavLinkProps {
  item: NavItem;
  locale: Locale;
  isActiveLink: (href: string, isSection?: boolean) => boolean;
  onClose?: () => void;
  handleBlogClick: (e: React.MouseEvent) => void;
}

const MobileNavLink = memo(
  ({ item, isActiveLink, onClose, handleBlogClick }: MobileNavLinkProps) => {
    if (item.comingSoon) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleBlogClick}
                className={cn(
                  'block rounded-md px-3 py-2.5 text-sm font-medium transition-colors w-full text-left',
                  'text-muted-foreground hover:text-foreground hover:bg-accent/20 cursor-not-allowed',
                )}
                aria-label={`${item.label} (Coming Soon)`}
              >
                {item.name}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              sideOffset={5}
              className="bg-background border border-border z-50"
              style={
                {
                  '--tooltip-arrow-color': ATTMA_COLOR_CLASS,
                  '--tooltip-background-color': 'var(--background)',
                } as React.CSSProperties
              }
            >
              <p>Coming Soon</p>
              <style jsx global>{`
              [data-side="right"] .tooltip-arrow {
                left: -5px;
                filter: drop-shadow(-1px 0 0 var(--border));
              }
            `}</style>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link
        href={item.href}
        className={cn(
          'block rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
          isActiveLink(item.href, item.isSection)
            ? `text-foreground border-l-2 border-[#3DEACD] bg-accent/30 pl-[10px]`
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/20',
        )}
        onClick={onClose}
        aria-label={item.label}
      >
        {item.name}
      </Link>
    );
  },
);

MobileNavLink.displayName = 'MobileNavLink';

export default memo(Header);
