import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GradientHeading } from '@/components/ui/gradient-heading';

// Define proper props interface to match what's being passed from the parent
interface FAQProps {
  dictionary: {
    title: string;
    questions: Record<
      string,
      {
        question: string;
        answer: string;
      }
    >;
  };
}

export function PricingFAQ({ dictionary }: FAQProps) {
  const faqItems = Object.values(dictionary.questions);

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex flex-col items-center space-y-4 text-center mb-12">
        <GradientHeading
          as="h2"
          gradient="scientific"
          className="text-2xl md:text-3xl font-bold tracking-tight"
        >
          {dictionary.title}
        </GradientHeading>
        <p className="max-w-[700px] text-muted-foreground">
          Find answers to common questions about our pricing plans.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {faqItems.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="border-b border-border"
          >
            <AccordionTrigger className="text-left py-4 text-base font-medium hover:text-primary-ink">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground pb-4 text-base leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
