# ABDUZIU na Play Store · guia passo a passo

O app da Play Store é uma **TWA** (Trusted Web Activity): um app Android que abre o `abduziu.fun` em tela
cheia, usando o Chrome do celular. Todo deploy do site atualiza o app sozinho. Você só precisa subir uma versão
nova na Play se mudar ícone, nome ou configurações do Android.

Legenda: ✅ já feito · 👤 você faz · 🤖 eu faço quando você me mandar o que é pedido

---

## 0. Já está pronto no site

- ✅ Política de privacidade: <https://abduziu.fun/privacidade/> (PT + EN, com link dentro do jogo em Configurações)
- ✅ Página de exclusão de conta: <https://abduziu.fun/excluir-conta/> (a Play exige um link fora do app)
- ✅ Apagar conta dentro do jogo: Conta → Apagar conta e dados online (apaga login, perfil, ranking e save)
- ✅ `https://abduziu.fun/.well-known/assetlinks.json` com o pacote `fun.abduziu.app` (faltam só as impressões
  digitais, ver o passo 4)
- ✅ Manifest do PWA ajustado e ícone adaptativo do Android corrigido
- ✅ Textos da loja em PT e EN: [`listing.md`](listing.md)
- ✅ Ícone 512, gráfico de destaque 1024×500 e screenshots 1920×1080: pasta [`play/`](play)

## 1. E-mail de contato 👤 (5 min)

A Play mostra um e-mail de contato público, e a política de privacidade usa `contato@abduziu.fun`. Pra ele
funcionar, encaminhe esse endereço pro seu Gmail, de graça, pela Cloudflare:

1. No painel da Cloudflare, abra o domínio **abduziu.fun** e vá em **Email → Email Routing**.
2. Clique em **Enable Email Routing** e aceite os registros DNS que ela sugere.
3. Em **Routing rules → Create address**: endereço `contato`, ação **Send to an email**, destino = seu Gmail.
4. Confirme no Gmail o e-mail de verificação que a Cloudflare manda.

## 2. Conta de desenvolvedor 👤

1. Crie a conta em <https://play.google.com/console/signup> com o Gmail que vai ser dono do jogo.
2. Escolha **Pessoal** (você) ou **Organização** (precisa de CNPJ e número D-U-N-S). A taxa é única, US$ 25.
3. Faça a verificação de identidade que o Google pedir (documento e, às vezes, um celular Android pra confirmar).
4. O nome de desenvolvedor aparece na loja: sugestão **Gueto Game Studio**.

> **Conta pessoal criada depois de nov/2023:** antes de liberar pra todo mundo, o app precisa de **teste fechado
> com pelo menos 12 testadores por 14 dias seguidos**. Se ficar abaixo de 12, a contagem recomeça. Já vá juntando
> a galera (cada um precisa de uma conta Google e de entrar pelo link de teste). Conta de organização não tem essa
> regra.

## 3. Gerar o app Android no PWABuilder 👤 (10 min)

1. Abra <https://www.pwabuilder.com>, cole `https://abduziu.fun` e clique em **Start**.
2. Clique em **Package for stores → Android → Generate Package** e depois em **Options**.
3. Preencha assim:

| Campo | Valor |
|---|---|
| Package ID | `fun.abduziu.app` (**não muda nunca mais**) |
| App name | `ABDUZIU` |
| Launcher name | `ABDUZIU` |
| App version | `1.0.0` |
| App version code | `1` (some 1 a cada versão nova que subir) |
| Host | `abduziu.fun` |
| Start URL | `/` |
| Theme color / Background color / Nav bar color | `#050A12` |
| Display mode | `Fullscreen` |
| Orientation | `Landscape` (se o campo não aparecer, ele usa o do manifest, que já está em landscape) |
| Splash fade out | `300` |
| Notification delegation | desligado |
| Location delegation | desligado |
| Google Play billing | desligado |
| Fallback behavior | `Custom Tabs` |
| Signing key | **Create new** · nome: seu nome · organização: Gueto Game Studio · país: BR |

