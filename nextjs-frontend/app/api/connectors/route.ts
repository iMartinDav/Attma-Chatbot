import { CONNECTORS } from '@/lib/ai/connectors/catalog';
import { NextResponse } from 'next/server';

/** Which sources this deployment can run, for the Sources menu. */
export function GET() {
  return NextResponse.json(
    CONNECTORS.map((connector) => ({
      id: connector.id,
      available:
        !connector.requires || Boolean(process.env[connector.requires]),
    })),
  );
}
