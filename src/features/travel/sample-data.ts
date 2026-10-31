import type { SheetRows, TableKey } from './schema';

// Dados fictícios no formato da API do Sheets (datas como número serial); usados sem credenciais.
const TRIP = 'Viagem Exemplo';
const LINK = {
  bogAirport: 'https://maps.app.goo.gl/uZG7N6n71akDaPvB8',
  hotel: 'https://maps.app.goo.gl/VxfpTt5ZQxRGCAcg9',
  hotelPage: 'https://maps.app.goo.gl/VKjFkrDxKVABHp9w5',
  museum: 'https://maps.app.goo.gl/hVLSHhRJyaA59neA9',
  tour: 'https://maps.app.goo.gl/q14ohSHNPLp3V6R29',
  barcelona: 'https://maps.app.goo.gl/aBv5R6vuRH1JqD7y7',
  saoPaulo: 'https://maps.app.goo.gl/oE8va2ouoRchwHPp6',
};

export const sampleRows: Record<TableKey, SheetRows> = {
  travels: [
    ['Nome', 'Data Inicial', 'Data Final'],
    [TRIP, 46596, 46612],
  ],
  activities: [
    ['Cod. Atividade', 'Início', 'Fim', 'Atividade', 'Local', 'Categoria', 'Meio de Transporte', 'Ref. Transporte', 'Observações', 'Viagem'],
    [1, 46596.895833333336, 46596.916666666664, 'Desembarque no aeroporto', LINK.bogAirport, 'Aeroporto', 'Avião', '', '', TRIP],
    [2, 46596.916666666664, 46596.916666666664, 'Check-in no hotel', LINK.hotel, 'Hotel', 'Automóvel', 'Transfer Aeroporto-Hotel', '', TRIP],
    [3, 46597.375, 46597.458333333336, 'Museu', LINK.museum, 'Passeio', 'A pé', '', '', TRIP],
    [4, 46597.479166666664, 46597.5, 'Almoço no centro histórico', LINK.tour, 'Gastronomia', 'A pé', '', '', TRIP],
    [5, 46597.5, 46597.5, 'Check-out do hotel', LINK.hotel, 'Hotel', 'A pé', '', '', TRIP],
    [6, 46597.541666666664, 46597.649305555555, 'Check-in no aeroporto', LINK.bogAirport, 'Aeroporto', 'Automóvel', 'Uber Hotel-Aeroporto', '', TRIP],
  ],
  bills: [
    ['Tipo', 'Referência', 'Data Reserva', 'Data Pagamento', 'Descrição do item', 'Moeda', 'Valor', 'Meio de Pagamento', 'Status', 'Pessoa', 'Viagem'],
    ['Vôo', 100200300, 46321, '', 'Milhas (Ana)', 'Smiles', 120000, 'Milhas', 'Reservado', 'Ana', TRIP],
    ['Vôo', 100200300, 46321, 46321, 'Taxa de embarque (Ana)', 'R$', 104, 'Cartão de crédito', 'Pago', 'Ana', TRIP],
    ['Vôo', 100200300, '', '', 'Milhas (Bruno)', 'Smiles', 120000, 'Milhas', 'Pendente', 'Bruno', TRIP],
    ['Vôo', 100200300, '', '', 'Taxa de embarque (Bruno)', 'R$', 104, '', 'Pendente', 'Bruno', TRIP],
    ['Hospedagem', 900100200, 46323, '', 'Hotel', 'COP$', 160840, 'Cartão de crédito', 'Reservado', 'Ana, Bruno', TRIP],
    ['Transporte', 1, '', '', 'Transfer aeroporto -> hotel', 'USD', 15, '', 'Pendente', 'Ana, Bruno', TRIP],
    ['Atividade', 3, '', '', 'Museu (Ana)', 'COP$', 5000, '', 'Pendente', 'Ana', TRIP],
    ['Atividade', 3, '', '', 'Museu (Bruno)', 'COP$', 21000, '', 'Pendente', 'Bruno', TRIP],
    ['Transporte', 2, '', '', 'Uber', 'COP$', 45000, '', 'Pendente', 'Ana, Bruno', TRIP],
    ['Comida', 3, '', '', 'Almoço', 'COP$', 40000, '', 'Pendente', 'Ana, Bruno', TRIP],
  ],
  flights: [
    ['Cod. Reserva', 'Empresa', 'Nº Vôo', 'Aeroporto Partida', 'Partida', 'Hora partida', 'Aeroporto Destino', 'Destino', 'Hora de chegada', 'Status', 'Passageiros', 'Viagem'],
    ['100200300', 'Avianca', '0001', 'GRU', 'São Paulo', 46596.71875, 'BOG', 'Bogotá', 46596.895833333336, 'Confirmado', 'Ana, Bruno', TRIP],
    ['100200300', 'Avianca', '0002', 'BOG', 'Bogotá', 46597.649305555555, 'BCN', 'Barcelona', 46598.364583333336, 'Confirmado', 'Ana, Bruno', TRIP],
  ],
  hotels: [
    ['Cod. Reserva', 'Data de início', 'Data de término', 'Hotel', 'Destino', 'Plataforma', 'Status', 'Contato', 'Localização', 'Viagem'],
    ['900100200', 46596, 46597, 'Hotel Exemplo', 'Bogotá', 'Booking', 'Reservado', '(00) 000 000000', LINK.hotelPage, TRIP],
  ],
  meals: [
    ['Cod Ref', 'Data', 'Tipo Refeição', 'Descrição', 'Local', 'Status', 'Viagem'],
    [1, 46596, 'Janta', 'Delivery no hotel', 'Bogotá', 'Pendente', TRIP],
    [2, 46597, 'Café da Manhã', 'Café do hotel', 'Bogotá', 'Pago embutido', TRIP],
    [3, 46597, 'Almoço', 'Almoço no centro histórico', 'Bogotá', 'Pendente', TRIP],
    [4, 46597, 'Lanche da Tarde', 'Lanche no aeroporto', 'Bogotá', 'Pendente', TRIP],
    [5, 46597, 'Janta', 'Janta no avião', 'Bogotá', 'Pago embutido', TRIP],
  ],
  transports: [
    ['Cod. Reserva', 'Plataforma', 'Meio de Transporte', 'Local de início', 'Destino final', 'Detalhes', 'Horário de partida', 'Horário de chegada', 'Status', 'Viagem'],
    [1, 'Booking', 'Automóvel', LINK.bogAirport, LINK.hotelPage, 'Transfer Aeroporto-Hotel', 46596.916666666664, 46596.958333333336, 'Não reservado', TRIP],
    [2, 'Uber', 'Automóvel', LINK.hotelPage, LINK.bogAirport, 'Uber Hotel-Aeroporto', 46597.520833333336, 46597.541666666664, 'Não reservado', TRIP],
  ],
  currencies: [
    ['Sigla', 'Cifra', 'Nome do item', 'Tipo', 'Câmbio R$'],
    ['R$', 'R$', 'Real', 'Fiduciária', 1],
    ['COP$', '$', 'Pesos Colombianos', 'Fiduciária', 0.0017],
    ['USD', '$', 'Dólar', 'Fiduciária', 5.43],
    ['Smiles', ':)', 'Smiles', 'MIlha', 16],
  ],
  locals: [
    ['Local', 'País', 'Localização Google', 'Banner'],
    ['São Paulo', 'Brasil', LINK.saoPaulo, ''],
    ['Bogotá', 'Colômbia', LINK.museum, ''],
    ['Barcelona', 'Espanha', LINK.barcelona, ''],
  ],
  coords: [['Link', 'Nome', 'Latitude', 'Longitude']],
};
