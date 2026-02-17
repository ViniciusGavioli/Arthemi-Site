import { BUSINESS_INFO } from '@/constants/seo';

// Updated: 17 de Fevereiro de 2026
// Source: Official Documents + User Correction (48h rule, 20% fee, Concierge Model)

export const LAST_UPDATE = '17 de Fevereiro de 2026';

// Correct WhatsApp Number as per user request
const WHATSAPP_SUPPORT = '(31) 99992-3910';

export const TERMS_OF_USE = [
    {
        id: 'aceitacao',
        title: '1. Aceitação dos termos',
        content: `Ao utilizar o site e os serviços do **Espaço Arthemi**, você concorda com estes Termos de Uso. Se você não concordar com qualquer parte destes termos, por favor, não utilize nossos serviços.
    
    Estes termos constituem um acordo legal entre você e o Espaço Arthemi para a locação de consultórios por hora.`
    },
    {
        id: 'servico',
        title: '2. Descrição do serviço',
        content: `O Espaço Arthemi oferece locação de consultórios para profissionais de saúde realizarem atendimentos. O serviço inclui:
    
    *   Uso do consultório pelo período reservado
    *   Mobiliário básico (mesa, cadeiras, maca quando aplicável)
    *   Ar condicionado
    *   Wi-Fi
    *   Acesso às áreas comuns (recepção, banheiro, copa)
    
    **Não estão inclusos:** materiais de consumo, equipamentos especializados, secretária ou recepcionista exclusiva.`
    },
    {
        id: 'reservas',
        title: '3. Reservas e pagamento',
        content: `**3.1 Como reservar**
    As solicitações de reserva são iniciadas através do formulário disponível no site. Após o preenchimento, nossa equipe entrará em contato via WhatsApp para confirmar a disponibilidade do consultório desejado, realizar o agendamento e fornecer as instruções de pagamento. A reserva só é confirmada após a validação do pagamento pelo nosso atendimento.
    
    **3.2 Valores**
    Os valores praticados são informados no site e confirmados pelo atendimento. Os valores podem ser alterados a qualquer momento, mas reservas já confirmadas mantêm o valor pago.
    
    **3.3 Pagamento**
    O pagamento é realizado diretamente com nossa equipe de atendimento via WhatsApp (PIX ou link de pagamento). Não realizamos cobranças automáticas ou salvamento de dados bancários no site.`
    },
    {
        id: 'cancelamento',
        title: '4. Cancelamento e reembolso',
        content: `**4.1 Cancelamento pelo cliente**
    *   **Com mais de 48 horas de antecedência:** cancelamento permitido mediante solicitação via WhatsApp. Reembolso integral do valor pago.
    *   **Com menos de 48 horas de antecedência:** não é possível cancelar com reembolso. O valor pago não será devolvido.
    *   **Após o início da reserva:** não há reembolso.
    
    **4.2 Cancelamento pelo Espaço Arthemi**
    Em casos excepcionais (manutenção emergencial, força maior), podemos cancelar uma reserva. Neste caso, oferecemos reembolso integral ou reagendamento sem custo adicional.
    
    **4.3 Não comparecimento (no-show)**
    Se você não comparecer e não cancelar com antecedência (prazo de 48 horas), a reserva será considerada utilizada e não haverá reembolso.`
    },
    {
        id: 'uso',
        title: '5. Regras de uso dos consultórios',
        content: `**5.1 Horário**
    *   Chegue com alguns minutos de antecedência para se acomodar.
    *   Libere o consultório pontualmente ao fim do período reservado.
    *   Atrasos podem comprometer a próxima reserva.
    
    **5.2 Conservação**
    *   Mantenha o consultório limpo e organizado.
    *   Não fume nas dependências.
    *   Comunique imediatamente qualquer dano ou problema.
    *   Não remova ou altere a disposição do mobiliário sem autorização.
    
    **5.3 Comportamento**
    *   Respeite os demais profissionais e pacientes.
    *   Mantenha volume de voz adequado.
    *   Não realize atividades ilegais ou antiéticas.
    
    **5.4 Danos**
    O usuário é responsável por danos causados ao consultório ou equipamentos durante o período de sua reserva, devendo arcar com os custos de reparo ou reposição.`
    },
    {
        id: 'responsabilidades',
        title: '6. Responsabilidades e limitações',
        content: `**6.1 Responsabilidade do Espaço Arthemi**
    *   Fornecer o consultório reservado em condições adequadas de uso.
    *   Manter as instalações limpas e funcionais.
    *   Garantir acesso durante o horário reservado.
    
    **6.2 O que NÃO nos responsabilizamos**
    *   Objetos pessoais esquecidos ou furtados.
    *   Atendimentos realizados pelos profissionais (você é responsável por seus pacientes).
    *   Questões entre você e seus pacientes ou clientes.
    *   Interrupções por força maior (falta de energia, internet, etc.).
    *   Dados armazenados em equipamentos pessoais.
    
    **6.3 Responsabilidade profissional**
    Você é integralmente responsável por sua atuação profissional, incluindo registro em conselho, seguros, prontuários e sigilo de seus pacientes.`
    },
    {
        id: 'propriedade',
        title: '7. Propriedade intelectual',
        content: `Todo o conteúdo do site (textos, imagens, logotipos, design) é propriedade do Espaço Arthemi ou licenciado para nosso uso. É proibida a reprodução sem autorização prévia.`
    },
    {
        id: 'privacidade',
        title: '8. Privacidade',
        content: `O tratamento dos seus dados pessoais é regido pela nossa **Política de Privacidade**, que faz parte integrante destes Termos de Uso e pode ser consultada na aba específica desta página.`
    },
    {
        id: 'alteracoes',
        title: '9. Alterações nos termos',
        content: `Podemos atualizar estes Termos de Uso a qualquer momento. Alterações significativas serão comunicadas. O uso continuado dos serviços após alterações constitui aceitação dos novos termos.`
    },
    {
        id: 'foro',
        title: '10. Legislação e foro',
        content: `Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Belo Horizonte/MG para dirimir quaisquer controvérsias, com exclusão de qualquer outro, por mais privilegiado que seja.`
    },
    {
        id: 'contato',
        title: '11. Contato',
        content: `Se você tiver dúvidas sobre estes Termos de Uso, entre em contato:
    
    *   **WhatsApp Official:** ${WHATSAPP_SUPPORT}
    *   **E-mail:** ${BUSINESS_INFO.email}
    *   **Endereço:** ${BUSINESS_INFO.address.street} — ${BUSINESS_INFO.address.neighborhood}, ${BUSINESS_INFO.address.city}/${BUSINESS_INFO.address.stateCode}`
    }
];

