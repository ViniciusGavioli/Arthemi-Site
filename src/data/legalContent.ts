import { BUSINESS_INFO } from '@/constants/seo';

// Updated: 18 de Fevereiro de 2026
// Source: Official Document — Política de Reembolso Arthemi Coworking de Saúde

export const LAST_UPDATE = '18 de Fevereiro de 2026';

// Correct WhatsApp Number as per user request
const WHATSAPP_SUPPORT = '(31) 99992-3910';

export const TERMS_OF_USE = [
    {
        id: 'aceitacao',
        title: '1. Aceitação dos Termos',
        content: `Ao utilizar os serviços do **Arthemi Coworking**, o usuário declara que leu, compreendeu e concorda integralmente com os presentes Termos de Uso.

Caso não concorde, total ou parcialmente, com quaisquer disposições aqui previstas, o usuário deverá abster-se de utilizar o site e os serviços oferecidos.

Estes Termos constituem acordo legal vinculante entre o usuário e o Arthemi Coworking, regulando a utilização da plataforma e a cessão onerosa de uso de consultórios por período determinado.`
    },
    {
        id: 'descricao-servicos',
        title: '2. Descrição dos Serviços',
        content: `O Arthemi Coworking disponibiliza consultórios compartilhados para uso de profissionais da saúde, exclusivamente para consultas e pequenos procedimentos ambulatoriais compatíveis com ambiente não estéril.

**2.1. Estão incluídos nos serviços:**
* Uso do consultório pelo período reservado
* Recepcionista do espaço para acolhimento de pacientes e comunicação de chegada ao profissional
* Ambiente limpo e organizado
* Internet de alta velocidade
* Ar-condicionado
* Mobiliário básico (mesa, cadeiras e maca, quando aplicável)
* Balança
* Insumos básicos (álcool 70%, sabonete líquido, papel toalha, lençol descartável)
* Impressora Wi-Fi disponível na recepção
* Café e água
* Acesso às áreas comuns (recepção, banheiro e copa)

**2.2. Não estão incluídos:**
* Serviço de secretária pessoal
* Confirmação de consultas ou contato com pacientes em nome do profissional
* Recebimento de valores de pacientes
* Equipamentos especializados ou insumos específicos além dos descritos
* Serviços administrativos individualizados`
    },
    {
        id: 'cadastro-reservas',
        title: '3. Cadastro e Reservas',
        content: `**3.1.** As reservas poderão ser realizadas por meio de link de agendamento que será disponibilizado pela equipe do Arthemi Coworking, exclusivamente por meio do número oficial **${WHATSAPP_SUPPORT}**.

**3.2.** O pagamento dos valores acordados e o agendamento realizado pelo link disponibilizado caracterizam aceite contratual integral dos presentes Termos de Uso e confirmação da reserva.

**3.3.** A reserva somente será considerada confirmada após a compensação do pagamento realizado na plataforma.

**3.4.** Em caso de cancelamento do pagamento, solicitação de estorno ou não compensação da transação, o agendamento realizado será automaticamente considerado cancelado, independentemente de aviso prévio.

**3.5.** O usuário é responsável pela veracidade das informações repassadas no momento do agendamento, estando ciente de que a prestação de informações falsas pode configurar ilícito civil e criminal nos termos da legislação vigente.`
    },
    {
        id: 'valores-comerciais',
        title: '4. Valores e Condições Comerciais',
        content: `**4.1.** Os valores praticados não constam nestes Termos de Uso, podendo sofrer alterações a qualquer tempo.

**4.2.** Os preços vigentes, modalidades de uso, pacotes e condições comerciais aplicáveis estarão sempre disponíveis na seção "Consultórios e Investimentos" do site, sendo aqueles os únicos valores válidos no momento da contratação.

**4.3.** As horas adquiridas, seja em modalidade avulsa ou em pacotes promocionais, possuem validade de **6 (seis) meses**, contados da data da confirmação do pagamento. Decorrido o prazo de validade sem utilização integral das horas, estas serão automaticamente expiradas, não gerando direito a reembolso, conversão em crédito ou compensação futura.

**4.4.** O prazo poderá ser prorrogado uma única vez, por igual período, mediante solicitação formal e por escrito do usuário em até trinta dias da expiração, podendo o pedido ser deferido a critério exclusivo do Arthemi Coworking.`
    },
    {
        id: 'pagamentos',
        title: '5. Pagamentos',
        content: `**5.1.** Os pagamentos deverão ser realizados exclusivamente por meio de PIX ou link de pagamento enviado pelo número oficial **${WHATSAPP_SUPPORT}**. O Arthemi Coworking não realiza contato por outros números para envio de cobranças ou links de pagamento.

**5.2.** Os pagamentos destinados à reserva e utilização dos consultórios deverão ser realizados exclusivamente pelos meios de pagamento online indicados pelo Arthemi Coworking. Funcionários e colaboradores **não estão autorizados a receber valores referentes a reservas ou pacotes de horas**, sendo admitido o recebimento apenas em relação a produtos, itens de conveniência ou amenities eventualmente disponibilizados no espaço.`
    },
    {
        id: 'cancelamento-reagendamento',
        title: '6. Cancelamento, Reagendamento e Reembolso',
        content: `**6.1.** Cancelamentos ou solicitações de reagendamento realizados com antecedência mínima de **24 (vinte e quatro) horas** em relação ao horário reservado permitem o reagendamento sem perda das horas contratadas, observadas as condições de validade previstas na Cláusula 4 destes Termos.

**6.2.** Cancelamentos ou solicitações de reagendamento realizados com **menos de 24 (vinte e quatro) horas** de antecedência, bem como o não comparecimento (no-show), implicam o débito da hora reservada, não gerando direito a crédito, reposição ou compensação.

**6.3.** As solicitações deverão ser realizadas exclusivamente pelo WhatsApp oficial ou pelo sistema de agendamento disponibilizado.

**6.4.** As condições específicas relativas à restituição de valores, recálculo de horas utilizadas, aplicação de taxa administrativa, exercício do direito de arrependimento e demais critérios financeiros encontram-se disciplinadas na **Política de Reembolso vigente**, que integra o conjunto normativo aplicável à contratação e deve ser interpretada de forma complementar a estes Termos.`
    },
    {
        id: 'horarios-uso',
        title: '7. Horários e Uso do Consultório',
        content: `**7.1.** As reservas são realizadas por hora cheia.

**7.2.** O consultório deverá ser liberado obrigatoriamente **10 (dez) minutos** antes do término do horário reservado, a fim de possibilitar a organização, limpeza e preparação do ambiente para o próximo profissional.

**7.3.** O descumprimento do horário de liberação acarretará multa no valor de **R$ 50,00 (cinquenta reais) a cada 5 (cinco) minutos de atraso**.

**7.4.** A política rigorosa de controle de horários existe para assegurar o respeito aos demais profissionais, aos pacientes e à responsabilidade assumida pelo Arthemi Coworking na gestão do consultório compartilhado.`
    },
    {
        id: 'limitacoes-uso',
        title: '8. Limitações de Uso e Procedimentos Vedados',
        content: `**8.1.** Os consultórios destinam-se exclusivamente à realização de consultas e pequenos procedimentos ambulatoriais compatíveis com ambiente não estéril.

**8.2.** É expressamente vedada:
* A realização de procedimentos invasivos que exijam esterilidade
* A aplicação de injetáveis
* A realização de procedimentos sob sedação
* Qualquer atividade incompatível com a estrutura oferecida

O descumprimento poderá ensejar suspensão imediata do uso, sem prejuízo de outras medidas cabíveis.`
    },
    {
        id: 'recepcao-pagamentos',
        title: '9. Recepção e Pagamentos de Pacientes',
        content: `A recepcionista do Arthemi Coworking **não está autorizada** a receber pagamentos de pacientes, realizar cobranças ou intermediar transações financeiras.

Todas as relações financeiras entre o profissional e seus pacientes são de responsabilidade exclusiva do profissional.`
    },
    {
        id: 'responsabilidades',
        title: '10. Responsabilidades',
        content: `**10.1.** O usuário é integralmente responsável por sua atuação profissional, incluindo:
* Regularidade junto ao conselho de classe
* Prontuários, sigilo e consentimentos
* Condutas adotadas nos atendimentos
* Relação com seus pacientes

**10.2.** O Arthemi Coworking não se responsabiliza por:
* Atendimentos realizados pelos profissionais, inclusive descumprimento de obrigações éticas, sanitárias ou regulatórias pelo profissional usuário do espaço;
* Objetos pessoais esquecidos ou extraviados;
* Interrupções por caso fortuito ou força maior;
* Dados armazenados em equipamentos pessoais do usuário.`
    },
    {
        id: 'propriedade-intelectual',
        title: '11. Propriedade Intelectual',
        content: `Todo o conteúdo do site, incluindo textos, imagens, marcas e identidade visual, é de propriedade do Arthemi Coworking ou licenciado para seu uso, sendo vedada a reprodução sem autorização prévia.`
    },
    {
        id: 'comunicacoes-digitais',
        title: '12. Validade das Comunicações Digitais',
        content: `As comunicações realizadas por meio do WhatsApp institucional do Arthemi Coworking, pelo número oficial **${WHATSAPP_SUPPORT}**, possuem validade jurídica e poderão ser utilizadas como prova da contratação, confirmação de reserva e aceite das condições comerciais.`
    },
    {
        id: 'alteracoes-termos',
        title: '13. Alterações dos Termos',
        content: `O Arthemi Coworking poderá atualizar estes Termos de Uso a qualquer momento. A continuidade da utilização dos serviços após eventuais alterações implica aceitação automática dos novos termos.`
    },
    {
        id: 'foro',
        title: '14. Legislação e Foro',
        content: `Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Belo Horizonte/MG para dirimir quaisquer controvérsias.`
    },
    {
        id: 'contato-termos',
        title: '15. Contato',
        content: `Para dúvidas ou solicitações relacionadas a estes Termos de Uso, entre em contato exclusivamente pelo WhatsApp oficial:

📞 **${WHATSAPP_SUPPORT}**

Arthemi – Coworking de Saúde`
    }
];

