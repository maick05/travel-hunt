import type { SheetRows, TableKey } from './schema';

// Amostra no mesmo formato que a API do Sheets devolve (datas como número serial). Usada sem credenciais.
const TRIP = 'Eclipse 08/2027';
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
    [1, 46596.895833333336, 46596.916666666664, 'Desembarque Aeroporto BOG', LINK.bogAirport, 'Aeroporto', 'Avião', '', '', TRIP],
    [2, 46596.916666666664, 46596.916666666664, 'Check-in Hotel Bogotá', LINK.hotel, 'Hotel', 'Automóvel', 'Transfer Aeroporto-Hotel Bogotá', '', TRIP],
    [3, 46597.375, 46597.458333333336, 'Museo del Oro', LINK.museum, 'Passeio', 'A pé', '', '', TRIP],
    [4, 46597.479166666664, 46597.5, 'Almoço no Centro Histórico', LINK.tour, 'Gastronomia', 'A pé', '', '', TRIP],
    [5, 46597.5, 46597.5, 'Check-out Hotel Bogotá', LINK.hotel, 'Hotel', 'A pé', '', '', TRIP],
    [6, 46597.541666666664, 46597.649305555555, 'Check-in Aeroporto BOG', LINK.bogAirport, 'Aeroporto', 'Automóvel', 'Uber Hotel-Aeroporto Bogotá', '', TRIP],
  ],
  bills: [
    ['Tipo', 'Referência', 'Data Reserva', 'Data Pagamento', 'Descrição do item', 'Moeda', 'Valor', 'Meio de Pagamento', 'Status', 'Pessoa', 'Viagem'],
    ['Vôo', 163258588, 46321, '', 'Milhas (Maick)', 'Smiles', 120000, 'Milhas', 'Reservado', 'Maick', TRIP],
    ['Vôo', 163258588, 46321, 46321, 'Taxa Embarque (Maick)', 'R$', 104, 'Cartão de crédito', 'Pago', 'Maick', TRIP],
    ['Vôo', 163258588, 46321, 46321, 'Taxa Viaje Fácil (Maick)', 'R$', 249, 'Cartão de crédito', 'Pago', 'Maick', TRIP],
    ['Vôo', 163258588, '', '', 'Milhas (Maiza)', 'Smiles', 120000, 'Milhas', 'Pendente', 'Maiza', TRIP],
    ['Vôo', 163258588, '', '', 'Taxa Embarque (Maiza)', 'R$', 104, '', 'Pendente', 'Maiza', TRIP],
    ['Vôo', 163258588, '', '', 'Taxa Viaje Fácil (Maiza)', 'R$', 249, '', 'Pendente', 'Maiza', TRIP],
    ['Hospedagem', 5790430393, 46323, '', 'Hotel Bogotá', 'COP$', 160840, 'Cartão de crédito', 'Reservado', 'Maick, Maiza', TRIP],
    ['Transporte', 1, '', '', 'Transfer BOG -> Hotel', 'USD', 15, '', 'Pendente', 'Maick, Maiza', TRIP],
    ['Atividade', 3, '', '', 'Museo del Oro (Maick) - DNE', 'COP$', 5000, '', 'Pendente', 'Maick', TRIP],
    ['Atividade', 3, '', '', 'Museo del Oro (Maiza)', 'COP$', 21000, '', 'Pendente', 'Maiza', TRIP],
    ['Transporte', 2, '', '', 'Uber BOG', 'COP$', 45000, '', 'Pendente', 'Maick, Maiza', TRIP],
    ['Comida', 3, '', '', 'Almoço', 'COP$', 40000, '', 'Pendente', 'Maick, Maiza', TRIP],
  ],
  flights: [
    ['Cod. Reserva', 'Empresa', 'Nº Vôo', 'Aeroporto Partida', 'Partida', 'Hora partida', 'Aeroporto Destino', 'Destino', 'Hora de chegada', 'Status', 'Passageiros', 'Viagem'],
    ['163258588', 'Avianca', '0184', 'GRU', 'São Paulo', 46596.71875, 'BOG', 'Bogotá', 46596.895833333336, 'Viaje Fácil', 'Maick, Maiza', TRIP],
    ['163258588', 'Avianca', '0018', 'BOG', 'Bogotá', 46597.649305555555, 'BCN', 'Barcelona', 46598.364583333336, 'Viaje Fácil', 'Maick, Maiza', TRIP],
  ],
  hotels: [
    ['Cod. Reserva', 'Data de início', 'Data de término', 'Hotel', 'Destino', 'Plataforma', 'Status', 'Contato', 'Localização', 'Viagem'],
    ['5790430393', 46596, 46597, 'Continental By Hours', 'Bogotá', 'Booking', 'Reservado', '(57) 312 4094767', LINK.hotelPage, TRIP],
  ],
  meals: [
    ['Cod Ref', 'Data', 'Tipo Refeição', 'Descrição', 'Local', 'Status', 'Viagem'],
    [1, 46596, 'Janta', 'Delivery no Hotel ou Lanche do Aerporto', 'Bogotá', 'Pendente', TRIP],
    [2, 46597, 'Café da Manhã', 'Café do Hotel', 'Bogotá', 'Pago embutido', TRIP],
    [3, 46597, 'Almoço', 'Almoço Centro Histórico', 'Bogotá', 'Pendente', TRIP],
    [4, 46597, 'Lanche da Tarde', 'Lanche no Aeroporto', 'Bogotá', 'Pendente', TRIP],
    [5, 46597, 'Janta', 'Janta no Avião', 'Bogotá', 'Pago embutido', TRIP],
  ],
  transports: [
    ['Cod. Reserva', 'Plataforma', 'Meio de Transporte', 'Local de início', 'Destino final', 'Detalhes', 'Horário de partida', 'Horário de chegada', 'Status', 'Viagem'],
    [1, 'Booking', 'Automóvel', LINK.bogAirport, LINK.hotelPage, 'Transfer Aeroporto-Hotel Bogotá', 46596.916666666664, 46596.958333333336, 'Não reservado', TRIP],
    [2, 'Uber', 'Automóvel', LINK.hotelPage, LINK.bogAirport, 'Uber Hotel-Aeroporto Bogotá', 46597.520833333336, 46597.541666666664, 'Não reservado', TRIP],
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
    ['Bogotá', 'Colômbia', LINK.museum, 'https://r-xx.bstatic.com/xdata/images/xphoto/672x378/78530515.jpg?k=001c129b014e6abf5e810952959729870625c23ecb40acbeb2338daaf7e5fcfc&o='],
    ['Barcelona', 'Espanha', LINK.barcelona, ''],
  ],
};
