import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface PricingCardProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
  buttonLink: string;
  mostPopular?: boolean;
}

export function PricingCard({
  title,
  price,
  description,
  features,
  highlighted = false,
  buttonText,
  buttonLink,
  mostPopular = false,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col p-6 rounded-xl border transition-all duration-200',
        highlighted
          ? 'border-primary shadow-lg'
          : 'border-border hover:border-primary/40 hover:shadow-xs',
      )}
    >
      {mostPopular && (
        <div className="absolute -top-3 inset-x-0 mx-auto w-fit px-4 py-1 bg-[#25C6A3] text-white text-xs font-medium rounded-full">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold">{title}</h3>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-3xl font-bold',
              highlighted && 'text-[#25C6A3]',
            )}
          >
            {price}
          </span>
          {price !== 'Custom' && (
            <span className="text-muted-foreground text-base">/month</span>
          )}
        </div>
        <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>

      <ul className="space-y-3 mb-8 grow">
        {features.map((feature, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <li key={i} className="flex items-start gap-3 text-sm">
            <CheckCircle className="size-5 text-[#25C6A3] shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link href={buttonLink} className="mt-auto">
        <Button
          className={cn(
            'w-full gap-2 font-medium',
            highlighted
              ? 'bg-[#25C6A3] hover:opacity-90 transition-opacity border-0'
              : 'border-[#25C6A3]/30 hover:border-[#25C6A3]/50 hover:bg-[#25C6A3]/5 transition-colors',
          )}
          variant={highlighted ? 'default' : 'outline'}
          size="lg"
        >
          {buttonText}
          <ArrowRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}