export const REFUND_POLICY = [
    {
        id: 'premissas',
        title: '1. Premissas Gerais',
        content: `A presente Política de Reembolso estabelece, de forma clara e transparente, as regras aplicáveis aos pedidos de reembolso relacionados à contratação de horas avulsas, pacotes de horas ou demais modalidades de uso dos consultórios disponibilizados pelo Arthemi Coworking.

As reservas são realizadas por meio de link de agendamento disponibilizado exclusivamente pelo WhatsApp oficial, sendo a confirmação condicionada à compensação do pagamento.

Todos os pedidos de reembolso serão analisados conforme os critérios abaixo, observadas as regras de cancelamento previstas nos Termos de Uso do Arthemi Coworking de Saúde.`
    },
    {
        id: 'valor-referencia',
        title: '2. Valor de Referência para Reembolso',
        content: `Para fins de apuração de eventual reembolso, será considerado exclusivamente o valor total efetivamente pago pelo usuário, conforme comprovante da transação realizada por meio de PIX ou link de pagamento enviado pelo número oficial do Arthemi Coworking.

Em nenhuma hipótese será utilizado como base de cálculo:
* o valor nominal de créditos;
* valores promocionais convertidos em horas ou bônus;
* estimativas diversas do montante financeiro efetivamente desembolsado.`
    },
    {
        id: 'cancelamento-reagendamento',
        title: '3. Cancelamento, Reagendamento e Validade das Horas',
        content: `**3.1.** Cancelamentos ou solicitações de reagendamento realizados com antecedência mínima de **24 (vinte e quatro) horas** em relação ao horário reservado permitem o reagendamento sem perda das horas contratadas.

**3.2.** Cancelamentos ou solicitações de reagendamento realizados com **menos de 24 (vinte e quatro) horas** de antecedência, bem como o não comparecimento (no-show), **não geram direito a reembolso, crédito ou compensação futura**, independentemente do motivo alegado.

**3.3.** As horas adquiridas, seja em modalidade avulsa ou por meio de pacotes, possuem validade de **6 (seis) meses**, contados da data da confirmação do pagamento.

**3.4.** A solicitação de cancelamento ou reagendamento não suspende, interrompe ou prorroga o prazo de validade das horas adquiridas.

**3.5.** O prazo de validade poderá ser prorrogado uma única vez, por igual período, mediante solicitação formal e por escrito do usuário, realizada em até 30 (trinta) dias após a expiração, podendo o pedido ser deferido a critério exclusivo do Arthemi Coworking.

**3.6.** Decorrido o prazo de validade sem a utilização integral das horas contratadas, estas serão automaticamente expiradas, não gerando direito a reembolso, conversão em crédito ou compensação futura.

**3.7.** As solicitações deverão ser feitas exclusivamente pelo WhatsApp oficial.`
    },
    {
        id: 'descontos-pacotes',
        title: '4. Natureza dos Descontos em Pacotes',
        content: `Os descontos concedidos na aquisição de pacotes de horas constituem política comercial do Arthemi Coworking, destinada a incentivar o uso recorrente e contínuo do espaço durante todo o período contratado.

Tais descontos:
* são válidos exclusivamente para a utilização integral do pacote, dentro do prazo de validade;
* não representam redução proporcional do valor da hora para fins de reembolso;
* não geram direito adquirido à devolução proporcional com base no valor/hora promocional.`
    },
    {
        id: 'reembolso-pacotes',
        title: '5. Reembolso no Curso de Pacotes de Horas',
        content: `Na hipótese de solicitação de reembolso durante a vigência de um pacote, será adotado o seguinte procedimento:

**5.1.** As horas já utilizadas serão recalculadas como horas avulsas, considerando o valor vigente da hora avulsa no momento da contratação.

**5.2.** O valor correspondente às horas efetivamente utilizadas será abatido do valor total pago pelo usuário.

**5.3.** Sobre o valor remanescente incidirá **taxa administrativa equivalente a 20% (vinte por cento)**, destinada à cobertura de custos operacionais, financeiros e administrativos.

**5.4.** O valor final a ser reembolsado corresponderá ao saldo remanescente após a aplicação da taxa administrativa.`
    },
    {
        id: 'prazos',
        title: '6. Prazos de Apuração e Pagamento',
        content: `**6.1.** A apuração dos valores devidos a título de reembolso será realizada em até **10 (dez) dias úteis**, contados a partir da solicitação formal do usuário, efetuada pelos canais oficiais de atendimento.

**6.2.** Após a apuração, o pagamento será efetuado em até **10 (dez) dias úteis**, mediante transferência para conta bancária de titularidade da mesma pessoa física ou jurídica que realizou o pagamento originário, salvo autorização expressa, por escrito, em sentido diverso.`
    },
    {
        id: 'arrependimento',
        title: '7. Direito de Arrependimento',
        content: `Considerando que a contratação envolve reserva de espaço físico com bloqueio de agenda e disponibilidade exclusiva por período determinado, o direito de arrependimento previsto no **art. 49 do Código de Defesa do Consumidor** poderá ser aplicado apenas quando:
* não houver ocorrido nenhum evento de utilização do serviço; e
* a solicitação ocorrer no prazo legal de **7 (sete) dias corridos** contados da contratação.

Após a utilização parcial ou total do serviço, não será aplicável o direito de arrependimento.`
    },
    {
        id: 'disposicoes-finais',
        title: '8. Disposições Finais',
        content: `A solicitação de reembolso implica ciência e concordância integral do usuário com as regras previstas nesta Política, bem como com os Termos de Uso do Arthemi Coworking.

O Arthemi Coworking reserva-se o direito de atualizar esta Política de Reembolso a qualquer tempo, mediante publicação da versão atualizada em seu site.`
    },
    {
        id: 'contato-reembolso',
        title: '9. Contato',
        content: `Para dúvidas, solicitações ou exercício de direitos relacionados a esta Política de Reembolso, entre em contato exclusivamente pelo WhatsApp:

📞 **${WHATSAPP_SUPPORT}**

Arthemi – Coworking de Saúde`
    }
];