export const REFUND_POLICY = [
    {
        id: 'cancelamento',
        title: '1. Cancelamento de Reservas',
        content: `Para garantir a melhor organização dos atendimentos e disponibilidade dos espaços, solicitamos que cancelamentos sejam realizados com no mínimo **48 horas de antecedência** do horário agendado.
    
    O pedido de cancelamento deve ser feito exclusivamente através do nosso WhatsApp de atendimento: **${WHATSAPP_SUPPORT}**.
    
    **Cancelamentos dentro do prazo (mais de 48h):**
    *   Elegíveis para reembolso integral do valor efetivamente pago.
    *   Processamento em até 5 dias úteis.
    
    **Cancelamentos fora do prazo (menos de 48h):**
    *   **Não elegíveis para reembolso.**
    *   O horário reservado ficará bloqueado para o profissional e não poderá ser realocado, gerando custo de oportunidade para o espaço.`
    },
    {
        id: 'reembolso',
        title: '2. Procedimento de Reembolso',
        content: `O valor do reembolso corresponde ao montante efetivamente pago no momento da reserva.
    
    **Formas de reembolso:**
    *   **Créditos para uso futuro:** Disponíveis imediatamente para novas reservas.
    *   **Estorno financeiro (PIX):** Realizado na mesma conta de origem do pagamento, em até 5 dias úteis após a aprovação da solicitação e envio do comprovante da transação original.
    
    **Importante:** É obrigatória a apresentação do comprovante da transação de pagamento para validação do estorno.`
    },
    {
        id: 'pacotes',
        title: '3. Reembolso de Pacotes de Horas',
        content: `Para o cancelamento e reembolso de Pacotes de Horas não utilizados ou parcialmente utilizados, aplicam-se as seguintes regras:
    
    *   **Cálculo do valor utilizado:** As horas já utilizadas serão descontadas do valor total do pacote com base no **preço da hora avulsa vigente** (sem o desconto promocional do pacote).
    *   **Taxa Administrativa:** Sobre o saldo restante a ser reembolsado, será aplicada uma **taxa administrativa de 20% (vinte por cento)** para cobrir custos operacionais e financeiros.
    *   **Prazo:** A solicitação deve ser feita dentro do prazo de validade do pacote.`
    },
    {
        id: 'cupons',
        title: '4. Cupons e Promoções',
        content: `Cupons promocionais são benefícios de uso único, válidos exclusivamente para a transação em que foram aplicados.
    
    **Regras:**
    *   Cupons promocionais NÃO são restaurados após cancelamento.
    *   O desconto obtido não é convertido em crédito ou reembolso.
    *   O reembolso será sempre sobre o valor líquido efetivamente pago pelo cliente.`
    }
];

