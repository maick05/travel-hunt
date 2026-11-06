# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Serviço de viagens

O Web App do Apps Script usa a mesma URL de implantação com dois endpoints, ambos por POST com `Content-Type: text/plain` e corpo JSON contendo `senha` (MD5 hexadecimal minúsculo da senha configurada):

- `?endpoint=viagens`: retorna somente a aba de viagens.
- `?endpoint=viagem&viagem=<nome>`: retorna os dados da viagem informada. O nome é obrigatório e deve ser codificado na URL.

As respostas contêm `atualizadoEm` e `abas`. As linhas com coluna `Viagem`, assim como a aba Travels, são filtradas pelo nome; Currency, Locals e Coordenadas são compartilhadas. As reservas são limitadas aos ativos citados na coluna `Reserva de Valor` das despesas da viagem. Se faltar a aba Money ou as colunas de vínculo, nenhuma reserva é associada.

A lista fica armazenada no dispositivo por até 24 horas, isolada por fonte e credencial; os detalhes não usam esse cache persistente. Ao entrar com uma senha, o aplicativo ainda a valida no servidor. Quando configurado com acesso direto à Google Sheets API, o filtro dos detalhes ocorre no aplicativo, pois essa API não implementa os endpoints acima.

Para atualizar o serviço existente, copie [scripts/apps-script/api.gs](scripts/apps-script/api.gs) para o projeto Apps Script e publique uma nova versão da implantação do Web App. Configure `EXPO_PUBLIC_SCRIPT_URL` com a URL `/exec` da implantação; a alteração no repositório, sozinha, não atualiza o serviço publicado.

## Cotações das reservas

As reservas usam o valor numérico da coluna `Cotação Atual` da aba ValueReserve, na moeda indicada na própria reserva. Essa coluna pode ser preenchida pela fórmula da planilha; valores vazios, textos e números não positivos são tratados como cotação indisponível. O aplicativo não consulta uma API externa de cotações nem informa um horário de mercado, pois a planilha não fornece esse horário.

O resultado estimado é a quantidade multiplicada pela cotação atual, menos o valor reservado; caso este não esteja informado, usa-se quantidade vezes `Cotação Usada`. Os valores são comparados na moeda da reserva, sem estimar taxas futuras, impostos ou movimentações posteriores. A atualização acompanha o carregamento dos detalhes da viagem e depende da atualização da fórmula na planilha.

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
