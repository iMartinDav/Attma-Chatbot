import React from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/internationalization/config';
import { PricingCard } from './pricing-card';

// Define a properly typed interface for the component props
interface PricingTiersProps {
  dictionary: {
    free: {
      title: string;
      price: string;
      description: string;
      button: string;
      features?: string[];
    };
    pro: {
      title: string;
      price: string;
      description: string;
      button: string;
      features?: string[];
    };
    enterprise: {
      title: string;
      price: string;
      description: string;
      button: string;
      features?: string[];
    };
    comparison?: {
      allPlansInclude?: string;
      viewComparison?: string;
    };
  };
  locale: Locale;
}

export function PricingTiers({ dictionary, locale }: PricingTiersProps) {
  const pricingPlans = [
    {
      title: dictionary.free.title,
      price: dictionary.free.price,
      description: dictionary.free.description,
      features: dictionary.free.features || [
        '100 AI analysis queries / month',
        'Basic sequence analysis',
        '5GB data storage',
        'Public dataset access',
        'Community support',
        'Standard visualizations',
      ],
      buttonText: dictionary.free.button,
      buttonLink: `/${locale}/chat`,
    },
    {
      title: dictionary.pro.title,
      price: dictionary.pro.price,
      description: dictionary.pro.description,
      highlighted: true,
      mostPopular: true,
      features: dictionary.pro.features || [
        '2,500 AI analysis queries / month',
        'Advanced sequence analysis',
        '100GB data storage',
        'Team collaboration (up to 10)',
        'API access',
        'Priority support',
        'Advanced visualizations',
        'Basic compliance features',
      ],
      buttonText: dictionary.pro.button,
      buttonLink: `/${locale}/signup?plan=pro`,
    },
    {
      title: dictionary.enterprise.title,
      price: dictionary.enterprise.price,
      description: dictionary.enterprise.description,
      features: dictionary.enterprise.features || [
        'Unlimited AI analysis',
        'Custom algorithm development',
        'Unlimited storage',
        'Unlimited team members',
        'Dedicated support',
        'Custom model training',
        'Advanced compliance (HIPAA, GxP)',
        'On-premise deployment options',
      ],
      buttonText: dictionary.enterprise.button,
      buttonLink: `/${locale}/contact?enterprise=true`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
      {pricingPlans.map((plan, index) => (
        <PricingCard key={index} {...plan} />
      ))}

      <div className="col-span-1 md:col-span-3 flex items-center justify-center mt-8">
        <p className="text-sm text-muted-foreground">
          {dictionary.comparison?.allPlansInclude ||
            'All plans include our core analysis platform.'}{' '}
          <Link
            href="#feature-comparison"
            className="text-primary-ink underline underline-offset-4 transition-colors hover:text-primary-ink/80"
          >
            {dictionary.comparison?.viewComparison ||
              'View full feature comparison'}
          </Link>
        </p>
      </div>
    </div>
  );
}
