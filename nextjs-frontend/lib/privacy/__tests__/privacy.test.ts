/**
 * All people, numbers and records below are invented for these tests.
 */
import { detectPhi } from '../detect';
import { PrivacyLeakError, privacyMiddleware, runWithPrivacy } from '../guard';
import { restoreTokens } from '../tokens';
import { PrivacyVault } from '../vault';

const types = (text: string) =>
  detectPhi(text).map((s) => `${s.type}:${s.value}`);

describe('detectPhi finds identifiers', () => {
  it.each([
    ['Patient: Maria Lopez Garcia, 34 years', 'PERSON:Maria Lopez Garcia'],
    ['Patient Name: DOE, JOHN', 'PERSON:DOE, JOHN'],
    ['seen by Dr. Okafor today', 'PERSON:Okafor'],
    ['paciente Lucía Fernández con convulsiones', 'PERSON:Lucía Fernández'],
    ['MRN: 00849204', 'MRN:00849204'],
    ['NHC 7731205 ingresó ayer', 'MRN:7731205'],
    ['DOB 03/14/1987', 'DOB:03/14/1987'],
    ['fecha de nacimiento: 14 de marzo de 1987', 'DOB:14 de marzo de 1987'],
    ['admitted on 2026-02-11 for status epilepticus', 'DATE:2026-02-11'],
    ['a 93-year-old man with ataxia', 'AGE_90_PLUS:93'],
    ['call +34 612 345 678 tomorrow', 'PHONE:+34 612 345 678'],
    [
      'email ana.ruiz@hospital-example.org',
      'EMAIL:ana.ruiz@hospital-example.org',
    ],
    ['SSN 123-45-6789', 'NATIONAL_ID:123-45-6789'],
    ['DNI 12345678Z', 'NATIONAL_ID:12345678Z'],
    ['NHS number 943 476 5919', 'NATIONAL_ID:943 476 5919'],
    [
      'IBAN ES91 2100 0418 4502 0005 1332',
      'IBAN:ES91 2100 0418 4502 0005 1332',
    ],
    ['sample ID: PT-0042-B in the cohort', 'SAMPLE_ID:PT-0042-B'],
    ['member ID: XJH4471209', 'INSURANCE_ID:XJH4471209'],
    ['Address: 42 Calle Mayor, Madrid', 'ADDRESS:42 Calle Mayor, Madrid'],
    ['lives at 221 Baker Street now', 'ADDRESS:221 Baker Street'],
  ])('%s', (text, expected) => {
    expect(types(text)).toContain(expected);
  });

  it('finds sample columns in a VCF header but keeps public reference samples', () => {
    const vcf =
      '##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tFAM01-PROBAND\tNA12878\n';
    expect(types(vcf)).toEqual(['SAMPLE_ID:FAM01-PROBAND']);
  });
});

describe('detectPhi leaves research content alone', () => {
  it.each([
    'SCN1A p.Arg1648His (NM_001165963.4:c.4943G>A) in a child with febrile seizures',
    'rs121918623 at chr2:166848646 (GRCh38), CADD 28.6, gnomAD AF 0',
    'Compare NA12878 and HG002 from Genome in a Bottle',
    'Cluster PBMC 3k with scanpy 1.10.2 on python 3.10.12',
    'an 18-month-old with developmental delay and hypotonia',
    'HPO release 2026, Resnik similarity, top-5 63% on 200 cases',
    'Patient with SCN1A variant presents with seizures',
    'Name the gene: BRCA1',
    'TP53 R175H is a hotspot; see PMID 12345678',
  ])('%s', (text) => {
    expect(detectPhi(text)).toEqual([]);
  });
});

describe('PrivacyVault', () => {
  it('gives one token per value and links a later surname to the full name', () => {
    const vault = new PrivacyVault();
    const first = vault.mask('Patient: Maria Lopez, MRN 00849204.');
    const second = vault.mask('Lopez was readmitted; MRN 00849204 again.');
    expect(first).toBe('Patient: [[PERSON_1]], MRN [[MRN_1]].');
    expect(second).toBe('[[PERSON_1]] was readmitted; MRN [[MRN_1]] again.');
    expect(vault.leaks(`${first} ${second}`)).toEqual([]);
  });

  it('masks values it already knows even without detection (public tool results)', () => {
    const vault = new PrivacyVault();
    vault.mask('sample ID: PT-0042-B');
    expect(
      vault.mask('{"sample":"PT-0042-B","date":"2026-01-02"}', {
        detect: false,
      }),
    ).toBe('{"sample":"[[SAMPLE_ID_1]]","date":"2026-01-02"}');
  });

  it('restores values for display and for tools that run inside Attma', () => {
    const vault = new PrivacyVault();
    const masked = vault.mask('Patient: Maria Lopez');
    const map = new Map(vault.summary().entries.map((e) => [e.token, e.value]));
    expect(restoreTokens(`Report for ${masked.slice(9)}`, map)).toBe(
      'Report for Maria Lopez',
    );
    expect(vault.restoreDeep({ code: "df[df.id == '[[PERSON_1]]']" })).toEqual({
      code: "df[df.id == 'Maria Lopez']",
    });
  });
});

describe('privacyMiddleware', () => {
  const call = (prompt: unknown) =>
    privacyMiddleware.transformParams?.({
      type: 'generate',
      params: { prompt } as never,
      model: {} as never,
    });

  it('masks user text and tool results, and keeps one vault per request', async () => {
    const vault = new PrivacyVault();
    const result = (await runWithPrivacy(vault, () =>
      call([
        { role: 'system', content: 'You are Attma.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Patient: Maria Lopez, DOB 03/14/1987' },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 't1',
              toolName: 'runPython',
              output: {
                type: 'text',
                value: 'loaded sample ID: PT-0042-B for Maria Lopez',
              },
            },
          ],
        },
      ]),
    )) as { prompt: Array<{ content: unknown }> };
    const sent = JSON.stringify(result.prompt);
    expect(sent).not.toContain('Maria Lopez');
    expect(sent).not.toContain('1987');
    expect(sent).not.toContain('PT-0042-B');
    expect(sent).toContain('[[PERSON_1]]');
    expect(sent).toContain('You are Attma.');
    expect(vault.size).toBe(3);
  });

  it('does not scan public database results for new identifiers', async () => {
    const result = (await call([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 't2',
            toolName: 'searchPubMed',
            output: {
              type: 'json',
              value: { published: '2024-05-01', title: 'SCN1A' },
            },
          },
        ],
      },
    ])) as { prompt: unknown };
    expect(JSON.stringify(result.prompt)).toContain('2024-05-01');
  });

  it('fails closed when a protected value would still be sent', async () => {
    const vault = new PrivacyVault();
    vault.mask('Patient: Maria Lopez');
    // A file part's filename is not masked, so the outbound check must catch it.
    const sneaky = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'see attached' }],
        providerOptions: { note: { text: 'Maria Lopez' } },
      },
    ];
    await expect(
      runWithPrivacy(vault, () => call(sneaky)),
    ).resolves.toBeDefined();
    const leaking = [
      {
        role: 'assistant',
        content: [{ type: 'custom-thing', payload: 'Maria Lopez' }],
      },
    ];
    await expect(runWithPrivacy(vault, () => call(leaking))).rejects.toThrow(
      PrivacyLeakError,
    );
  });
});