export const PRIVACY_POLICY = [
    {
        id: 'intro',
        title: '1. Quem somos',
        content: `O **Espaço Arthemi** é um coworking de saúde localizado em Belo Horizonte, MG. Esta Política de Privacidade explica como coletamos, usamos e protegemos seus dados pessoais.`
    },
    {
        id: 'coleta',
        title: '2. Quais dados coletamos',
        content: `Coletamos apenas os dados estritamente necessários para iniciar o atendimento e direcionar sua solicitação para o WhatsApp:
    
    *   **Nome completo:** Para identificação.
    *   **Telefone (WhatsApp):** Para contato e prosseguimento da reserva.
    *   **Profissão:** Para adequação do espaço às suas necessidades.
    *   **Intenção:** (Tirar dúvidas ou Reservar).
    
    **Não coletamos dados sensíveis** ou financeiros através do formulário do site.`
    },
    {
        id: 'pagamento',
        title: '3. Dados de Pagamento',
        content: `**Não coletamos ou armazenamos dados de cartão de crédito ou bancários em nosso site.**
    
    Todo o processo de pagamento é realizado externamente durante o atendimento via WhatsApp, através de transações seguras (PIX ou Link de Pagamento). Os dados financeiros são processados diretamente pelas instituições financeiras envolvidas, sem trânsito ou armazenamento em nossos servidores.`
    },
    {
        id: 'finalidade',
        title: '4. Para que usamos seus dados',
        content: `Utilizamos seus dados para:
    *   Iniciar o atendimento via WhatsApp.
    *   Processar solicitações de reserva.
    *   Enviar confirmações de agendamento.
    *   Cumprir obrigações legais e fiscais.
    
    **Não vendemos ou compartilhamos seus dados com terceiros para fins de marketing.**`
    },
    {
        id: 'compartilhamento',
        title: '5. Compartilhamento de Dados',
        content: `Seus dados podem ser compartilhados apenas com prestadores de serviço essenciais para a operação (ex: sistema de agendamento, contabilidade) ou quando exigido por lei.`
    },
    {
        id: 'seguranca',
        title: '6. Segurança',
        content: `Adotamos medidas técnicas e administrativas adequadas para proteger seus dados pessoais contra acessos não autorizados e situações acidentais ou ilícitas.`
    },
    {
        id: 'direitos',
        title: '7. Seus direitos (LGPD)',
        content: `Você tem direito de confirmar a existência, acessar, corrigir e solicitar a exclusão de seus dados pessoais. Para exercer seus direitos, entre em contato pelo nosso canal oficial de atendimento.`
    },
    {
        id: 'contato',
        title: '8. Contato',
        content: `Dúvidas sobre privacidade podem ser tratadas através do nosso WhatsApp oficial: **${WHATSAPP_SUPPORT}** ou e-mail: **${BUSINESS_INFO.email}**.`
    }
];
