import { PRICES_V3 } from '@/constants/prices';
import { BUSINESS_INFO } from '@/constants/seo';

// Helper to get raw text for potential future use or simple rendering
export const LAST_UPDATE = '17 de Fevereiro de 2026';

export const TERMS_OF_USE = [
    {
        id: 'aceitacao',
        title: '1. Aceitação dos termos',
        content: `Ao utilizar o site e os serviços do **Espaço Arthemi**, você concorda com estes Termos de Uso. Se você não concordar com qualquer parte destes termos, por favor, não utilize nossos serviços. Estes termos constituem um acordo legal entre você e o Espaço Arthemi para a locação de consultórios por hora.`
    },
    {
        id: 'servico',
        title: '2. Descrição do serviço',
        content: `O Espaço Arthemi oferece locação de consultórios para profissionais de saúde realizarem atendimentos. O serviço inclui:
    
    *   Uso do consultório pelo período reservado
    *   Mobiliário básico (mesa, cadeiras, maca quando aplicável)
    *   Ar condicionado e Wi-Fi
    *   Acesso às áreas comuns (recepção, banheiro, copa)
    
    **Não estão inclusos:** materiais de consumo, equipamentos especializados, secretária ou recepcionista exclusiva.`
    },
    {
        id: 'reservas',
        title: '3. Solicitação de Reservas e Pagamento',
        content: `**3.1 Como reservar**
    As solicitações de reserva são iniciadas através do formulário disponível no site. Após o preenchimento, nossa equipe entrará em contato via WhatsApp para confirmar a disponibilidade do consultório desejado, realizar o agendamento e fornecer as instruções de pagamento. A reserva só é confirmada após a validação do pagamento pelo nosso atendimento.
    
    **3.2 Valores**
    Os valores para locação avulsa e pacotes são informados no site e confirmados pelo atendimento no momento da reserva. Os valores podem sofrer alterações sem aviso prévio, mas reservas já confirmadas e pagas terão seu valor preservado.
    
    **3.3 Pagamento**
    O pagamento é realizado diretamente com nossa equipe de atendimento via WhatsApp. Aceitamos pagamentos via PIX ou link de pagamento seguro. Não realizamos cobranças automáticas ou processamento de cartões diretamente através do site.`
    },
    {
        id: 'cancelamento',
        title: '4. Cancelamento e Reembolso',
        content: `Consulte a aba **Política de Reembolso** para detalhes completos sobre prazos, condições e procedimentos para cancelamento e estorno de valores.`
    },
    {
        id: 'regras',
        title: '5. Regras de uso dos consultórios',
        content: `**5.1 Horário**
    *   Chegue com alguns minutos de antecedência para se acomodar.
    *   Libere o consultório pontualmente ao fim do período reservado para não prejudicar o próximo profissional.
    
    **5.2 Conservação e Comportamento**
    *   Mantenha o consultório limpo e organizado.
    *   Não fume nas dependências.
    *   Respeite o silêncio e a privacidade dos demais profissionais e pacientes.
    *   Não remova ou altere a disposição do mobiliário sem autorização prévia.
    
    **5.3 Danos**
    O profissional é responsável por quaisquer danos causados ao consultório, mobiliário ou equipamentos durante o período de sua reserva, devendo arcar com os custos de reparo ou reposição.`
    },
    {
        id: 'responsabilidades',
        title: '6. Responsabilidades',
        content: `**6.1 Do Espaço Arthemi**
    Garantir o acesso ao consultório reservado em condições adequadas de uso, limpeza e funcionamento durante o horário contratado.
    
    **6.2 Do Profissional**
    Você é integralmente responsável por sua atuação profissional, incluindo registro em conselho de classe, prontuários, sigilo de pacientes e cumprimento das normas sanitárias. O Espaço Arthemi não se responsabiliza pelos atendimentos prestados pelos profissionais locatários aos seus pacientes.`
    },
    {
        id: 'propriedade',
        title: '7. Propriedade Intelectual',
        content: `Todo o conteúdo do site (textos, imagens, logotipos, design) é propriedade do Espaço Arthemi. É proibida a reprodução parcial ou total sem autorização expressa.`
    },
    {
        id: 'privacidade',
        title: '8. Privacidade',
        content: `O tratamento dos seus dados pessoais é regido pela nossa **Política de Privacidade**, disponível na aba correspondente nesta página.`
    },
    {
        id: 'alteracoes',
        title: '9. Alterações',
        content: `Podemos atualizar estes Termos de Uso a qualquer momento. Alterações significativas serão comunicadas. O uso continuado dos serviços após alterações constitui aceitação dos novos termos.`
    },
    {
        id: 'foro',
        title: '10. Legislação e Foro',
        content: `Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de Belo Horizonte/MG para dirimir quaisquer controvérsias.`
    },
    {
        id: 'contato',
        title: '11. Contato',
        content: `Em caso de dúvidas, entre em contato:
    
    *   **WhatsApp:** ${BUSINESS_INFO.phone}
    *   **E-mail:** ${BUSINESS_INFO.email}
    *   **Endereço:** ${BUSINESS_INFO.address.street} — ${BUSINESS_INFO.address.neighborhood}, ${BUSINESS_INFO.address.city}/${BUSINESS_INFO.address.stateCode}`
    }
];

