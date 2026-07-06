'use strict';
/**
 * spectator-name (library.swf): mostra QUEM falou nas mensagens de time dos espectadores.
 *
 * O pacote 1532749363 (spectator-team message) carrega `uid + message`, mas o cliente DESCARTA o uid:
 * o handler `use function extends`.addSpectatorTeamMessage passa `null` como nickname pro chat, e o
 * construtor da linha (`function while` = BattleChatLine) renderiza o rótulo amarelo fixo
 * `LOCALE("SPECTATOR_NAME") + ":"` ("Espectador:"). Resultado: o servidor precisava embutir o nome no
 * texto ("nick: msg" → "Espectador: nick: msg").
 *
 * 2 edits:
 *  A. BattleChatLine ctor (branch param5=isSpectator): rótulo = `param1 + ":"` quando param1 != null,
 *     senão o LOCALE de sempre (outros chamadores passam null → comportamento original preservado).
 *  B. addSpectatorTeamMessage: passa o uid (getlocal1) em vez de pushnull — com param5=true o filtro de
 *     ignore é pulado e o ctor usa o uid como rótulo; NENHUM lookup de scoreboard acontece nesse caminho.
 *
 * Com o patch o servidor manda a mensagem LIMPA (sem prefixo) + uid → renderiza "nick: msg" em amarelo.
 */

// ---------- A. rótulo do espectador no ctor da BattleChatLine ----------
const CTOR_REFID = 'while const class:function while/instance/init';
const LABEL_OLD = `     getlocal            7
     getlex              QName(PackageNamespace("", "#0"), "521423164582316471123423632234")
     pushstring          "SPECTATOR_NAME"
     callproperty        QName(Namespace("alternativa.osgi.service.locale:ILocaleService"), "521423157602315773123423632234"), 1
     pushstring          ":"
     add`;
const LABEL_NEW = `     getlocal            7
     getlocal1
     pushnull
     ifeq                LspecDefault
     getlocal1
     jump                LspecName
    LspecDefault:
     getlex              QName(PackageNamespace("", "#0"), "521423164582316471123423632234")
     pushstring          "SPECTATOR_NAME"
     callproperty        QName(Namespace("alternativa.osgi.service.locale:ILocaleService"), "521423157602315773123423632234"), 1
    LspecName:
     pushstring          ":"
     add`;

// ---------- B. handler addSpectatorTeamMessage passa o uid ----------
const HANDLER_REFID = 'while const class:use function extends/instance/5214235828235841123423632234';
const HANDLER_RE = new RegExp('(refid "' + esc(HANDLER_REFID) + '"[\\s\\S]*?)pushnull');

// ---------- C. handler GERAL (d18c810e): sentinela "*nick" = espectador com nome ----------
// O caminho geral só marca espectador quando nickname == null (sem campo de nome). O servidor manda a
// cópia dos espectadores com nickname = "*nick"; aqui detectamos o "*", forçamos isSpectator (loc5) e
// tiramos o marcador — o nome vira o rótulo (via edit A) SEM lookup de scoreboard (usernames reais são
// ^[a-zA-Z0-9]+$, então "*" nunca colide). Nick null continua no fluxo original.
const GENERAL_REFID = 'while const class:use function extends/instance/while const class:use function extends/instance/5214236172236185123423632234';
const GENERAL_ANCHOR = `      getlocal1
      pushnull
      equals
      dup
      setlocal            5

      iffalse             L8

L8:`;
const GENERAL_INSERT = `
      getlocal            5
      iftrue              Lgmark
      getlocal1
      pushbyte            0
      callproperty        QName(PackageNamespace(""), "charAt"), 1
      pushstring          "*"
      ifne                Lgmark
      pushtrue
      setlocal            5
      getlocal1
      pushbyte            1
      callproperty        QName(PackageNamespace(""), "substring"), 1
      coerce_s
      setlocal1
     Lgmark:`;

module.exports = {
  id: 'spectator-name',
  swf: 'library',
  description: 'Chat de time dos espectadores mostra o nome de quem falou (uid do pacote 1532749363) no rótulo amarelo.',

  apply({ classes, log }) {
    let edits = 0, already = 0;
    for (const c of classes) {
      // A: BattleChatLine ctor
      if (c.text.includes(`refid "${CTOR_REFID}"`)) {
        if (c.text.includes('LspecDefault:')) { already++; }
        else if (c.text.includes(LABEL_OLD)) {
          c.save(c.text.replace(LABEL_OLD, LABEL_NEW));
          edits++;
        } else {
          throw new Error('bloco do rótulo SPECTATOR_NAME não encontrado no ctor da BattleChatLine');
        }
        continue;
      }
      // B + C: view (addSpectatorTeamMessage + handler geral d18c810e) — mesma classe
      if (c.text.includes(`refid "${HANDLER_REFID}"`)) {
        let t = c.text;
        if (t.match(HANDLER_RE)) { t = t.replace(HANDLER_RE, '$1getlocal1'); edits++; } else already++;
        if (t.includes('Lgmark:')) { already++; }
        else if (t.includes(`refid "${GENERAL_REFID}"`) && t.includes(GENERAL_ANCHOR)) {
          t = t.replace(GENERAL_ANCHOR, GENERAL_ANCHOR + GENERAL_INSERT);
          edits++;
        } else {
          throw new Error('âncora do handler geral (d18c810e) não encontrada');
        }
        if (t !== c.text) c.save(t);
        continue;
      }
    }
    if (edits === 0 && already >= 3) return { edits: 0, note: 'já aplicado' };
    if (edits !== 3) throw new Error(`esperava 3 edits, fez ${edits} (already=${already})`);
    log('BattleChatLine usa o nome como rótulo + team repassa o uid + geral aceita sentinela "*nick"');
    return { edits };
  },
};

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
