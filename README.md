# 🚀 LeTanki Server

## 🌟 Visão Geral

O LeTanki Server é uma aplicação de servidor robusta, escrita em TypeScript, para alimentar as funcionalidades multiplayer do jogo LeTanki. Projetado com escalabilidade, modularidade e segurança de tipos em mente, o projeto fornece uma infraestrutura flexível e de fácil manutenção para o ciclo de jogo completo — da autenticação e garagem ao lobby, batalhas em tempo real, progressão e sistemas competitivos.

> **Fase Atual: Batalhas completas + progressão e sistemas competitivos**
> O servidor suporta o ciclo de jogo completo — autenticação, garagem (compra/aprimoramento/equipamento), lobby com lista de batalhas em tempo real e partidas totalmente jogáveis: combate com todas as armas, todos os modos de batalha, dano/abate/placar, respawn, bônus, suprimentos e minas. Além do núcleo de combate, estão implementados os sistemas de progressão e sociais: clãs, missões (de jogador e de clã), estatísticas de longo prazo, pinturas com resistência, moderação/staff e o painel web para matchmaking competitivo. O foco atual é refinar a paridade com o cliente oficial (física, reconexão, troca de equipamento em batalha) e expandir os modos competitivos.

## ✨ Funcionalidades

- **Desenvolvido em TypeScript**: segurança de tipos, melhor DX e recursos modernos de JavaScript.
- **Arquitetura escalável e modular**: código organizado por features (`src/features/*`), cada uma com seus serviços, modelos e handlers de pacotes.
- **Banco de dados NoSQL**: MongoDB com Mongoose.
- **Configuração dinâmica**: sistema chave-valor no banco, semeado no boot a partir de `src/config/initial-config.json` e cacheado em memória.
- **Garagem e inventário**: compra, aprimoramento e equipamento de torretas, carrocerias e pinturas, com troca de equipamento durante a batalha (com cooldown por categoria).
- **Lobby e batalhas**: lista de batalhas em tempo real, criação de partidas, entrada de jogadores nos modos DM, TDM, CTF e Domínio (CP), modo espectador, reconexão à batalha em andamento e batalhas privadas com visibilidade controlada.
- **Combate completo**: todas as armas com modelos de dano próprios (Metralha, Trovão, Fumaça, Gêmea, Ricochete, Haste, Lança-chamas, Espingarda, Lança-gelo e Metralhadora), dano em área, fogo amigo configurável, abate, placar e respawn.
- **Sistemas de batalha**: bônus e caixas douradas, suprimentos consumíveis (kit médico, mina, dano duplo, etc.), minas, zonas de morte do mapa e fundo (fund) da partida.
- **Sincronização e física**: relay de movimento entre jogadores e física dos tanques calibrada para paridade com o cliente oficial, a partir de capturas de tráfego de referência.
- **Pinturas**: catálogo completo de pinturas oficiais (incluindo animadas) com resistências aplicadas no combate.
- **Progressão**: sistema de ranks incluindo o rank prestígio "Lenda" (aberto/progressivo), missões diárias de jogador e estatísticas competitivas de longo prazo (abates, mortes, vitórias, sequências, cristais, XP).
- **Sistema social**: amigos (adicionar, remover, aceitar/recusar pedidos, notificações de status online), convites e sistema de indicação (referral).
- **Sistema de clãs**: criação, convites e pedidos de entrada (com validação de tag/nome e busca), papéis/permissões, logo do clã, gerenciamento de membros, configurações, ranking e missões de clã colaborativas.
- **Moderação e staff**: cargos de staff com comandos de chat com permissões em níveis (mute, broadcast, comandos administrativos), além de anti-flood no chat.
- **Painel web / Competitivo**: painel web embutido no cliente (via StageWebView) que serve de base para o matchmaking competitivo (ranked).
- **Gerenciamento de recursos automatizado**: build que descobre, versiona e processa automaticamente os assets do jogo a partir de uma estrutura de pastas amigável (`resources/`), servidos por um servidor de recursos HTTP dedicado.
- **Logs abrangentes**: Winston com rotação diária de arquivos para depuração e monitoramento.

## 📋 Pré-requisitos

- **Node.js** (v18 ou superior; desenvolvido/testado com v22)
- **npm** (v9 ou superior)
- **MongoDB** (v4.4 ou superior recomendado)
- **Git**

## 🛠️ Instalação

1.  **Clone o repositório**:

    ```sh
    git clone https://github.com/letanki/server.git
    cd server
    ```

