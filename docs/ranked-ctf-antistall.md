# Ranqueada CTF — Anti-stall / anti-flag-hoarding (decisão de design)

> **Status:** decidido, **não implementado**. Registro da decisão para implementar depois.
> Modo alvo: Ranqueada (Partida Competitiva), **CTF 1v1**, XP/BP, mapa `map_sandbox`.

## O problema que estamos resolvendo

Em CTF, para pontuar é preciso levar a bandeira inimiga até a **própria base** — e só conta se a **própria bandeira estiver em casa**. Isso abre dois abusos ligados a "segurar o jogo":

1. **Turtle no relógio (com timer):** com limite de tempo, quem abre vantagem cedo passa a ter a estratégia dominante de *fugir/defender* até o cronômetro zerar, vencendo pelo placar sem jogar. O timer (10 min) tinha sido colocado para evitar partidas arrastadas, mas criou esse incentivo.

2. **Flag hoarding (sequestro de bandeira) — o problema central:** enquanto eu **seguro** a bandeira do adversário, a bandeira dele está "fora de casa", então ele **não consegue completar captura nenhuma**. Num mapa aberto, cheio de obstáculos e sem becos sem saída, eu consigo **fugir da mira por tempo indeterminado** e **congelar o placar** na vantagem. Aqui o problema é *mecânico* (negação do objetivo), não econômico.

O caso patológico irredutível do CTF 1v1 é o **deadlock**: eu carrego a bandeira dele e ele carrega a minha → **ninguém pode pontuar** → os dois podem se esconder pra sempre.

## A solução escolhida

**Duas partes:**

### Parte 1 — Remover o timer (resolução só por placar)
A partida termina **apenas ao atingir o limite de bandeiras** (score limit). Sem relógio, **ninguém vence segurando o tempo** — a única forma de ganhar é pontuar. Isso elimina o abuso #1 por completo e reduz o abuso #2 a um único estado: o deadlock.

### Parte 2 — Slow progressivo no carregador, restrito ao deadlock, com counterplay
Penalidade de velocidade que **só age quando as DUAS bandeiras estão fora de suas bases** (o deadlock). Regras:

- **Condição (gate):** o carregador só é penalizado enquanto `carregando a bandeira inimiga` **E** `a própria bandeira também está fora`. Se a minha bandeira está em casa, **sem penalidade** — mesmo que eu carregue por 5 minutos, porque aí eu *poderia pontuar a qualquer momento*; não é abuso, é ineficiência minha.
- **Rampa:** graça inicial de **120s** de deadlock a 100% de velocidade; depois **−1% a cada 2s**; **piso de 30%** (não fica mais lento que isso).
- **O slow multiplica a velocidade final, inclusive o nitro** — o nitro **não** pode ser rota de fuga do penalty.
- **Persistência na bandeira:** o acumulador pertence à *bandeira*, **pausa** quando ela é solta, **retoma** de onde parou quando é pega de novo (não zera ao largar-e-repegar → fecha o exploit de reset). **Zera de vez** apenas quando a bandeira volta pra base dela (capturada, tocada pelo dono, ou retorno por queda no void).
- **Quebra do deadlock com você ainda carregando** (a sua bandeira voltou pra casa): a penalidade **deixa de agir** (volta a 100%), mas o valor acumulado fica guardado; se cair em deadlock de novo, retoma.
- **Counterplay (o coração do mecanismo):** largar a bandeira devolve **100%** na hora, permitindo **atacar/caçar** o adversário, que continua pesado carregando a sua bandeira.

## Por que essa é a melhor solução

- **Ataca a causa mecânica exata** (o deadlock de bandeiras cruzadas) sem tocar em jogo legítimo — bandeira em casa = sem penalidade.
- **É counterplay, não punição.** O servidor não arranca o objetivo da mão do jogador; cria um **dilema** (segurar pesado × largar pra caçar) e devolve a decisão ao jogador. Isso é design melhor do que qualquer regra automática.
- **Auto-corrige o grief.** Se alguém tenta segurar a bandeira inimiga com a própria em casa (sem penalidade) só pra travar, o adversário **pega a bandeira dele** → as duas ficam fora → deadlock → o hoarder começa a ficar lento. Não dá pra esconder com uma bandeira e defender a outra ao mesmo tempo. A regra fecha sozinha, sem o sistema precisar julgar intenção.
- **Simetria que se resolve.** Quando os dois ficam pesados, o mapa "encolhe": largar-pra-caçar quebra a simetria e força o confronto. A partida se resolve por pressão mecânica.
- **Sem estado de jogo novo pro jogador decorar** — o comportamento emerge das regras de bandeira que já existem.

