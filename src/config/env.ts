// Chave exposta no bundle: restrinja-a por HTTP referrer e à Sheets API no Google Cloud.
export const env = {
  sheetsId: process.env.EXPO_PUBLIC_SHEETS_ID ?? '',
  sheetsApiKey: process.env.EXPO_PUBLIC_SHEETS_API_KEY ?? '',
};

export const isSheetsConfigured = Boolean(env.sheetsId && env.sheetsApiKey);
