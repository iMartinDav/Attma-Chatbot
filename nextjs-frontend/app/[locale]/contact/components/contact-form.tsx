'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  ArrowRight,
  MessageSquare,
  Microscope,
  Clock,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { submitContactForm } from '@/app/[locale]/contact/actions/contact';
import { motion } from 'framer-motion';
import type { Locale } from '@/lib/internationalization/config';

interface ContactFormProps {
  dictionary: {
    title: string;
    subtitle: string;
    form: {
      firstName: string;
      lastName: string;
      email: string;
      company: string;
      researchArea: string;
      message: string;
      submit: string;
      policy: string;
    };
    benefits: {
      expertSupport: {
        title: string;
        description: string;
      };
      research: {
        title: string;
        description: string;
      };
      response: {
        title: string;
        description: string;
      };
      privacy: {
        title: string;
        description: string;
      };
    };
    researchAreas?: {
      genomics: string;
      proteomics: string;
      drugDiscovery: string;
      medicalImaging: string;
      clinicalTrials: string;
      other: string;
    };
    errors?: {
      general: string;
      required: string;
      invalidEmail: string;
      submission: string;
    };
    success: {
      title: string;
      message: string;
      button: string;
    };
  };
  locale: Locale;
}

export function ContactForm({ dictionary, locale }: ContactFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    message: '',
    researchArea: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();

  // Define research areas using translations if available
  const researchAreas = dictionary.researchAreas
    ? [
        { value: 'genomics', label: dictionary.researchAreas.genomics },
        { value: 'proteomics', label: dictionary.researchAreas.proteomics },
        {
          value: 'drug-discovery',
          label: dictionary.researchAreas.drugDiscovery,
        },
        {
          value: 'medical-imaging',
          label: dictionary.researchAreas.medicalImaging,
        },
        {
          value: 'clinical-trials',
          label: dictionary.researchAreas.clinicalTrials,
        },
        { value: 'other', label: dictionary.researchAreas.other },
      ]
    : [
        { value: 'genomics', label: 'Genomics' },
        { value: 'proteomics', label: 'Proteomics' },
        { value: 'drug-discovery', label: 'Drug Discovery' },
        { value: 'medical-imaging', label: 'Medical Imaging' },
        { value: 'clinical-trials', label: 'Clinical Trials' },
        { value: 'other', label: 'Other' },
      ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (value: string) => {
    setFormData({
      ...formData,
      researchArea: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Create FormData object for server action
    const formDataObj = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataObj.append(key, value);
    });

    try {
      const result = await submitContactForm(formDataObj);

      if (result && !result.success) {
        toast.error('Form Submission Error', {
          description:
            result.message ||
            dictionary.errors?.submission ||
            'Please check the form for errors',
        });
      } else {
        setShowSuccess(true);
      }
    } catch (error) {
      toast.error('Error', {
        description:
          dictionary.errors?.general ||
          'An unexpected error occurred. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-20 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto"
        >
          <div className="size-16 bg-[#25C6A3]/10 rounded-full flex items-center justify-center">
            <Check className="size-8 text-[#25C6A3]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {dictionary.success.title}
          </h1>
          <p className="text-lg text-muted-foreground">
            {dictionary.success.message}
          </p>
          <Button
            onClick={() => router.push(`/${locale}`)}
            className="mt-8 bg-[#25C6A3] hover:opacity-90 transition-opacity border-0 shadow-sm"
          >
            {dictionary.success.button} <ArrowRight className="ml-2 size-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  const benefits = [
    {
      icon: <MessageSquare className="size-5 text-[#25C6A3]" />,
      title: dictionary.benefits.expertSupport.title,
      description: dictionary.benefits.expertSupport.description,
    },
    {
      icon: <Microscope className="size-5 text-[#25C6A3]" />,
      title: dictionary.benefits.research.title,
      description: dictionary.benefits.research.description,
    },
    {
      icon: <Clock className="size-5 text-[#25C6A3]" />,
      title: dictionary.benefits.response.title,
      description: dictionary.benefits.response.description,
    },
    {
      icon: <Shield className="size-5 text-[#25C6A3]" />,
      title: dictionary.benefits.privacy.title,
      description: dictionary.benefits.privacy.description,
    },
  ];

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 md:py-20 lg:py-24 max-w-7xl">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {dictionary.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              {dictionary.subtitle}
            </p>
          </div>

          <div className="grid gap-6 mt-4">
            {benefits.map((benefit, index) => (
              <motion.div
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="mt-1 bg-[#25C6A3]/10 p-2 rounded-full">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="font-medium">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <form
            onSubmit={handleSubmit}
            className="space-y-6 border border-[#25C6A3]/20 rounded-lg p-6 bg-card shadow-sm hover:border-[#25C6A3]/30 transition-colors duration-200"
          >
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">{dictionary.form.firstName} *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{dictionary.form.lastName} *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{dictionary.form.email} *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">{dictionary.form.company}</Label>
              <Input
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="researchArea">
                {dictionary.form.researchArea}
              </Label>
              <Select
                value={formData.researchArea}
                onValueChange={handleSelectChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a research area" />
                </SelectTrigger>
                <SelectContent>
                  {researchAreas.map((area) => (
                    <SelectItem key={area.value} value={area.value}>
                      {area.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{dictionary.form.message} *</Label>
              <Textarea
                id="message"
                name="message"
                required
                rows={5}
                value={formData.message}
                onChange={handleChange}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#25C6A3] hover:opacity-90 transition-opacity border-0 shadow-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : dictionary.form.submit}
              <ArrowRight className="ml-2 size-4" />
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {dictionary.form.policy}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
