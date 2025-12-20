// ===========================================================
// Auditoria - Logs de ações do sistema
// ===========================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, Button, Badge, Input, Select, Table, Spinner, Toast, Modal } from '@/components/admin/ui';
import { useToast, formatDateTime } from '@/components/admin/helpers';

interface AuditLog {
  id: string;
  action: string;
  source: string;
  actorId: string | null;
  actorEmail: string | null;
  actorIp: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  BOOKING_CREATED: 'Reserva Criada',
  BOOKING_CONFIRMED: 'Reserva Confirmada',
  BOOKING_CANCELLED: 'Reserva Cancelada',
  BOOKING_EXPIRED: 'Reserva Expirada',
  BOOKING_MANUAL_CREATED: 'Reserva Manual Criada',
  PAYMENT_RECEIVED: 'Pagamento Recebido',
  PAYMENT_FAILED: 'Pagamento Falhou',
  CREDIT_CREATED: 'Crédito Criado',
  CREDIT_USED: 'Crédito Usado',
  CREDIT_EXPIRED: 'Crédito Expirado',
  ADMIN_LOGIN: 'Login Admin',
  ADMIN_LOGOUT: 'Logout Admin',
  ADMIN_BOOKING_VIEW: 'Visualização Admin',
  ADMIN_BOOKING_UPDATE: 'Atualização Admin',
};

const actionColors: Record<string, 'gray' | 'green' | 'yellow' | 'red' | 'blue'> = {
  BOOKING_CREATED: 'green',
  BOOKING_CONFIRMED: 'green',
  BOOKING_CANCELLED: 'red',
  BOOKING_EXPIRED: 'red',
  BOOKING_MANUAL_CREATED: 'blue',
  PAYMENT_RECEIVED: 'green',
  PAYMENT_FAILED: 'red',
  CREDIT_CREATED: 'blue',
  CREDIT_USED: 'yellow',
  CREDIT_EXPIRED: 'red',
  ADMIN_LOGIN: 'gray',
  ADMIN_LOGOUT: 'gray',
  ADMIN_BOOKING_VIEW: 'gray',
  ADMIN_BOOKING_UPDATE: 'yellow',
};

const sourceLabels: Record<string, string> = {
  USER: 'Usuário',
  ADMIN: 'Admin',
  SYSTEM: 'Sistema',
};

export default function AuditoriaPage() {
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filtros
  const [filterAction, setFilterAction] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterTargetId, setFilterTargetId] = useState('');

  // Modal de detalhes
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
      });

      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterSource !== 'all') params.append('source', filterSource);
      if (filterEmail) params.append('actorEmail', filterEmail);
      if (filterTargetId) params.append('targetId', filterTargetId);

      const res = await fetch(`/api/admin/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } else {
        showToast('Erro ao carregar logs', 'error');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      showToast('Erro ao carregar logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterSource, filterEmail, filterTargetId, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Colunas
  const columns = [
    {
      key: 'createdAt',
      header: 'Data/Hora',
      render: (log: AuditLog) => (
        <span className="text-sm">{formatDateTime(log.createdAt)}</span>
      ),
    },
    {
      key: 'action',
      header: 'Ação',
      render: (log: AuditLog) => (
        <Badge variant={actionColors[log.action] || 'gray'}>
          {actionLabels[log.action] || log.action}
        </Badge>
      ),
    },
    {
      key: 'source',
      header: 'Origem',
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-600">
          {sourceLabels[log.source] || log.source}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Quem',
      render: (log: AuditLog) => (
        <span className="text-sm">
          {log.actorEmail || log.actorIp || 'Sistema'}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Alvo',
      render: (log: AuditLog) => (
        log.targetType ? (
          <span className="text-sm text-gray-600">
            {log.targetType} #{log.targetId?.slice(0, 8)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (log: AuditLog) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(log);
          }}
        >
          Detalhes
        </Button>
      ),
    },
  ];

  // Opções de ação para filtro
  const actionOptions = [
    { value: 'all', label: 'Todas' },
    ...Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
  ];

  return (
    <AdminLayout title="Auditoria">
      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <Select
                label="Ação"
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                options={actionOptions}
              />
            </div>
            <div className="w-32">
              <Select
                label="Origem"
                value={filterSource}
                onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
                options={[
                  { value: 'all', label: 'Todas' },
                  { value: 'USER', label: 'Usuário' },
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'SYSTEM', label: 'Sistema' },
                ]}
              />
            </div>
            <div className="w-48">
              <Input
                label="Email do ator"
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                placeholder="admin@..."
              />
            </div>
            <div className="w-32">
              <Input
                label="ID do alvo"
                value={filterTargetId}
                onChange={(e) => setFilterTargetId(e.target.value)}
                placeholder="cuid..."
              />
            </div>
            <Button variant="secondary" size="sm" onClick={fetchLogs} icon="🔄">
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <Table
                columns={columns}
                data={logs}
                keyExtractor={(log) => log.id}
                onRowClick={(log) => setSelectedLog(log)}
                emptyMessage="Nenhum log encontrado"
                emptyDescription="Tente ajustar os filtros de busca"
              />

              {/* Paginação */}
              {total > 50 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">
                    Mostrando {logs.length} de {total} registros
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page * 50 >= total}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      {selectedLog && (
        <Modal
          open={true}
          onClose={() => setSelectedLog(null)}
          title="Detalhes do Log"
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Data/Hora</p>
                <p className="font-medium">{formatDateTime(selectedLog.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ação</p>
                <Badge variant={actionColors[selectedLog.action] || 'gray'}>
                  {actionLabels[selectedLog.action] || selectedLog.action}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Origem</p>
                <p className="font-medium">{sourceLabels[selectedLog.source] || selectedLog.source}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ator</p>
                <p className="font-medium">{selectedLog.actorEmail || selectedLog.actorIp || 'Sistema'}</p>
              </div>
              {selectedLog.targetType && (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Tipo do Alvo</p>
                    <p className="font-medium">{selectedLog.targetType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ID do Alvo</p>
                    <p className="font-mono text-sm">{selectedLog.targetId}</p>
                  </div>
                </>
              )}
            </div>

            {selectedLog.targetId && selectedLog.targetType === 'Booking' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedLog(null);
                  router.push(`/admin/reservas?id=${selectedLog.targetId}`);
                }}
              >
                Ver Reserva →
              </Button>
            )}

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Metadados</p>
                <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-4">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast.visible && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
}