export const REFUND_POLICY = [
    {
        id: 'intro',
        title: 'Política de Reembolso',
        content: `Esta política estabelece as condições para cancelamento de reservas e reembolso de valores pagos ao Espaço Arthemi, garantindo transparência em nossa relação comercial.`
    },
    {
        id: 'prazos',
        title: '1. Prazos para Cancelamento',
        content: `**1.1 Cancelamento com antecedência (mais de 2 horas)**
    Solicitações de cancelamento feitas com mais de 2 horas de antecedência ao horário agendado dão direito ao reembolso integral do valor pago ou crédito para reagendamento, sem custos adicionais.
    
    **1.2 Cancelamento de última hora (menos de 2 horas)**
    Cancelamentos solicitados com menos de 2 horas de antecedência não são elegíveis para reembolso, devido à reserva da sala e impossibilidade de realocação para outro profissional.
    
    **1.3 Não comparecimento (No-Show)**
    O não comparecimento no horário agendado, sem aviso prévio nos prazos estabelecidos, não dá direito a reembolso.`
    },
    {
        id: 'comprovante',
        title: '2. Procedimento de Reembolso',
        content: `Para solicitar um reembolso, entre em contato com nosso atendimento via WhatsApp.
    
    **Importante:** É obrigatória a apresentação do comprovante da transação de pagamento original para a validação e processamento do estorno. O reembolso será realizado preferencialmente via PIX, na mesma conta de origem do pagamento, em até 5 dias úteis após a aprovação da solicitação.`
    },
    {
        id: 'excecoes',
        title: '3. Casos Excepcionais',
        content: `Em casos de cancelamento por iniciativa do Espaço Arthemi (manutenção emergencial, falta de energia ou força maior), o valor será integralmente reembolsado ou, se preferir, a reserva será reagendada sem custo algum.`
    }
];

export const PRIVACY_POLICY = [
    {
        id: 'intro',
        title: 'Política de Privacidade',
        content: `O **Espaço Arthemi** respeita a sua privacidade. Esta política descreve como coletamos e utilizamos suas informações, limitando-nos ao estritamente necessário para o atendimento e prestação de serviço, conforme a Lei Geral de Proteção de Dados (LGPD).`
    },
    {
        id: 'coleta',
        title: '1. Dados que Coletamos',
        content: `Para viabilizar seu atendimento e solicitação de reserva, coletamos através do nosso formulário apenas os seguintes dados:
    
    *   **Nome completo:** Para identificação.
    *   **Telefone (WhatsApp):** Para contato, confirmação e envio de informações.
    *   **Profissão:** Para melhor adequação do atendimento às suas necessidades.
    *   **Intenção:** Se deseja tirar dúvidas ou solicitar uma reserva.
    
    **Atenção:** Não coletamos números de documentos (CPF/RG) ou endereço no formulário inicial. Estes dados podem ser solicitados pontualmente no WhatsApp apenas para emissão de Nota Fiscal, se necessário.`
    },
    {
        id: 'pagamento',
        title: '2. Dados de Pagamento',
        content: `**Não coletamos, armazenamos ou processamos dados financeiros (cartão de crédito, dados bancários) em nosso site.**
    
    Todo o processo de pagamento é realizado externamente durante o atendimento via WhatsApp, através de links seguros de pagamento ou transferência bancária (PIX). Nenhuma informação financeira sensível transita por nossos servidores.`
    },
    {
        id: 'finalidade',
        title: '3. Como Usamos seus Dados',
        content: `Utilizamos as informações coletadas exclusivamente para:
    
    *   Entrar em contato via WhatsApp para responder dúvidas.
    *   Processar sua solicitação de reserva de consultório.
    *   Confirmar agendamentos.
    *   Cumprir obrigações legais e fiscais (emissão de NF).
    
    Não compartilhamos seus dados com terceiros para fins de marketing.`
    },
    {
        id: 'seguranca',
        title: '4. Segurança',
        content: `Adotamos medidas de segurança técnicas e administrativas para proteger seus dados pessoais contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.`
    },
    {
        id: 'direitos',
        title: '5. Seus Direitos',
        content: `Você tem o direito de solicitar, a qualquer momento, o acesso, correção ou exclusão dos seus dados pessoais de nossa base de contatos. Para isso, basta enviar uma solicitação através do nosso canal de atendimento no WhatsApp ou E-mail.`
    }
];
