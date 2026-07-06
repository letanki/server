'use strict';
/**
 * webpanel-button (library.swf): the in-game web panel is now SERVER-DRIVEN. The client method
 * `alternativa.tanks.model.referrals:ReferralsModel.openReferrerPanel` is actually the handler for the
 * server→client packet 1587315905 (old ReferralInfoDetails). We rewrite it to open an **HTMLLoader**
 * (AIR WebKit, a DisplayObject) whose URL / size / position come from the packet: the server sends a
 * JSON string `{"url","x","y","w","h"}` as the first string param; the client `JSON.parse`s it. x<0
 * means "center on the stage". So the server can pop the panel any time (button, battle entry, event)
 * via `client.sendPacket(OpenWebPanel.default({...}))` — see src/features/webpanel/webpanel.packets.ts.
 *
 * The method signature is (param1:Vector, param2:String url-json, param3:String, param4:String).
 * Handlers added to the class:
 *   - webpanelClose : keyDown ESC (27) → close
 *   - webpanelResize: stage resize → if centered, recompute x/y from the live HTMLLoader size
 *   - webpanelNav   : locationChanging → if the URL contains "wpclose" (the HTML × button), cancel + close
 * Field `webpanelWV` holds the HTMLLoader; `webpanelCentered` remembers whether to recenter on resize.
 * Close = the HTML × (navigates to http://wpclose/) OR ESC. Opening while already open is a no-op.
 */
const NS = 'PrivateNamespace("alternativa.tanks.model.referrals:ReferralsModel")';
const WV = `QName(${NS}, "webpanelWV")`;
const CENTERED = `QName(${NS}, "webpanelCentered")`;
const CFP = 'QName(PackageNamespace("", "#0"), "class function package")';
const STAGE = 'QName(Namespace("alternativa.osgi.service.display:IDisplay"), "stage")';
const SW = 'QName(PackageNamespace("", "#0"), "stageWidth")';
const SH = 'QName(PackageNamespace("", "#0"), "stageHeight")';
const HTML = 'QName(PackageNamespace("flash.html"), "HTMLLoader")';
const URLREQ = 'QName(PackageNamespace("flash.net"), "URLRequest")';
const RECT = 'QName(PackageNamespace("flash.geom"), "Rectangle")';
const SPRITE = 'QName(PackageNamespace("flash.display"), "Sprite")';
const BOX = `QName(${NS}, "webpanelBox")`;
const CROP = 30; // DIAGNÓSTICO: recorte exagerado p/ ver se o clipping do container tem efeito (depois calibrar)
const JSONC = 'QName(PackageNamespace("", "#0"), "JSON")';
const OBJECT = 'QName(PackageNamespace("", "#0"), "Object")';
const BOOLEAN = 'QName(PackageNamespace("", "#0"), "Boolean")';
const PUB = (n) => `QName(PackageNamespace(""), "${n}")`;
const OPEN_REFID = '521423119262311939123423632234:null catch dynamic/instance/5214231803231816123423632234';

const stageW = `getlex               ${CFP}\n      getproperty         ${STAGE}\n      getproperty         ${SW}`;
const stageH = `getlex               ${CFP}\n      getproperty         ${STAGE}\n      getproperty         ${SH}`;
// fecha: se a view existe, remove do palco e zera os campos (guardado contra fechar duas vezes)
const DISPOSE = `getlocal0
      getproperty         ${WV}
      pushnull
      ifeq                Ld
      getlex              ${CFP}
      getproperty         ${STAGE}
      getlocal0
      getproperty         ${BOX}
      callpropvoid        ${PUB('removeChild')}, 1
      getlocal0
      pushnull
      setproperty         ${WV}
      getlocal0
      pushnull
      setproperty         ${BOX}
     Ld:`;

