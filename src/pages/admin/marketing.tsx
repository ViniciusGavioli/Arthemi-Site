// ===========================================================
// Página: /admin/marketing - Marketing & Integrações
// ===========================================================
// Gerenciar Meta Pixel, Google Analytics e Google Tag Manager

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface SettingData {
  value: string;
  isActive: boolean;
  description?: string;
}

interface Settings {
  META_PIXEL_ID?: SettingData;
  GA_MEASUREMENT_ID?: SettingData;
  GTM_ID?: SettingData;
}

export default function MarketingPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingPixel, setTestingPixel] = useState(false);

  // Carregar configurações
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings?category=marketing');
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar configurações' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Salvar configurações
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar' });
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  // Atualizar valor de uma configuração
  const updateSetting = (key: keyof Settings, field: 'value' | 'isActive', newValue: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: newValue,
      },
    }));
  };

  // Testar evento do Meta Pixel
  const handleTestPixel = async () => {
    setTestingPixel(true);
    try {
      // Simula disparo de evento (apenas em dev)
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'PageView');
        setMessage({ type: 'success', text: 'Evento PageView disparado! Verifique o Pixel Helper.' });
      } else {
        setMessage({ type: 'error', text: 'Meta Pixel não carregado. Em desenvolvimento, o pixel não é ativado.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao testar evento' });
    } finally {
      setTestingPixel(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Marketing & Integrações">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Marketing & Integrações">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">📈 Marketing & Integrações</h2>
          <p className="text-primary-100">
            Configure suas ferramentas de tracking e analytics. As alterações são aplicadas em tempo real.
          </p>
        </div>

        {/* Mensagem de feedback */}
        {message && (
          <div className={`p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Meta Pixel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white text-2xl">
                📘
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Meta Pixel</h3>
                <p className="text-sm text-gray-500">Facebook & Instagram Ads</p>
              </div>
              <div className="ml-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  settings.META_PIXEL_ID?.value && settings.META_PIXEL_ID?.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {settings.META_PIXEL_ID?.value && settings.META_PIXEL_ID?.isActive ? '✓ Conectado' : 'Não configurado'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pixel ID
              </label>
              <input
                type="text"
                placeholder="Ex: 1234567890123456"
                value={settings.META_PIXEL_ID?.value || ''}
                onChange={(e) => updateSetting('META_PIXEL_ID', 'value', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
              <p className="mt-1 text-xs text-gray-500">
                Encontre em: Meta Business Suite → Eventos → Configurações do Pixel
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.META_PIXEL_ID?.isActive || false}
                    onChange={(e) => updateSetting('META_PIXEL_ID', 'isActive', e.target.checked)}
                    className="sr-only peer"
                    aria-label="Ativar tracking do Meta Pixel"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
                <span className="text-sm text-gray-600">Ativar tracking</span>
              </div>

              <button
                onClick={handleTestPixel}
                disabled={testingPixel || !settings.META_PIXEL_ID?.value}
                className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingPixel ? 'Testando...' : '🧪 Testar Evento'}
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                ⚠️ <strong>Importante:</strong> O tracking só é ativado em produção. Em desenvolvimento, os eventos são logados no console.
              </p>
            </div>
          </div>
        </div>

        {/* Google Analytics 4 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white text-2xl">
                📊
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Google Analytics 4</h3>
                <p className="text-sm text-gray-500">Analytics e métricas do site</p>
              </div>
              <div className="ml-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  settings.GA_MEASUREMENT_ID?.value && settings.GA_MEASUREMENT_ID?.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {settings.GA_MEASUREMENT_ID?.value && settings.GA_MEASUREMENT_ID?.isActive ? '✓ Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Measurement ID
              </label>
              <input
                type="text"
                placeholder="Ex: G-XXXXXXXXXX"
                value={settings.GA_MEASUREMENT_ID?.value || ''}
                onChange={(e) => updateSetting('GA_MEASUREMENT_ID', 'value', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
              <p className="mt-1 text-xs text-gray-500">
                Encontre em: Google Analytics → Admin → Fluxos de dados → ID da medição
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.GA_MEASUREMENT_ID?.isActive || false}
                  onChange={(e) => updateSetting('GA_MEASUREMENT_ID', 'isActive', e.target.checked)}
                  className="sr-only peer"
                  aria-label="Ativar Google Analytics"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
              <span className="text-sm text-gray-600">Ativar analytics</span>
            </div>
          </div>
        </div>

        {/* Google Tag Manager */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-2xl">
                🏷️
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Google Tag Manager</h3>
                <p className="text-sm text-gray-500">Gerenciador de tags (opcional)</p>
              </div>
              <div className="ml-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  settings.GTM_ID?.value && settings.GTM_ID?.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {settings.GTM_ID?.value && settings.GTM_ID?.isActive ? '✓ Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Container ID
              </label>
              <input
                type="text"
                placeholder="Ex: GTM-XXXXXXX"
                value={settings.GTM_ID?.value || ''}
                onChange={(e) => updateSetting('GTM_ID', 'value', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use apenas se preferir gerenciar todos os scripts via GTM
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.GTM_ID?.isActive || false}
                  onChange={(e) => updateSetting('GTM_ID', 'isActive', e.target.checked)}
                  className="sr-only peer"
                  aria-label="Ativar Google Tag Manager"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
              <span className="text-sm text-gray-600">Ativar Tag Manager</span>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => fetchSettings()}
            className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Salvando...
              </span>
            ) : (
              '💾 Salvar Configurações'
            )}
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">ℹ️ Como funciona</h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• As configurações são salvas no banco de dados e aplicadas automaticamente</li>
            <li>• Não é necessário refazer o deploy para ativar ou desativar integrações</li>
            <li>• O tracking é ativado apenas em produção para não poluir os dados</li>
            <li>• Eventos de conversão (Lead, Purchase) são disparados automaticamente no fluxo de reserva</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