4. Clique em **Download**. Vem um `.zip` com:
   - `*.aab`: o arquivo que sobe na Play;
   - `*.apk`: pra instalar e testar direto no seu celular;
   - `assetlinks.json`: tem a impressão digital da sua chave;
   - `signing.keystore` + `signing-key-info.txt`: **a chave do app e as senhas**.

> 🔐 **Guarde o `signing.keystore` e o `signing-key-info.txt`** em dois lugares seguros (ex.: Google Drive pessoal
> e um pendrive). Não mande no chat e não coloque no repositório. Sem essa chave, você não consegue atualizar o app.
> (Com o "Play App Signing", que vem ligado, dá pra pedir troca da chave de upload ao Google se perder, mas demora.)

## 4. Ligar o app ao site (assetlinks) 👤 + 🤖

É isso que faz o app abrir **sem a barra de endereço** do Chrome.

1. 👤 Abra o `assetlinks.json` que veio no zip e copie o valor de `sha256_cert_fingerprints` (algo como
   `AB:CD:12:...`). Ele é público, pode me mandar aqui.
2. 👤 Depois de criar o app no Play Console (passo 5), vá em **Testar e lançar → Configuração → Integridade do
   app → Assinatura de apps** e copie o **SHA-256 do certificado da chave de assinatura de apps**. Também é
   público, pode me mandar.
3. 🤖 Eu coloco as duas no `public/.well-known/assetlinks.json` e faço o deploy.

Teste: instale o `.apk` no celular. Se aparecer uma barrinha com `abduziu.fun` no topo, os fingerprints ainda
não estão no ar.

## 5. Criar o app no Play Console 👤

1. **Criar app** → nome `ABDUZIU: Invasão Alienígena`, idioma padrão **Português (Brasil)**, tipo **Jogo**,
   **Gratuito**. Aceite as declarações.
2. **Página principal da loja**: cole os textos do [`listing.md`](listing.md) e suba:
   - ícone: `play/icon-512.png`;
   - gráfico de destaque: `play/feature-graphic.png`;
   - capturas de tela do telefone: as de `play/screenshots/` (mínimo 4 pra jogos; use todas).
   Repita em **Adicionar tradução → Inglês (EUA)** com o texto em inglês (as imagens podem ser as mesmas).
3. **Configurações da loja**: categoria **Jogos → Arcade**; e-mail `contato@abduziu.fun`; site `https://abduziu.fun`.

## 6. Conteúdo do app (Política → Conteúdo do app) 👤

Respostas que batem com o que o jogo faz de verdade:

**Política de privacidade:** `https://abduziu.fun/privacidade/`

**Acesso ao app:** "Algumas funcionalidades estão restritas" → instrução: *"Login opcional com qualquer conta
Google ou por e-mail (link mágico). Todo o resto funciona sem login. Não há credenciais especiais."*

**Anúncios:** Não, o app não contém anúncios.

**Classificação do conteúdo** (questionário IARC): categoria **Jogo**. Responda com sinceridade. Referência do
que o jogo tem:
- violência de fantasia/desenho: naves e veículos explodem, pessoas são abduzidas, **sem sangue, sem morte
  explícita e sem humanos feridos de forma realista**;
- sem conteúdo sexual, palavrão, drogas, álcool, apostas ou jogos de azar;
- **interação entre usuários: sim** (multiplayer online com apelidos, **sem chat**);
- não compartilha localização; **sem compras digitais**.

**Público-alvo:** marque **13–15, 16–17 e 18+**. **Não** marque faixas abaixo de 13 (isso puxaria as regras do
programa Famílias). "O app pode atrair crianças sem querer?" → Não.

**Segurança dos dados:**
- Coleta ou compartilha dados? **Sim**.
- Criptografia em trânsito? **Sim**.
- Usuário pode pedir exclusão? **Sim** → link `https://abduziu.fun/excluir-conta/`.
- Contas: o app permite criar conta? **Sim**, com login por **OAuth (Google)** e **e-mail**. Link de exclusão:
  o mesmo acima.

