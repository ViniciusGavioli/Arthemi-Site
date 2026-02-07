// ===========================================================
// Cupons - Gerenciamento de cupons de desconto
// ===========================================================

import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, Button, Badge, Input, Select, Table, Spinner, Modal, Textarea } from '@/components/admin/ui';
import { useToast, formatDate, formatCurrency, formatDateTime } from '@/components/admin/helpers';
import { requireAdminSSR, AuthUser } from '@/lib/auth';

interface Coupon {
  id: string;
  code: string;
  discountType: 'fixed' | 'percent' | 'priceOverride';
  value: number;
  description: string;
  singleUsePerUser: boolean;
  isDevCoupon: boolean;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  minAmountCents: number | null;
  maxUses: number | null;
  currentUses: number;
  actualUses?: number;
  createdAt: string;
  updatedAt: string;
}

interface CouponFormData {
  code: string;
  discountType: 'fixed' | 'percent' | 'priceOverride';
  value: number;
  description: string;
  singleUsePerUser: boolean;
  isDevCoupon: boolean;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  minAmountCents: string;
  maxUses: string;
}

interface CuponsPageProps {
  user: AuthUser;
}

// Proteção SSR: Exige role ADMIN
export const getServerSideProps: GetServerSideProps<CuponsPageProps> = async (ctx) => {
  const result = requireAdminSSR(ctx);
  
  if ('redirect' in result) {
    return result;
  }

  return {
    props: {
      user: result.auth,
    },
  };
};

