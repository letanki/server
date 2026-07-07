'use strict';
/**
 * webpanel-button (library.swf): painel web IN-GAME dirigido pelo servidor, usando **StageWebView**
 * (flash.media.StageWebView) — uma camada NATIVA do SO desenhada por cima da janela, fora do display
 * list e do Stage3D. Isso resolve o problema fatal do HTMLLoader: sob Stage3D direct mode a superfície
 * do HTMLLoader NÃO repinta após o render inicial (contador/animações congelam). A StageWebView renderiza
 * e atualiza nativamente.
 *
 * Reaproveita o handler do pacote 1587315905 (ReferralsModel.openReferrerPanel). O servidor manda um JSON
 * `{"url","x","y","w","h"}` na 1ª string. Regras de tamanho/posição (100% dirigidas pelo servidor):
 *   - w<=0 => stageWidth ; h<=0 => stageHeight (fullscreen)
 *   - x<0  => centraliza X = (sw-w)/2 ; y<0 => centraliza Y = (sh-h)/2  (independentes)
 *   - se o painel JÁ existe => só ATUALIZA o viewPort (reposiciona/redimensiona) SEM recarregar a url.
 *     Assim o servidor troca tamanho/posição a qualquer momento reenviando OpenWebPanel.
 *
 * Eventos: webpanelNav (locationChanging → URL com "wpclose" = × do HTML → cancela navegação + dispose).
 * NÃO fecha no ESC (removido) — só pelos botões do HTML. Campo `webpanelWV` = StageWebView.
 * (webpanelClose/webpanelResize continuam definidos mas NÃO são mais registrados.)
 */
const NS = 'PrivateNamespace("alternativa.tanks.model.referrals:ReferralsModel")';
const WV = `QName(${NS}, "webpanelWV")`;
const CENTERED = `QName(${NS}, "webpanelCentered")`;
const CFP = 'QName(PackageNamespace("", "#0"), "class function package")';
const STAGE = 'QName(Namespace("alternativa.osgi.service.display:IDisplay"), "stage")';
const SW = 'QName(PackageNamespace("", "#0"), "stageWidth")';
const SH = 'QName(PackageNamespace("", "#0"), "stageHeight")';
const SWV = 'QName(PackageNamespace("flash.media"), "StageWebView")';
const RECT = 'QName(PackageNamespace("flash.geom"), "Rectangle")';
const JSONC = 'QName(PackageNamespace("", "#0"), "JSON")';
const OBJECT = 'QName(PackageNamespace("", "#0"), "Object")';
const BOOLEAN = 'QName(PackageNamespace("", "#0"), "Boolean")';
const PUB = (n) => `QName(PackageNamespace(""), "${n}")`;
const OPEN_REFID = '521423119262311939123423632234:null catch dynamic/instance/5214231803231816123423632234';
const NUMBER = 'QName(PackageNamespace("", "#0"), "Number")';
// spec da view guardada (x,y,w,h em px OU %, + flag pct) — para recalcular o viewPort no resize
const WX = `QName(${NS}, "webpanelX")`;
const WY = `QName(${NS}, "webpanelY")`;
const WW = `QName(${NS}, "webpanelW")`;
const WH = `QName(${NS}, "webpanelH")`;
const WPCT = `QName(${NS}, "webpanelPct")`;

const stageW = `getlex               ${CFP}\n      getproperty         ${STAGE}\n      getproperty         ${SW}`;
const stageH = `getlex               ${CFP}\n      getproperty         ${STAGE}\n      getproperty         ${SH}`;

// fecha: se a view existe, solta do palco (stage=null), dispose() e zera o campo (guardado contra 2x)
const DISPOSE = `getlocal0
      getproperty         ${WV}
      pushnull
      ifeq                Ld
      getlocal0
      getproperty         ${WV}
      pushnull
      setproperty         ${PUB('stage')}
      getlocal0
      getproperty         ${WV}
      callpropvoid        ${PUB('dispose')}, 0
      getlocal0
      pushnull
      setproperty         ${WV}
     Ld:`;

