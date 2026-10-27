import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/chat/app-sidebar';
import { DataStreamHandler } from '@/components/chat/data-stream-handler';
import { DataStreamProvider } from '@/components/chat/data-stream-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '../(auth)/auth';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <>
      <DataStreamProvider>
        <SidebarProvider defaultOpen={!isCollapsed}>
          <AppSidebar user={session?.user} />
          <SidebarInset>
            {children}
            <DataStreamHandler />
          </SidebarInset>
        </SidebarProvider>
      </DataStreamProvider>
    </>
  );
}
