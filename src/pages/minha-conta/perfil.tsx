// ===========================================================
// Página: /minha-conta/perfil - Perfil do Cliente
// ===========================================================
// Central de dados do usuário com:
// - Visualização e edição de dados pessoais
// - Seção de segurança (reset de senha)
// - Preferências (notificações por email)
// - Estatísticas da conta

import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Clock,
  AlertTriangle,
  ChevronLeft,
  Edit3,
  Save,
  X,
  Lock,
  Bell,
  Check,
  Loader2,
  Shield,
  ExternalLink
} from 'lucide-react';

// ===========================================================
// TIPOS
// ===========================================================

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  cpf: string | null;
  professionalRegister: string | null;
  emailNotifications: boolean;
  createdAt?: string;
}

interface CreditSummary {
  total: number;
  totalHours: number;
  byRoom: { roomId: string | null; roomName: string; amount: number; hours: number; tier: number | null }[];
}

interface Stats {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
}

interface FieldErrors {
  name?: string;
  phone?: string;
  cpf?: string;
  professionalRegister?: string;
}

// ===========================================================
// HELPERS
// ===========================================================

/**
 * Formata CPF: 12345678901 → 123.456.789-01
 */
function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata telefone: 11999998888 → (11) 99999-8888
 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formata valor em centavos para R$
 */
function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formata horas para exibição
 */
function formatHoursDisplay(hours: number): string {
  if (hours <= 0) return '0h';
  if (hours === 1) return '1 hora';
  if (Number.isInteger(hours)) return `${hours} horas`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Valida CPF usando algoritmo oficial
 */
function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;

  // Bloqueia sequências repetidas
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i);
  }
  let digit1 = (sum * 10) % 11;
  if (digit1 === 10) digit1 = 0;
  if (digit1 !== parseInt(cleanCPF[9])) return false;

  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i);
  }
  let digit2 = (sum * 10) % 11;
  if (digit2 === 10) digit2 = 0;
  if (digit2 !== parseInt(cleanCPF[10])) return false;

  return true;
}

/**
 * Valida telefone brasileiro
 */