const OPEN_BODY =
`    body
     maxstack 8
     localcount 10
     initscopedepth 0
     maxscopedepth 1
     code
      getlocal0
      pushscope

      ; se já existe painel aberto, não abre outro
      getlocal0
      getproperty         ${WV}
      pushnull
      ifeq                Lgo
      returnvoid
     Lgo:

      ; cfg = JSON.parse(param2)   — param2 = "{"url","x","y","w","h"}" enviado pelo servidor
      getlex              ${JSONC}
      getlocal2
      callproperty        ${PUB('parse')}, 1
      coerce              ${OBJECT}
      setlocal 5

      ; wv = new HTMLLoader()
      getlocal0
      findpropstrict      ${HTML}
      constructprop       ${HTML}, 0
      setproperty         ${WV}

      getlocal0
      getproperty         ${WV}
      pushfalse
      setproperty         ${PUB('paintsDefaultBackground')}

      ; w = int(cfg.w) ; h = int(cfg.h)
      getlocal 5
      getproperty         ${PUB('w')}
      convert_i
      setlocal 6
      getlocal 5
      getproperty         ${PUB('h')}
      convert_i
      setlocal 7

      ; wv.width = w ; wv.height = h
      getlocal0
      getproperty         ${WV}
      getlocal 6
      setproperty         ${PUB('width')}
      getlocal0
      getproperty         ${WV}
      getlocal 7
      setproperty         ${PUB('height')}

      ; x = int(cfg.x) ; y = int(cfg.y)
      getlocal 5
      getproperty         ${PUB('x')}
      convert_i
      setlocal 8
      getlocal 5
      getproperty         ${PUB('y')}
      convert_i
      setlocal 9

      ; centered = (x < 0)
      getlocal0
      getlocal 8
      pushbyte            0
      lessthan
      setproperty         ${CENTERED}

      ; se centralizado: x = (sw-w)/2 ; y = (sh-h)/2
      getlocal0
      getproperty         ${CENTERED}
      iffalse             Lpos
      ${stageW}
      getlocal 6
      subtract
      pushbyte            2
      divide
      convert_i
      setlocal 8
      ${stageH}
      getlocal 7
      subtract
      pushbyte            2
      divide
      convert_i
      setlocal 9
     Lpos:

      ; wv.load(new URLRequest(cfg.url))
      getlocal0
      getproperty         ${WV}
      findpropstrict      ${URLREQ}
      getlocal 5
      getproperty         ${PUB('url')}
      coerce_s
      constructprop       ${URLREQ}, 1
      callpropvoid        ${PUB('load')}, 1

      ; box = new Sprite(); box.addChild(wv) — a view fica dentro de um container que a recorta
      getlocal0
      findpropstrict      ${SPRITE}
      constructprop       ${SPRITE}, 0
      setproperty         ${BOX}
      getlocal0
      getproperty         ${BOX}
      getlocal0
      getproperty         ${WV}
      callpropvoid        ${PUB('addChild')}, 1

      ; box.scrollRect = new Rectangle(CROP, CROP, w-2*CROP, h-2*CROP) — recorta a moldura branca
      ; (scrollRect no Sprite PAI força rasterização, clipando a superfície do HTMLLoader)
      getlocal0
      getproperty         ${BOX}
      findpropstrict      ${RECT}
      pushbyte            ${CROP}
      pushbyte            ${CROP}
      getlocal 6
      pushbyte            ${2 * CROP}
      subtract
      getlocal 7
      pushbyte            ${2 * CROP}
      subtract
      constructprop       ${RECT}, 4
      setproperty         ${PUB('scrollRect')}

      ; box.x = x ; box.y = y
      getlocal0
      getproperty         ${BOX}
      getlocal 8
      setproperty         ${PUB('x')}
      getlocal0
      getproperty         ${BOX}
      getlocal 9
      setproperty         ${PUB('y')}

      ; stage.addChild(box)
      getlex              ${CFP}
      getproperty         ${STAGE}
      getlocal0
      getproperty         ${BOX}
      callpropvoid        ${PUB('addChild')}, 1

      getlocal0
      getproperty         ${WV}
      pushstring          "locationChanging"
      getlocal0
      getproperty         QName(${NS}, "webpanelNav")
      callpropvoid        ${PUB('addEventListener')}, 2

      getlex              ${CFP}
      getproperty         ${STAGE}
      pushstring          "keyDown"
      getlocal0
      getproperty         QName(${NS}, "webpanelClose")
      callpropvoid        ${PUB('addEventListener')}, 2

      getlex              ${CFP}
      getproperty         ${STAGE}
      pushstring          "resize"
      getlocal0
      getproperty         QName(${NS}, "webpanelResize")
      callpropvoid        ${PUB('addEventListener')}, 2

      returnvoid
     end ; code
    end ; body`;

const NEW_TRAITS =
`  trait slot ${WV} type ${HTML} end
  trait slot ${BOX} type ${SPRITE} end
  trait slot ${CENTERED} type ${BOOLEAN} end
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
     maxstack 5
     localcount 2
     initscopedepth 0
     maxscopedepth 1
     code
      getlocal0
      pushscope
      getlocal0
      getproperty         ${WV}
      pushnull
      ifeq                Lr
      getlocal0
      getproperty         ${CENTERED}
      iffalse             Lr
      getlocal0
      getproperty         ${BOX}
      ${stageW}
      getlocal0
      getproperty         ${WV}
      getproperty         ${PUB('width')}
      subtract
      pushbyte            2
      divide
      setproperty         ${PUB('x')}
      getlocal0
      getproperty         ${BOX}
      ${stageH}
      getlocal0
      getproperty         ${WV}
      getproperty         ${PUB('height')}
      subtract
      pushbyte            2
      divide
      setproperty         ${PUB('y')}
     Lr:
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
  description: 'Painel web IN-GAME dirigido pelo servidor (HTMLLoader; url/x/y/w/h via pacote OpenWebPanel); ×/ESC fecham.',

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
    log('openReferrerPanel → HTMLLoader server-driven (JSON url/x/y/w/h) + ×/ESC-close + resize');
    return { edits };
  },
};

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
