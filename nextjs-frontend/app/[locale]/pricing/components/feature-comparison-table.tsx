import { CheckCircle, HelpCircle, X } from 'lucide-react';
import type { Locale } from '@/lib/internationalization/config'; // Import the Locale type
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type FeatureValue = string | boolean;

interface FeatureItem {
  name: string;
  free: FeatureValue;
  pro: FeatureValue;
  enterprise: FeatureValue;
  tooltip?: string;
}

// Properly define the component props with TypeScript interface
interface FeatureComparisonTableProps {
  locale: Locale;
  dictionary?: {
    comparison?: {
      caption?: string;
      columns?: {
        feature: string;
        free: string;
        pro: string;
        enterprise: string;
      };
      features?: Array<{
        name: string;
        free: string | boolean;
        pro: string | boolean;
        enterprise: string | boolean;
        tooltip?: string;
      }>;
    };
  };
}

export function FeatureComparisonTable({
  locale,
  dictionary = {},
}: FeatureComparisonTableProps) {
  // Get translations or use defaults
  const caption =
    dictionary?.comparison?.caption ||
    'Detailed feature comparison across all plans';
  const columns = dictionary?.comparison?.columns || {
    feature: 'Feature',
    free: 'Free',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  // Use translated features or fallback to default features
  const features = dictionary?.comparison?.features || [
    {
      name: 'AI Queries',
      free: '100/month',
      pro: '2,500/month',
      enterprise: 'Unlimited',
    },
    {
      name: 'Analysis',
      free: 'Basic',
      pro: 'Advanced',
      enterprise: 'Custom',
    },
    {
      name: 'Storage',
      free: '5GB',
      pro: '100GB',
      enterprise: 'Unlimited',
    },
    {
      name: 'Collaboration',
      free: false,
      pro: '10 members',
      enterprise: 'Unlimited',
    },
    {
      name: 'API Access',
      free: false,
      pro: true,
      enterprise: true,
      tooltip:
        "Access to Attma's API for integration with your research workflows",
    },
    {
      name: 'Support',
      free: false,
      pro: '24-48h',
      enterprise: 'Dedicated',
    },
    {
      name: 'Model Training',
      free: false,
      pro: false,
      enterprise: true,
    },
    {
      name: 'Compliance',
      free: false,
      pro: 'Basic',
      enterprise: 'HIPAA, GxP',
    },
  ];

  const renderFeatureValue = (value: FeatureValue) => {
    if (value === true) {
      return (
        <div className="flex items-center justify-center w-full">
          <div className="size-7 flex items-center justify-center bg-primary/10 rounded-full transition-all duration-300">
            <CheckCircle className="size-4 text-primary" />
          </div>
        </div>
      );
    } else if (value === false) {
      return (
        <div className="flex items-center justify-center w-full">
          <div className="size-7 flex items-center justify-center rounded-full">
            <X className="size-4 text-muted-foreground/40" />
          </div>
        </div>
      );
    }
    return (
      <span className="text-sm px-3 py-0.5 rounded-full border border-border">
        {value}
      </span>
    );
  };

  // Column styles for plan tiers - more subtle approach to avoid hydration issues
  const getPlanHeaderClass = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'free':
        return 'text-foreground border-b-2 border-blue-500/70';
      case 'pro':
        return 'text-foreground border-b-2 border-purple-500/70';
      case 'enterprise':
        return 'text-foreground border-b-2 border-[#4EF9DB]/70';
      default:
        return '';
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="p-3 flex justify-between items-center border-b">
        <h3 className="text-base font-medium text-foreground">
          Plan Comparison
        </h3>

        {/* Legend for the table - simplified for minimalism */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="size-3.5 text-primary" />
            <span className="text-muted-foreground">Included</span>
          </div>
          <div className="flex items-center gap-1.5">
            <X className="size-3.5 text-muted-foreground/40" />
            <span className="text-muted-foreground">Not available</span>
          </div>
        </div>
      </div>

      <Table>
        <TableCaption className="text-muted-foreground">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%] font-medium text-foreground">
              {columns.feature}
            </TableHead>
            <TableHead
              className={cn(
                'w-[23%] font-medium',
                getPlanHeaderClass(columns.free),
              )}
            >
              <div className="text-center py-2">
                <p className="font-semibold">{columns.free}</p>
                <p className="text-xs text-muted-foreground">Get started</p>
              </div>
            </TableHead>
            <TableHead
              className={cn(
                'w-[23%] font-medium',
                getPlanHeaderClass(columns.pro),
              )}
            >
              <div className="text-center py-2">
                <p className="font-semibold">{columns.pro}</p>
                <p className="text-xs text-muted-foreground">Most popular</p>
              </div>
            </TableHead>
            <TableHead
              className={cn(
                'w-[24%] font-medium',
                getPlanHeaderClass(columns.enterprise),
              )}
            >
              <div className="text-center py-2">
                <p className="font-semibold">{columns.enterprise}</p>
                <p className="text-xs text-muted-foreground">Full power</p>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature, index) => (
            <TableRow
              key={index}
              className="transition-colors hover:bg-muted/50"
            >
              <TableCell className="font-medium border-r border-border/30 p-3">
                <div className="flex items-center whitespace-nowrap">
                  {feature.name}
                  {feature.tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline ml-1.5 size-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="w-[200px] text-sm">{feature.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex justify-center items-center">
                  {renderFeatureValue(feature.free)}
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex justify-center items-center">
                  {renderFeatureValue(feature.pro)}
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex justify-center items-center">
                  {renderFeatureValue(feature.enterprise)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