export default function CuponsPage({ user }: CuponsPageProps) {
  const { toast, showToast, hideToast } = useToast();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterDev, setFilterDev] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState<CouponFormData>({
    code: '',
    discountType: 'percent',
    value: 0,
    description: '',
    singleUsePerUser: false,
    isDevCoupon: false,
    isActive: true,
    validFrom: '',
    validUntil: '',
    minAmountCents: '',
    maxUses: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterActive !== 'all') params.append('isActive', filterActive);
      if (filterDev !== 'all') params.append('isDevCoupon', filterDev);

      const res = await fetch(`/api/admin/coupons?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.data?.coupons || []);
      } else {
        const error = await res.json();
        showToast(error.error || 'Erro ao carregar cupons', 'error');
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
      showToast('Erro ao carregar cupons', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterActive, filterDev, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCoupons();
    }, 300); // Debounce
    return () => clearTimeout(timer);
  }, [fetchCoupons]);

  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'percent',
      value: 0,
      description: '',
      singleUsePerUser: false,
      isDevCoupon: false,
      isActive: true,
      validFrom: '',
      validUntil: '',
      minAmountCents: '',
      maxUses: '',
    });
    setFormErrors({});
    setEditingCoupon(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    // Para edição: value sempre armazena em centavos (ou percentual direto)
    // No formulário, exibimos em reais para fixed/priceOverride
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value, // Já está em centavos (ou percentual se discountType === 'percent')
      description: coupon.description,
      singleUsePerUser: coupon.singleUsePerUser,
      isDevCoupon: coupon.isDevCoupon,
      isActive: coupon.isActive,
      validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString().slice(0, 16) : '',
      validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().slice(0, 16) : '',
      minAmountCents: coupon.minAmountCents ? (coupon.minAmountCents / 100).toString() : '',
      maxUses: coupon.maxUses?.toString() || '',
    });
    setFormErrors({});
    setEditingCoupon(coupon);
    setModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.code.trim()) {
      errors.code = 'Código é obrigatório';
    }

    if (!formData.description.trim()) {
      errors.description = 'Descrição é obrigatória';
    }

    if (formData.value < 0) {
      errors.value = 'Valor deve ser >= 0';
    }

    if (formData.discountType === 'percent' && (formData.value < 0 || formData.value > 100)) {
      errors.value = 'Percentual deve estar entre 0 e 100';
    }

    if (formData.validFrom && formData.validUntil) {
      const from = new Date(formData.validFrom);
      const until = new Date(formData.validUntil);
      if (from >= until) {
        errors.validUntil = 'Data de fim deve ser posterior à data de início';
      }
    }

    if (formData.minAmountCents && parseFloat(formData.minAmountCents) < 0) {
      errors.minAmountCents = 'Valor mínimo deve ser >= 0';
    }

    if (formData.maxUses && (parseInt(formData.maxUses) < 1 || isNaN(parseInt(formData.maxUses)))) {
      errors.maxUses = 'Número máximo de usos deve ser >= 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        value: formData.discountType === 'percent' 
          ? formData.value 
          : formData.value, // value já está em centavos (foi convertido no onChange)
        description: formData.description.trim(),
        singleUsePerUser: formData.singleUsePerUser,
        isDevCoupon: formData.isDevCoupon,
        isActive: formData.isActive,
      };

      // Adicionar campos opcionais
      if (formData.validFrom) {
        payload.validFrom = new Date(formData.validFrom).toISOString();
      }
      if (formData.validUntil) {
        payload.validUntil = new Date(formData.validUntil).toISOString();
      }
      if (formData.minAmountCents) {
        payload.minAmountCents = Math.round(parseFloat(formData.minAmountCents) * 100);
      }
      if (formData.maxUses) {
        payload.maxUses = parseInt(formData.maxUses);
      }

      const url = editingCoupon 
        ? `/api/admin/coupons/${editingCoupon.id}`
        : '/api/admin/coupons';
      
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(
          editingCoupon ? 'Cupom atualizado com sucesso!' : 'Cupom criado com sucesso!',
          'success'
        );
        setModalOpen(false);
        resetForm();
        fetchCoupons();
      } else {
        showToast(data.error || 'Erro ao salvar cupom', 'error');
      }
    } catch (error) {
      console.error('Error saving coupon:', error);
      showToast('Erro ao salvar cupom', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Tem certeza que deseja deletar o cupom "${coupon.code}"?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    setDeleting(coupon.id);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Cupom deletado com sucesso!', 'success');
        fetchCoupons();
      } else {
        showToast(data.error || 'Erro ao deletar cupom', 'error');
      }
    } catch (error) {
      console.error('Error deleting coupon:', error);
      showToast('Erro ao deletar cupom', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // Colunas da tabela
  const columns = [
    {
      key: 'code',
      header: 'Código',
      render: (c: Coupon) => (
        <div>
          <span className="font-bold text-primary-600">{c.code}</span>
          {c.isDevCoupon && (
            <Badge variant="purple" size="sm" className="ml-2">DEV</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Desconto',
      render: (c: Coupon) => {
        if (c.discountType === 'percent') {
          return <span className="font-medium">{c.value}%</span>;
        } else if (c.discountType === 'fixed') {
          return <span className="font-medium">{formatCurrency(c.value)}</span>;
        } else {
          return <span className="font-medium">Força {formatCurrency(c.value)}</span>;
        }
      },
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (c: Coupon) => (
        <span className="text-gray-600 text-sm">{c.description}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Coupon) => (
        <Badge variant={c.isActive ? 'green' : 'gray'}>
          {c.isActive ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'uses',
      header: 'Usos',
      render: (c: Coupon) => (
        <div>
          <span className="font-medium">{c.actualUses ?? c.currentUses}</span>
          {c.maxUses && (
            <span className="text-gray-500 text-sm"> / {c.maxUses}</span>
          )}
        </div>
      ),
    },
    {
      key: 'validity',
      header: 'Validade',
      render: (c: Coupon) => {
        if (!c.validFrom && !c.validUntil) {
          return <span className="text-gray-400">Sem limite</span>;
        }
        const from = c.validFrom ? formatDate(c.validFrom) : 'Sem início';
        const until = c.validUntil ? formatDate(c.validUntil) : 'Sem fim';
        return (
          <span className="text-sm text-gray-600">
            {from} até {until}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (c: Coupon) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openEditModal(c)}
            icon="✏️"
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(c)}
            loading={deleting === c.id}
            icon="🗑️"
          >
            Deletar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Cupons de Desconto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cupons de Desconto</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie cupons de desconto do sistema</p>
          </div>
          <Button onClick={openCreateModal} icon="➕">
            Novo Cupom
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                label="Buscar por código"
                placeholder="Ex: ARTHEMI10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                label="Status"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'true', label: 'Ativos' },
                  { value: 'false', label: 'Inativos' },
                ]}
              />
              <Select
                label="Tipo"
                value={filterDev}
                onChange={(e) => setFilterDev(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'true', label: 'Desenvolvimento' },
                  { value: 'false', label: 'Produção' },
                ]}
              />
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
              <Table 
                columns={columns} 
                data={coupons}
                keyExtractor={(c) => c.id}
                emptyMessage="Nenhum cupom encontrado"
                emptyDescription={search ? 'Tente buscar com outros termos' : 'Crie um novo cupom para começar'}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Criar/Editar */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código do Cupom *"
              placeholder="Ex: ARTHEMI10"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              error={formErrors.code}
              disabled={!!editingCoupon}
            />
            <Select
              label="Tipo de Desconto *"
              value={formData.discountType}
              onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'fixed' | 'percent' | 'priceOverride' })}
              options={[
                { value: 'percent', label: 'Percentual (%)' },
                { value: 'fixed', label: 'Valor Fixo (R$)' },
                { value: 'priceOverride', label: 'Forçar Preço (R$)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={formData.discountType === 'percent' ? 'Percentual (%) *' : 'Valor (R$) *'}
              type="number"
              step={formData.discountType === 'percent' ? '1' : '0.01'}
              min="0"
              max={formData.discountType === 'percent' ? '100' : undefined}
              value={formData.discountType === 'percent' 
                ? formData.value 
                : (formData.value / 100).toFixed(2)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setFormData({ 
                  ...formData, 
                  value: formData.discountType === 'percent' ? val : Math.round(val * 100) 
                });
              }}
              error={formErrors.value}
            />
            <Input
              label="Valor Mínimo (R$)"
              type="number"
              step="0.01"
              min="0"
              value={formData.minAmountCents || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, minAmountCents: val || '' });
              }}
              error={formErrors.minAmountCents}
            />
          </div>

          <Textarea
            label="Descrição *"
            placeholder="Descreva o cupom..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            error={formErrors.description}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data de Início"
              type="datetime-local"
              value={formData.validFrom}
              onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
            />
            <Input
              label="Data de Fim"
              type="datetime-local"
              value={formData.validUntil}
              onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
              error={formErrors.validUntil}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Máximo de Usos"
              type="number"
              min="1"
              value={formData.maxUses}
              onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
              error={formErrors.maxUses}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.singleUsePerUser}
                onChange={(e) => setFormData({ ...formData, singleUsePerUser: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Uso único por usuário</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isDevCoupon}
                onChange={(e) => setFormData({ ...formData, isDevCoupon: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Cupom de desenvolvimento</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Ativo</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editingCoupon ? 'Atualizar' : 'Criar'} Cupom
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
