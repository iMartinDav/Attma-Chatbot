/**
 * Example cases for the chat's rare-disease suggestions. The second and third
 * are written from published phenopacket-store cases (PMID 28503313 and
 * PMID 41757399), with causal variants from other patients mixed in as decoys,
 * exactly as in the benchmark. Their variants are in the VEP snapshot.
 */

export interface DemoCase {
  id: string;
  title: string;
  note: string;
  variants: string[];
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'dravet',
    title: 'Infant with fever-triggered seizures',
    note: `Undiagnosed patient: 18-month-old girl. First seizure at 6 months during a fever, then repeated prolonged febrile and afebrile seizures, some focal with hemiclonic jerks. Development normal until 12 months, now global developmental delay. Mild hypotonia, ataxic gait. No dysmorphic features, MRI normal.`,
    variants: [
      'ENSP00000501589.1:p.Arg1648His',
      'rs1801133',
      'NM_000546.6:c.215C>G',
      'rs121909102',
      '17-43045712-A-G',
    ],
  },
  {
    id: 'genital-anomalies',
    title: 'Boy with genital and toe anomalies',
    note: `Undiagnosed patient: boy with cryptorchidism, ambiguous genitalia, hypospadias, micropenis and bifid scrotum, small testes, 2-3 toe syndactyly, short nose, low-set ears and atopic dermatitis. Labs: low cholesterol, raised 7-dehydrocholesterol and 8-dehydrocholesterol. Testosterone normal.`,
    variants: [
      '11-71435478-T-C',
      '11-71437868-C-T',
      '15-67236719-TG-T',
      '11-17404525-G-A',
      '7-5527774-A-AG',
      '16-57659534-C-T',
      '10-111078198-C-T',
      '14-102923978-T-A',
    ],
  },
  {
    id: 'low-platelets',
    title: 'Boy with low platelets and infections',
    note: `Undiagnosed patient: boy with thrombocytopenia, recurrent sinusitis, otitis media and pneumonia, low IgA and IgE, low neutrophil and white cell counts, splenomegaly, hematochezia and iron deficiency anemia. Also diabetes with anti-GAD65 and anti-insulin antibodies. IgG and IgM normal.`,
    variants: [
      'X-48688391-T-C',
      '22-17182620-C-T',
      '11-130473683-C-G',
      '11-94799659-C-T',
      '11-116821862-G-C',
      '14-102922722-CA-C',
    ],
  },
];

/** The message a suggestion sends: the note followed by its candidate variants. */
export function demoPrompt(demo: DemoCase): string {
  return `${demo.note}\nExome candidate variants: ${demo.variants.join(', ')}`;
}
