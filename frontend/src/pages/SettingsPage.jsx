import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOAuthStatus } from '../hooks/useData';
import ConnectedAccounts from '../components/ui/ConnectedAccounts';
import PageHeader from '../components/layout/PageHeader';

export default function SettingsPage({ clientId: propClientId }) {
  const { user }   = useAuth();
  const clientId   = propClientId || user?.client_id;
  const { status, refetch } = useOAuthStatus(clientId);
  const [searchParams, setSearchParams] = useSearchParams();
  const didRefetch = useRef(false);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if ((connected !== null || error !== null) && !didRefetch.current) {
      didRefetch.current = true;
      refetch();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, refetch, setSearchParams]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <PageHeader
        title="Connect Accounts"
        subtitle="Manage platform connections and refresh account status."
      />
      <ConnectedAccounts
        clientId={clientId}
        status={status}
        onRefresh={refetch}
      />
    </div>
  );
}
