import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  // Clinical notes and pasted reports run long.
  text: z.string().min(1).max(20000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]),
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
  content: z.string().optional(),
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
  selectedAgentId: z.string().optional(),
  projectId: z.string().uuid().optional().nullable(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
