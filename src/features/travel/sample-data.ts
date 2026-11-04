import type { SheetRows, TableKey } from './schema';

// Dados totalmente fictícios no formato da API do Sheets (datas como número serial); usados sem credenciais.
const TRIP = 'Viagem Exemplo';
const LINK = {
  rioAirport: 'https://maps.app.goo.gl/exemplo-aeroporto-rio',
  lisAirport: 'https://maps.app.goo.gl/exemplo-aeroporto-lisboa',
  madAirport: 'https://maps.app.goo.gl/exemplo-aeroporto-madri',
  hotel: 'https://maps.app.goo.gl/exemplo-hotel',
  museum: 'https://maps.app.goo.gl/exemplo-museu',
  center: 'https://maps.app.goo.gl/exemplo-centro',
};

export const sampleRows: Record<TableKey, SheetRows> = {
  travels: [
    ['Nome', 'Data Inicial', 'Data Final'],
    [TRIP, 46600, 46612],
  ],
  activities: [
    ['Cod. Atividade', 'Início', 'Fim', 'Atividade', 'Local', 'Categoria', 'Meio de Transporte', 'Ref. Transporte', 'Observações', 'Viagem', 'Reservado (Ticket/Valor)', 'Data Reserva Possível', 'Motivo Aguardo da Reserva'],
    [1, 46600.895833333336, 46600.916666666664, 'Desembarque no aeroporto', LINK.lisAirport, 'Aeroporto', 'Avião', '', '', TRIP, false, 46447, 'Aguardando disponibilidade'],
    [2, 46600.916666666664, 46600.916666666664, 'Check-in no hotel', LINK.hotel, 'Hotel', 'Automóvel', 'Transfer Aeroporto-Hotel', '', TRIP],
    [3, 46601.375, 46601.458333333336, 'Museu', LINK.museum, 'Passeio', 'A pé', '', '', TRIP],
    [4, 46601.479166666664, 46601.5, 'Almoço no centro histórico', LINK.center, 'Gastronomia', 'A pé', '', '', TRIP],
    [5, 46601.5, 46601.5, 'Check-out do hotel', LINK.hotel, 'Hotel', 'A pé', '', '', TRIP],
    [6, 46601.541666666664, 46601.649305555555, 'Check-in no aeroporto', LINK.lisAirport, 'Aeroporto', 'Automóvel', 'Uber Hotel-Aeroporto', '', TRIP],
  ],
  bills: [
    ['Tipo', 'Ref.', 'Data Reserva', 'Data Pagamento', 'Descrição do item', 'Moeda', 'Valor', 'Meio de Pagamento', 'Status', 'Pessoa', 'Viagem', 'Reserva de Valor', 'Categoria'],
    ['Vôo', 100200300, 46321, '', 'Milhas (Ana)', 'Smiles', 120000, 'Milhas', 'Reservado', 'Ana', TRIP, '', 'Passagem'],
    ['Vôo', 100200300, 46321, 46321, 'Taxa de embarque (Ana)', 'R$', 104, 'Cartão de crédito', 'Pago', 'Ana', TRIP],
    ['Vôo', 100200300, '', '', 'Milhas (Bruno)', 'Smiles', 120000, 'Milhas', 'Pendente', 'Bruno', TRIP],
    ['Vôo', 100200300, '', '', 'Taxa de embarque (Bruno)', 'R$', 104, '', 'Pendente', 'Bruno', TRIP],
    ['Hospedagem', 900100200, 46323, '', 'Hotel', 'EUR', 120, 'Cartão de crédito', 'Reservado', 'Ana, Bruno', TRIP, '', 'Hospedagem'],
    ['Transporte', 1, '', '', 'Transfer aeroporto -> hotel', 'EUR', 20, '', 'Pendente', 'Ana, Bruno', TRIP],
    ['Atividade', 3, '', '', 'Museu (Ana)', 'EUR', 8, '', 'Pendente', 'Ana', TRIP],
    ['Atividade', 3, '', '', 'Museu (Bruno)', 'EUR', 12, '', 'Pendente', 'Bruno', TRIP],
    ['Transporte', 2, '', '', 'Uber', 'EUR', 25, '', 'Pendente', 'Ana, Bruno', TRIP, 'ATIVO1, ATIVO2', 'Transporte Privativo'],
    ['Comida', 3, '', '', 'Almoço', 'EUR', 30, '', 'Pendente', 'Ana, Bruno', TRIP],
  ],
  flights: [
    ['Cod. Reserva', 'Empresa', 'Nº Vôo', 'Aeroporto Partida', 'Partida', 'Hora partida', 'Aeroporto Destino', 'Destino', 'Hora de chegada', 'Status', 'Passageiros', 'Viagem'],
    ['100200300', 'Avianca', '0001', 'GIG', 'Rio de Janeiro', 46600.71875, 'LIS', 'Lisboa', 46600.895833333336, 'Confirmado', 'Ana, Bruno', TRIP],
    ['100200300', 'Avianca', '0002', 'LIS', 'Lisboa', 46601.649305555555, 'MAD', 'Madri', 46602.364583333336, 'Confirmado', 'Ana, Bruno', TRIP],
  ],
  hotels: [
    ['Cod. Reserva', 'Data de início', 'Data de término', 'Hotel', 'Destino', 'Plataforma', 'Status', 'Contato', 'Localização', 'Viagem'],
    ['900100200', 46600, 46601, 'Hotel Exemplo', 'Lisboa', 'Booking', 'Reservado', '(00) 000 000000', LINK.hotel, TRIP],
  ],
  meals: [
    ['Cod Ref', 'Data', 'Tipo Refeição', 'Descrição', 'Local', 'Status', 'Viagem'],
    [1, 46600, 'Janta', 'Delivery no hotel', 'Lisboa', 'Pendente', TRIP],
    [2, 46601, 'Café da Manhã', 'Café do hotel', 'Lisboa', 'Pago embutido', TRIP],
    [3, 46601, 'Almoço', 'Almoço no centro histórico', 'Lisboa', 'Pendente', TRIP],
    [4, 46601, 'Lanche da Tarde', 'Lanche no aeroporto', 'Lisboa', 'Pendente', TRIP],
    [5, 46601, 'Janta', 'Janta no avião', 'Lisboa', 'Pago embutido', TRIP],
  ],
  transports: [
    ['Cod. Reserva', 'Plataforma', 'Meio de Transporte', 'Local de início', 'Destino final', 'Detalhes', 'Horário de partida', 'Horário de chegada', 'Status', 'Viagem'],
    [1, 'Booking', 'Automóvel', LINK.lisAirport, LINK.hotel, 'Transfer Aeroporto-Hotel', 46600.916666666664, 46600.958333333336, 'Não reservado', TRIP],
    [2, 'Uber', 'Automóvel', LINK.hotel, LINK.lisAirport, 'Uber Hotel-Aeroporto', 46601.520833333336, 46601.541666666664, 'Não reservado', TRIP],
  ],
  currencies: [
    ['Sigla', 'Cifra', 'Nome do item', 'Tipo', 'Câmbio R$'],
    ['R$', 'R$', 'Real', 'Fiduciária', 1],
    ['EUR', '€', 'Euro', 'Fiduciária', 6.2],
    ['USD', '$', 'Dólar', 'Fiduciária', 5.43],
    ['Smiles', ':)', 'Smiles', 'MIlha', 0.016],
  ],
  valueReserves: [
    ['ID', 'Data da Reserva', 'Plataforma', 'Tipo', 'Ativo', 'Ativo Desc.', 'Quantidade Ativo', 'Valor Reservado', 'Custo em Taxas', 'Cotação Usada', 'Moeda', 'Status'],
    [1, 46329, 'Plataforma Exemplo', 'Investimento', 'ATIVO1', 'Ativo exemplo 1', 1, 100, 0, 100, 'R$', 'Reservado'],
    [2, 46329, 'Plataforma Exemplo', 'Investimento', 'ATIVO2', 'Ativo exemplo 2', 2, 50, 0, 25, 'R$', 'Reservado'],
  ],
  locals: [
    ['Local', 'País', 'Localização Google', 'Banner'],
    ['Rio de Janeiro', 'Brasil', LINK.rioAirport, ''],
    ['Lisboa', 'Portugal', LINK.lisAirport, ''],
    ['Madri', 'Espanha', LINK.madAirport, ''],
  ],
  coords: [['Link', 'Nome', 'Latitude', 'Longitude']],
};