### Detalhe crítico para a calibração
O slow **simétrico não cria diferença de velocidade sozinho** (os dois a 70% seguem iguais). Quem realmente quebra o deadlock é o **counterplay de largar** (voltar a 100% e caçar quem está pesado). Portanto o "largar-pra-caçar" **não é sabor, é o motor** — e a persistência (retomar a %, não zerar) é o que impede burlar largando-e-repegando. Provavelmente vai precisar de **feedback visual** (ícone de peso/velocidade) pra ensinar o jogador que largar é a jogada.

## Complemento recomendado (Fase 2): beacon do carregador
O slow cria a *possibilidade* de alcançar; um **marcador sempre visível** de quem carrega a bandeira garante que você *ache* quem alcançar num mapa aberto. Uma sem a outra fica manca: slow sem visibilidade ainda deixa o cara sumir; visibilidade sem slow não deixa você pegá-lo. Precisa de trabalho no cliente (pacote + UI do marcador), por isso fica numa fase posterior.

## Alternativas consideradas e por que foram descartadas

| Solução | Prós | Contras | Veredito |
|---|---|---|---|
| **Timer + placar (status quo)** | Trivial; partida sempre acaba | É a *origem* do abuso: premia segurar/negar | Descartado |
| **MMR por decisividade** (Elo menor p/ vitória magra) | Barato, server-only; desincentiva turtle | Não conserta a mecânica (só ganha menos); inútil sem timer | Descartado |
| **Morte súbita / prorrogação** | Força resolução de jogos travados | Só existe por causa do timer; some sem tempo | Descartado |
| **Baixar placar (7→5)** | Menos exposição ao estado travado | Ortogonal ao exploit; é tuning, não solução | Só afinação, não resolve |
| **Auto-derrubar/retornar bandeira por timer** | Mata hoarding, simples de codar | Tira a agência; "mágico" e frustrante | Rejeitado (punição, não counterplay) |
| **Beacon / carregador visível** | Ataca o "fugir por tempo indeterminado"; ótimo complemento | Sozinho não resolve (ver ≠ alcançar); exige cliente | Complemento da escolhida, não principal |
| **Permitir supplies/bônus (`esportDropTiming`)** | Dá "coragem" pra atacar; já existe no engine | Não ataca a raiz (o hoarder também coleta e pode ficar *mais* forte); **snowball** e **RNG/controle de spawn** brutais em 1v1 → fere a justiça do MMR | Descartado (bom p/ modo casual, ruim p/ ranqueada) |
| **Slow progressivo gated por deadlock + counterplay** | Corrige a causa preservando agência; auto-corrige grief | Mais complexo de codar/calibrar; depende do counterplay ser entendido | **Escolhida** |

## Ressalva em aberto
Sem *nenhum* timer nem cap, um griefer patológico que nunca engaja e nunca pega bandeira é teoricamente capaz de arrastar. O deadlock-penalty torna isso quase impossível, e abandono/desconexão já é **W.O.** (perde MMR + `abandons++`). Mesmo assim, considerar (não decidido) um **cap de segurança generoso (~20–25 min)** puramente anti-softlock, resolvendo por placar (ou empate se 0×0). Não é mecânica de vitória — é seguro.

## Notas de implementação (para quando formos aplicar)
- **Parte 1:** remover `timeLimitInSec` da resolução da ranqueada (hoje `onRoundFinished` resolve por placar; garantir que o fim venha só do score limit). Ver `RankedMatchmakingService`, `rankedBattleSettings()` e `RoundService.finishRound`.
- **Parte 2:** acumulador de deadlock **por bandeira**, enganchado nos eventos de **pegar / soltar / retornar** bandeira que o CTF já tem (ver memória `ctf-flag-sync`). Penalidade aplicada como multiplicador de velocidade via **reenvio de `TankSpecification`** — mesmo caminho que o lança-gelo usa para desacelerar (ver memória `freeze-damage-model`); garantir que o multiplicador incida sobre a velocidade **com** nitro.
- **Parâmetros iniciais:** graça 120s · −1%/2s · piso 30% (afinar em teste; a rampa atual leva ~4min20s de deadlock contínuo até o piso).
