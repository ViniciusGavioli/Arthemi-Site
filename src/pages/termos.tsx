// ===========================================================
// Página: Documentos Legais (Termos, Reembolso, Privacidade)
// ===========================================================

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { TERMS_OF_USE, REFUND_POLICY, PRIVACY_POLICY, LAST_UPDATE } from '@/data/legalContent';
import { FileText, CreditCard, Shield, ChevronLeft } from 'lucide-react';

type TabType = 'termos' | 'reembolso' | 'privacidade';

export default function LegalPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('termos');

  // Sync tab with URL query param
  useEffect(() => {
    if (router.isReady) {
      const { tab } = router.query;
      if (tab && ['termos', 'reembolso', 'privacidade'].includes(tab as string)) {
        setActiveTab(tab as TabType);
      }
    }
  }, [router.isReady, router.query]);

  // Update URL without reload when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push({
      pathname: '/termos',
      query: { tab },
    }, undefined, { shallow: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'reembolso': return REFUND_POLICY;
      case 'privacidade': return PRIVACY_POLICY;
      default: return TERMS_OF_USE;
    }
  };

  const currentContent = getTabContent();

  const tabs = [
    { id: 'termos', label: 'Termos de Uso', icon: FileText },
    { id: 'reembolso', label: 'Política de Reembolso', icon: CreditCard },
    { id: 'privacidade', label: 'Privacidade', icon: Shield },
  ] as const;

  return (
    <Layout>
      <Head>
        <title>Documentos Legais — Espaço Arthemi</title>
        <meta name="description" content="Termos de Uso, Política de Reembolso e Privacidade do Espaço Arthemi." />
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-warm-50 pb-20 pt-24 md:pt-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header Minimalista */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center text-accent-600 hover:text-accent-700 font-medium transition-colors mb-6 group">
              <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
              Voltar para o site
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-primary-900 mb-2">
              Documentos Legais
            </h1>
            <p className="text-secondary-500 text-sm">
              Última atualização: {LAST_UPDATE}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-warm-200 p-1.5 mb-8 flex flex-col sm:flex-row gap-1 sticky top-20 sm:top-24 z-30">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200
                    ${isActive
                      ? 'bg-accent-50 text-accent-700 shadow-sm ring-1 ring-accent-200'
                      : 'text-secondary-500 hover:bg-warm-50 hover:text-secondary-700'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-accent-600' : 'text-secondary-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6 md:p-10 animate-in fade-in duration-300">
            <div className="prose prose-lg max-w-none prose-headings:text-primary-900 prose-p:text-secondary-600 prose-li:text-secondary-600 prose-strong:text-primary-800 prose-a:text-accent-600 hover:prose-a:text-accent-700">

              {currentContent.map((section) => (
                <section key={section.id} className="mb-10 last:mb-0 border-b border-warm-100 last:border-0 pb-10 last:pb-0">
                  <h2 className="text-2xl font-bold mb-4">{section.title}</h2>
                  <div className="whitespace-pre-line leading-relaxed">
                    {/* Using a simple Markdown-like parser for strong and lists would be ideal, 
                        but for now we render text. If the content has Markdown syntax like **bold**, 
                        we should parse it or just render. 
                        Since I used Markdown syntax in data, I will use a simple formatter. */}
                    {section.content.split('\n').map((line, i) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <br key={i} className="my-2" />;

                      // List item
                      if (trimmed.startsWith('* ')) {
                        return (
                          <div key={i} className="flex gap-2 ml-4 mb-2">
                            <span className="text-accent-500 mt-1.5">•</span>
                            <span dangerouslySetInnerHTML={{
                              __html: trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }} />
                          </div>
                        );
                      }

                      // Normal paragraph with bold support
                      return (
                        <p key={i} className="mb-2" dangerouslySetInnerHTML={{
                          __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }} />
                      );
                    })}
                  </div>
                </section>
              ))}

            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center text-sm text-secondary-400">
            Precisa de ajuda? <a href={`https://wa.me/5531983050085`} target="_blank" className="text-accent-600 hover:underline">Fale conosco no WhatsApp</a>
          </div>

        </div>
      </main>
    </Layout>
  );
}