export const PRIVACY_POLICY = [
    {
        id: 'quem-somos',
        title: '1. Quem Somos',
        content: `O **Arthemi** é um coworking de saúde localizado em Belo Horizonte/MG, que disponibiliza consultórios para uso compartilhado por profissionais da área da saúde.

Esta Política de Privacidade tem por finalidade informar, de forma clara e transparente, como os dados pessoais são coletados, utilizados, armazenados e protegidos quando o usuário utiliza os serviços do Arthemi Coworking, inclusive por meio de link de agendamento disponibilizado via WhatsApp institucional, em conformidade com a Lei Geral de Proteção de Dados Pessoais (**LGPD – Lei n. 13.709/2018**).

**Controlador dos dados**
Arthemi Coworking de Saúde
Contato exclusivo (WhatsApp): **${WHATSAPP_SUPPORT}**`
    },
    {
        id: 'dados-coletados',
        title: '2. Quais Dados Coletamos',
        content: `Coletamos apenas os dados estritamente necessários para a prestação dos serviços de reserva e utilização dos consultórios.

**2.1. Dados fornecidos pelo usuário**
No momento do preenchimento do link de agendamento disponibilizado pelo WhatsApp institucional ou durante comunicações realizadas pelo número oficial, poderão ser coletados os seguintes dados pessoais:
* **Nome completo** – para identificação do profissional e vinculação da reserva;
* **Telefone celular** – para contato operacional relacionado à reserva;
* **E-mail** – para envio de confirmação de reserva e comunicações operacionais;
* **CPF** – para identificação, segurança da operação e cumprimento de obrigações legais;
* **Profissão e Inscrição em conselho profissional**, quando aplicável – para verificação da habilitação profissional.

Também poderão ser coletadas informações adicionais necessárias à organização da reserva, conforme informado pelo próprio usuário.

**2.2. Dados coletados automaticamente**
Durante a navegação no site, poderão ser coletados automaticamente:
* **Endereço IP** – para fins de segurança e auditoria;
* **User-Agent do navegador** – para identificação do dispositivo;
* **Data e hora de acesso** – para registro de operações e prevenção de fraudes.

Caso o usuário seja direcionado a ferramenta de agendamento online de terceiros, a coleta de dados poderá ocorrer conforme a política própria da referida ferramenta.

**2.3. Dados de pagamento**
O Arthemi Coworking **não armazena dados bancários ou de cartão de crédito**.
Os pagamentos são processados por plataformas de pagamento terceirizadas, que possuem suas próprias políticas de segurança e privacidade. O Arthemi Coworking recebe apenas informações essenciais, como:
* confirmação do pagamento (aprovado ou recusado);
* identificação da transação.`
    },
    {
        id: 'finalidade',
        title: '3. Finalidade do Tratamento dos Dados',
        content: `Os dados pessoais coletados são utilizados para as seguintes finalidades:
* **Execução do serviço** – viabilizar reservas, utilização dos consultórios e gestão da contratação;
* **Comunicação operacional** – envio de confirmações, avisos e informações relacionadas às reservas;
* **Atendimento via WhatsApp institucional** – organização do fluxo de agendamento e suporte;
* **Segurança jurídica** – registro de comunicações e comprovação contratual;
* **Segurança** – controle de acessos e prevenção a fraudes;
* **Cumprimento de obrigações legais e regulatórias.**

O Arthemi Coworking **não comercializa, aluga ou compartilha dados pessoais para fins de marketing**.`
    },
    {
        id: 'base-legal',
        title: '4. Base Legal para o Tratamento (LGPD)',
        content: `O tratamento dos dados pessoais é realizado com fundamento nas seguintes bases legais previstas na LGPD:
* **Execução de contrato (art. 7º, V)** – para viabilizar a reserva e o uso dos consultórios;
* **Consentimento (art. 7º, I)** – quando aplicável, mediante aceite;
* **Interesse legítimo (art. 7º, IX)** – para segurança, controle e prevenção de fraudes;
* **Obrigação legal ou regulatória (art. 7º, II)** – para cumprimento de exigências fiscais e legais.`
    },
    {
        id: 'compartilhamento',
        title: '5. Compartilhamento de Dados',
        content: `Os dados pessoais poderão ser compartilhados exclusivamente com:
* **Plataformas de pagamento** – para processamento das transações financeiras;
* **Ferramentas de agendamento online** – utilizadas para organização das reservas;
* **Fornecedores de tecnologia e hospedagem** – responsáveis pelo armazenamento seguro dos dados;
* **Autoridades públicas** – quando exigido por lei, ordem judicial ou requisição administrativa.

O compartilhamento ocorre apenas na medida do necessário para a execução dos serviços.`
    },
    {
        id: 'armazenamento',
        title: '6. Armazenamento e Segurança',
        content: `Os dados pessoais são armazenados em ambientes seguros, adotando-se medidas técnicas e administrativas adequadas, tais como:
* conexões criptografadas (HTTPS/TLS);
* controle restrito de acesso a bancos de dados;
* autenticação de usuários administrativos;
* registros de auditoria.

As comunicações realizadas por meio do WhatsApp institucional poderão ser armazenadas para fins de comprovação contratual, segurança jurídica e cumprimento de obrigações legais.

**Retenção dos dados**
Os dados relacionados às reservas e contratações poderão ser mantidos por até **5 (cinco) anos**, para fins legais, fiscais e regulatórios, ou por prazo superior quando exigido em lei.`
    },
    {
        id: 'direitos',
        title: '7. Direitos do Titular dos Dados',
        content: `Nos termos da LGPD, o titular dos dados poderá solicitar:
* confirmação da existência de tratamento;
* acesso aos dados;
* correção de dados incompletos, inexatos ou desatualizados;
* exclusão de dados, quando aplicável;
* portabilidade;
* revogação de consentimento;
* oposição ao tratamento, nos limites legais.

As solicitações deverão ser feitas exclusivamente pelos canais oficiais de comunicação e serão respondidas em até **15 (quinze) dias úteis**.`
    },
    {
        id: 'cookies',
        title: '8. Cookies',
        content: `O site institucional do Arthemi Coworking utiliza cookies para garantir seu funcionamento adequado e proporcionar melhor experiência de navegação ao usuário.

Além dos cookies essenciais, poderão ser utilizados cookies internos destinados à:
* melhoria da experiência do usuário;
* personalização de conteúdo e comunicações;
* análise de navegação e desempenho do site;
* aprimoramento contínuo dos serviços oferecidos.

O usuário poderá, a qualquer tempo, gerenciar as preferências de cookies por meio das configurações do seu navegador.
Caso o usuário seja direcionado a ambiente digital de terceiros, a política de cookies aplicável será aquela definida pelo respectivo fornecedor.`
    },
    {
        id: 'menores',
        title: '9. Menores de Idade',
        content: `Os serviços destinam-se exclusivamente a profissionais da saúde **maiores de 18 anos**.`
    },
    {
        id: 'atualizacoes',
        title: '10. Atualizações desta Política',
        content: `Esta Política poderá ser atualizada a qualquer tempo, sendo válida a versão publicada no site institucional. Recomenda-se a consulta periódica deste documento.`
    },
    {
        id: 'contato-privacidade',
        title: '11. Contato',
        content: `Para dúvidas, solicitações ou exercício de direitos relacionados a esta Política de Privacidade, entre em contato exclusivamente pelo WhatsApp:

📞 **${WHATSAPP_SUPPORT}**

Arthemi – Coworking de Saúde`
    }
];