const OPEN_BODY =
`    body
     maxstack 8
     localcount 6
     initscopedepth 0
     maxscopedepth 1
     code
      getlocal0
      pushscope

      ; cfg = JSON.parse(param2)   — {url, x, y, w, h, pct}
      getlex              ${JSONC}
      getlocal2
      callproperty        ${PUB('parse')}, 1
      coerce              ${OBJECT}
      setlocal 5

      ; guarda a spec (x,y,w,h como int; pct como Boolean) p/ recalcular no resize
      getlocal0
      getlocal 5
      getproperty         ${PUB('x')}
      convert_i
      setproperty         ${WX}
      getlocal0
      getlocal 5
      getproperty         ${PUB('y')}
      convert_i
      setproperty         ${WY}
      getlocal0
      getlocal 5
      getproperty         ${PUB('w')}
      convert_i
      setproperty         ${WW}
      getlocal0
      getlocal 5
      getproperty         ${PUB('h')}
      convert_i
      setproperty         ${WH}
      getlocal0
      getlocal 5
      getproperty         ${PUB('pct')}
      convert_b
      setproperty         ${WPCT}

      ; se o painel JÁ existe -> só reaplica o viewPort (reposiciona/redimensiona) e sai (sem recarregar)
      getlocal0
      getproperty         ${WV}
      pushnull
      ifeq                Lnew
      getlocal0
      pushnull
      callpropvoid        QName(${NS}, "webpanelResize"), 1
      returnvoid
     Lnew:

      ; wv = new StageWebView()
      getlocal0
      findpropstrict      ${SWV}
      constructprop       ${SWV}, 0
      setproperty         ${WV}

      ; wv.stage = stage
      getlocal0
      getproperty         ${WV}
      getlex              ${CFP}
      getproperty         ${STAGE}
      setproperty         ${PUB('stage')}

      ; wv.addEventListener("locationChanging", webpanelNav)
      getlocal0
      getproperty         ${WV}
      pushstring          "locationChanging"
      getlocal0
      getproperty         QName(${NS}, "webpanelNav")
      callpropvoid        ${PUB('addEventListener')}, 2

      ; stage.addEventListener("resize", webpanelResize) — % acompanha a janela
      getlex              ${CFP}
      getproperty         ${STAGE}
      pushstring          "resize"
      getlocal0
      getproperty         QName(${NS}, "webpanelResize")
      callpropvoid        ${PUB('addEventListener')}, 2

      ; wv.loadURL(cfg.url)
      getlocal0
      getproperty         ${WV}
      getlocal 5
      getproperty         ${PUB('url')}
      coerce_s
      callpropvoid        ${PUB('loadURL')}, 1

      ; aplica o viewPort inicial (calcula do spec)
      getlocal0
      pushnull
      callpropvoid        QName(${NS}, "webpanelResize"), 1

      returnvoid
     end ; code
    end ; body`;

