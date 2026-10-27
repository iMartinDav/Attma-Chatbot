import { getDictionary } from '@/lib/internationalization/dictionaries';
import type { Locale } from '@/lib/internationalization/config';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatItem {
  id: string;
  number: string;
  label: string;
  description: string;
}
interface StatsClientProps {
  title: string;
  subtitle: string;
  items: StatItem[];
}

// Client component for rendering the stats UI
const StatsClient = ({ title, subtitle, items }: StatsClientProps) => {
  return (
    <section className="py-20">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center mb-12">
          <h2 className="text-3xl feature-title-gradient font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="max-w-[700px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((stat) => (
            <Card
              key={stat.id}
              className={cn(
                'flex flex-col items-center justify-center p-6 text-center bg-background border border-border',
                'hover:bg-accent/50 transition-colors duration-200',
              )}
            >
              <p className="text-4xl  feature-title-gradient font-bold text-primary-ink">
                {stat.number}
              </p>
              <h3 className="text-lg font-medium mt-2">{stat.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {stat.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

// Server component that fetches data and renders the client component
export async function Stats({ locale }: { locale: Locale }) {
  const dictionary = await getDictionary(locale);
  const stats = dictionary.home.stats;

  return (
    <StatsClient
      title={stats.title}
      subtitle={stats.subtitle}
      items={stats.items}
    />
  );
}

export default Stats;
