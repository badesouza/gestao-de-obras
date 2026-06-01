export interface InstrucaoSecao {
  titulo: string;
  icon: string;
  itens: string[];
}

export interface ServicoInstrucoes {
  slug: string;
  nome: string;
  resumo: string;
  secoes: InstrucaoSecao[];
  dicas: string[];
}

export const INSTRUCOES: Record<string, ServicoInstrucoes> = {

  'rocagem': {
    slug: 'rocagem',
    nome: 'Roçagem e Controle de Vegetação',
    resumo: 'Registro diário de serviços de roçagem de vias, terrenos e áreas públicas do município.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: preencha com consistência — alimentam o ranking automático do painel.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Outros).',
          'TIPO DE SERVIÇO: Roçagem Manual, Mecanizada, Capina, Controle Químico, Limpeza de Margem.',
          'ÁREA ROÇADA (m²): metragem efetivamente tratada — principal indicador de produção.',
          'EXTENSÃO (m): comprimento da faixa ou margem roçada.',
          'EQUIPAMENTO: identifica o equipamento utilizado para controle de rendimento.',
          'EQUIPE / TURMA: selecione a equipe responsável pelo serviço.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver registro fotográfico do serviço.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço executado no dia.',
          'O campo Área Roçada é o principal indicador — preencha sempre que possível.',
          'Bairro e Logradouro devem ser preenchidos de forma consistente para que os rankings funcionem.',
          'Status "Concluído" só deve ser marcado quando o serviço estiver 100% finalizado e o local liberado.',
        ],
      },
    ],
    dicas: [
      'Use sempre os mesmos nomes de bairro para não fragmentar os rankings.',
      'Equipamentos podem ser editados na lista para refletir a frota real do município.',
      'Registre a foto antes e depois do serviço para comprovação em caso de ouvidoria.',
    ],
  },

  'coleta-entulhos': {
    slug: 'coleta-entulhos',
    nome: 'Coleta de Entulhos e Resíduos Volumosos',
    resumo: 'Registro de coleta e descarte de resíduos e entulhos urbanos, com controle de pontos críticos de descarte irregular.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data em que o serviço de coleta foi realizado (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: preencha com consistência — os painéis usam esses campos para calcular rankings automáticos.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Outros).',
          'TIPO DE RESÍDUO: selecione o tipo predominante (Entulho de obra, Resíduo vegetal/poda, Volumoso/móvel, Misto, Outro).',
          'VOLUME COLETADO (m³): principal indicador de produção — preencha com a estimativa de volume retirado.',
          'SITUAÇÃO DO LOCAL: onde o resíduo estava depositado (Calçada, Via pública, Terreno baldio, Área pública).',
          'HORAS TRABALHADAS: essencial para calcular produtividade (m³/hora) automaticamente.',
          'VEÍCULO: use a lista para vincular o atendimento ao equipamento utilizado.',
          'FOTO REGISTRADA?: marque Sim quando a ocorrência foi fotografada — facilita auditoria.',
          'DESCARTE IRREGULAR?: marque Sim quando o resíduo foi depositado em local irregular — alimenta o ranking de pontos críticos.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por atendimento executado no dia.',
          'Volume Coletado é o principal indicador — preencha com estimativa realista.',
          'Horas Trabalhadas é essencial para calcular a produtividade (m³/hora).',
          'Descarte Irregular deve ser marcado mesmo quando o resíduo já foi retirado — alimenta o mapa de pontos críticos.',
        ],
      },
    ],
    dicas: [
      'Os nomes dos veículos podem ser editados para refletir a frota real do município.',
      'O campo Descarte Irregular gera ranking de bairros com maior incidência — útil para ações preventivas.',
      'Registre foto sempre que o descarte irregular for identificado para subsidiar autuações.',
    ],
  },

  'construcao-civil': {
    slug: 'construcao-civil',
    nome: 'Construção Civil e Obras Públicas',
    resumo: 'Acompanhamento de obras e serviços de construção civil, com controle de ordens de serviço, área executada e status.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'Nº DA OS: número da Ordem de Serviço — usado para contagem no painel e produção diária.',
          'BAIRRO e LOGRADOURO: preencha com consistência — alimentam o ranking automático do painel.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Secretaria, Outros).',
          'TIPO DE SERVIÇO: Pavimentação, Recapeamento, Calçada/Passeio, Drenagem, Muro de Arrimo, Outros.',
          'ÁREA EXECUTADA (m²): metragem quadrada efetivamente executada — principal indicador de produção.',
          'EXTENSÃO LINEAR (m): comprimento executado — complementa a área para serviços lineares.',
          'STATUS: use a lista — marque "Concluído" somente quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver registro fotográfico da execução.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço ou OS executada no dia.',
          'Nº da OS é obrigatório — permite rastrear cada serviço individualmente.',
          'Área Executada é o principal indicador — preencha com a metragem real.',
          'Status "Concluído" só deve ser marcado quando o serviço estiver 100% finalizado.',
        ],
      },
    ],
    dicas: [
      'Os tipos de serviço e origens podem ser ajustados na lista para refletir a realidade do município.',
      'Use o Nº da OS para cruzar com outras fontes (contratos, medições) quando necessário.',
      'Registre foto antes, durante e depois de obras maiores.',
    ],
  },

  'encascalhamento': {
    slug: 'encascalhamento',
    nome: 'Encascalhamento de Vias',
    resumo: 'Registro de encascalhamento de vias, acessos rurais e estradas vicinais, com controle de volume aplicado.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: preencha com consistência para funcionamento dos rankings.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Outros).',
          'TIPO DE SERVIÇO: Encascalhamento, Reforço, Nivelamento, Patrolamento.',
          'VOLUME (m³): informe o volume de cascalho ou material aplicado.',
          'EXTENSÃO (m): comprimento da via atendida.',
          'EQUIPAMENTO: registre o equipamento principal utilizado na operação.',
          'EQUIPE / TURMA: selecione a equipe responsável.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver comprovação fotográfica.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço executado.',
          'Volume e Extensão são os principais indicadores — preencha ambos sempre que possível.',
          'Registre o equipamento utilizado para controle de rendimento por máquina.',
        ],
      },
    ],
    dicas: [
      'Patrolamento e Nivelamento devem ser registrados mesmo sem aplicação de cascalho.',
      'O histórico de volume por via permite planejar manutenções preventivas.',
    ],
  },

  'iluminacao': {
    slug: 'iluminacao',
    nome: 'Iluminação Pública',
    resumo: 'Manutenção e instalação de luminárias na rede de iluminação pública, com controle por tipo de luminária e localização.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: essenciais para mapear os pontos de iluminação atendidos.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Outros).',
          'TIPO DE SERVIÇO: Troca de Lâmpada, Reparo de Poste, Instalação Nova, Reparo de Fiação, Outros.',
          'TIPO DE LUMINÁRIA: registre o tipo instalado ou reparado para controle do parque de iluminação.',
          'EQUIPE / TURMA: selecione a equipe responsável pelo serviço.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver comprovação fotográfica.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por ponto de iluminação atendido.',
          'Tipo de Luminária deve ser sempre preenchido — permite controle do parque instalado.',
          'Para instalações novas, registre sempre foto do local antes e depois.',
        ],
      },
    ],
    dicas: [
      'O histórico por tipo de luminária subsidia decisões de padronização e compra.',
      'Registros de Ouvidoria devem ter foto obrigatória para comprovação de atendimento.',
    ],
  },

  'oficina': {
    slug: 'oficina',
    nome: 'Oficina Mecânica / Frota',
    resumo: 'Manutenção preventiva e corretiva de veículos e equipamentos da secretaria, com controle de peças e patrimônio.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'TIPO DE SERVIÇO: Preventiva, Corretiva, Troca de Peças, Funilaria, Elétrica, Mecânica.',
          'VEÍCULO / EQUIPAMENTO: descreva o veículo ou equipamento (ex: Caminhão Basculante, Trator).',
          'PLACA / PATRIMÔNIO: identificação oficial do bem para rastreamento.',
          'DEFEITO / PROBLEMA: descreva o problema identificado com clareza.',
          'PEÇAS UTILIZADAS: liste as peças trocadas para controle de estoque.',
          'MECÂNICO RESPONSÁVEL: nome do mecânico que executou o serviço.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver finalizado.',
          'STATUS "Aguardando Peça": use quando o serviço está parado aguardando reposição.',
          'FOTO REGISTRADA?: marque Sim quando houver comprovação fotográfica.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço executado em cada veículo/equipamento.',
          'Placa ou Patrimônio é obrigatório — permite rastrear o histórico de manutenção por bem.',
          'Peças Utilizadas deve ser preenchido para controle de estoque e custo.',
          'Defeito/Problema deve ser descrito com clareza suficiente para histórico técnico.',
        ],
      },
    ],
    dicas: [
      'O histórico por placa permite identificar veículos com alta frequência de manutenção.',
      'Status "Aguardando Peça" deve ser atualizado assim que a peça chegar.',
      'Registre fotos do defeito identificado para suporte em processos de garantia.',
    ],
  },

  'pintura': {
    slug: 'pintura',
    nome: 'Pintura de Vias e Espaços Públicos',
    resumo: 'Serviços de pintura de vias, meio-fio, faixas de pedestre e espaços públicos, com controle de área e tipo de tinta.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: preencha com consistência para funcionamento dos rankings.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Outros).',
          'TIPO DE SERVIÇO: Meio-fio, Muro/Parede, Faixa de Pedestre, Sinalização Viária, Prédio Público.',
          'TIPO DE TINTA: registre o tipo de tinta utilizado para controle de estoque e padrão.',
          'ÁREA PINTADA (m²): informe a metragem efetivamente pintada — principal indicador de produção.',
          'EQUIPE / TURMA: selecione a equipe responsável.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver comprovação fotográfica.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço executado.',
          'Área Pintada é o principal indicador — preencha com a metragem real.',
          'Tipo de Tinta deve ser sempre preenchido para controle de estoque.',
        ],
      },
    ],
    dicas: [
      'O histórico por tipo de tinta permite planejar compras de forma mais precisa.',
      'Faixas de pedestre exigem foto obrigatória para sinalização de trânsito.',
    ],
  },

  'poda-arvores': {
    slug: 'poda-arvores',
    nome: 'Poda de Árvores e Vegetação',
    resumo: 'Poda e manejo de arborização urbana, com controle de espécie, porte e coleta de resíduos vegetais.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: preencha com consistência para os rankings do painel.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Secretaria, Outros).',
          'TIPO DE SERVIÇO: Poda, Supressão, Roçagem, Limpeza de Canteiro, Remoção de Toco, Outro.',
          'ESPÉCIE DA ÁRVORE: campo livre — registre o nome popular (ex: Oiti, Ficus, Mangueira, Acácia).',
          'PORTE DA ÁRVORE: Pequeno (até 5m), Médio (5–10m) ou Grande (acima de 10m).',
          'EQUIPE / TURMA: selecione a equipe responsável.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver finalizado e o local liberado.',
          'RESÍDUO RECOLHIDO?: registre se os galhos foram recolhidos — Sim, Não ou Parcial.',
          'FOTO REGISTRADA?: marque Sim quando houver registro fotográfico antes e depois.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por árvore ou conjunto de árvores atendidas no mesmo local.',
          'Espécie deve ser preenchida — o histórico por espécie permite planos de arborização.',
          'Resíduo Recolhido deve ser preenchido — resíduos não coletados geram nova ocorrência.',
          'Para espécies desconhecidas, use "Não identificada" e fotografe para identificação posterior.',
        ],
      },
    ],
    dicas: [
      'Registre sempre o nome mais conhecido localmente para facilitar buscas.',
      'O campo Espécie permite análise histórica de quais árvores geram mais demanda.',
      'Essa informação pode subsidiar planos de arborização e substituição de espécies inadequadas.',
      'Supressão exige autorização prévia — registre o número do documento no campo Observações.',
    ],
  },

  'pracas-jardins': {
    slug: 'pracas-jardins',
    nome: 'Praças e Jardins',
    resumo: 'Manutenção e conservação de praças, jardins e espaços públicos, com controle por nome do espaço e situação encontrada.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'PRAÇA / JARDIM / LOCAL: informe o nome do espaço público atendido.',
          'BAIRRO: selecione da lista para alimentar o ranking automático.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Outros).',
          'TIPO DE SERVIÇO: Capina, Jardinagem, Plantio, Irrigação, Limpeza Geral, Reforma de Canteiro.',
          'SITUAÇÃO DO ESPAÇO: registre a condição encontrada (Boa, Regular, Precária).',
          'EQUIPE / TURMA: selecione a equipe responsável.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver comprovação fotográfica.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por espaço público atendido.',
          'Nome da Praça deve ser consistente entre os registros para permitir histórico por espaço.',
          'Situação do Espaço deve refletir a condição encontrada antes do serviço.',
        ],
      },
    ],
    dicas: [
      'O histórico por praça permite identificar espaços com alta frequência de manutenção.',
      'Situação "Precária" deve sempre ter foto registrada para justificar a intervenção.',
    ],
  },

  'serralheria': {
    slug: 'serralheria',
    nome: 'Serralheria',
    resumo: 'Fabricação e manutenção de estruturas metálicas para espaços públicos, com controle de material e local de destino.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO / LOCAL DE DESTINO: onde a peça será instalada ou o serviço será realizado.',
          'LOGRADOURO / REFERÊNCIA: ponto de referência do local de destino.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Outros).',
          'TIPO DE SERVIÇO: Fabricação de Grade, Reparo de Portão, Corrimão, Estrutura, Solda.',
          'MATERIAL UTILIZADO: registre o tipo de metal para controle de estoque.',
          'EQUIPE / TURMA: selecione a equipe responsável.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver finalizado e entregue.',
          'FOTO REGISTRADA?: registre antes e depois para comprovação da entrega.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço ou peça fabricada.',
          'Material Utilizado deve ser preenchido para controle de estoque de insumos.',
          'Foto deve ser registrada antes e depois — comprova a entrega do serviço.',
        ],
      },
    ],
    dicas: [
      'O histórico de material por serviço permite planejar compras de insumos com antecedência.',
      'Para reformas em espaços públicos, registre o número do patrimônio no campo Observações.',
    ],
  },

  'tapa-buracos': {
    slug: 'tapa-buracos',
    nome: 'Tapa-Buracos',
    resumo: 'Registro de operações de tapa-buracos em vias públicas, com controle de área executada, produtividade e metas mensais.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'BAIRRO e LOGRADOURO: preencha com consistência para os painéis funcionarem corretamente.',
          'ORIGEM DA DEMANDA: use a lista (Ouvidoria, Vistoria Própria, Munícipe, Vereador, Outros).',
          'TIPO DE SERVIÇO: Tapa-Buraco, Remendo, Fresagem, Recapeamento Emergencial.',
          'ÁREA EXECUTADA (m²): principal indicador de produção — preencha sempre que possível.',
          'HORAS TRABALHADAS: essencial para calcular produtividade (m²/hora).',
          'EQUIPE / TURMA: preencha igual ao nome usado na tabela do Painel (ex: "Equipe A").',
          'RESPONSÁVEL TÉCNICO: nome do responsável técnico pelo serviço.',
          'STATUS: marque "Concluído" apenas quando o serviço estiver 100% finalizado.',
          'FOTO REGISTRADA?: marque Sim quando houver registro fotográfico.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por serviço executado no dia.',
          'Área Executada e Horas Trabalhadas são essenciais para cálculo de produtividade.',
          'Nome da equipe deve ser idêntico ao cadastrado no Painel para que os rankings funcionem.',
          'Status "Concluído" só deve ser marcado quando o serviço estiver 100% finalizado.',
        ],
      },
    ],
    dicas: [
      'Faça backup semanal renomeando o arquivo com o mês (ex: TapaBuracos_Mai2025).',
      'Os bairros nas tabelas do painel são editáveis — ajuste para os bairros do município.',
      'Use Ctrl+F para localizar rapidamente logradouros ou bairros no registro.',
    ],
  },

  'varricao': {
    slug: 'varricao',
    nome: 'Varrição de Vias Públicas',
    resumo: 'Controle de varrição de ruas por rotas, distrito e turno, com comparativo entre extensão prevista e executada.',
    secoes: [
      {
        titulo: 'Campos do Registro Diário',
        icon: '📋',
        itens: [
          'DATA: informe a data de execução (DD/MM/AAAA).',
          'ROTA / LOCAL: selecione da lista — Distrito, Fiscal e Extensão Prevista são preenchidos automaticamente.',
          'AGENTES DE LIMPEZA: informe os nomes dos agentes que realizaram a varrição.',
          'TURNO: selecione Manhã, Tarde ou Diário conforme o horário de execução.',
          'EXTENSÃO EXECUTADA (m): informe o trecho efetivamente varrido — pode ser menor que o previsto.',
          'SERVIÇO EXECUTADO?: Sim = varrição completa · Parcial = trecho incompleto · Não = não executado.',
          'MOTIVO DE NÃO EXECUÇÃO: preencha quando o status for "Não" — essencial para gestão e justificativa.',
          'FOTO REGISTRADA?: use a lista Sim/Não.',
          'OCORRÊNCIA: detalhe situações relevantes (acidente, descarte irregular, obstrução, etc.).',
        ],
      },
      {
        titulo: 'Distritos e Fiscais',
        icon: '🗺️',
        itens: [
          'D01 – Fiscal Lucas Neves: Paroquial, Rua da Linha, Lot. Bahia 01, Caititu, Campo do Governo, Gran Bahia, CONCIC, Batalhão, Rua de Ipirá, Costa e Silva.',
          'D02 – Fiscal José Carvalho: São João/Nova Itaberaba, Rua da Palmeira/Rodoviária, Irmã Dulce/RM, Barro Vermelho A e B, Vida Nova/Predinhos, Jardim Europa, Morada dos Sonhos, Açude Novo.',
          'D03 – Fiscal Lucas Sena: Oriente, Pç. Rosário/Liberdade, Pç. J.J. Seabra/Av. Rio Branco, Independente, Pé do Monte, Brigadeiro E. Gomes/CETEP, Av. Medeiros Neto, Primavera, Jardim das Palmeiras, Orla Parques das Águas.',
          'D04 – Fiscal Jucelino Salomão: R. L. Fernandes Serra, Praça do Coqueiro, Centro Financeiro, Sem Teto, Urbis, Hermes Bastos, Escurinha, Lot. Bahia 02, Av. Getúlio Vargas, Derba.',
        ],
      },
      {
        titulo: 'Regras de Preenchimento',
        icon: '⚠️',
        itens: [
          'Preencha um registro por rota varrida no dia (uma linha por turno/rota).',
          'Motivo de Não Execução é obrigatório quando o status for "Não" — sem isso o painel fica incompleto.',
          'Extensão Executada pode ser menor que a Prevista — registre o valor real.',
          'Para adicionar novas rotas: inclua na aba Rotas (Nome, Distrito, Fiscal, Extensão) e atualize a lista.',
        ],
      },
    ],
    dicas: [
      'Os campos Distrito, Fiscal e Extensão Prevista são automáticos ao selecionar a rota — não editar.',
      'O comparativo Previsto vs. Executado é o principal indicador de desempenho da varrição.',
      'Motivos de não execução devem ser registrados com precisão para subsidiar melhorias operacionais.',
    ],
  },

};
