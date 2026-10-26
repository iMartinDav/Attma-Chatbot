import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ArtifactKind } from '@/components/chat/artifact';
import {
    chat,
    document,
    type Message,
    message,
    project,
    type Project,
    type Suggestion,
    suggestion,
    user,
    type User,
    vote
} from './schema';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Analysis status options for bioinformatics documents
 */
export const AnalysisStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Unified document types to include bioinformatics data
 */
export const DocumentKind = {
  // Original document types
  TEXT: 'text',
  CODE: 'code',
  IMAGE: 'image',
  PDF: 'pdf',
  GRAPH: 'graph',
  // New bioinformatics types
  BIO_DATA: 'bio-data',
  BIO_ANALYSIS: 'bio-analysis',
  BIO_VISUALIZATION: 'bio-visualization',
};

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(
  email: string,
  password: string | null,
  name?: string,
  image?: string,
) {
  try {
    let hashedPassword = null;

    // Only hash the password if it exists
    if (password) {
      const salt = genSaltSync(10);
      hashedPassword = hashSync(password, salt);
    }

    // Insert user without name and image since they don't exist in the database
    const result = await db
      .insert(user)
      .values({
        email,
        password: hashedPassword,
        // Removed name and image fields
      })
      .returning({
        id: user.id,
        email: user.email,
        password: user.password,
        // Removed name and image fields from returning
      });

    // Return the created user or null
    return result.length > 0 ? result : null;
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility = 'private',
  projectId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility?: 'public' | 'private';
  projectId?: string | null;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      title,
      userId,
      visibility,
      projectId: projectId || null,
    });
  } catch (error) {
    console.error('Failed to save chat to database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    // Delete in correct order to respect foreign key constraints
    // 1. First delete votes (they reference both chat and messages)
    await db.delete(vote).where(eq(vote.chatId, id));

    // 2. Then delete messages (they reference chat)
    await db.delete(message).where(eq(message.chatId, id));

    // 3. Finally delete the chat itself
    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database:', error);
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    // Only insert if there are messages to save
    if (messages.length > 0) {
      return await db.insert(message).values(messages);
    }
    return null; // or handle as needed
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database');
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    interface MessageId {
      id: string;
    }
    const messageIds: string[] = (messagesToDelete as MessageId[]).map(
      (message: MessageId) => message.id,
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

// Add this function to link chats from one user ID to another
export async function linkUserChats(
  sourceUserId: string,
  targetUserId: string,
) {
  try {
    // Update chats to point to the target user ID
    // This assumes you're using SQL or an ORM with similar syntax
    // Adjust according to your actual database access method
    await db
      .update(chat)
      .set({ userId: targetUserId })
      .where(eq(chat.userId, sourceUserId));
    return true;
  } catch (error) {
    console.error('Error linking user chats:', error);
    return false;
  }
}

export async function saveBioAnalysisDocument({
  id,
  title,
  fileUrl,
  metadata,
  analysisStatus = AnalysisStatus.PENDING,
  userId,
}: {
  id: string;
  title: string;
  fileUrl: string;
  metadata: Record<string, unknown>;
  analysisStatus?: string;
  userId: string;
}) {
  try {
    // Store analysis metadata in the document content as JSON
    const content = JSON.stringify({
      fileUrl,
      metadata,
      analysisStatus,
      analysisStartedAt: new Date().toISOString(),
    });

    return await db.insert(document).values({
      // Only include 'id' if your schema allows manual id insertion
      ...(document.id ? { id } : {}),
      title,
      kind: 'text', // Use an allowed literal from your schema, or update schema to allow "bio-data"
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save bio analysis document in database', error);
    throw error;
  }
}

export async function updateBioAnalysisStatus({
  id,
  analysisStatus,
  results = null,
}: {
  id: string;
  analysisStatus: string;
  results?: Record<string, unknown> | null;
}) {
  try {
    // Get existing document to update its content
    const [existingDoc] = await db
      .select()
      .from(document)
      .where(eq(document.id, id));

    if (!existingDoc) {
      throw new Error(`Document with ID ${id} not found`);
    }

    // Parse existing content
    const content = JSON.parse(existingDoc.content || '{}');

    // Update status and optionally add results
    content.analysisStatus = analysisStatus;
    content.analysisCompletedAt = new Date().toISOString();

    if (results) {
      content.results = results;
    }

    // Update document with new content
    return await db
      .update(document)
      .set({
        content: JSON.stringify(content),
      })
      .where(eq(document.id, id));
  } catch (error) {
    console.error('Failed to update bio analysis status in database', error);
    throw error;
  }
}

// Stream ID management for resumable streams
export async function createStreamId({ streamId, chatId }: { streamId: string; chatId: string }) {
  // For now, this is a placeholder implementation
  // In a full implementation, you'd store stream IDs in a database table
  return { streamId, chatId, createdAt: new Date() };
}

// Message count for rate limiting
export async function getMessageCountByUserId({ 
  id, 
  differenceInHours = 24 
}: { 
  id: string; 
  differenceInHours?: number; 
}) {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, sql`now() - interval '${sql.raw(differenceInHours.toString())} hours'`)
        )
      );
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error('Failed to get message count by user ID', error);
    throw error;
  }
}

export async function getProjectsByUserId({ userId }: { userId: string }): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.createdAt));
  } catch (error) {
    console.error('Failed to get projects by user ID', error);
    throw error;
  }
}

export async function getProjectById({ id }: { id: string }): Promise<Project | null> {
  try {
    const [result] = await db.select().from(project).where(eq(project.id, id));
    return result || null;
  } catch (error) {
    console.error('Failed to get project by ID', error);
    throw error;
  }
}

export async function createProject({
  userId,
  name,
  description,
  emoji = '📁',
}: {
  userId: string;
  name: string;
  description?: string;
  emoji?: string;
}): Promise<Project> {
  try {
    const [result] = await db
      .insert(project)
      .values({
        userId,
        name,
        description,
        emoji,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  } catch (error) {
    console.error('Failed to create project', error);
    throw error;
  }
}

export async function updateProject({
  id,
  name,
  description,
  emoji,
}: {
  id: string;
  name?: string;
  description?: string;
  emoji?: string;
}): Promise<Project | null> {
  try {
    const updates: Partial<{ name: string; description: string; emoji: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (emoji !== undefined) updates.emoji = emoji;

    const [result] = await db
      .update(project)
      .set(updates)
      .where(eq(project.id, id))
      .returning();
    return result || null;
  } catch (error) {
    console.error('Failed to update project', error);
    throw error;
  }
}

export async function deleteProject({ id }: { id: string }): Promise<void> {
  try {
    await db.update(chat).set({ projectId: null }).where(eq(chat.projectId, id));
    await db.delete(project).where(eq(project.id, id));
  } catch (error) {
    console.error('Failed to delete project', error);
    throw error;
  }
}

export async function updateChatProject({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string | null;
}): Promise<void> {
  try {
    await db.update(chat).set({ projectId }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat project', error);
    throw error;
  }
}

export async function getChatsByProjectId({ projectId }: { projectId: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by project ID', error);
    throw error;
  }
}