| Tipo de dado | Coletado | Compartilhado | Opcional | Finalidade |
|---|---|---|---|---|
| Informações pessoais → **Endereço de e-mail** | Sim | Não | Sim | Gerenciamento de conta |
| Informações pessoais → **Nome** (só com login Google) | Sim | Não | Sim | Gerenciamento de conta |
| Informações pessoais → **IDs de usuário** (conta, código de amigo) | Sim | Não | Sim | Funcionalidade do app, gerenciamento de conta |
| Atividade no app → **Outras ações** (pontuações ranqueadas, save na nuvem) | Sim | Não | Sim | Funcionalidade do app |
| Atividade no app → **Outro conteúdo gerado pelo usuário** (apelido) | Sim | Não | Sim | Funcionalidade do app |

Não marque: localização, contatos, fotos, áudio, arquivos, calendário, saúde, finanças, mensagens, histórico de
navegação, diagnóstico/crash, identificadores de publicidade. Fornecedores que processam dados em seu nome
(Supabase, Cloudflare) **não contam como compartilhamento**.

**Outras declarações:** app de notícias: não · governo: não · recursos financeiros: não · saúde: não ·
ID de publicidade: **não usa**.

## 7. Teste interno (você mesmo, hoje) 👤

1. **Testar e lançar → Testes → Teste interno → Criar versão**, suba o `.aab`.
2. Adicione seu Gmail na lista de testadores, abra o link de participação no celular e instale pela Play.
3. Confira: abre em tela cheia na horizontal, sem barra de endereço (depois do passo 4), login com Google funciona
   e volta pro jogo, áudio toca depois do primeiro toque, Configurações → Política de privacidade abre.

## 8. Teste fechado: 12 pessoas por 14 dias 👤 (só conta pessoal)

1. **Teste fechado → Criar faixa** (ou use a "Alpha"), suba o mesmo `.aab`.
2. Em **Testadores**, crie uma lista de e-mails ou use um **Grupo do Google**. É mais fácil: cria o grupo, manda o
   link e cada um entra sozinho.
3. Mande pra galera o **link de participação** (opt-in) da faixa. Cada pessoa precisa aceitar pelo link e instalar.
4. Mantenha **12 ou mais** inscritos por **14 dias seguidos**. Peça pra jogarem de verdade: o Google olha se o
   app foi usado.
5. Depois dos 14 dias: **Painel → Solicitar acesso à produção**. Você responde umas perguntas sobre o teste (como
   recrutou, que feedback recebeu, o que mudou). Mencione as melhorias que foram pro ar no período, já que o jogo
   atualiza pelo site.

## 9. Produção 👤

1. **Produção → Criar versão** → suba o `.aab` (ou promova a versão do teste fechado).
2. Países: **Brasil** primeiro (ou todos, já que tem inglês).
3. **Enviar para revisão**. A primeira revisão costuma levar de alguns dias a uma semana.

---

## Atualizações depois do lançamento

- **Conteúdo do jogo** (fases, objetos, correções): é só o deploy de sempre no site. O app pega sozinho.
- **Ícone, nome, cores, orientação**: gere de novo no PWABuilder **com a mesma chave** (Signing key → *Use mine*,
  enviando o `signing.keystore` e as senhas), aumente o *version code* e suba o `.aab` novo.

## Pontos de atenção

- **Blue Pen (#230)**: o nome foi trocado, mas o modelo 3D continua parecido com o Manoel Gomes. Se a Play
  reclamar de uso de imagem de pessoa real, a saída é trocar o visual do personagem.
- **Modelos gerados na Tripo**: confira se o seu plano permite uso comercial dos modelos.
- **Loja de skins**: só com moeda do jogo. Se um dia vender com dinheiro de verdade, a Play exige o Google Play
  Billing (e aí o app deixa de ser só uma TWA simples).