2.  **Instale as dependências**:

    ```sh
    npm install
    ```

3.  **Configure as variáveis de ambiente**:
    Crie um `.env` na raiz com base no `.env.example`:

    ```env
    # Servidor
    PORT=1337
    RESOURCE_PORT=9999

    # Banco de dados (MongoDB)
    MONGODB_URI=mongodb://localhost:27017/letanki

    # Logs
    ENABLE_CONSOLE_LOGGING=true
    LOG_LEVEL=info

    # URL pública do painel web embutido no cliente (matchmaking competitivo).
    # Deve apontar para a RESOURCE_PORT (ex.: http://localhost:9999/panel).
    WEBPANEL_URL=http://localhost:9999/panel
    ```

    Ajuste `MONGODB_URI` e `WEBPANEL_URL` para o seu ambiente.

4.  **Banco de dados**: garanta que o MongoDB esteja em execução. As coleções são criadas automaticamente na primeira conexão; a configuração inicial é semeada a partir de `src/config/initial-config.json`.

5.  **Recursos**: popule a pasta `resources/` com os assets, seguindo a estrutura categorizada (ex.: `resources/ui/login_background/v1/image.jpg`).

6.  **Desenvolvimento** (compila recursos e sobe o servidor com recarregamento automático):

    ```sh
    npm run dev
    ```

7.  **Produção** (compila recursos + TypeScript e inicia a build):

    ```sh
    npm run build
    npm start
    ```

## 📜 Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Sobe o servidor em desenvolvimento (ts-node-dev, recarregamento automático). |
| `npm run build` | Limpa `dist/`, gera recursos/mapas, compila o TypeScript e copia os assets de runtime. |
| `npm start` | Inicia a versão compilada (`dist/`) via `start.js`. |
| `npm run build:gen` | Regenera apenas os artefatos de recursos e mapas. |
| `npm test` | Executa a suíte de testes (`test/**/*.test.ts`). |
| `npm run set-role` | Define o cargo/permissão de um usuário. |
| `npm run parse:logs` | Analisa capturas de tráfego (`.ndjson`) de referência. |
| `npm run stress` / `npm run targets` | Ferramentas de teste de carga e bots-alvo. |
| `npm run patch:client` / `patch:deploy` / `patch:list` | Ferramentas de patch do cliente. |
| `npm run extract:skyboxes` / `npm run tara` | Utilitários de assets (skyboxes / (des)empacotar `.tara`). |

## 🗂️ Estrutura do Projeto

```
src/
├── server.ts          # Entrypoint: monta os serviços e sobe os servidores
├── config/            # Dados de jogo e configuração (physics, turrets, hulls, initial-config.json)
├── core/              # Infra transversal (config, segurança, diagnósticos)
├── features/          # Uma pasta por domínio (auth, battle, chat, clan, garage,
│                      #   lobby, quests, ranked, stats, webpanel, ...)
├── packets/           # Roteamento/registro de handlers de pacotes
├── server/            # Camada de rede: game server, resource server, clientes
├── maps/              # Loaders de dados de mapa/colisão em runtime
├── generated/         # Gerado no build (não versionado)
├── shared/ / utils/   # Serviços e utilitários compartilhados
scripts/               # Build de recursos/mapas, dev, ferramentas e patches
resources/             # Assets do jogo (estrutura categorizada, versionada)
tools/                 # Ferramentas auxiliares (viewers, editor de mapas, rabcdasm)
```

## 🚀 Uso

- **Clientes do jogo**: aponte o cliente para o IP/porta do servidor (ex.: `localhost:1337`).
- **Servidor de recursos**: os assets estáticos são servidos a partir do diretório `.resource` (gerado no build) na `RESOURCE_PORT` (padrão `9999`), que também serve o painel web em `/panel` e as logos de clã em `/clanlogo`.
- **Logs**: acompanhados no console e persistidos em `logs/` (rotação diária).

## 🤝 Contribuindo

1.  Faça um fork do repositório.
2.  Crie uma branch para sua feature (`git checkout -b feature/sua-feature`).
3.  Faça o commit das alterações (`git commit -m "Adiciona sua feature"`).
4.  Envie para a branch (`git push origin feature/sua-feature`).
5.  Abra um pull request com uma descrição clara.

## 📜 Licença

Licenciado sob a Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📬 Contato

Para perguntas, sugestões ou problemas, abra uma issue no GitHub ou contate o mantenedor:

- **Danilo Palmeira**: [GitHub](https://github.com/danilopalmeira)
