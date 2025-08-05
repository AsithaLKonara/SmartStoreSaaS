import { IntegrationManager } from '@/components/integrations/IntegrationManager';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-gray-600 mt-2">
          Connect your SmartStore platform with external services and platforms
        </p>
      </div>

      <IntegrationManager organizationId={session.user.organizationId!} />
    </div>
  );
} 