'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    id: 'what-is-Attma',
    question: 'What is Attmaand how does it work?',
    answer:
      'Attma is an AI-powered bioinformatics assistant that helps researchers analyze biological data, interpret results, and accelerate discoveries. It combines large language models with specialized algorithms trained on biological data to provide insights, analyze sequences, and assist with various bioinformatics tasks.',
  },
  {
    id: 'data-security',
    question: 'Is my research data secure?',
    answer:
      'Yes, we take data security very seriously. All data is encrypted both in transit and at rest. We follow industry best practices for security and compliance. Your research data and queries are not used to train our models unless you explicitly opt in to our improvement program.',
  },
  {
    id: 'data-types',
    question: 'What types of biological data can Attma analyze?',
    answer:
      "Attma can analyze a wide range of biological data, including DNA and RNA sequences, protein structures, gene expression data, phylogenetic trees, and more. It's designed to be adaptable to various bioinformatics workflows and data formats.",
  },
  {
    id: 'skills-needed',
    question: 'Do I need programming skills to use Attma?',
    answer:
      'No, Attma is designed to be accessible to researchers with all levels of computational experience. Its natural language interface allows you to ask questions and get insights without needing to write code. However, for advanced users, Attma can also generate code and scripts for custom analyses.',
  },
  {
    id: 'pricing',
    question: 'What pricing plans are available?',
    answer:
      'We offer several pricing tiers, including a free tier for basic usage, a professional tier for individual researchers, and team/enterprise plans for research groups and organizations. Visit our pricing page for detailed information on features and limits for each plan.',
  },
];

export const FAQ = () => {
  return (
    <section className="py-20">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="max-w-[700px] text-muted-foreground">
            Find answers to common questions about Attma and how it can help
            your research.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
