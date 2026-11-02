import { CONNECTOR_IDS, type ConnectorId } from '@/lib/ai/connectors/catalog';
import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  // Clinical notes and pasted reports run long.
  text: z.string().min(1).max(20000),
});

// Documents and images are read by Muse Spark; data files (VCF, CSV, h5ad,
// FASTA...) are analyzed in the Python workspace, so any type is accepted.
const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.string().min(1).max(120),
  // The client sends `filename`; `name` is accepted for older messages.
  filename: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

// AI SDK v5 compatible message format
const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(20000).optional(),
  parts: z.array(partSchema).optional(),
});

export const postRequestBodySchema = z.object({
  id: z
    .string()
    .refine(
      (val) => val === 'new' || z.string().uuid().safeParse(val).success,
      {
        message: "id must be 'new' or a valid UUID",
      },
    ),
  message: messageSchema,
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(['public', 'private']),
  /** Sources the agent may use; defaults to every source that needs no setup. */
  connectors: z
    .array(z.enum(CONNECTOR_IDS as [ConnectorId, ...ConnectorId[]]))
    .optional(),
  projectId: z.string().uuid().optional().nullable(),
  /** A person's decision on a report awaiting review; approve skips the model, changes reopens the gate. */
  review: z
    .object({
      decision: z.enum(['approve', 'changes']),
      notes: z.string().max(4000).optional(),
    })
    .optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
