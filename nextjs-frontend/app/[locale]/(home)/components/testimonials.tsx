'use client';

import React, { memo, useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/internationalization/config';
import { cn } from '@/lib/utils';

interface TestimonialItem {
  id: string;
  quote: string;
  name: string;
  title: string;
  avatar: string;
}

interface TestimonialsProps {
  dictionary: {
    title: string;
    subtitle: string;
    items?: Partial<TestimonialItem>[];
  };
  locale: Locale;
}

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    id: '1',
    quote:
      'Attma has completely transformed our research workflow. What used to take weeks now happens in minutes.',
    name: 'Dr. Sarah Johnson',
    title: 'Lead Researcher, Genomics Institute',
    avatar: '/images/researcher-1.png',
  },
  {
    id: '2',
    quote:
      "The pattern recognition capabilities are unmatched. We've discovered correlations in our data that we would have never found manually.",
    name: 'Prof. Michael Chen',
    title: 'Computational Biologist, Oxford University',
    avatar: '/images/researcher-2.png',
  },
  {
    id: '3',
    quote:
      "As someone with limited bioinformatics experience, Attma's natural language interface makes complex analysis accessible and intuitive.",
    name: 'Dr. Emily Rodriguez',
    title: 'Molecular Biologist, BioTech Labs',
    avatar: '/images/researcher-3.png',
  },
];

const TestimonialCard: React.FC<{
  item: TestimonialItem;
  delay: number;
  active?: boolean;
}> = memo(({ item, delay, active = true }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: active ? 1 : 0.7, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    className={cn('h-full', !active && 'scale-95 opacity-70')}
  >
    <Card className="h-full bg-background border border-border hover:border-primary/20 hover:shadow-md transition-all overflow-hidden">
      <CardContent className="p-6 space-y-6">
        <div className="flex justify-center">
          <div className="relative size-16 rounded-full overflow-hidden border-2 border-primary/10">
            <Image
              src={item.avatar}
              alt={`${item.name}'s profile`}
              fill
              sizes="64px"
              className="object-cover"
              priority
              quality={100}
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI/wNKGMFTZQAAAABJRU5ErkJggg=="
            />
          </div>
        </div>
        <blockquote className="text-foreground text-base font-light leading-relaxed text-center">
          {item.quote}
        </blockquote>
        <div className="text-center">
          <h4 className="font-semibold text-lg">{item.name}</h4>
          <p className="text-sm text-muted-foreground">{item.title}</p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
));
TestimonialCard.displayName = 'TestimonialCard';

export const Testimonials: React.FC<TestimonialsProps> = ({ dictionary }) => {
  const items = (
    dictionary.items?.length
      ? dictionary.items.map((item, i) => ({
          id: item.id || `${i}`,
          quote: item.quote || '',
          name: item.name || '',
          title: item.title || '',
          avatar: item.avatar || `/images/researcher-${(i % 3) + 1}.png`,
        }))
      : DEFAULT_TESTIMONIALS
  ) as TestimonialItem[];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const nextSlide = () =>
    setCurrentSlide((prev) => (prev === items.length - 1 ? 0 : prev + 1));
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev === 0 ? items.length - 1 : prev - 1));

  return (
    <section className="py-24 relative">
      {/* Subtle DNA-inspired background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
        <div
          className="absolute size-full bg-repeat opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M10,10 L50,50 M50,10 L10,50 M30,5 L30,55' stroke='%236366F1' stroke-width='0.5' fill='none'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="container mx-auto px-4 max-w-7xl relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-4 text-center mb-20"
        >
          <h2 className="text-3xl feature-title-gradient font-bold sm:text-4xl lg:text-5xl tracking-tight text-foreground">
            {dictionary.title}
          </h2>
          <p className="max-w-[700px] text-muted-foreground mx-auto text-lg">
            {dictionary.subtitle}
          </p>
        </motion.div>

        {isMobile ? (
          <div className="relative px-8">
            <TestimonialCard
              key={items[currentSlide].id}
              item={items[currentSlide]}
              delay={0}
              active
            />

            <div className="flex justify-center gap-2 mt-8">
              {items.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`size-2 rounded-full transition-all ${
                    i === currentSlide ? 'bg-primary w-6' : 'bg-muted'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm border border-border rounded-full p-2 shadow-md hover:bg-muted transition-all"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm border border-border rounded-full p-2 shadow-md hover:bg-muted transition-all"
              aria-label="Next testimonial"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {items.map((item, i) => (
              <TestimonialCard key={item.id} item={item} delay={i * 0.15} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
