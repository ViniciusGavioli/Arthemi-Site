// ===========================================================
// Admin: /admin/status - Página de Status do Sistema
// ===========================================================

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { CONTINGENCY_FLAGS } from '@/lib/contingency';

// ============================================================
// TIPOS
// ============================================================

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  message?: string;
}

interface SystemStatus {
  timestamp: string;
  services: {
    database: ServiceStatus;
    payment: ServiceStatus;
    email: ServiceStatus;
    webhook: ServiceStatus;
  };
  contingencyFlags: Record<string, boolean>;
  metrics: Record<string, number>;
  lastErrors: Record<string, { message: string; errorCode?: string; timestamp: string }>;
  summary: {
    reservasHoje: number;
    reservasPendentes: number;
  };
}

// ============================================================
// COMPONENTES
// ============================================================

function StatusBadge({ status }: { status: ServiceStatus['status'] }) {
  const colors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    down: 'bg-red-100 text-red-800 border-red-200',
    unknown: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const labels = {
    healthy: '✓ Operacional',
    degraded: '⚠ Degradado',
    down: '✕ Indisponível',
    unknown: '? Desconhecido',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function ServiceCard({ name, service }: { name: string; service: ServiceStatus }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-l-gray-200" 
      style={{ 
        borderLeftColor: service.status === 'healthy' ? '#10b981' : 
                        service.status === 'degraded' ? '#f59e0b' : 
                        service.status === 'down' ? '#ef4444' : '#6b7280' 
      }}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-900">{name}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Última verificação: {new Date(service.lastCheck).toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <StatusBadge status={service.status} />
      </div>
      {service.message && (
        <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">
          {service.message}
        </p>
      )}
    </div>
  );
}

function FlagToggle({ 
  flagKey, 
  active, 
  onToggle, 
  loading 
}: { 
  flagKey: string; 
  active: boolean; 
  onToggle: () => void;
  loading: boolean;
}) {
  const config = CONTINGENCY_FLAGS[flagKey as keyof typeof CONTINGENCY_FLAGS];
  
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-medium text-gray-900 text-sm">{flagKey.replace(/_/g, ' ')}</p>
        <p className="text-xs text-gray-500">{config?.description || 'Sem descrição'}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={loading}
        aria-label={`${active ? 'Desativar' : 'Ativar'} ${flagKey.replace(/_/g, ' ')}`}
        title={`${active ? 'Desativar' : 'Ativar'} ${flagKey.replace(/_/g, ' ')}`}
        role="switch"
        aria-checked={active}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          active ? 'bg-red-600' : 'bg-gray-200'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            active ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function MetricCard({ name, value, icon }: { name: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center">
        <span className="text-2xl mr-3">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{name}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorLog({ category, error }: { category: string; error: { message: string; timestamp: string } }) {
  const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
  };

  return (
    <div className="bg-red-50 rounded p-3 border border-red-100">
      <div className="flex justify-between items-start">
        <span className="font-medium text-red-800 text-sm">{category}</span>
        <span className="text-xs text-red-600">{timeSince(error.timestamp)}</span>
      </div>
      <p className="text-sm text-red-700 mt-1">{error.message}</p>
    </div>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function AdminStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-status');
      if (!res.ok) throw new Error('Falha ao carregar status');
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleFlag = async (flag: string) => {
    if (!status) return;
    
    setToggling(flag);
    try {
      const newValue = !status.contingencyFlags[flag];
      
      const res = await fetch('/api/admin/system-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, active: newValue }),
      });

      if (!res.ok) throw new Error('Falha ao atualizar');

      // Atualizar estado local
      setStatus(prev => prev ? {
        ...prev,
        contingencyFlags: {
          ...prev.contingencyFlags,
          [flag]: newValue,
        }
      } : null);
    } catch (err) {
      alert('Erro ao atualizar flag');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Status do Sistema">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !status) {
    return (
      <AdminLayout title="Status do Sistema">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erro ao carregar status: {error}</p>
          <button 
            onClick={fetchStatus}
            className="mt-2 text-sm text-red-600 underline"
          >
            Tentar novamente
          </button>
        </div>
      </AdminLayout>
    );
  }

  const hasAnyError = Object.values(status.services).some(s => s.status !== 'healthy');
  const hasAnyFlagActive = Object.values(status.contingencyFlags).some(v => v);

  return (
    <AdminLayout title="Status do Sistema">
      <div className="space-y-6">
        {/* Header com status geral */}
        <div className={`rounded-lg p-4 ${
          hasAnyError ? 'bg-red-50 border border-red-200' : 
          hasAnyFlagActive ? 'bg-yellow-50 border border-yellow-200' : 
          'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-3xl mr-3">
                {hasAnyError ? '🔴' : hasAnyFlagActive ? '🟡' : '🟢'}
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  {hasAnyError ? 'Sistema com Problemas' : 
                   hasAnyFlagActive ? 'Sistema em Modo Contingência' : 
                   'Sistema Operacional'}
                </h2>
                <p className="text-sm text-gray-600">
                  Última atualização: {lastUpdate?.toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>
            <button
              onClick={fetchStatus}
              className="px-3 py-1 text-sm bg-white rounded border hover:bg-gray-50"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* Métricas de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard 
            name="Reservas Hoje" 
            value={status.summary.reservasHoje} 
            icon="📅" 
          />
          <MetricCard 
            name="Reservas Pendentes" 
            value={status.summary.reservasPendentes} 
            icon="⏳" 
          />
          <MetricCard 
            name="Pagamentos (7d)" 
            value={(status.metrics.payment_success || 0) + (status.metrics.payment_failure || 0)} 
            icon="💳" 
          />
          <MetricCard 
            name="Emails (7d)" 
            value={(status.metrics.email_sent || 0)} 
            icon="📧" 
          />
        </div>

        {/* Status dos Serviços */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Status dos Serviços</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ServiceCard name="🗄️ Banco de Dados" service={status.services.database} />
            <ServiceCard name="💳 Pagamentos (Asaas)" service={status.services.payment} />
            <ServiceCard name="📧 Email (Resend)" service={status.services.email} />
            <ServiceCard name="🔔 Webhooks" service={status.services.webhook} />
          </div>
        </div>

        {/* Flags de Contingência */}
        <div>
          <h3 className="text-lg font-semibold mb-3">⚡ Flags de Contingência</h3>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-2 rounded border border-yellow-100">
              ⚠️ <strong>Atenção:</strong> Ativar uma flag irá desabilitar a funcionalidade correspondente para todos os usuários.
            </p>
            <div className="space-y-1">
              {Object.entries(status.contingencyFlags).map(([key, active]) => (
                <FlagToggle
                  key={key}
                  flagKey={key}
                  active={active}
                  onToggle={() => toggleFlag(key)}
                  loading={toggling === key}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Últimos Erros */}
        {Object.keys(status.lastErrors).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">🚨 Últimos Erros</h3>
            <div className="space-y-2">
              {Object.entries(status.lastErrors).map(([category, error]) => (
                <ErrorLog key={category} category={category} error={error} />
              ))}
            </div>
          </div>
        )}

        {/* Métricas Detalhadas */}
        <div>
          <h3 className="text-lg font-semibold mb-3">📊 Métricas (Últimos 7 dias)</h3>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Métrica</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(status.metrics).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-center text-gray-500 text-sm">
                      Nenhuma métrica registrada ainda
                    </td>
                  </tr>
                ) : (
                  Object.entries(status.metrics).map(([name, value]) => (
                    <tr key={name}>
                      <td className="px-4 py-2 text-sm text-gray-900">{name.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right font-mono">{value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
