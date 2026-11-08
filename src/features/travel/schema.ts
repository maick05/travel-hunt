export type SheetCell = string | number | boolean | null | undefined;
export type SheetRows = SheetCell[][];

type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'list';
type Field<T extends FieldType = FieldType> = { header: string; type: T; occurrence?: number; aliases?: string[] };

const text = (header: string, occurrence?: number, aliases?: string[]): Field<'text'> => ({ header, type: 'text', occurrence, aliases });
const number = (header: string): Field<'number'> => ({ header, type: 'number' });
const date = (header: string): Field<'date'> => ({ header, type: 'date' });
const boolean = (header: string): Field<'boolean'> => ({ header, type: 'boolean' });
const list = (header: string): Field<'list'> => ({ header, type: 'list' });

export type FieldSpec = Record<string, Field>;

/** Data/hora como epoch ms em que o horário "de parede" da planilha é lido como UTC. */
export type DateValue = number | null;

export type Row<S extends FieldSpec> = {
  [K in keyof S]: S[K] extends Field<'text'> ? string : S[K] extends Field<'list'> ? string[] : S[K] extends Field<'boolean'> ? boolean | null : number | null;
};

// `tab` é o prefixo do título da aba (o título real tem emoji). Os headers são os da planilha.
export const schemas = {
  travels: {
    tab: 'Travels',
    fields: {
      name: text('Nome'),
      startDate: date('Data Inicial'),
      endDate: date('Data Final'),
      banner: text('Banner'),
    },
  },
  activities: {
    tab: 'Activities',
    fields: {
      code: text('Cod. Atividade'),
      start: date('Início'),
      end: date('Fim'),
      title: text('Atividade'),
      place: text('Local'),
      category: text('Categoria'),
      transportMode: text('Meio de Transporte'),
      transportRef: text('Ref. Transporte'),
      reserved: boolean('Reservado (Ticket/Valor)'),
      reservationAvailableDate: date('Data Reserva Possível'),
      reservationWaitReason: text('Motivo Aguardo da Reserva'),
      company: text('Empresa'),
      link: text('Link'),
      notes: text('Observações', undefined, ['Obs']),
      voucher: text('Reserva', undefined, ['Res']),
      trip: text('Viagem'),
    },
  },
  bills: {
    tab: 'Money',
    fields: {
      type: text('Tipo'),
      reference: text('Ref.', undefined, ['Referência']),
      category: text('Categoria'),
      bookingDate: date('Data Reserva'),
      paymentDate: date('Data Pagamento'),
      description: text('Descrição do item'),
      currency: text('Moeda'),
      amount: number('Valor'),
      paymentMethod: text('Meio de Pagamento'),
      status: text('Status'),
      person: text('Pessoa'),
      usedRate: number('Cotação Utilizada'),
      receipt: text('Comprovantes'),
      valueReserve: list('Reserva de Valor'),
      trip: text('Viagem'),
    },
  },
  flights: {
    tab: 'Fly',
    fields: {
      code: text('Cod. Reserva'),
      airline: text('Empresa'),
      flightNumber: text('Nº Vôo'),
      fromAirport: text('Aeroporto Partida'),
      from: text('Partida'),
      departure: date('Hora partida'),
      toAirport: text('Aeroporto Destino'),
      to: text('Destino'),
      arrival: date('Hora de chegada'),
      status: text('Status'),
      passengers: text('Passageiros'),
      voucher: text('Reserva'),
      stage: text('Etapa Percurso'),
      trip: text('Viagem'),
    },
  },
  hotels: {
    tab: 'Hotel',
    fields: {
      code: text('Cod. Reserva'),
      checkIn: date('Data de início'),
      checkOut: date('Data de término'),
      name: text('Hotel'),
      city: text('Destino'),
      link: text('Localização'),
      platform: text('Plataforma'),
      status: text('Status'),
      contact: text('Contato'),
      voucher: text('Reserva'),
      trip: text('Viagem'),
    },
  },
  meals: {
    tab: 'Food',
    fields: {
      code: text('Cod Ref'),
      date: date('Data'),
      type: text('Tipo Refeição'),
      description: text('Descrição'),
      menu: text('Cardápio', 0),
      menuFile: text('Cardápio', 1),
      place: text('Local'),
      status: text('Status'),
      trip: text('Viagem'),
    },
  },
  transports: {
    tab: 'Transport',
    fields: {
      code: text('Cod. Reserva'),
      platform: text('Plataforma'),
      mode: text('Meio de Transporte'),
      from: text('Local de início'),
      to: text('Destino final'),
      details: text('Detalhes'),
      departure: date('Horário de partida'),
      arrival: date('Horário de chegada'),
      status: text('Status'),
      voucher: text('Reserva'),
      trip: text('Viagem'),
    },
  },
  currencies: {
    tab: 'Currency',
    fields: {
      symbol: text('Sigla'),
      sign: text('Cifra'),
      name: text('Nome do item'),
      type: text('Tipo'),
      rateBRL: number('Câmbio R$'),
    },
  },
  valueReserves: {
    tab: 'ValueReserve',
    fields: {
      id: text('ID'),
      date: date('Data da Reserva'),
      platform: text('Plataforma'),
      type: text('Tipo'),
      asset: text('Ativo'),
      assetDescription: text('Ativo Desc.'),
      quantity: number('Quantidade Ativo'),
      value: number('Valor Reservado'),
      fees: number('Custo em Taxas'),
      usedRate: number('Cotação Usada'),
      currentRate: number('Cotação Atual'),
      currency: text('Moeda'),
      status: text('Status'),
    },
  },
  // Cidades com um link do Maps cada; o link é a âncora para agrupar lugares por cidade.
  locals: {
    tab: 'Locals',
    fields: {
      name: text('Local'),
      state: text('Estado'),
      country: text('País'),
      link: text('Localização Google'),
      banner: text('Banner'),
    },
  },
  // Preenchida por um script do Apps Script a partir dos links do Maps (ver scripts/apps-script).
  coords: {
    tab: 'Coordenadas',
    fields: {
      link: text('Link'),
      name: text('Nome'),
      lat: number('Latitude'),
      lng: number('Longitude'),
    },
  },
} as const;

export type TableKey = keyof typeof schemas;
export type Tables = { [K in TableKey]: Row<(typeof schemas)[K]['fields']>[] };

export type Travel = Tables['travels'][number];
export type Activity = Tables['activities'][number];
export type Bill = Tables['bills'][number];
export type Flight = Tables['flights'][number];
export type Hotel = Tables['hotels'][number];
export type Meal = Tables['meals'][number];
export type Transport = Tables['transports'][number];
export type Currency = Tables['currencies'][number];
