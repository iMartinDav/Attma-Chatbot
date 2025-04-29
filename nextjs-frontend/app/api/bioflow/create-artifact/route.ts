import { NextResponse } from 'next/server';
import { document as documentSchema } from '@/lib/db/schema';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import type {
  AnalysisResultType,
  ParameterValue,
} from '@/lib/bioflow/artifact-mapper';
import {
  generateArtifactParams,
  createArtifactTitle,
} from '@/lib/bioflow/artifact-mapper';
import { auth } from '@/app/(auth)/auth';
// Import the database from queries.ts instead of a non-existent drizzle.ts file
import { db } from '@/lib/db/queries';

// Valid analysis result types as an array to check against
const VALID_ANALYSIS_TYPES = [
  'gene_expression',
  'clustering',
  'pathway_enrichment',
  'variant_analysis',
  'sequence_analysis',
  'dimensionality_reduction',
  'qc_metrics',
  'differential_expression',
  'single_cell',
] as const;

/**
 * API route to create an artifact from analysis results
 *
 * This endpoint takes analysis results from BioFlow and creates an appropriate
 * artifact based on the result type.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Parse request body
    const data = await request.json();
    const { resultType, resultData, metadata = {}, preferredArtifact } = data;

    if (!resultType || !resultData) {
      return NextResponse.json(
        { error: 'Missing required fields: resultType, resultData' },
        { status: 400 },
      );
    }

    // Validate result type
    if (!VALID_ANALYSIS_TYPES.includes(resultType as AnalysisResultType)) {
      return NextResponse.json(
        { error: 'Invalid result type' },
        { status: 400 },
      );
    }

    // Generate artifact parameters
    const artifactParams = generateArtifactParams(
      resultType as AnalysisResultType,
      resultData,
      metadata,
    );

    // Generate an appropriate title
    const title = createArtifactTitle(
      resultType as AnalysisResultType,
      metadata,
    );

    // Create the document with initial properties
    const [document] = await db
      .insert(documentSchema)
      .values({
        title,
        content: artifactParams.content,
        kind: artifactParams.kind,
        userId: session.user.id,
        createdAt: new Date(), // Add the required createdAt field
      })
      .returning();

    // Find the appropriate document handler
    const handler = documentHandlersByArtifactKind.find(
      (h) => h.kind === artifactParams.kind,
    );

    // If we have a handler and it supports post-processing, call it
    // Note: The handler interface doesn't include onPostCreate yet, so we'll comment this out until it's added
    /*
    if (handler && 'onPostCreate' in handler && typeof handler.onPostCreate === 'function') {
      try {
        await handler.onPostCreate({
          document,
          metadata: artifactParams.artifactMetadata,
          session,
        });
      } catch (error) {
        console.error('Error in onPostCreate:', error);
        // We don't fail the request if onPostCreate fails
      }
    }
    */

    // Return the document ID and metadata
    return NextResponse.json({
      documentId: document.id,
      artifactType: artifactParams.kind,
      title: document.title,
      status: 'created',
      metadata: artifactParams.artifactMetadata,
    });
  } catch (error) {
    console.error('Error creating artifact from analysis result:', error);
    return NextResponse.json(
      { error: 'Failed to create artifact' },
      { status: 500 },
    );
  }
}
