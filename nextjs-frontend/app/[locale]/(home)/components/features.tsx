'use client';

import {
  Brain,
  Dna as DnaLucide, // Renamed to avoid conflict
  MessageSquare,
  LineChart as LineChartLucide, // Renamed to avoid conflict
  FileText,
  Lock,
} from 'lucide-react';
import {
  DnaIcon,
  MessageBubbleIcon,
  BarChartAnimatedIcon,
  DocumentAnalysisIcon,
  PatternRecognitionIcon,
  SecurityLockIcon,
} from '@/components/icons'; // Import custom icons
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/internationalization/config';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Define pattern types
type PatternType = 'dots' | 'lines' | 'circles' | 'grid' | 'waves';

// Create strong typing for feature items
interface FeatureItem {
  id: string;
  title: string;
  description: string;
  gradient?: string;
  pattern?: PatternType;
}

export interface FeaturesProps {
  dictionary: {
    title: string;
    subtitle: string;
    items?: FeatureItem[];
  };
  locale: Locale;
}

// Custom hook for responsive height management
const useResponsiveHeight = () => {
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    // Set initial height
    setViewportHeight(window.innerHeight);

    // Update height on resize
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewportHeight;
};

// We'll use our custom icons, but keep the Lucide ones for reference
const iconsByPosition = [
  DnaLucide,
  Brain,
  MessageSquare,
  LineChartLucide,
  FileText,
  Lock,
];

// Safari-compatible background patterns using rgba values instead of opacity
// to ensure consistent rendering across browsers
const backgroundPatterns = {
  dots: `radial-gradient(circle, rgba(96, 165, 250, 0.3) 1px, transparent 1px)`,
  lines: `repeating-linear-gradient(90deg, rgba(167, 139, 250, 0.3) 1px, transparent 1px, transparent 16px)`,
  circles: `repeating-radial-gradient(circle at center, transparent 0, transparent 10px, rgba(52, 211, 153, 0.3) 10px, rgba(52, 211, 153, 0.3) 11px, transparent 11px)`,
  grid: `repeating-linear-gradient(to right, rgba(96, 165, 250, 0.3) 1px, transparent 1px, transparent 20px),
         repeating-linear-gradient(to bottom, rgba(96, 165, 250, 0.3) 1px, transparent 1px, transparent 20px)`,
  waves: `repeating-radial-gradient(ellipse at center, transparent 0, transparent 10px, rgba(139, 92, 246, 0.3) 10px, rgba(139, 92, 246, 0.3) 11px, transparent 11px)`,
};

const defaultFeatures: FeatureItem[] = [
  {
    id: 'sequence-analysis',
    title: 'DNA Sequence Analysis',
    description:
      'Analyze DNA and RNA sequences with state-of-the-art AI algorithms designed specifically for genomic data.',
    pattern: 'waves',
  },
  {
    id: 'pattern-recognition',
    title: 'Smart Pattern Recognition',
    description:
      'Identify complex patterns in biological data and uncover hidden relationships that traditional methods might miss.',
    pattern: 'circles',
  },
  {
    id: 'nl-interface',
    title: 'Natural Language Interface',
    description:
      'Ask questions in plain English and get immediate, accurate answers to your research questions.',
    pattern: 'dots',
  },
  {
    id: 'data-viz',
    title: 'Data Visualization',
    description:
      'Generate insightful visualizations and reports from your complex genomic and proteomic data.',
    pattern: 'grid',
  },
  {
    id: 'literature-analysis',
    title: 'Literature Analysis',
    description:
      'Scan, summarize, and extract insights from thousands of research papers in seconds.',
    pattern: 'lines',
  },
  {
    id: 'security',
    title: 'Secure & Private',
    description:
      'Keep your research data private with enterprise-grade security measures.',
    pattern: 'waves',
  },
];