const NEW_TRAITS =
`  trait slot ${WV} type ${SWV} end
  trait slot ${WX} type ${NUMBER} end
  trait slot ${WY} type ${NUMBER} end
  trait slot ${WW} type ${NUMBER} end
  trait slot ${WH} type ${NUMBER} end
  trait slot ${WPCT} type ${BOOLEAN} end
  trait method QName(${NS}, "webpanelClose")
   method
    refid "521423119262311939123423632234:null catch dynamic/instance/webpanelClose"
    param QName(PackageNamespace("flash.events"), "KeyboardEvent")
    returns QName(PackageNamespace("", "#0"), "void")
    body
     maxstack 4
     localcount 2
     initscopedepth 0
     maxscopedepth 1
     code
      getlocal0
      pushscope
      getlocal1
      getproperty         ${PUB('keyCode')}
      pushbyte            27
      ifne                Lc
      ${DISPOSE}
     Lc:
      returnvoid
     end ; code
    end ; body
   end ; method
  end ; trait
  trait method QName(${NS}, "webpanelResize")
   method
    refid "521423119262311939123423632234:null catch dynamic/instance/webpanelResize"
    param QName(PackageNamespace("flash.events"), "Event")
    returns QName(PackageNamespace("", "#0"), "void")
    body
     maxstack 8
     localcount 8
     initscopedepth 0
     maxscopedepth 1
     code
      getlocal0
      pushscope
      ; se não há painel, sai
      getlocal0
      getproperty         ${WV}
      pushnull
      ifne                Lok
      returnvoid
     Lok:
      ; sw (local2) ; sh (local3)
      ${stageW}
      setlocal2
      ${stageH}
      setlocal3

      ; ---- w (local4) ----  pct: sw*WW/100 ; px: WW (se <=0 -> sw)
      getlocal0
      getproperty         ${WPCT}
      iffalse             LwPx
      getlocal2
      getlocal0
      getproperty         ${WW}
      multiply
      pushbyte            100
      divide
      setlocal 4
      jump                LwEnd
     LwPx:
      getlocal0
      getproperty         ${WW}
      setlocal 4
      getlocal 4
      pushbyte            0
      ifgt                LwEnd
      getlocal2
      setlocal 4
     LwEnd:

      ; ---- h (local5) ----  pct: sh*WH/100 ; px: WH (se <=0 -> sh)
      getlocal0
      getproperty         ${WPCT}
      iffalse             LhPx
      getlocal3
      getlocal0
      getproperty         ${WH}
      multiply
      pushbyte            100
      divide
      setlocal 5
      jump                LhEnd
     LhPx:
      getlocal0
      getproperty         ${WH}
      setlocal 5
      getlocal 5
      pushbyte            0
      ifgt                LhEnd
      getlocal3
      setlocal 5
     LhEnd:

      ; ---- x (local6) ----  WX<0 -> (sw-w)/2 ; pct -> sw*WX/100 ; px -> WX
      getlocal0
      getproperty         ${WX}
      pushbyte            0
      lessthan
      iftrue              LxCenter
      getlocal0
      getproperty         ${WPCT}
      iffalse             LxPx
      getlocal2
      getlocal0
      getproperty         ${WX}
      multiply
      pushbyte            100
      divide
      setlocal 6
      jump                LxEnd
     LxPx:
      getlocal0
      getproperty         ${WX}
      setlocal 6
      jump                LxEnd
     LxCenter:
      getlocal2
      getlocal 4
      subtract
      pushbyte            2
      divide
      setlocal 6
     LxEnd:

      ; ---- y (local7) ----  WY<0 -> (sh-h)/2 ; pct -> sh*WY/100 ; px -> WY
      getlocal0
      getproperty         ${WY}
      pushbyte            0
      lessthan
      iftrue              LyCenter
      getlocal0
      getproperty         ${WPCT}
      iffalse             LyPx
      getlocal3
      getlocal0
      getproperty         ${WY}
      multiply
      pushbyte            100
      divide
      setlocal 7
      jump                LyEnd
     LyPx:
      getlocal0
      getproperty         ${WY}
      setlocal 7
      jump                LyEnd
     LyCenter:
      getlocal3
      getlocal 5
      subtract
      pushbyte            2
      divide
      setlocal 7
     LyEnd:

      ; wv.viewPort = new Rectangle(x, y, w, h)
      getlocal0
      getproperty         ${WV}
      findpropstrict      ${RECT}
      getlocal 6
      getlocal 7
      getlocal 4
      getlocal 5
      constructprop       ${RECT}, 4
      setproperty         ${PUB('viewPort')}
      returnvoid
     end ; code
    end ; body
   end ; method
  end ; trait
  trait method QName(${NS}, "webpanelNav")
   method
    refid "521423119262311939123423632234:null catch dynamic/instance/webpanelNav"
    param QName(PackageNamespace("flash.events"), "LocationChangeEvent")
    returns QName(PackageNamespace("", "#0"), "void")
    body
     maxstack 4
     localcount 2
     initscopedepth 0
     maxscopedepth 1
     code
      getlocal0
      pushscope
      getlocal1
      getproperty         ${PUB('location')}
      pushstring          "wpclose"
      callproperty        ${PUB('indexOf')}, 1
      pushbyte            0
      iflt                Ln
      getlocal1
      callpropvoid        ${PUB('preventDefault')}, 0
      ${DISPOSE}
     Ln:
      returnvoid
     end ; code
    end ; body
   end ; method
  end ; trait
`;

const OPEN_TRAIT_ANCHOR = '  trait method QName(PackageNamespace("", "#0"), "5214231803231816123423632234")';
const BODY_RE = new RegExp('refid "' + esc(OPEN_REFID) + '"([\\s\\S]*?)\\n    body[\\s\\S]*?end ; body');

module.exports = {
  id: 'webpanel-button',
  swf: 'library',
  description: 'Painel web IN-GAME via StageWebView (nativo, atualiza ao vivo sobre Stage3D); url/x/y/w/h via OpenWebPanel; ×/ESC fecham. Base do matchmaking.',

  apply({ classes, log }) {
    let seen = false, edits = 0, already = 0;
    for (const c of classes) {
      if (!c.text.includes(OPEN_REFID)) continue;
      seen = true;
      if (c.text.includes('"webpanelWV"')) { already++; break; }
      let t = c.text.replace(BODY_RE, 'refid "' + OPEN_REFID + '"$1\n' + OPEN_BODY);
      if (!t.includes(OPEN_TRAIT_ANCHOR)) throw new Error('anchor da trait openReferrerPanel não encontrado');
      t = t.replace(OPEN_TRAIT_ANCHOR, NEW_TRAITS + OPEN_TRAIT_ANCHOR);
      if (t !== c.text) { c.save(t); edits++; }
      break;
    }
    if (!seen) throw new Error('ReferralsModel.openReferrerPanel não encontrado em library.swf');
    if (edits === 0 && already > 0) return { edits: 0, note: 'já aplicado' };
    if (edits !== 1) throw new Error(`esperava 1 edit, fez ${edits}`);
    log('openReferrerPanel → StageWebView server-driven (JSON url/x/y/w/h) + ×/ESC-close + resize');
    return { edits };
  },
};

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
