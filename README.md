# 🚀 LeTanki Server

## 🌟 Visão Geral

O LeTanki Server é uma aplicação de servidor robusta, escrita em TypeScript, para alimentar as funcionalidades multiplayer do jogo LeTanki. Projetado com escalabilidade, modularidade e segurança de tipos em mente, este projeto fornece uma infraestrutura flexível e de fácil manutenção para lidar com o ciclo de jogo completo, incluindo autenticação, garagem, lobby e batalhas em tempo real.

> **Fase Atual: Batalhas em Tempo Real com Combate Completo**
> O servidor suporta o ciclo de jogo completo — autenticação, garagem (compra/aprimoramento/equipamento), lobby com lista de batalhas em tempo real — e partidas totalmente jogáveis: combate com todas as armas, todos os modos de batalha, sistema de dano/abate/placar, respawn, bônus, suprimentos e minas. O sistema de clãs já está praticamente completo (criação, convites, pedidos de entrada, gerenciamento de membros e ranking), faltando apenas alguns detalhes. O foco atual é refinar a paridade com o cliente oficial (física, fluxos de reconexão e troca de equipamento em batalha) e os sistemas de progressão.

## ✨ Funcionalidades

- **Desenvolvido em TypeScript**: Aproveita o TypeScript para segurança de tipos, melhor experiência de desenvolvimento e recursos modernos de JavaScript.
- **Arquitetura Escalável**: Lida com múltiplas conexões de clientes simultâneas de forma eficiente usando Node.js.
- **Design Modular**: Código organizado com serviços, modelos e manipuladores de pacotes para fácil extensão e manutenção.
- **Banco de Dados NoSQL**: Utiliza MongoDB com Mongoose para um gerenciamento de dados robusto e escalável.
- **Configuração Dinâmica**: Suporta um sistema de configuração genérico chave-valor armazenado no banco de dados, carregado na inicialização do servidor.
- **Garagem e Inventário**: Sistema completo de garagem que permite aos jogadores comprar, aprimorar e equipar torretas, carrocerias e pinturas, com troca de equipamento durante a batalha.
- **Lobby e Batalhas**: Gerenciamento de lobby com lista de batalhas em tempo real, criação de partidas e entrada de jogadores nos modos DM, TDM, CTF e Domínio (CP), com modo espectador e reconexão à batalha em andamento.
- **Combate Completo**: Todas as armas implementadas com seus próprios modelos de dano (Metralha, Trovão, Fumaça, Gêmea, Ricochete, Haste, Lança-chamas, Espingarda, Lança-gelo e Metralhadora), incluindo dano em área, fogo amigo configurável, sistema de abate, placar e respawn.
- **Sistemas de Batalha**: Bônus e caixas douradas, suprimentos consumíveis (kit médico, mina, dano duplo, etc.), minas, zonas de morte do mapa e fundo (fund) da partida.
- **Sincronização e Física**: Relay de movimento entre jogadores e física dos tanques calibrada para paridade com o cliente oficial, a partir de capturas de tráfego de referência.
- **Sistema Social**: Funcionalidades de amigos, incluindo adicionar, remover, aceitar/recusar pedidos e notificações de status online.
- **Sistema de Clãs**: Criação de clãs, convites e pedidos de entrada (com validação de tag/nome e busca), gerenciamento de membros (expulsar/sair com cooldown), edição de configurações (descrição, rank mínimo, recrutamento) e ranking de clãs.
- **Missões Diárias**: Sistema que gera missões diárias para os jogadores com recompensas.
- **Autenticação Segura**: Implementa registro de usuário, login, recuperação de senha com hash bcrypt e verificação por CAPTCHA.
- **Gerenciamento de Recursos Automatizado**: Um sistema de build inteligente descobre, versiona e processa automaticamente todos os recursos do jogo a partir de uma estrutura de pastas amigável (`resources/`).
- **Logs Abrangentes**: Sistema de logs completo com Winston para depuração e monitoramento.

## 📋 Pré-requisitos

Antes de configurar o LeTanki Server, certifique-se de ter o seguinte instalado:

- **Node.js** (v16 ou superior)
- **npm** (v8 ou superior)
- **MongoDB** (v4.4 ou superior recomendado)
- **Git** (para clonar o repositório)

## 🛠️ Instalação

Siga estes passos para configurar o LeTanki Server localmente:

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
    Crie um arquivo `.env` no diretório raiz com base no `.env.example`. Exemplo de configuração:

    ```env
    # Configurações do Servidor
    PORT=1337
    RESOURCE_PORT=9999

    # Configurações do Banco de Dados (MongoDB)
    MONGODB_URI=mongodb://localhost:27017/letanki

    # Configurações de Log
    ENABLE_CONSOLE_LOGGING=true
    LOG_LEVEL=info
    ```

    Ajuste a variável `MONGODB_URI` para o seu ambiente.

4.  **Configure o banco de dados**:
    Certifique-se de que o seu serviço MongoDB esteja em execução. Nenhuma outra configuração é necessária; o banco de dados e as coleções serão criados automaticamente na primeira conexão.

5.  **Adicione os Recursos**:
    Popule a pasta `resources/` com os assets do seu jogo, seguindo a estrutura de pastas categorizada (ex: `resources/ui/login_background/v1/image.jpg`).

6.  **Compile e Execute em Desenvolvimento**:
    Use o comando `dev` para compilar os recursos e iniciar o servidor com recarregamento automático.

    ```sh
    npm run dev
    ```

7.  **Para Produção**:
    Compile os recursos e o código TypeScript:
    ```sh
    npm run build
    ```
    Inicie o servidor:
    ```sh
    npm start
    ```

## 🚀 Uso

- **Clientes do Jogo**: Configure os clientes do jogo LeTanki para se conectarem ao endereço IP e porta do servidor (ex: `localhost:1337`).
- **Servidor de Recursos**: Os recursos estáticos do jogo são servidos a partir do diretório `.resource` (que é gerado automaticamente) na `RESOURCE_PORT` configurada (padrão: `9999`).
- **Logs**: Acompanhe a atividade do servidor em tempo real diretamente no console.

## 🤝 Contribuindo

Agradecemos contribuições para tornar o LeTanki Server ainda melhor! Para contribuir:

1.  Faça um fork do repositório.
2.  Crie uma branch para sua feature (`git checkout -b feature/sua-feature`).
3.  Faça o commit de suas alterações (`git commit -m "Adiciona sua feature"`).
4.  Envie para a branch (`git push origin feature/sua-feature`).
5.  Abra um pull request com uma descrição clara de suas alterações.

## 📜 Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📬 Contato

Para perguntas, sugestões ou problemas, por favor, abra uma issue no GitHub ou contate o mantenedor:

- **Danilo Palmeira**: [GitHub](https://github.com/danilopalmeira)
