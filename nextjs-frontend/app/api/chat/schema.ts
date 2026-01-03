import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum(['image/jpeg', 'image/png']),
  name: z.string().min(1).max(100),
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
  id: z.string().refine((val) => val === 'new' || z.string().uuid().safeParse(val).success, {
    message: "id must be 'new' or a valid UUID"
  }),
  message: messageSchema,
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(['public', 'private']),
  selectedAgentId: z.string().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