function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return false;
  const ddd = parseInt(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

// ===========================================================
// COMPONENTE PRINCIPAL
// ===========================================================

export default function PerfilPage() {
  const router = useRouter();

  // ---- Estados de dados ----
  const [user, setUser] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ---- Estados de edição ----
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', cpf: '', professionalRegister: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ---- Estados de segurança ----
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  // ---- Fetch inicial ----
  const fetchProfile = useCallback(async () => {
    try {
      // Busca via API de perfil com JWT auth
      const profileRes = await fetch('/api/user/profile');

      if (profileRes.status === 401) {
        router.replace('/login');
        return;
      }

      if (!profileRes.ok) {
        throw new Error('Erro ao buscar perfil');
      }

      const profileData = await profileRes.json();

      if (!profileData.success) {
        throw new Error(profileData.error || 'Erro ao buscar perfil');
      }

      // Atualiza estados
      setUser(profileData.user);
      setCredits(profileData.credits);
      setStats(profileData.stats);

      // Preenche formulário de edição
      setEditForm({
        name: profileData.user.name || '',
        phone: formatPhone(profileData.user.phone || ''),
        cpf: formatCPF(profileData.user.cpf || ''),
        professionalRegister: profileData.user.professionalRegister || '',
      });

    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ---- Handlers de edição ----

  function handleEditClick() {
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: formatPhone(user.phone || ''),
        cpf: formatCPF(user.cpf || ''),
        professionalRegister: user.professionalRegister || '',
      });
      setFieldErrors({});
    }
    setIsEditing(true);
    setSaveSuccess(false);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setFieldErrors({});
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: formatPhone(user.phone || ''),
        cpf: formatCPF(user.cpf || ''),
        professionalRegister: user.professionalRegister || '',
      });
    }
  }

  function handleInputChange(field: keyof typeof editForm, value: string) {
    setEditForm(prev => ({ ...prev, [field]: value }));
    // Limpa erro do campo ao digitar
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSave() {
    // Validação local
    const errors: FieldErrors = {};

    if (!editForm.name || editForm.name.trim().length < 2) {
      errors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

    if (editForm.phone && !validatePhone(editForm.phone)) {
      errors.phone = 'Telefone inválido. Use o formato (XX) 9XXXX-XXXX';
    }

    if (editForm.cpf && !validateCPF(editForm.cpf)) {
      errors.cpf = 'CPF inválido';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.replace(/\D/g, '') || undefined,
          cpf: editForm.cpf.replace(/\D/g, '') || undefined,
          professionalRegister: editForm.professionalRegister.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        } else {
          throw new Error(data.error || 'Erro ao salvar');
        }
        return;
      }

      // Atualiza usuário local
      setUser(data.user);
      setIsEditing(false);
      setSaveSuccess(true);

      // Limpa mensagem de sucesso após 3s
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setFieldErrors({ name: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  // ---- Handler de reset de senha ----

  async function handleSendResetEmail() {
    if (!user?.email) return;

    setSendingReset(true);
    setResetError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      // A API sempre retorna 200 por segurança
      setResetSent(true);

    } catch (err) {
      console.error('Erro ao solicitar reset:', err);
      setResetError('Erro ao enviar email. Tente novamente.');
    } finally {
      setSendingReset(false);
    }
  }

  function closePasswordModal() {
    setShowPasswordModal(false);
    setResetSent(false);
    setResetError('');
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ---- Error state ----
  if (error || !user) {
    return (
      <>
        <Head>
          <title>Meu Perfil | Espaço Arthemi</title>
        </Head>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <Link href="/minha-conta">
                <span className="text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </span>
              </Link>
            </div>
          </header>
          <main className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-red-900">Não foi possível carregar seu perfil</h2>
                <p className="text-red-700 text-sm mt-1">
                  Verifique sua conexão e tente novamente.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  // ---- Main render ----
  return (
    <>
      <Head>
        <title>Meu Perfil | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/minha-conta">
              <span className="text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" />
                Voltar ao Dashboard
              </span>
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          {/* Título */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
            <p className="text-gray-500 mt-1">Gerencie suas informações pessoais e preferências</p>
          </div>

          {/* Mensagem de sucesso */}
          {saveSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">Perfil atualizado com sucesso!</span>
            </div>
          )}

          {/* ============================================= */}
          {/* SEÇÃO: Dados Pessoais */}
          {/* ============================================= */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Dados Pessoais</h2>
                  <p className="text-sm text-gray-500">Informações da sua conta</p>
                </div>
              </div>

              {/* Botão Editar/Cancelar */}
              {!isEditing ? (
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="text-sm font-medium">Editar</span>
                </button>
              ) : (
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm font-medium">Cancelar</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Nome</p>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        placeholder="Seu nome completo"
                      />
                      {fieldErrors.name && (
                        <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-gray-900">{user.name || 'Não informado'}</p>
                  )}
                </div>
              </div>

              {/* Email (não editável) */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="font-medium text-gray-900">{user.email}</p>
                  {isEditing && (
                    <p className="text-xs text-gray-400 mt-1">
                      O email não pode ser alterado
                    </p>
                  )}
                </div>
              </div>

              {/* Telefone */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Telefone</p>
                  {isEditing ? (
                    <div>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        placeholder="(11) 99999-9999"
                      />
                      {fieldErrors.phone && (
                        <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-gray-900">
                      {user.phone ? formatPhone(user.phone) : 'Não informado'}
                    </p>
                  )}
                </div>
              </div>

              {/* CPF */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">CPF</p>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={editForm.cpf}
                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${fieldErrors.cpf ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                      {fieldErrors.cpf && (
                        <p className="text-red-600 text-xs mt-1">{fieldErrors.cpf}</p>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-gray-900">
                      {user.cpf ? formatCPF(user.cpf) : 'Não informado'}
                    </p>
                  )}
                </div>
              </div>

              {/* Registro Profissional */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Registro Profissional</p>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={editForm.professionalRegister}
                        onChange={(e) => handleInputChange('professionalRegister', e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Ex: CRM-SP 123456"
                      />
                      <p className="text-xs text-gray-400 mt-1">Opcional. Ex: CRM, CRP, OAB...</p>
                    </div>
                  ) : (
                    <p className="font-medium text-gray-900">
                      {user.professionalRegister || 'Não informado'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Botão Salvar */}
            {isEditing && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar alterações</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* ============================================= */}
          {/* SEÇÃO: Segurança */}
          {/* ============================================= */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Segurança</h2>
                <p className="text-sm text-gray-500">Gerencie o acesso à sua conta</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Senha</p>
                  <p className="text-sm text-gray-500">Altere sua senha de acesso</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                Alterar senha
              </button>
            </div>
          </section>

          {/* ============================================= */}
          {/* SEÇÃO: Estatísticas */}
          {/* ============================================= */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo da Conta</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Horas disponíveis */}
              <Link href="/minha-conta" className="block">
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 text-primary-600 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm font-medium">Horas Disponíveis</span>
                  </div>
                  <p className="text-2xl font-bold text-primary-900">
                    {credits?.totalHours ? formatHoursDisplay(credits.totalHours) : '0h'}
                  </p>
                  <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
                    Ver detalhes <ExternalLink className="w-3 h-3" />
                  </p>
                </div>
              </Link>

              {/* Total de Reservas */}
              <Link href="/minha-conta/reservas" className="block">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-sm font-medium">Total de Reservas</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {stats?.totalBookings || 0}
                  </p>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    Ver histórico <ExternalLink className="w-3 h-3" />
                  </p>
                </div>
              </Link>

              {/* Próximas Reservas */}
              <Link href="/minha-conta/reservas" className="block">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm font-medium">Reservas Agendadas</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {stats?.upcomingBookings || 0}
                  </p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    Ver agenda <ExternalLink className="w-3 h-3" />
                  </p>
                </div>
              </Link>
            </div>
          </section>

          {/* Horas por Consultório */}
          {credits && credits.byRoom && credits.byRoom.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Horas por Consultório</h2>
              <div className="space-y-3">
                {credits.byRoom.map((room, index) => (
                  <div
                    key={room.roomId || index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium text-gray-900">{room.roomName}</span>
                    <div className="text-right">
                      <span className="text-primary-600 font-semibold">
                        {formatHoursDisplay(room.hours)}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({formatCurrency(room.amount)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ações */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/minha-conta/reservas"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Ver Minhas Reservas
              </Link>
              <Link
                href="/minha-conta"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                Comprar Créditos
              </Link>
            </div>
          </section>
        </main>
      </div>

      {/* ============================================= */}
      {/* MODAL: Reset de Senha */}
      {/* ============================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closePasswordModal}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <button
              onClick={closePasswordModal}
              aria-label="Fechar modal"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Alterar Senha</h3>
              <p className="text-sm text-gray-500 mt-2">
                Enviaremos um link para {user.email} para você criar uma nova senha.
              </p>
            </div>

            {resetSent ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium">Email enviado!</p>
                <p className="text-sm text-green-600 mt-1">
                  Verifique sua caixa de entrada e siga as instruções.
                </p>
                <button
                  onClick={closePasswordModal}
                  className="mt-4 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                {resetError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700">{resetError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closePasswordModal}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSendResetEmail}
                    disabled={sendingReset}
                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Enviar email</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
