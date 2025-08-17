// Search route temporarily disabled during AI SDK v5 migration
// This route needs comprehensive migration from v4 to v5 patterns

export async function POST(request: Request) {
  return new Response('Search functionality temporarily disabled during AI SDK v5 migration', { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

export async function DELETE(request: Request) {
  return new Response('Search functionality temporarily disabled during AI SDK v5 migration', { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}