export const Features = ({ dictionary }: FeaturesProps) => {
  const featuresToRender = dictionary.items || defaultFeatures;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportHeight = useResponsiveHeight();

  // Add subtle background animation effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width;
      const y = (e.clientY - top) / height;

      const cards = container.querySelectorAll('.feature-card');
      cards.forEach((card) => {
        const cardEl = card as HTMLElement;
        const shiftX = x * 10 - 5; // -5px to 5px shift
        const shiftY = y * 10 - 5; // -5px to 5px shift
        cardEl.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative py-10 sm:py-16 overflow-visible">
      {/* Background with blue top-right accent and subtle purple bottom-left */}
      <div className="absolute inset-0 -z-10 overflow-visible">
        {/* Blue top-right gradient (more prominent) */}
        <div
          className="absolute top-[-10%] right-[5%] w-[70%] aspect-square"
          style={{
            background:
              'radial-gradient(circle, rgba(96,165,250,0.2) 0%, rgba(59,130,246,0.1) 50%, transparent 75%)',
            filter: 'blur(70px)',
            WebkitFilter: 'blur(70px)',
          }}
        />

        {/* Subtle purple bottom-left gradient */}
        <div
          className="absolute -bottom-1/4 left-[-15%] w-full aspect-square"
          style={{
            background:
              'radial-gradient(circle, rgba(167,139,250,0.08) 0%, rgba(167,139,250,0.05) 60%, transparent 80%)',
            filter: 'blur(100px)',
            WebkitFilter: 'blur(100px)',
          }}
        />
      </div>

      <div
        className="mx-auto max-w-2xl px-6 lg:max-w-7xl lg:px-8 relative z-10"
        ref={containerRef}
      >
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Safari-compatible subtitle with direct inline block */}
          <p className="mt-2 text-balance text-center text-4xl font-semibold tracking-tight sm:text-5xl">
            <span
              className="feature-subtitle-gradient"
              style={{
                display: 'inline-block',
                width: '100%',
              }}
            >
              {dictionary.subtitle || 'From Question to Reproducible Result'}
            </span>
          </p>
        </motion.div>

        {/* Feature cards grid with elevated z-index to ensure prominence */}
        <div className="grid gap-4 lg:grid-cols-4 lg:grid-rows-2 relative z-20">
          {/* DNA Sequence Analysis (Top-left, full height) */}
          <div className="relative lg:col-span-1 lg:row-span-2 lg:col-start-1 lg:row-start-1 order-first feature-card transition-all duration-300 ease-out">
            {/* Safari-compatible card background */}
            <div
              className="absolute inset-px rounded-xl lg:rounded-l-4xl"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(6,182,212,0.1), rgba(37,99,235,0.1))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-xl border lg:rounded-l-4xl"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                boxShadow:
                  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minHeight: `${Math.max(300, viewportHeight * 0.6)}px`, // Dynamic minimum height
              }}
            >
              <FeatureContent
                index={0}
                feature={featuresToRender[0]}
                Icon={iconsByPosition[0]}
                className="px-8 pb-3 pt-8 sm:px-10 sm:pb-0 sm:pt-10"
              />
              <div className="relative min-h-56 w-full grow">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to bottom right, rgb(6, 182, 212), rgb(37, 99, 235))',
                    opacity: 0.1,
                    isolation: 'isolate',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundPatterns.waves,
                    backgroundSize: '30px 30px',
                    backgroundPosition: 'center',
                    opacity: 0.1,
                  }}
                />
                {/* Replace SVG with our imported DnaIcon component */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <DnaIcon size={250} />
                </div>
              </div>
            </div>
          </div>

          {/* Natural Language Interface (Top-middle-left, single row) */}
          <div className="relative lg:col-start-2 feature-card transition-all duration-300 ease-out">
            <div
              className="absolute inset-px rounded-xl"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(139,92,246,0.1), rgba(168,85,247,0.1))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-xl border"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                boxShadow:
                  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minHeight: `${Math.max(200, viewportHeight * 0.3)}px`, // Dynamic minimum height
              }}
            >
              <FeatureContent
                index={2}
                feature={featuresToRender[2]}
                Icon={iconsByPosition[2]}
                className="px-8 pt-6 sm:px-10 sm:pt-8"
              />
              <div className="flex flex-1 items-center justify-center px-8 py-6 sm:px-10 relative">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundPatterns.dots,
                    backgroundSize: '16px 16px',
                    backgroundPosition: 'center',
                    opacity: 0.1,
                  }}
                />
                {/* Replace SVG with our imported MessageBubbleIcon component */}
                <MessageBubbleIcon size={80} />
              </div>
            </div>
          </div>

          {/* Data Visualization (Top-middle-right, single row) */}
          <div className="relative lg:col-start-3 feature-card transition-all duration-300 ease-out">
            <div
              className="absolute inset-px rounded-xl"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(99,102,241,0.1), rgba(59,130,246,0.1))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-xl border"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                boxShadow:
                  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minHeight: `${Math.max(200, viewportHeight * 0.3)}px`, // Dynamic minimum height
              }}
            >
              <FeatureContent
                index={3}
                feature={featuresToRender[3]}
                Icon={iconsByPosition[3]}
                className="px-8 pt-6 sm:px-10 sm:pt-8"
              />
              <div className="flex flex-1 items-end justify-center px-8 pb-6 pt-4 sm:px-10 relative">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundPatterns.grid,
                    backgroundSize: '20px 20px',
                    opacity: 0.1,
                  }}
                />
                {/* Replace animated bar chart with our imported BarChartAnimatedIcon component */}
                <BarChartAnimatedIcon size={120} />
              </div>
            </div>
          </div>

          {/* Literature Analysis (Middle-middle-left, single row) */}
          <div className="relative lg:row-start-2 lg:col-start-2 feature-card transition-all duration-300 ease-out">
            <div
              className="absolute inset-px rounded-xl"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(244,114,182,0.1), rgba(168,85,247,0.1))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-xl border"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                boxShadow:
                  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minHeight: `${Math.max(200, viewportHeight * 0.3)}px`, // Dynamic minimum height
              }}
            >
              <FeatureContent
                index={4}
                feature={featuresToRender[4]}
                Icon={iconsByPosition[4]}
                className="px-8 pt-6 sm:px-10 sm:pt-8"
              />
              <div className="flex flex-1 items-center justify-center px-8 py-6 sm:px-10 relative">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundPatterns.lines,
                    backgroundSize: '16px 16px',
                    opacity: 0.1,
                  }}
                />
                {/* Replace SVG with our imported DocumentAnalysisIcon component */}
                <DocumentAnalysisIcon size={80} />
              </div>
            </div>
          </div>

          {/* Smart Pattern Recognition (Middle-middle-right, single row) */}
          <div className="relative lg:row-start-2 lg:col-start-3 feature-card transition-all duration-300 ease-out">
            <div
              className="absolute inset-px rounded-xl"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(16,185,129,0.1), rgba(13,148,136,0.1))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-xl border"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                boxShadow:
                  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minHeight: `${Math.max(200, viewportHeight * 0.3)}px`, // Dynamic minimum height
              }}
            >
              <FeatureContent
                index={1}
                feature={featuresToRender[1]}
                Icon={iconsByPosition[1]}
                className="px-8 pt-6 sm:px-10 sm:pt-8"
              />
              <div className="flex flex-1 items-center justify-center px-8 pb-6 pt-4 sm:px-10 relative">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundPatterns.circles,
                    backgroundSize: '24px 24px',
                    opacity: 0.1,
                  }}
                />
                {/* Replace SVG with our imported PatternRecognitionIcon component */}
                <PatternRecognitionIcon size={80} />
              </div>
            </div>
          </div>

          {/* Secure & Private (Bottom-right, full height) */}
          <div className="relative lg:col-span-1 lg:row-span-2 lg:col-start-4 lg:row-start-1 feature-card transition-all duration-300 ease-out">
            <div
              className="absolute inset-px rounded-xl lg:rounded-r-4xl"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(139,92,246,0.1), rgba(79,70,229,0.1))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-xl border lg:rounded-r-4xl"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                boxShadow:
                  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minHeight: `${Math.max(300, viewportHeight * 0.6)}px`, // Dynamic minimum height
              }}
            >
              <FeatureContent
                index={5}
                feature={featuresToRender[5]}
                Icon={iconsByPosition[5]}
                className="px-8 pb-3 pt-8 sm:px-10 sm:pb-0 sm:pt-10"
              />
              <div className="relative min-h-56 w-full grow">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to bottom right, rgb(139, 92, 246), rgb(79, 70, 229))',
                    opacity: 0.1,
                    isolation: 'isolate',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundPatterns.waves,
                    backgroundSize: '24px 24px',
                    opacity: 0.1,
                  }}
                />
                {/* Replace SVG with our imported SecurityLockIcon component */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <SecurityLockIcon size={250} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer to eliminate bottom gap */}
        <div className="h-4 sm:h-8 w-full" />
      </div>
    </section>
  );
};

const FeatureContent = ({
  feature,
  Icon,
  className,
  index,
}: {
  index: number;
  feature: FeatureItem;
  Icon: any;
  className?: string;
}) => {
  return (
    <motion.div
      className={cn(
        className,
        'flex flex-col items-center lg:items-start z-10',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      {/* Safari-optimized icon container */}
      <div
        className="size-10 rounded-lg flex items-center justify-center"
        style={{
          background:
            'linear-gradient(to bottom right, rgba(6,182,212,0.2), rgba(79,70,229,0.2))',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        }}
      >
        <Icon className="size-5" style={{ color: 'rgb(6, 182, 212)' }} />
      </div>

      {/* Safari-compatible gradient text with direct inline style */}
      <h3 className="mt-3 text-lg font-medium tracking-tight">
        <span
          className="feature-title-gradient"
          style={{
            display: 'inline-block',
            width: '100%',
          }}
        >
          {feature.title}
        </span>
      </h3>
      <p className="feature-description">{feature.description}</p>
    </motion.div>
  );
};

export default Features;
