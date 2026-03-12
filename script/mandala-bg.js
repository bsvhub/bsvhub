/* ============================================================
   MANDALA NETWORK ANIMATION — mandala-bg.js  v3.0
   ============================================================
   BSV Node network visualisation — DECENTRALISED MULTI-CORE.
   Drop-in replacement for particle-bg.js.
   Identical public API:
     particleBgStart()
     particleBgStop()
     particleBgDestroy()
     particleBgSetOpacity(v)
     CFG  (global config object)

   v3.0 CHANGES vs v2.0:
   • NUM_CORES mandala networks (default 3) distributed across screen
   • Each core competes for blocks — first to receive BLOCK_PACKETS wins
   • BLOCK_PACKETS drives BSV brightness phases (auto-linked)
   • Block win broadcasts to all other cores via golden ring pulse
   • All cores reset on win; new competition begins immediately
   • Cores have lifespan ~60s — decay and new ones form in their place
   • WAN packets route to NEAREST gateway of target core network
   • Backbone dashed lines matched by network ID (always visible)
   • Win broadcast pulses rendered with extra-bright golden glow
   ============================================================ */

/* ============================================================
   MANDALA ARCHITECTURE (v3.0 DECENTRALISED)
   ─────────────────────────────────────────────────────────
   Three layers, always visible simultaneously:

   1. COMPETING CORE CLUSTERS (NUM_CORES, default 3)
      Each is a permanent N-fold symmetric mandala mesh placed
      at distributed positions across the screen. Each has its
      own floating BSV hexagon with BLOCK_PACKETS-step brightness
      ramp. Cores compete: first to receive BLOCK_PACKETS WAN
      packets wins a block, broadcasts a golden ring pulse to the
      other cores, all counters reset. Cores have lifespan ~60s;
      dying cores fade out while new ones fade in to replace them.

   2. OVERLAY NETWORKS
      7 topology types (star, ring, tree, fat-tree, mesh,
      double-ring, radial) spawning and dying continuously.
      Each communicates internally via LAN and externally via
      WAN to other overlays AND a randomly chosen core.

   3. BLOCK COMPETITION SYSTEM
      Each core tracks incoming WAN arrivals separately.
      bsvStep on each core advances 0 → BLOCK_PACKETS-1.
      First core to BLOCK_PACKETS arrivals wins the block:
        • Golden confirmation ring expands from that core's centre
        • Win-broadcast pulses (extra-bright gold) fly to all other cores
        • All cores' counters reset to 0 immediately
        • Global block counter increments in the monitor
   ─────────────────────────────────────────────────────────
   WAN ROUTING (updated):
   • Overlay→core: routes to the NEAREST gateway of the target core
   • Core→overlay: picks weighted random overlay by edge count
   • Core→core: only win-broadcast pulses (special flag)
   • Backbone lines: matched by network ID pair (always lit on activity)

   TUNABLE CONSTANTS (CFG):
     NUM_CORES      — number of competing mandala networks (min 2)
     BLOCK_PACKETS  — packets per core to win a block (controls BSV brightness phases)
     CORE_LIFESPAN_MIN / MAX — core decay timing in frames (3600 = 60s at 60fps)
   ============================================================ */


(function(global){
'use strict';

/* ============================================================
   COLOUR MAP
   ============================================================ */
var PARTICLE_CRT_COLOURS = {
    'default': { primary:'#48B9E4', accent:'#F2B734' },
    'amber':   { primary:'#FFB000', accent:'#FFFFFF' },
    'green':   { primary:'#00CC44', accent:'#AAFFAA' },
    'white':   { primary:'#C8D8EE', accent:'#FFE080' },
    'blue':    { primary:'#5599FF', accent:'#FFD060' },
    'cyan':    { primary:'#00CCDD', accent:'#F5C842' },
};


/* ============================================================
   CONFIG — ALL TUNABLE VALUES
   ============================================================
   TIME NOTE: at 60fps —  60f = 1s | 300f = 5s | 1800f = 30s | 3600f = 60s
   ============================================================ */
var CFG = {

    /* ════════════════════════════════════════════════════════
       DECENTRALISED CORE COMPETITION — KEY NEW PARAMS
       ════════════════════════════════════════════════════════ */

    NUM_CORES:          3,    /* number of competing mandala core networks
                                 range : 2 → 6  [3–5]
                                 ⚠ minimum 2 for competition to be visible  */

    BLOCK_PACKETS:      8,    /* WAN packets a core must receive to win a block
                                 range : 4 → 20  [6–12]
                                 ⚠ also controls BSV brightness phase count   */

    CORE_LIFESPAN_MIN: 3000,  /* min frames a core stays alive (~50s at 60fps)
                                 range : 1800 → 7200  [2400–4800]
                                 ⚠ must be < CORE_LIFESPAN_MAX               */

    CORE_LIFESPAN_MAX: 4800,  /* max frames a core stays alive (~80s at 60fps)
                                 range : 2400 → 10800  [3600–6000]
                                 ⚠ must be > CORE_LIFESPAN_MIN               */

    /* ════════════════════════════════════════════════════════
       LAYER 1 — SCENE
       ════════════════════════════════════════════════════════ */

    MAX_OVERLAYS:       5,    /* simultaneous overlay networks
                                 range : 3 → 12  [4–8]
                                 ⚠ minimum 3 (Rule 6 type diversity)         */

    OPACITY:           0.88,  /* master canvas opacity
                                 range : 0.0 → 1.0  [0.5–0.95]              */

    /* ════════════════════════════════════════════════════════
       LAYER 2 — ANIMATION TIMING
       ════════════════════════════════════════════════════════ */

    WAN_INTERVAL:      432,   /* frames between each network's WAN spawn      */
    WAN_SPEED:         336,   /* frames to travel full router→gateway         */
    WAN_TRAIL:          18,   /* trail length behind WAN dot (frames)         */

    LAN_INTERVAL:      240,   /* frames between LAN spawns per network        */
    LAN_SPEED:         456,   /* frames to travel one LAN edge                */
    LAN_TRAIL:          11,   /* trail length behind LAN dot (frames)         */

    FLASH_DECAY:      0.026,  /* alpha subtracted from flash per frame        */

    FADE_FRAMES:       264,   /* frames to fade a network in OR out           */
    ALIVE_MIN:        2160,   /* min frames an overlay stays alive            */
    ALIVE_MAX:        4080,   /* max frames an overlay stays alive            */

    /* ════════════════════════════════════════════════════════
       LAYER 3 — TOPOLOGY SIZES (px)
       ════════════════════════════════════════════════════════ */

    SIZE_SMALL:         80,
    SIZE_MEDIUM:       120,
    SIZE_LARGE:        168,
    SIZE_CORE:         132,   /* physical radius of the core mesh             */
    CORE_INNER_NODES:   12,
    CORE_GATEWAYS:       4,   /* overridden at runtime by nFaces              */
    CORE_EXTRA_LINKS:    3,
    CORE_LAN_FACTOR:  0.55,

    MARGIN:            160,   /* px kept clear from screen edges              */
    SPAWN_CANDS:        90,   /* candidate positions tried on spawn           */

    /* ════════════════════════════════════════════════════════
       LAYER 4 — NODE COUNTS PER TOPOLOGY
       ════════════════════════════════════════════════════════ */

    PC_SMALL_MIN:        2,
    PC_SMALL_MAX:        5,
    PC_MED_MIN:          4,
    PC_MED_MAX:          9,
    MESH_NODES_MIN:      8,
    MESH_NODES_MAX:     14,
    MESH_LINKS:          2,
    DRING_INNER:         5,
    DRING_OUTER:         9,
    RADIAL_ARMS:         5,
    RADIAL_LEN:          3,
    FATTREE_CORE:        3,
    FATTREE_AGG:         4,
    FATTREE_EDGE:        2,

    /* ════════════════════════════════════════════════════════
       LAYER 5 — CONSENSUS / RING VISUAL
       ════════════════════════════════════════════════════════ */

    CONSENSUS_RING_SPEED: 0.006, /* ring expansion per frame (0→1)           */
    CONSENSUS_RING_SCALE: 2.0,   /* ring expands to SIZE_CORE × this         */

    /* ════════════════════════════════════════════════════════
       LAYER 6 — DEVICE SHAPE SIZES (px)
       ════════════════════════════════════════════════════════ */

    SZ_COMPUTER:   2.0,
    SZ_SERVER:     3.0,
    SZ_ROUTER:     3.8,
    SZ_SWITCH:     3.5,
    SZ_MINER:      4.0,
    SZ_VALIDATOR:  3.8,
    SZ_IOT:        2.5,
    SZ_GATEWAY:    5.2,
    SZ_CORE_NODE:  4.2,
    SZ_BSV_HEX:   15.2,
};


/* ── Internal constants ────────────────────────────────────── */
var ST = { FADE_IN:0, ALIVE:1, FADE_OUT:2, DEAD:3, CORE:4 };
var DT = {
    COMPUTER:0, SERVER:1, ROUTER:2, SWITCH:3,
    MINER:4, VALIDATOR:5, IOT:6, GATEWAY:7, CORE_NODE:8,
    BSV_HEX:9,
};


/* ============================================================
   COLOUR HELPERS
   ============================================================ */
var colour = {
    pr:72, pg:185, pb:228,
    ar:242,ag:183, ab:52,
};

function setColour(pair) {
    var p = pair || {};
    function parse(hex, target) {
        var c = (hex||'').trim();
        if (/^#[0-9a-fA-F]{6}$/i.test(c)) {
            target[0]=parseInt(c.slice(1,3),16);
            target[1]=parseInt(c.slice(3,5),16);
            target[2]=parseInt(c.slice(5,7),16);
        } else if (/^#[0-9a-fA-F]{3}$/i.test(c)) {
            target[0]=parseInt(c[1]+c[1],16);
            target[1]=parseInt(c[2]+c[2],16);
            target[2]=parseInt(c[3]+c[3],16);
        }
    }
    var pv=[colour.pr,colour.pg,colour.pb];
    var av=[colour.ar,colour.ag,colour.ab];
    parse(p.primary, pv); parse(p.accent, av);
    colour.pr=pv[0]; colour.pg=pv[1]; colour.pb=pv[2];
    colour.ar=av[0]; colour.ag=av[1]; colour.ab=av[2];
    _glowCacheInvalidate();
}

function col(a, accent) {
    var r=accent?colour.ar:colour.pr;
    var g=accent?colour.ag:colour.pg;
    var b=accent?colour.ab:colour.pb;
    return 'rgba('+r+','+g+','+b+','+Math.min(1,Math.max(0,a))+')';
}
function smooth(t){ t=t<0?0:t>1?1:t; return t*t*(3-2*t); }


/* ============================================================
   GLOW SPRITE CACHE
   ============================================================ */
var _glowCache    = {};
var _glowColourKey = '';

function _glowCacheInvalidate(){ _glowCache={}; _glowColourKey=''; }

function _glowSprite(outerR, peakAlpha, accent) {
    var ck = colour.pr+','+colour.pg+','+colour.pb+
             '|'+colour.ar+','+colour.ag+','+colour.ab;
    if (ck !== _glowColourKey){ _glowCache={}; _glowColourKey=ck; }
    var qR  = Math.round(outerR);
    var qA  = Math.round(peakAlpha * 20) / 20;
    var key = (accent?'a':'p') + qR + ':' + qA;
    if (!_glowCache[key]) {
        var dim = qR*2+2;
        var oc  = document.createElement('canvas');
        oc.width = oc.height = dim;
        var ox  = oc.getContext('2d');
        var cx  = dim*0.5;
        var r = accent?colour.ar:colour.pr;
        var g = accent?colour.ag:colour.pg;
        var b = accent?colour.ab:colour.pb;
        var gr = ox.createRadialGradient(cx,cx,0,cx,cx,qR);
        gr.addColorStop(0,'rgba('+r+','+g+','+b+','+qA+')');
        gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
        ox.beginPath(); ox.arc(cx,cx,qR,0,Math.PI*2);
        ox.fillStyle=gr; ox.fill();
        _glowCache[key]=oc;
    }
    return _glowCache[key];
}

function _drawGlow(ctx,x,y,outerR,peakAlpha,accent){
    if(peakAlpha<0.005) return;
    var s=_glowSprite(outerR,peakAlpha,!!accent);
    var h=s.width*0.5;
    ctx.drawImage(s,x-h,y-h);
}


/* ============================================================
   DEVICE DRAWING
   net — optional, used for BSV_HEX to get per-core bsvStep
   ============================================================ */
function drawDevice(ctx, dev, alpha, inCore, net) {
    var a=alpha; if(a<0.005) return;
    var fl=(dev.flash||0)*a;
    var ac=inCore && (dev.type===DT.GATEWAY);

    if(dev.type===DT.GATEWAY){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,32+fl*24,fl*0.82,true);
        _drawGlow(ctx,dev.x,dev.y,22,0.20*a,true);
        ctx.beginPath(); ctx.arc(dev.x,dev.y,CFG.SZ_GATEWAY,0,Math.PI*2);
        ctx.strokeStyle=col(Math.min(1,a*0.82+fl*0.40),true);
        ctx.lineWidth=1.6; ctx.stroke();
        ctx.beginPath(); ctx.arc(dev.x,dev.y,CFG.SZ_GATEWAY*0.42,0,Math.PI*2);
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.50),true);
        ctx.fill(); return;
    }

    if(dev.type===DT.CORE_NODE){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,22+fl*16,fl*0.68,false);
        _drawGlow(ctx,dev.x,dev.y,12,0.14*a,false);
        var r=CFG.SZ_CORE_NODE;
        ctx.beginPath();
        for(var i=0;i<8;i++){
            var ang=i*Math.PI/4+Math.PI/8;
            var px=dev.x+Math.cos(ang)*r, py=dev.y+Math.sin(ang)*r;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.40),false);
        ctx.fill(); return;
    }

    if(dev.type===DT.ROUTER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,20+fl*18,fl*0.65,false);
        ctx.beginPath(); ctx.arc(dev.x,dev.y,CFG.SZ_ROUTER,0,Math.PI*2);
        ctx.fillStyle=col(Math.min(1,a+fl*0.55),false);
        ctx.fill(); return;
    }

    if(dev.type===DT.SWITCH){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,14+fl*10,fl*0.50,false);
        var s=CFG.SZ_SWITCH;
        ctx.beginPath();
        ctx.moveTo(dev.x,dev.y-s); ctx.lineTo(dev.x+s,dev.y);
        ctx.lineTo(dev.x,dev.y+s); ctx.lineTo(dev.x-s,dev.y);
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.40),false);
        ctx.fill(); return;
    }

    if(dev.type===DT.COMPUTER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,12+fl*8,fl*0.45,false);
        var s=CFG.SZ_COMPUTER;
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.35),false);
        ctx.fillRect(dev.x-s,dev.y-s,s*2,s*2); return;
    }

    if(dev.type===DT.SERVER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,14+fl*10,fl*0.48,false);
        var s=CFG.SZ_SERVER;
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.35),false);
        ctx.fillRect(dev.x-s,dev.y-s,s*2,s*2); return;
    }

    if(dev.type===DT.MINER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,18+fl*14,fl*0.60,false);
        var r=CFG.SZ_MINER;
        ctx.beginPath();
        for(var i=0;i<6;i++){
            var ang=Math.PI/6+i*Math.PI/3;
            var px=dev.x+Math.cos(ang)*r, py=dev.y+Math.sin(ang)*r;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.88+fl*0.45),false);
        ctx.fill(); return;
    }

    if(dev.type===DT.VALIDATOR){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,16+fl*12,fl*0.55,ac);
        var r=CFG.SZ_VALIDATOR;
        ctx.beginPath();
        ctx.moveTo(dev.x,              dev.y-r);
        ctx.lineTo(dev.x+r*0.866,      dev.y+r*0.5);
        ctx.lineTo(dev.x-r*0.866,      dev.y+r*0.5);
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.40),ac);
        ctx.fill(); return;
    }

    if(dev.type===DT.IOT){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,10+fl*8,fl*0.40,false);
        var arm=CFG.SZ_IOT, thick=0.9;
        ctx.fillStyle=col(Math.min(1,a*0.75+fl*0.30),false);
        ctx.fillRect(dev.x-arm,   dev.y-thick, arm*2,   thick*2);
        ctx.fillRect(dev.x-thick, dev.y-arm,   thick*2, arm*2);
        return;
    }

    if(dev.type===DT.BSV_HEX){
        /* Use per-core bsvStep & pendingGlow when net is provided */
        var step    = (net ? (net.bsvStep||0)    : 0);
        var pglow   = (net ? (net.pendingGlow||0) : 0);
        var baseR   = CFG.SZ_BSV_HEX;
        var breath  = 0.05+Math.sin((sim?sim.frame:0)*0.022)*0.025;
        _drawGlow(ctx,dev.x,dev.y,baseR*2.4,(breath+pglow*0.22)*a,false);
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,baseR*3.6,fl*0.45,true);
        ctx.beginPath();
        for(var i=0;i<6;i++){
            var ang=Math.PI/6+i*Math.PI/3;
            var px=dev.x+Math.cos(ang)*baseR, py=dev.y+Math.sin(ang)*baseR;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,0.88*a),false);
        ctx.fill();
        ctx.strokeStyle=col(Math.min(1,0.96*a),false);
        ctx.lineWidth=1.6; ctx.stroke();
        ctx.beginPath();
        for(var i=0;i<6;i++){
            var ang=Math.PI/6+i*Math.PI/3;
            var px=dev.x+Math.cos(ang)*baseR*0.72, py=dev.y+Math.sin(ang)*baseR*0.72;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.strokeStyle=col(Math.min(1,0.36*a),false);
        ctx.lineWidth=0.8; ctx.stroke();
        /* BSV symbol — BLOCK_PACKETS brightness steps */
        _drawBSVSymbol(ctx, dev.x, dev.y, baseR*0.66, step, a);
        return;
    }
}

/* ── BSV Symbol — brightness steps = CFG.BLOCK_PACKETS ────────
   step = 0 … (BLOCK_PACKETS-1)  dim ember → full orange
   ─────────────────────────────────────────────────────────── */
function _drawBSVSymbol(ctx, cx, cy, sz, step, alpha){
    var n = CFG.BLOCK_PACKETS;
    var levels = [];
    for(var i=0;i<n;i++){
        /* exponential ramp: very dim at 0, blazing at n-1 */
        levels.push(0.06 + 0.92 * Math.pow(i/Math.max(n-1,1), 1.4));
    }
    var bA=Math.min(1, levels[Math.min(n-1,Math.max(0,step))]*alpha);

    ctx.save();
    ctx.fillStyle = col(bA,true);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 " + (sz*1.9) + "px system-ui, Segoe UI, Arial, sans-serif";
    var _m = ctx.measureText("₿");
    var _w = _m.actualBoundingBoxLeft + _m.actualBoundingBoxRight;
    var _h = _m.actualBoundingBoxAscent + _m.actualBoundingBoxDescent;
    ctx.fillText("₿",
        cx - _m.actualBoundingBoxLeft - _w / 2 - sz * 0.1,
        cy + _m.actualBoundingBoxAscent - _h / 2
    );
    ctx.restore();
}


/* ── Electric arc force-field between two points ──────────────
   Two animated jagged passes in primary (blue) colour.
   ─────────────────────────────────────────────────────────── */
function _drawElectricArc(ctx, x1, y1, x2, y2, frame, alpha){
    if(alpha<0.005) return;
    var dx=x2-x1, dy=y2-y1;
    var len=Math.sqrt(dx*dx+dy*dy); if(len<1) return;
    var nx=-dy/len, ny=dx/len;
    ctx.save(); ctx.lineCap='round';
    for(var pass=0; pass<2; pass++){
        var ph1=frame*0.13+pass*2.3, ph2=frame*0.09+pass*1.7+0.8, ph3=frame*0.07+pass*3.1+1.6;
        var amp=len*0.13;
        var d1=Math.sin(ph1)*amp, d2=Math.cos(ph2)*amp*0.7, d3=Math.sin(ph3)*amp*0.5;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x1+dx*0.20+nx*d1, y1+dy*0.20+ny*d1);
        ctx.lineTo(x1+dx*0.42+nx*d2, y1+dy*0.42+ny*d2);
        ctx.lineTo(x1+dx*0.62+nx*d3, y1+dy*0.62+ny*d3);
        ctx.lineTo(x1+dx*0.82+nx*d1*0.6, y1+dy*0.82+ny*d1*0.6);
        ctx.lineTo(x2,y2);
        ctx.strokeStyle=col(alpha*(pass===0?0.52:0.22),false);
        ctx.lineWidth=pass===0?0.9:0.5;
        ctx.stroke();
    }
    ctx.restore();
}


/* ============================================================
   _pickTopoType  — type-diversity overlay selector  (Rule 6)
   ============================================================ */
var TOPO_COUNT = 7;
var TOPO_NAMES = ['star','ring','tree','fat-tree','mesh','dbl-ring','radial'];

function _pickTopoType(){
    var counts=[], i;
    for(i=0;i<TOPO_COUNT;i++) counts[i]=0;
    sim.networks.forEach(function(n){
        if(!n.isCore && n.state!==ST.DEAD && n.topoType>=0)
            counts[n.topoType]++;
    });
    var missing=[];
    for(i=0;i<TOPO_COUNT;i++) if(counts[i]===0) missing.push(i);
    if(missing.length>0) return missing[Math.floor(Math.random()*missing.length)];
    var minC=Math.min.apply(null,counts), least=[];
    for(i=0;i<TOPO_COUNT;i++) if(counts[i]===minC) least.push(i);
    return least[Math.floor(Math.random()*least.length)];
}


/* ============================================================
   SIMULATION STATE
   ============================================================ */
var sim = {
    netIdCounter: 0,
    networks:     [],
    coreNets:     [],
    coreNet:      null,
    pulses:       [],
    frame:        0,
    globalBlocks: 0,
    blockCooldown: 0,
    speedIdx:     4,           /* index into SPEED_STEPS; 4=1.0x default */
    zoomLevel:    0,           /* -10 to +10; zoom = 2^(zoomLevel/10)    */
    fpsLast:      0,           /* timestamp of last fps sample              */
    fpsFrames:    0,           /* frames counted in current second          */
    fps:          0,           /* smoothed FPS value                        */
};

var SPEED_STEPS=[0.25,0.375,0.5,0.75,1.0,1.25,1.5,2.0,3.0,4.0];
function _speed(){ return SPEED_STEPS[sim.speedIdx]; }
function _zoom(){  return Math.pow(2, sim.zoomLevel/10); }

/* Effective spawn/layout bounds accounting for current zoom */
function _effectiveBounds(){
    var z=_zoom();
    var hw=scene.W/(2*z), hh=scene.H/(2*z);
    return { x0:scene.W*0.5-hw, y0:scene.H*0.5-hh,
             x1:scene.W*0.5+hw, y1:scene.H*0.5+hh };
}

/* Speed-scaled helpers */
function _effFadeFrames(){ return Math.max(20, Math.round(CFG.FADE_FRAMES/_speed())); }
function _effFlashDecay(){ return Math.min(0.5, CFG.FLASH_DECAY*_speed()); }


/* ============================================================
   NETWORK CLASS
   ============================================================ */
function Network(cx, cy, isCore) {
    this.id        = ++sim.netIdCounter;
    this.cx        = cx;
    this.cy        = cy;
    this.isCore    = !!isCore;
    this.alpha     = 0;
    this.state     = ST.FADE_IN;
    this.stf       = 0;
    this.devices      = [];
    this.edges        = [];
    this.routerIdx    = 0;
    this.gatewayIdxs  = [];
    this.lanTimer     = Math.floor(Math.random()*CFG.LAN_INTERVAL);
    this.wanTimer     = 0;
    this.wanPendingFirst = true;
    this._wanCooldown    = {};

    if(isCore){
        this.topoType        = -1;
        /* Per-core competition state */
        this.blockPackets    = 0;
        this.bsvStep         = 0;
        this.pendingGlow     = 0;
        this.blockRings      = [];
        this.coreLifespan    = CFG.CORE_LIFESPAN_MIN +
            Math.floor(Math.random()*(CFG.CORE_LIFESPAN_MAX-CFG.CORE_LIFESPAN_MIN));
        this._buildCore();
    } else {
        this.aliveDuration = CFG.ALIVE_MIN +
            Math.floor(Math.random()*(CFG.ALIVE_MAX-CFG.ALIVE_MIN));
        this.topoType = _pickTopoType();
        var builders=[
            '_buildStar','_buildRing','_buildTree','_buildFatTree',
            '_buildMesh','_buildDoubleRing','_buildRadialArms',
        ];
        this[builders[this.topoType]]();
    }
}


/* ── Geometry helpers ─────────────────────────────────────── */
Network.prototype._add = function(x,y,type){
    this.devices.push({x:x,y:y,type:type,flash:0});
    return this.devices.length-1;
};
Network.prototype._edge = function(a,b,t){
    for(var i=0;i<this.edges.length;i++){
        var e=this.edges[i];
        if((e.a===a&&e.b===b)||(e.a===b&&e.b===a)) return;
    }
    this.edges.push({a:a,b:b,t:t||'access'});
};
Network.prototype._sortByDist = function(fromIdx,pool){
    var ref=this.devices[fromIdx];
    return pool.slice().sort(function(a,b){
        var da=this.devices[a],db=this.devices[b];
        return ((da.x-ref.x)*(da.x-ref.x)+(da.y-ref.y)*(da.y-ref.y))-
               ((db.x-ref.x)*(db.x-ref.x)+(db.y-ref.y)*(db.y-ref.y));
    }.bind(this));
};
Network.prototype._connectNearest = function(fromIdx,pool,n,edgeType){
    var sorted=this._sortByDist(fromIdx,pool);
    for(var i=0;i<Math.min(n,sorted.length);i++)
        this._edge(fromIdx,sorted[i],edgeType||'uplink');
};
Network.prototype._placeRing = function(n,radius,rot,type){
    var idxs=[];
    for(var i=0;i<n;i++){
        var a=rot+i*(Math.PI*2/n);
        idxs.push(this._add(this.cx+Math.cos(a)*radius,this.cy+Math.sin(a)*radius,type));
    }
    return idxs;
};
Network.prototype._connectRing = function(idxs,edgeType){
    for(var i=0;i<idxs.length;i++)
        this._edge(idxs[i],idxs[(i+1)%idxs.length],edgeType||'access');
};
Network.prototype._routerAtEdge = function(size,factor){
    var ra=Math.random()*Math.PI*2;
    var idx=this._add(this.cx+Math.cos(ra)*size*factor,
                      this.cy+Math.sin(ra)*size*factor,DT.ROUTER);
    this.routerIdx=idx; return idx;
};

/* routerPos: single stable position for this network's WAN anchor.
   Overlays: their one router node.
   Cores: gatewayIdxs[0] (kept for legacy callers only).           */
Network.prototype.routerPos = function(){
    var idx=this.isCore&&this.gatewayIdxs.length>0
        ? this.gatewayIdxs[0] : this.routerIdx;
    var r=this.devices[idx];
    return r?{x:r.x,y:r.y}:{x:this.cx,y:this.cy};
};

/* nearestAnchorTo(otherNet) — returns the position on THIS network
   that is closest to the other network's centre.
   • Overlays have exactly one router  → always returns that router.
   • Cores have a full gateway ring    → picks the gateway facing
     the other network (shortest WAN hop = shortest backbone path).
   Used by both backbone-line drawing AND WanPulse construction so
   every packet is guaranteed to travel on its drawn path.          */
Network.prototype.nearestAnchorTo = function(other){
    var tx=other.cx, ty=other.cy;
    if(this.isCore && this.gatewayIdxs && this.gatewayIdxs.length>0){
        var best=null, bestD=Infinity;
        for(var i=0;i<this.gatewayIdxs.length;i++){
            var gd=this.devices[this.gatewayIdxs[i]];
            if(!gd) continue;
            var dx=gd.x-tx, dy=gd.y-ty, d=dx*dx+dy*dy;
            if(d<bestD){bestD=d; best={x:gd.x,y:gd.y};}
        }
        if(best) return best;
    }
    /* Overlay: nearest among candidate anchor points
       (router plus any other edge-facing device)     */
    var r=this.devices[this.routerIdx];
    return r?{x:r.x,y:r.y}:{x:this.cx,y:this.cy};
};

/* primaryGatewayPos — alias kept for any remaining callers */
Network.prototype.primaryGatewayPos = function(){
    return this.routerPos();
};

/* nearestGatewayPos — legacy alias */
Network.prototype.nearestGatewayPos = function(fromX, fromY){
    var dummy={cx:fromX,cy:fromY,isCore:false,routerIdx:0,devices:[],gatewayIdxs:[]};
    return this.nearestAnchorTo(dummy);
};


/* ══════════════════════════════════════════════════════════════
   FRACTAL SNOWFLAKE MANDALA GENERATOR
   ══════════════════════════════════════════════════════════════
   Each mandala is grown from a DNA vector of 8+ independent
   continuous/discrete parameters.  The combinatorial space
   exceeds 10^12 distinct topologies — no duplicate checking
   is needed.

   MATHEMATICS
   -----------
   Ring radii follow a phi-spiral (golden-ratio lattice):
       r_k  =  r0 * phi^(k * phi_exp)
   where phi_exp in (0.55, 1.45) is independently randomised,
   creating tight / loose / Fibonacci / logarithmic spirals.

   Each shell has its own harmonic multiplier h_k in
   {1, 2, 3, 1/2, 2/3, 3/2} applied to the base symmetry n,
   so node counts across rings form a harmonic series:
   n, 2n, n, 3n, n/2 ...
   This generates the same interference patterns seen in
   Chladni figures and cymatics.

   Per-ring twist accumulates: theta_k = theta_{k-1} + delta_k
   where delta_k is drawn from a bounded random walk, producing
   spiral lattices and contra-rotating shells.

   Arm bifurcation at outer rings spawns child nodes offset by
   +/-pi/(2n) with a configurable probability, giving tree-like
   dendritic tips reminiscent of ice-crystal growth.

   Hub style (0-4) varies how the BSV centre connects inward:
   spoke / double-spoke / starburst / golden-pentagram / web.

   DNA vector (8+ independent parameters, sampled once per core):
     n_base   - symmetry order (curated harmonic set, primes+composites)
     phi_exp  - golden-ratio exponent for radius scaling
     twist[]  - per-ring phase offset (bounded random walk)
     harm[]   - per-ring harmonic multiplier array
     r0_frac  - innermost ring radius fraction
     depth    - ring count (2-5)
     branch_p - arm bifurcation probability
     hub      - centre connection style (0-4)
     cross_k  - cross-link neighbour count (1-3)
     jitter   - per-node radial noise coefficient
   ══════════════════════════════════════════════════════════════ */
Network.prototype._buildCore = function(){
    var sp=CFG.SIZE_CORE, cx=this.cx, cy=this.cy;
    var PHI=1.6180339887;
    var TAU=Math.PI*2;

    /* Symmetry orders weighted toward visually rich ranges.
       Primes (5,7,11,13) create aperiodic long-range structure.
       Composites with many divisors (12,24) create dense webs. */
    // AFTER — max is now 24
    var N_POOL=[3,4,5,5,6,6,7,7,8,8,9,10,10,11,12,12,13,14,15,16,18,20,21,24];
    var n=N_POOL[Math.floor(Math.random()*N_POOL.length)];
    var nGW=Math.max(6,Math.min(24,n)); /* gateway count: 6-24 */

    var phi_exp = 0.55+Math.random()*0.90;  /* phi-spiral tightness  */
    var r0_frac = 0.14+Math.random()*0.14;  /* innermost ring radius */
    var depth   = 2+Math.floor(Math.random()*4); /* 2-5 rings        */
    var hub     = Math.floor(Math.random()*5);   /* hub style 0-4    */
    var cross_k = 1+Math.floor(Math.random()*3); /* 1-3 cross-links  */
    var branch_p= Math.random()*0.65;            /* bifurcation prob */
    var jitter  = Math.random()*0.10;            /* radial noise     */
    var baseRot = Math.random()*TAU;             /* global rotation  */

    /* Harmonic multipliers: each ring drawn independently */
    var HARM=[1,1,1,2,2,3,0.5,0.67,1.5];
    var harm=[];
    for(var d=0;d<depth;d++) harm.push(HARM[Math.floor(Math.random()*HARM.length)]);

    /* Per-ring twist: bounded random walk so outer rings spiral */
    var twist=[baseRot];
    var twistStep=(-0.5+Math.random())*(Math.PI/n)*1.6;
    var twistJitter=0.18*(Math.random()-0.5)*(Math.PI/n);
    for(var d=1;d<depth;d++){
        twist.push(twist[d-1]+twistStep+twistJitter*(Math.random()-0.5));
    }

    /* Ring radii: r_k = sp * r0 * phi^(k * phi_exp) */
    var radii=[];
    for(var d=0;d<depth;d++) radii.push(sp*r0_frac*Math.pow(PHI,d*phi_exp));
    /* Scale down if outermost ring exceeds sp bounds */
    var rMax=radii[depth-1];
    if(rMax>sp*0.88){
        var rScale=sp*0.88/rMax;
        for(var d=0;d<depth;d++) radii[d]*=rScale;
    }

    var DTYPES=[DT.VALIDATOR,DT.CORE_NODE,DT.MINER,DT.VALIDATOR,DT.CORE_NODE];

    /* BUILD CENTER */
    var center=this._add(cx,cy,DT.BSV_HEX);
    var all=[center];
    var rings=[];

    /* BUILD RINGS */
    for(var d=0;d<depth;d++){
        var r=radii[d];
        var rawN=Math.max(2,Math.round(n*harm[d]));
        /* Keep arc-spacing visually sane */
        var maxN=Math.max(2,Math.floor(TAU*r/8));
        var nN=Math.min(rawN,maxN);
        var dt=DTYPES[d%DTYPES.length];
        var ring=[];
        for(var i=0;i<nN;i++){
            var a=twist[d]+i*(TAU/nN);
            var jitR=r*(1+jitter*(Math.random()*2-1));
            var jitA=a+(Math.random()-0.5)*(TAU/nN)*jitter*0.5;
            var idx=this._add(cx+Math.cos(jitA)*jitR,cy+Math.sin(jitA)*jitR,dt);
            ring.push(idx);
            all.push(idx);
        }
        rings.push(ring);
        this._connectRing(ring,'trunk');
    }

    /* INTER-RING RADIAL CONNECTIONS */
    for(var d=1;d<depth;d++){
        var inner=rings[d-1], outer=rings[d];
        for(var i=0;i<outer.length;i++)
            this._connectNearest(outer[i],inner,Math.min(cross_k,inner.length),'trunk');
        for(var i=0;i<inner.length;i++)
            this._connectNearest(inner[i],outer,1,'trunk');
    }

    /* ARM BIFURCATION: fractal dendritic tips */
    var outerRing=rings[depth-1];
    var branchNodes=[];
    if(branch_p>0.05&&depth>=2&&outerRing.length<=24){
        var halfAngle=(Math.PI/n)*0.65;
        var branchR=radii[depth-1]*(1+0.28*PHI/(depth+1));
        if(branchR<=sp*0.90){
            for(var i=0;i<outerRing.length;i++){
                if(Math.random()>branch_p) continue;
                var od=this.devices[outerRing[i]];
                var baseA=Math.atan2(od.y-cy,od.x-cx);
                for(var side=-1;side<=1;side+=2){
                    var ba=baseA+side*halfAngle;
                    var bidx=this._add(
                        cx+Math.cos(ba)*branchR,
                        cy+Math.sin(ba)*branchR,
                        DT.MINER);
                    this._edge(outerRing[i],bidx,'trunk');
                    branchNodes.push(bidx);
                    all.push(bidx);
                }
            }
        }
    }

    /* HUB CONNECTION STYLES */
    var innerRing=rings[0];
    if(hub===0){
        /* Spoke: centre to every inner node */
        for(var i=0;i<innerRing.length;i++) this._edge(center,innerRing[i],'trunk');
    } else if(hub===1){
        /* Double-spoke: every other + skip-one diagonals */
        for(var i=0;i<innerRing.length;i++){
            if(i%2===0) this._edge(center,innerRing[i],'trunk');
        }
        for(var i=0;i<innerRing.length;i++){
            var j=(i+2)%innerRing.length;
            this._edge(innerRing[i],innerRing[j],'trunk');
        }
    } else if(hub===2){
        /* Starburst: centre to nearest cross_k inner nodes */
        this._connectNearest(center,innerRing,Math.min(cross_k+1,innerRing.length),'trunk');
    } else if(hub===3){
        /* Golden pentagram: connect every floor(n/phi)-th node */
        var step=Math.max(2,Math.round(innerRing.length/PHI));
        var seen={}, pos=0;
        for(var i=0;i<innerRing.length;i++){
            var next=(pos+step)%innerRing.length;
            var key=Math.min(pos,next)+'_'+Math.max(pos,next);
            if(!seen[key]){ this._edge(innerRing[pos],innerRing[next],'trunk'); seen[key]=1; }
            pos=next;
        }
        for(var i=0;i<innerRing.length;i++) this._edge(center,innerRing[i],'trunk');
    } else {
        /* Cross-web: phi-jump connections across the ring */
        for(var i=0;i<innerRing.length;i++){
            var j=Math.round(i*PHI)%innerRing.length;
            this._edge(innerRing[i],innerRing[j],'trunk');
        }
        this._connectNearest(center,innerRing,innerRing.length,'trunk');
    }

    /* GATEWAY RING */
    var gwR=sp*1.05;
    var gwRot=baseRot+(Math.random()-0.5)*(Math.PI/nGW)*0.4;
    var gwConnect=branchNodes.length?branchNodes:outerRing;
    for(var i=0;i<nGW;i++){
        var a=gwRot+i*(TAU/nGW);
        var gIdx=this._add(cx+Math.cos(a)*gwR,cy+Math.sin(a)*gwR,DT.GATEWAY);
        this.gatewayIdxs.push(gIdx);
        this._connectNearest(gIdx,gwConnect,Math.min(2,gwConnect.length),'uplink');
    }
    this._connectRing(this.gatewayIdxs,'uplink');
    this.routerIdx=this.gatewayIdxs[0];

    /* ARC TARGETS for electric force-fields */
    var arcPool=innerRing.length?innerRing:all.filter(function(i){return i!==center;});
    var sortedArc=this._sortByDist(center,arcPool);
    this.arcTargets=sortedArc.slice(0,Math.min(nGW,sortedArc.length));
    this.laserTimer=0;
};


/* ══════════════════════════════════════════════════════════════
   OVERLAY TOPOLOGY BUILDERS  —  PARAMETRIC INFINITE-VARIETY
   ══════════════════════════════════════════════════════════════
   Every topology is driven by a fresh random DNA vector so no
   two networks on screen are ever alike.  The combinatorial
   space of each builder alone exceeds 10^8 distinct layouts.

   Design principles shared across all topologies:
   • Continuous float parameters (angles, radii, spreads)
   • Node counts drawn from ranges, not fixed values
   • Per-node positional jitter proportional to local scale
   • Edge density and cross-link count independently varied
   • Router attachment angle + distance both randomised
   • Device-type palette shuffled per instance
   ══════════════════════════════════════════════════════════════ */

/* ── STAR ─────────────────────────────────────────────────────
   Hub-and-spoke with optional secondary tiers and chord links.
   Parameters: arm count, arm length variance, spread arc,
   secondary branch probability, hub offset, chord density.     */
Network.prototype._buildStar = function(){
    var sp = CFG.SIZE_SMALL*(0.85+Math.random()*0.45);
    var r  = this._routerAtEdge(sp, 0.62+Math.random()*0.24);
    var ra = Math.atan2(this.devices[r].y-this.cy, this.devices[r].x-this.cx);

    /* Hub: randomly offset from exact centre for asymmetry */
    var hOff = sp*(Math.random()*0.18);
    var hAng = ra+Math.PI+(Math.random()-0.5)*0.9;
    var sw = this._add(
        this.cx+Math.cos(hAng)*hOff,
        this.cy+Math.sin(hAng)*hOff, DT.SWITCH);
    this._edge(r, sw, 'uplink');

    /* Arm parameters */
    var n         = 3+Math.floor(Math.random()*9);       /* 3–11 arms     */
    var spreadArc = (0.55+Math.random()*0.45)*Math.PI*2; /* arc coverage  */
    var arcStart  = ra+Math.PI - spreadArc*0.5;
    var lenMu     = sp*(0.38+Math.random()*0.32);        /* mean arm len  */
    var lenSig    = lenMu*0.25*Math.random();             /* len variance  */
    var branch_p  = Math.random()*0.45;                  /* 2nd-tier prob */
    var chord_p   = Math.random()*0.35;                  /* chord prob    */
    var LEAFPOOL  = [DT.COMPUTER,DT.IOT,DT.COMPUTER,DT.MINER,DT.VALIDATOR,DT.IOT];

    var tips = [];
    for(var i=0;i<n;i++){
        var a  = arcStart + (n>1?i/(n-1):0.5)*spreadArc;
        var d  = lenMu + (Math.random()-0.5)*lenSig*2;
        var jA = (Math.random()-0.5)*(spreadArc/n)*0.3;
        var leaf = LEAFPOOL[Math.floor(Math.random()*LEAFPOOL.length)];
        var t = this._add(
            this.cx+Math.cos(a+jA)*d,
            this.cy+Math.sin(a+jA)*d, leaf);
        this._edge(sw, t, 'access');
        tips.push(t);

        /* Optional secondary branch off this arm */
        if(Math.random()<branch_p){
            var ba = a+jA + (Math.random()<0.5?0.30:-0.30);
            var bd = d*(0.45+Math.random()*0.30);
            var bt = this._add(
                this.cx+Math.cos(ba)*bd,
                this.cy+Math.sin(ba)*bd,
                Math.random()<0.5?DT.IOT:DT.COMPUTER);
            this._edge(t, bt, 'access');
        }
    }

    /* Optional chord links between non-adjacent tips */
    if(chord_p>0.05&&tips.length>3){
        var chords = Math.floor(chord_p*tips.length*0.5);
        for(var c=0;c<chords;c++){
            var ai=Math.floor(Math.random()*tips.length);
            var bi=(ai+2+Math.floor(Math.random()*(tips.length-3)))%tips.length;
            this._edge(tips[ai],tips[bi],'access');
        }
    }
};

/* ── RING ─────────────────────────────────────────────────────
   Arc or full-circle ring with variable skip connections,
   optional inner satellite nodes, and spiral distortion.
   Parameters: node count, arc span, radius noise, skip-links,
   satellite count, spiral twist, chord style.                  */
Network.prototype._buildRing = function(){
    var sp  = CFG.SIZE_MEDIUM*(0.80+Math.random()*0.50);
    var r   = this._routerAtEdge(sp, 0.65+Math.random()*0.25);
    var ra  = Math.atan2(this.devices[r].y-this.cy, this.devices[r].x-this.cx);

    var n        = 4+Math.floor(Math.random()*12);         /* 4–15 nodes    */
    var arcFull  = Math.random()>0.38;                     /* full circle?  */
    var arcSpan  = arcFull ? Math.PI*2 : (0.7+Math.random()*1.1)*Math.PI;
    var arcStart = arcFull ? 0 : ra+Math.PI - arcSpan*0.5;
    var rMu      = sp*(0.50+Math.random()*0.28);           /* mean radius   */
    var rSig     = rMu*Math.random()*0.18;                 /* radius noise  */
    var spiral   = (Math.random()-0.5)*0.8;                /* spiral twist  */
    var skipK    = Math.random()>0.55 ? 2+Math.floor(Math.random()*3) : 0;
    var satCount = Math.floor(Math.random()*3);            /* 0–2 satellites*/
    var TYPES    = [DT.SERVER,DT.VALIDATOR,DT.COMPUTER,DT.MINER,DT.IOT,DT.COMPUTER];

    var ring = [];
    for(var i=0;i<n;i++){
        var frac = n>1?i/(n-1):0.5;
        var a    = arcStart + frac*arcSpan + spiral*(frac-0.5)*Math.PI;
        var rd   = rMu + (Math.random()-0.5)*rSig*2;
        var dt   = TYPES[Math.floor(Math.random()*TYPES.length)];
        ring.push(this._add(this.cx+Math.cos(a)*rd, this.cy+Math.sin(a)*rd, dt));
    }

    /* Primary ring edges */
    this._connectRing(ring, 'access');

    /* Skip-connection chords */
    if(skipK>0){
        for(var i=0;i<ring.length;i++){
            var j=(i+skipK)%ring.length;
            this._edge(ring[i],ring[j],'trunk');
        }
    }

    /* Satellite nodes hanging off random ring nodes */
    for(var s=0;s<satCount;s++){
        var hostIdx = ring[Math.floor(Math.random()*ring.length)];
        var hd      = this.devices[hostIdx];
        var sa      = Math.atan2(hd.y-this.cy, hd.x-this.cx);
        var sd      = sp*(0.15+Math.random()*0.20);
        var sat     = this._add(hd.x+Math.cos(sa)*sd, hd.y+Math.sin(sa)*sd, DT.COMPUTER);
        this._edge(hostIdx, sat, 'access');
    }

    this._connectNearest(r, ring, 1+Math.floor(Math.random()*2), 'uplink');
};

/* ── TREE ─────────────────────────────────────────────────────
   Variable-depth branching tree with randomised fan-out per
   level, asymmetric spread angles, and optional cross-level
   skip links between siblings.
   Parameters: depth (2–4), fan-outs[], spread angles[],
   asymmetry, sibling-link prob, node spacing variance.         */
Network.prototype._buildTree = function(){
    var sp  = CFG.SIZE_MEDIUM*(0.85+Math.random()*0.45);
    var r   = this._routerAtEdge(sp, 0.72+Math.random()*0.18);
    var ra  = Math.atan2(this.devices[r].y-this.cy, this.devices[r].x-this.cx);
    var mainDir = ra+Math.PI;

    var depth    = 2+Math.floor(Math.random()*3);          /* 2–4 levels    */
    var sibling_p= Math.random()*0.40;                     /* sibling links */
    var stepDist = sp*(0.26+Math.random()*0.18);           /* level spacing */
    var LPOOL    = [DT.COMPUTER,DT.IOT,DT.COMPUTER,DT.MINER,DT.VALIDATOR,DT.SERVER];

    /* Recursive tree builder */
    var self = this;
    function growBranch(parentIdx, angle, distSoFar, level){
        if(level>depth) return [];
        var fanOut  = 2+Math.floor(Math.random()*3);       /* 2–4 children  */
        var spread  = (0.30+Math.random()*0.55)*Math.PI;
        var dStep   = stepDist*(1-level*0.12);             /* taper inward  */
        var nodes   = [];
        for(var i=0;i<fanOut;i++){
            var frac = fanOut>1?i/(fanOut-1):0.5;
            var a    = angle - spread*0.5 + frac*spread;
            var d    = distSoFar + dStep*(0.85+Math.random()*0.30);
            if(d>sp*1.0) continue;                         /* stay in bounds*/
            var jA   = (Math.random()-0.5)*(spread/fanOut)*0.25;
            var dt   = level===depth ? LPOOL[Math.floor(Math.random()*LPOOL.length)] : DT.SERVER;
            var idx  = self._add(
                self.cx+Math.cos(a+jA)*d,
                self.cy+Math.sin(a+jA)*d, dt);
            self._edge(parentIdx, idx, level===1?'uplink':'access');
            nodes.push(idx);
            growBranch(idx, a+jA, d, level+1);
        }
        /* Optional sibling links at this level */
        if(sibling_p>0.05&&nodes.length>1){
            for(var i=0;i<nodes.length-1;i++){
                if(Math.random()<sibling_p) self._edge(nodes[i],nodes[i+1],'access');
            }
        }
        return nodes;
    }
    growBranch(r, mainDir, sp*0.10, 1);
};

/* ── FAT-TREE ─────────────────────────────────────────────────
   Layered datacenter with independently varied core/agg/edge
   counts, rotated placement, and variable inter-layer density.
   Parameters: nCore (2–5), nAgg (3–8), nEdge (1–3),
   rotation, cross-connect density, radius fractions.           */
Network.prototype._buildFatTree = function(){
    var sp   = CFG.SIZE_LARGE*(0.80+Math.random()*0.40);
    var rot  = Math.random()*Math.PI*2;
    var nC   = 2+Math.floor(Math.random()*4);              /* 2–5 core nodes*/
    var nA   = 3+Math.floor(Math.random()*6);              /* 3–8 agg nodes */
    var nE   = 1+Math.floor(Math.random()*3);              /* 1–3 edge/agg  */
    var rC   = sp*(0.12+Math.random()*0.10);               /* core ring r   */
    var rA   = sp*(0.38+Math.random()*0.16);               /* agg ring r    */
    var xDen = Math.random()*0.5;                          /* xlink density */

    /* Core layer — fully meshed */
    var core = this._placeRing(nC, rC, rot, DT.SERVER);
    for(var i=0;i<core.length;i++)
        for(var j=i+1;j<core.length;j++)
            this._edge(core[i],core[j],'trunk');

    /* Aggregation layer */
    var agg = this._placeRing(nA, rA, rot+(Math.random()-0.5)*0.4, DT.VALIDATOR);
    this._connectRing(agg,'trunk');
    for(var i=0;i<agg.length;i++)
        this._connectNearest(agg[i],core,1+Math.floor(Math.random()*2),'trunk');

    /* Edge layer: nE nodes fanning out from each agg */
    var edgeAll = [];
    for(var i=0;i<agg.length;i++){
        var ad = this.devices[agg[i]];
        var outA = Math.atan2(ad.y-this.cy, ad.x-this.cx);
        var spread = (nE-1)*0.28*(0.8+Math.random()*0.4);
        for(var ei=0;ei<nE;ei++){
            var ea = outA + (nE>1?(ei-(nE-1)/2)*(spread/Math.max(nE-1,1)):0);
            var ed = sp*(0.26+Math.random()*0.18);
            var eIdx = this._add(ad.x+Math.cos(ea)*ed,ad.y+Math.sin(ea)*ed,DT.MINER);
            this._edge(agg[i],eIdx,'access');
            edgeAll.push(eIdx);
        }
    }

    /* Optional cross-links between edge nodes */
    if(xDen>0.1&&edgeAll.length>2){
        var xLinks = Math.floor(xDen*edgeAll.length*0.4);
        for(var x=0;x<xLinks;x++){
            var ai=Math.floor(Math.random()*edgeAll.length);
            var bi=(ai+1+Math.floor(Math.random()*(edgeAll.length-1)))%edgeAll.length;
            this._edge(edgeAll[ai],edgeAll[bi],'access');
        }
    }

    var r = this._routerAtEdge(sp, 0.90+Math.random()*0.15);
    this._connectNearest(r, edgeAll, 1+Math.floor(Math.random()*2), 'uplink');
};

/* ── MESH ─────────────────────────────────────────────────────
   Irregular spatial mesh with varied placement distributions:
   uniform / clustered / annular / grid-perturbed.
   Parameters: node count, distribution mode, extra-link count,
   cluster centres, grid pitch, annular radius bounds.          */
Network.prototype._buildMesh = function(){
    var sp   = CFG.SIZE_LARGE*(0.80+Math.random()*0.40);
    var r    = this._routerAtEdge(sp, 0.72+Math.random()*0.20);
    var n    = 6+Math.floor(Math.random()*18);             /* 6–23 nodes    */
    var mode = Math.floor(Math.random()*4);                /* distribution  */
    var xK   = 1+Math.floor(Math.random()*3);             /* extra links   */
    var POOL = [DT.MINER,DT.VALIDATOR,DT.COMPUTER,DT.IOT,DT.SERVER,DT.COMPUTER];

    var nodes = [];
    for(var i=0;i<n;i++){
        var px,py;
        if(mode===0){
            /* Uniform disc */
            var a=Math.random()*Math.PI*2, d=Math.sqrt(Math.random())*sp*0.88;
            px=this.cx+Math.cos(a)*d; py=this.cy+Math.sin(a)*d;
        } else if(mode===1){
            /* Clustered — 2–3 gaussian blobs */
            var nC=2+Math.floor(Math.random()*2);
            var ci=Math.floor(Math.random()*nC);
            var ca=(ci/nC)*Math.PI*2;
            var cr=sp*(0.30+Math.random()*0.20);
            var ga=(Math.random()-0.5)*sp*0.35, gb=(Math.random()-0.5)*sp*0.35;
            px=this.cx+Math.cos(ca)*cr+ga; py=this.cy+Math.sin(ca)*cr+gb;
        } else if(mode===2){
            /* Annular band */
            var rInner=sp*0.28, rOuter=sp*0.82;
            var a=Math.random()*Math.PI*2;
            var d=rInner+Math.random()*(rOuter-rInner);
            px=this.cx+Math.cos(a)*d; py=this.cy+Math.sin(a)*d;
        } else {
            /* Perturbed grid */
            var cols=Math.ceil(Math.sqrt(n));
            var rows=Math.ceil(n/cols);
            var gx=(i%cols - (cols-1)*0.5)*(sp*1.6/Math.max(cols,1));
            var gy=(Math.floor(i/cols)-(rows-1)*0.5)*(sp*1.6/Math.max(rows,1));
            px=this.cx+gx+(Math.random()-0.5)*sp*0.22;
            py=this.cy+gy+(Math.random()-0.5)*sp*0.22;
        }
        /* Clamp within sp */
        var dx=px-this.cx,dy=py-this.cy,dd=Math.sqrt(dx*dx+dy*dy);
        if(dd>sp*0.92){px=this.cx+dx*sp*0.92/dd;py=this.cy+dy*sp*0.92/dd;}
        nodes.push(this._add(px,py,POOL[i%POOL.length]));
    }

    /* MST backbone */
    var inMST=[r], notIn=nodes.slice();
    while(notIn.length>0){
        var bestD=Infinity,bestA=-1,bestB=-1;
        for(var i=0;i<inMST.length;i++)
            for(var j=0;j<notIn.length;j++){
                var da=this.devices[inMST[i]],db=this.devices[notIn[j]];
                var ddx=da.x-db.x,ddy=da.y-db.y,dd2=ddx*ddx+ddy*ddy;
                if(dd2<bestD){bestD=dd2;bestA=inMST[i];bestB=notIn[j];}
            }
        if(bestA===-1) break;
        this._edge(bestA,bestB,(bestA===r||bestB===r)?'uplink':'access');
        inMST.push(bestB); notIn.splice(notIn.indexOf(bestB),1);
    }

    /* Extra nearby links for mesh density */
    var all=[r].concat(nodes);
    for(var i=0;i<nodes.length;i++){
        var p2=all.filter(function(x){return x!==nodes[i];});
        var near=this._sortByDist(nodes[i],p2);
        for(var k=0;k<Math.min(xK,near.length);k++)
            this._edge(nodes[i],near[k],(near[k]===r)?'uplink':'access');
    }
};

/* ── DOUBLE RING ──────────────────────────────────────────────
   Concentric rings with variable ring counts (2–4), individual
   radii, twist offsets between rings, and selectable hub
   connectivity styles (full-spoke / partial / spiral / none).
   Parameters: nRings, radii[], twists[], hub style,
   cross-ring density, outer router position.                   */
Network.prototype._buildDoubleRing = function(){
    var sp      = CFG.SIZE_LARGE*(0.80+Math.random()*0.40);
    var baseRot = Math.random()*Math.PI*2;
    var nRings  = 2+Math.floor(Math.random()*3);           /* 2–4 rings     */
    var hubStyle= Math.floor(Math.random()*4);             /* 0–3           */
    var xDen    = Math.random()*0.6;                       /* cross density */
    var PHI     = 1.6180339887;

    /* Radii: phi-scaled from inner to outer */
    var r0 = sp*(0.22+Math.random()*0.14);
    var rings=[], allRing=[];
    for(var ri=0;ri<nRings;ri++){
        var rad  = r0*Math.pow(PHI, ri*(0.7+Math.random()*0.5));
        if(rad>sp*0.88) rad=sp*0.88;
        var nN   = 3+Math.floor(Math.random()*(6+ri*2));   /* more on outer */
        var twist= baseRot + ri*(Math.PI/(nN||1))*(Math.random()>0.5?1:-1);
        var dt   = ri===0?DT.VALIDATOR:ri===nRings-1?DT.MINER:DT.CORE_NODE;
        var ring = this._placeRing(nN, rad, twist, dt);
        this._connectRing(ring, ri===0?'trunk':'access');
        rings.push(ring); allRing=allRing.concat(ring);
    }

    /* Inter-ring connections */
    for(var ri=1;ri<rings.length;ri++){
        var inner=rings[ri-1], outer=rings[ri];
        var linksPerOuter = 1+Math.floor(xDen*2);
        for(var i=0;i<outer.length;i++)
            this._connectNearest(outer[i],inner,Math.min(linksPerOuter,inner.length),'uplink');
    }

    /* Hub node with varied spoke styles */
    var hub=this._add(this.cx,this.cy,DT.SWITCH);
    var inner0=rings[0];
    if(hubStyle===0){
        /* Full spoke to all inner nodes */
        for(var i=0;i<inner0.length;i++) this._edge(hub,inner0[i],'trunk');
    } else if(hubStyle===1){
        /* Every-other spoke */
        for(var i=0;i<inner0.length;i+=2) this._edge(hub,inner0[i],'trunk');
    } else if(hubStyle===2){
        /* Phi-jump spokes */
        var step=Math.max(1,Math.round(inner0.length/PHI));
        var pos=0;
        for(var i=0;i<Math.ceil(inner0.length/step);i++){
            this._edge(hub,inner0[pos],'trunk');
            pos=(pos+step)%inner0.length;
        }
    } else {
        /* No hub spokes — rings are self-contained */
    }

    /* Router at outer edge */
    var outerRing=rings[rings.length-1];
    var r=this._routerAtEdge(sp,1.05+Math.random()*0.20);
    this._connectNearest(r,outerRing,1+Math.floor(Math.random()*2),'uplink');
};

/* ── RADIAL ARMS ──────────────────────────────────────────────
   Symmetric radial arms with per-arm curvature, variable length
   and node density, optional Y-bifurcation at tips, optional
   partial cross-ring connecting arm nodes at same depth.
   Parameters: nArms (3–9), armLen (2–5), curvature, taper,
   bifurcation prob, cross-ring prob, tip-ring connect.         */
Network.prototype._buildRadialArms = function(){
    var sp       = CFG.SIZE_LARGE*(0.80+Math.random()*0.40);
    var nArms    = 3+Math.floor(Math.random()*7);          /* 3–9 arms      */
    var armLen   = 2+Math.floor(Math.random()*4);          /* 2–5 segments  */
    var rot      = Math.random()*Math.PI*2;
    var curvature= (Math.random()-0.5)*0.55;               /* arm bend      */
    var taper    = 0.75+Math.random()*0.25;                /* len taper     */
    var bif_p    = Math.random()*0.45;                     /* tip bifurc.   */
    var cross_p  = Math.random()*0.50;                     /* cross-ring    */
    var LPOOL    = [DT.COMPUTER,DT.IOT,DT.MINER,DT.VALIDATOR,DT.SERVER];

    var hub  = this._add(this.cx,this.cy,DT.SWITCH);
    var tips = [];
    /* depth-keyed cross-ring arrays: depthNodes[d] = [idx,...] */
    var depthNodes = {};
    var self = this;

    for(var ai=0;ai<nArms;ai++){
        var baseAngle = rot + ai*(Math.PI*2/nArms);
        var prev  = hub;
        var prevA = baseAngle;
        var dist  = 0;
        var segL  = sp*(0.18+Math.random()*0.10);

        for(var li=0;li<armLen;li++){
            var frac = li/(armLen-1||1);
            segL    *= taper;
            dist    += segL;
            if(dist>sp*0.92) break;

            /* Curvature: angle drifts per segment */
            var a = prevA + curvature*(0.8+Math.random()*0.4)*(Math.PI/nArms);
            var jA = (Math.random()-0.5)*0.08;
            var dt = li===armLen-1 ? DT.MINER : li===0 ? DT.VALIDATOR : LPOOL[Math.floor(Math.random()*LPOOL.length)];

            var nIdx = self._add(
                self.cx+Math.cos(a+jA)*dist,
                self.cy+Math.sin(a+jA)*dist, dt);
            self._edge(prev, nIdx, prev===hub?'uplink':'access');
            prev = nIdx; prevA = a;

            if(!depthNodes[li]) depthNodes[li]=[];
            depthNodes[li].push(nIdx);
        }
        tips.push(prev);

        /* Optional Y-bifurcation at tip */
        if(Math.random()<bif_p&&dist<sp*0.80){
            for(var side=-1;side<=1;side+=2){
                var ba = prevA + side*(Math.PI/nArms)*0.5;
                var bd = dist + segL*0.6;
                if(bd>sp*0.95) continue;
                var bt = self._add(
                    self.cx+Math.cos(ba)*bd,
                    self.cy+Math.sin(ba)*bd, DT.MINER);
                self._edge(prev, bt, 'access');
                tips.push(bt);
            }
        }
    }

    /* Optional cross-ring connections at intermediate depths */
    var depthKeys=Object.keys(depthNodes);
    depthKeys.forEach(function(d){
        if(Math.random()>cross_p) return;
        var dNodes=depthNodes[d];
        for(var i=0;i<dNodes.length;i++){
            var j=(i+1)%dNodes.length;
            self._edge(dNodes[i],dNodes[j],'access');
        }
    });

    /* Tip ring */
    this._connectRing(tips,'access');

    /* Router attached to one tip arm */
    var raArm = Math.floor(Math.random()*tips.length);
    var tipDev = this.devices[tips[raArm]];
    var tipA = Math.atan2(tipDev.y-this.cy, tipDev.x-this.cx);
    var rIdx = this._add(
        tipDev.x+Math.cos(tipA)*sp*(0.15+Math.random()*0.12),
        tipDev.y+Math.sin(tipA)*sp*(0.15+Math.random()*0.12), DT.ROUTER);
    this.routerIdx = rIdx;
    this._edge(rIdx, tips[raArm], 'uplink');
};

/* ── Lifecycle update ─────────────────────────────────────── */
Network.prototype.update = function(){
    this.stf++;
    if(this.isCore){
        /* Core lifecycle: FADE_IN → ALIVE (timed by coreLifespan) → FADE_OUT → DEAD */
        var ff=_effFadeFrames();
        if(this.state===ST.FADE_IN){
            this.alpha=smooth(this.stf/ff);
            if(this.stf>=ff){this.alpha=1;this.state=ST.ALIVE;this.stf=0;}
        } else if(this.state===ST.ALIVE){
            this.alpha=1;
            var effLife=Math.max(60,Math.round(this.coreLifespan/_speed()));
            if(this.stf>=effLife){this.state=ST.FADE_OUT;this.stf=0;}
        } else if(this.state===ST.FADE_OUT){
            this.alpha=1-smooth(this.stf/ff);
            if(this.stf>=ff){this.alpha=0;this.state=ST.DEAD;}
        } else if(this.state===ST.CORE){
            this.alpha=1;
        }
        /* Advance per-core block rings */
        if(this.blockRings){
            this.blockRings.forEach(function(r){r.t+=CFG.CONSENSUS_RING_SPEED;});
            this.blockRings=this.blockRings.filter(function(r){return r.t<1;});
        }
        if(this.pendingGlow>0) this.pendingGlow=Math.max(0,this.pendingGlow-0.012);
    } else {
        /* Overlay lifecycle — durations scale with speed */
        var ff=_effFadeFrames();
        if(this.state===ST.FADE_IN){
            this.alpha=smooth(this.stf/ff);
            if(this.stf>=ff){this.alpha=1;this.state=ST.ALIVE;this.stf=0;}
        } else if(this.state===ST.ALIVE){
            this.alpha=1;
            var effAlive=Math.max(60,Math.round(this.aliveDuration/_speed()));
            if(this.stf>=effAlive){this.state=ST.FADE_OUT;this.stf=0;}
        } else if(this.state===ST.FADE_OUT){
            this.alpha=1-smooth(this.stf/ff);
            if(this.stf>=ff){this.alpha=0;this.state=ST.DEAD;}
        }
    }
    for(var i=0;i<this.devices.length;i++)
        this.devices[i].flash=Math.max(0,(this.devices[i].flash||0)-_effFlashDecay());
};

Network.prototype.canReceive=function(){
    return this.state!==ST.DEAD;
};
Network.prototype.canSend=function(){
    return this.state!==ST.DEAD;
};


/* ============================================================
   WAN PULSE — large glowing dot, router <-> gateway
   ALWAYS uses primaryGatewayPos() for both endpoints — same
   stable position used by backbone dashed lines, guaranteeing
   every packet travels on a visible path.
   isWinBroadcast — special golden pulse sent after block win.
   ============================================================ */
function WanPulse(fromNet, toNet, forwards, isWinBroadcast){
    /* Each endpoint is the anchor on that network FACING the other —
       the same geometry used by the backbone dashed line for this pair. */
    var fp=fromNet.nearestAnchorTo(toNet);
    var tp=toNet.nearestAnchorTo(fromNet);
    this.fromNet=fromNet; this.toNet=toNet;
    this.fx=fp.x; this.fy=fp.y; this.tx=tp.x; this.ty=tp.y;
    this.t=0; this.speed=_speed()/CFG.WAN_SPEED;
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=true;
    this.forwards=!!forwards;
    this.toCore  =toNet.isCore;
    this.fromCore=fromNet.isCore;
    this.isWinBroadcast=!!isWinBroadcast;
}
WanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.WAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;

        /* Flash destination router / gateway */
        var r=this.toNet.devices[this.toNet.routerIdx];
        if(r) r.flash=1.0;

        if(this.toCore && this.toNet.state!==ST.DEAD){
            /* Flash nearest gateway of receiving core */
            if(this.toNet.gatewayIdxs && this.toNet.gatewayIdxs.length>0){
                var gIdx=this.toNet.gatewayIdxs[
                    Math.floor(Math.random()*this.toNet.gatewayIdxs.length)];
                var gd=this.toNet.devices[gIdx];
                if(gd) gd.flash=1.0;
            }

            if(!this.isWinBroadcast && sim.blockCooldown===0){
                /* Advance this core's packet count */
                this.toNet.blockPackets=(this.toNet.blockPackets||0)+1;
                var newPkts=this.toNet.blockPackets;
                /* bsvStep: 0 … BLOCK_PACKETS-1 */
                this.toNet.bsvStep=Math.min(CFG.BLOCK_PACKETS-1, newPkts-1);

                /* Block win check */
                if(newPkts>=CFG.BLOCK_PACKETS){
                    var winner=this.toNet;
                    sim.globalBlocks++;
                    sim.blockCooldown=90; /* ~1.5s lockout */
                    winner.pendingGlow=1.0;
                    winner.blockRings.push({
                        cx:winner.cx, cy:winner.cy,
                        t:0, maxR:CFG.SIZE_CORE*CFG.CONSENSUS_RING_SCALE,
                    });
                    /* Flash all gateways on winner */
                    if(winner.gatewayIdxs){
                        winner.gatewayIdxs.forEach(function(gi){
                            var gd2=winner.devices[gi];
                            if(gd2) gd2.flash=1.0;
                        });
                    }
                    /* Broadcast win to all other live cores via golden pulse */
                    sim.coreNets.forEach(function(c){
                        if(c!==winner && c.canReceive()){
                            sim.pulses.push(new WanPulse(winner, c, false, true));
                        }
                    });
                    /* Reset ALL cores' competition counters */
                    sim.coreNets.forEach(function(c){
                        c.blockPackets=0;
                        c.bsvStep=0;
                    });
                }
            }
        }

        /* Rule 3 / Rule 4 — forwarding (not for win broadcasts) */
        if(!this.isWinBroadcast && this.forwards && this.toNet.canSend())
            _wanSendFrom(this.toNet,this.fromNet);
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   LAN PULSE — small dot, node → node within one network
   ============================================================ */
function LanPulse(net,edgeIdx,forward){
    var e  =net.edges[edgeIdx];
    var src=forward?net.devices[e.a]:net.devices[e.b];
    var dst=forward?net.devices[e.b]:net.devices[e.a];
    this.net=net; this.dstDev=forward?e.b:e.a;
    this.fx=src.x;this.fy=src.y;this.tx=dst.x;this.ty=dst.y;
    this.t=0; this.speed=_speed()/CFG.LAN_SPEED;
    this.alive=true;this.cx=this.fx;this.cy=this.fy;
    this.trail=[];this.isWan=false;
}
LanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.LAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        var dev=this.net.devices[this.dstDev];
        if(dev) dev.flash=0.85;
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   LASER PULSE — fast orange beam, BSV hex ↔ gateway nodes
   ============================================================ */
function LaserPulse(net, fromIdx, toIdx){
    var src=net.devices[fromIdx], dst=net.devices[toIdx];
    if(!src||!dst){this.alive=false;return;}
    this.net=net; this.dstDev=toIdx;
    this.fx=src.x; this.fy=src.y;
    this.tx=dst.x; this.ty=dst.y;
    this.t=0;
    this.speed=_speed()/Math.max(30, CFG.LAN_SPEED*0.20);
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=false; this.isLaser=true;
}
LaserPulse.prototype.update=function(){
    var LASER_TRAIL=6;
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>LASER_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        var dev=this.net.devices[this.dstDev];
        if(dev) dev.flash=0.90;
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   _wanSendFrom  — WAN routing logic  (Rules 1–5)
   Overlays target a randomly chosen LIVE core 70% of the time.
   Cores route to overlays only (weighted by edge count).
   ============================================================ */
function _wanSendFrom(net,exclude){
    var PAIR_COOLDOWN=600;

    var candidates=sim.networks.filter(function(r){
        if(r===net||r===exclude||!r.canReceive()) return false;
        var last=net._wanCooldown[r.id]||0;
        return (sim.frame-last)>=PAIR_COOLDOWN;
    });
    if(candidates.length===0){
        candidates=sim.networks.filter(function(r){
            return r!==net&&r!==exclude&&r.canReceive();
        });
    }
    if(candidates.length===0) return false;

    var target=null;

    if(net.isCore){
        /* Core routes only to overlays (not to other cores directly) */
        var ovls=candidates.filter(function(c){return !c.isCore;});
        if(ovls.length===0) ovls=candidates.filter(function(c){return !c.isCore;});
        if(ovls.length===0) return false; /* no overlays available */
        var total=0;
        ovls.forEach(function(c){total+=c.edges.length||1;});
        var rv=Math.random()*total,cum=0;
        target=ovls[ovls.length-1];
        for(var i=0;i<ovls.length;i++){
            cum+=ovls[i].edges.length||1;
            if(cum>=rv){target=ovls[i];break;}
        }
    } else {
        /* Overlay: 70% chance to pick a random live core */
        var liveCores=sim.coreNets.filter(function(c){
            return c.canReceive()&&c!==exclude;
        });
        if(liveCores.length>0&&Math.random()<0.70){
            /* Pick random core, respect cooldown */
            var shuffled=liveCores.slice().sort(function(){return Math.random()-0.5;});
            for(var ci=0;ci<shuffled.length;ci++){
                var cand=shuffled[ci];
                var cdOk=(sim.frame-(net._wanCooldown[cand.id]||0))>=PAIR_COOLDOWN;
                if(cdOk){target=cand;break;}
            }
            if(!target&&shuffled.length>0) target=shuffled[0]; /* cooldown fallback */
        }
        /* Fallback: weighted random from all candidates */
        if(!target){
            var total=0;
            candidates.forEach(function(c){total+=c.edges.length||1;});
            var rv=Math.random()*total,cum=0;
            target=candidates[candidates.length-1];
            for(var i=0;i<candidates.length;i++){
                cum+=candidates[i].edges.length||1;
                if(cum>=rv){target=candidates[i];break;}
            }
        }
    }

    if(!target) return false;
    net._wanCooldown[target.id]=sim.frame;

    /* Forwarding flag */
    var forwards;
    if(!net.isCore && target.isCore)    forwards=true;
    else if(net.isCore&&!target.isCore) forwards=false;
    else forwards=(Math.random()<0.40);

    sim.pulses.push(new WanPulse(net,target,forwards,false));
    return true;
}


/* ============================================================
   engineTickWAN  — inter-network communication  (Rules 1 & 2)
   ============================================================ */
function engineTickWAN(){
    sim.networks.forEach(function(net){
        if(!net.canSend()) return;
        if(net.wanPendingFirst){
            var sent=_wanSendFrom(net,null);
            if(sent) net.wanPendingFirst=false;
            return;
        }
        var edges=net.edges.length||5;
        var effInterval=Math.max(30,Math.floor(CFG.WAN_INTERVAL*10/Math.max(edges,10)/_speed()));
        net.wanTimer++;
        if(net.wanTimer<effInterval) return;
        var sent=_wanSendFrom(net,null);
        if(sent) net.wanTimer=0;
    });
}


/* ============================================================
   engineTickLAN  — intra-network communication
   ============================================================ */
function engineTickLAN(){
    sim.networks.forEach(function(net){
        if(net.state===ST.DEAD) return;

        /* Core laser pulses — BSV hex ↔ gateway (orange) */
        if(net.isCore && net.gatewayIdxs && net.gatewayIdxs.length>0){
            net.laserTimer=(net.laserTimer||0)+1;
            var laserInt=Math.max(10,Math.floor(CFG.LAN_INTERVAL*0.45/_speed()));
            if(net.laserTimer>=laserInt){
                net.laserTimer=0;
                var gIdxs=net.gatewayIdxs;
                var tIdx=gIdxs[Math.floor(Math.random()*gIdxs.length)];
                var fromCentre=Math.random()<0.55;
                var p=new LaserPulse(net, fromCentre?0:tIdx, fromCentre?tIdx:0);
                if(p.alive) sim.pulses.push(p);
            }
        }

        if(net.edges.length===0) return;
        net.lanTimer=(net.lanTimer||0)+1;
        var interval=Math.max(10,Math.floor(
            (net.isCore?CFG.LAN_INTERVAL*CFG.CORE_LAN_FACTOR:CFG.LAN_INTERVAL)/_speed()
        ));
        if(net.lanTimer<interval) return;
        net.lanTimer=0;
        var count=Math.min(6,Math.max(1,Math.round(net.edges.length/8)));
        for(var c=0;c<count;c++){
            var eIdx=Math.floor(Math.random()*net.edges.length);
            if(net.isCore){
                var e=net.edges[eIdx];
                if(e.a===0||e.b===0) continue;
            }
            sim.pulses.push(new LanPulse(net,eIdx,Math.random()<0.5));
        }
    });
}


/* ============================================================
   ENGINE — canvas, resize, init, update, draw
   ============================================================ */
var scene = {canvas:null,ctx:null,animId:null,layer:null,W:0,H:0,running:false};

function _resizeCanvas(){
    var dpr=Math.max(1,window.devicePixelRatio||1);
    scene.W=window.innerWidth;
    scene.H=window.innerHeight;
    scene.canvas.width =Math.floor(scene.W*dpr);
    scene.canvas.height=Math.floor(scene.H*dpr);
    scene.canvas.style.width =scene.W+'px';
    scene.canvas.style.height=scene.H+'px';
    scene.ctx=scene.canvas.getContext('2d');
    scene.ctx.setTransform(dpr,0,0,dpr,0,0);
    _glowCacheInvalidate();
}

/* Distribute NUM_CORES cores across screen in ellipse formation */
function _corePositions(){
    var n=Math.max(2,CFG.NUM_CORES);
    var b=_effectiveBounds();
    var BW=b.x1-b.x0, BH=b.y1-b.y0, M=CFG.MARGIN;
    var W=scene.W, H=scene.H;
    if(n===1) return [{x:W*0.5,y:H*0.5}];
    var rx=Math.max(CFG.SIZE_CORE*2.2, Math.min(BW*0.5-M-CFG.SIZE_CORE*1.2, BW*0.26));
    var ry=Math.max(CFG.SIZE_CORE*2.0, Math.min(BH*0.5-M-CFG.SIZE_CORE*1.2, BH*0.26));
    var positions=[];
    for(var i=0;i<n;i++){
        var angle=(i/n)*Math.PI*2-Math.PI*0.5;
        positions.push({
            x:W*0.5+Math.cos(angle)*rx,
            y:H*0.5+Math.sin(angle)*ry,
        });
    }
    return positions;
}

/* Best spawn position for a new core replacement */
function _bestCoreSpawnPos(){
    var b=_effectiveBounds();
    var M=CFG.MARGIN+CFG.SIZE_CORE*1.2;
    var best={x:scene.W*0.5,y:scene.H*0.5};
    var bestD=-1;
    var live=sim.coreNets.filter(function(c){return c.state!==ST.DEAD;});
    for(var i=0;i<80;i++){
        var px=b.x0+M+Math.random()*Math.max(1,(b.x1-b.x0-M*2));
        var py=b.y0+M+Math.random()*Math.max(1,(b.y1-b.y0-M*2));
        var minD=Infinity;
        for(var j=0;j<live.length;j++){
            var dx=live[j].cx-px,dy=live[j].cy-py;
            minD=Math.min(minD,Math.sqrt(dx*dx+dy*dy));
        }
        if(live.length===0) minD=999999;
        if(minD>bestD){bestD=minD;best={x:px,y:py};}
    }
    return best;
}

/* Best spawn for overlays — avoid all cores */
function bestSpawn(){
    var b=_effectiveBounds();
    var M=CFG.MARGIN;
    var live=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    var best={x:b.x0+M+Math.random()*Math.max(1,(b.x1-b.x0-M*2)),y:b.y0+M+Math.random()*Math.max(1,(b.y1-b.y0-M*2))};
    var bestD=-1;
    for(var i=0;i<CFG.SPAWN_CANDS;i++){
        var px=b.x0+M+Math.random()*Math.max(1,(b.x1-b.x0-M*2)),py=b.y0+M+Math.random()*Math.max(1,(b.y1-b.y0-M*2));
        /* Bias away from ALL cores */
        var tooClose=false;
        for(var ci=0;ci<sim.coreNets.length;ci++){
            var core=sim.coreNets[ci];
            if(core.state===ST.DEAD) continue;
            var cdx=px-core.cx,cdy=py-core.cy;
            if(Math.sqrt(cdx*cdx+cdy*cdy)<CFG.SIZE_CORE*1.6){tooClose=true;break;}
        }
        if(tooClose) continue;
        var minD=Infinity;
        for(var j=0;j<live.length;j++){
            var dx=live[j].cx-px,dy=live[j].cy-py;
            minD=Math.min(minD,Math.sqrt(dx*dx+dy*dy));
        }
        if(live.length===0) minD=999999;
        if(minD>bestD){bestD=minD;best={x:px,y:py};}
    }
    return best;
}

function engineInit(){
    if(!scene.canvas){
        scene.canvas=document.createElement('canvas');
        scene.canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2;';
        scene.layer.appendChild(scene.canvas);
        window.addEventListener('resize',function(){
            _resizeCanvas();
        });
    }
    _resizeCanvas();

    sim.frame=0; sim.netIdCounter=0; sim.networks=[]; sim.pulses=[];
    sim.coreNets=[]; sim.coreNet=null;
    sim.globalBlocks=0; sim.blockCooldown=0;

    /* Spawn NUM_CORES core networks distributed across screen */
    var corePos=_corePositions();
    for(var ci=0;ci<Math.max(2,CFG.NUM_CORES);ci++){
        var pos=corePos[ci]||_bestCoreSpawnPos();
        var core=new Network(pos.x,pos.y,true);
        /* Initial cores start alive immediately */
        core.state=ST.ALIVE; core.alpha=1; core.stf=0;
        sim.networks.push(core);
        sim.coreNets.push(core);
    }
    sim.coreNet=sim.coreNets[0];

    /* Overlay networks — staggered lifecycle */
    var cycle=CFG.FADE_FRAMES*2+CFG.ALIVE_MIN;
    for(var i=0;i<CFG.MAX_OVERLAYS;i++){
        var pt=bestSpawn();
        var net=new Network(pt.x,pt.y,false);
        var off=Math.floor((i/CFG.MAX_OVERLAYS)*cycle);
        if(off<=CFG.FADE_FRAMES){
            net.state=ST.FADE_IN; net.stf=off;
            net.alpha=smooth(off/CFG.FADE_FRAMES);
        } else if(off<=CFG.FADE_FRAMES+CFG.ALIVE_MIN){
            net.state=ST.ALIVE; net.stf=off-CFG.FADE_FRAMES; net.alpha=1;
        } else {
            net.state=ST.FADE_OUT;
            net.stf=off-CFG.FADE_FRAMES-CFG.ALIVE_MIN;
            net.alpha=1-smooth(net.stf/CFG.FADE_FRAMES);
        }
        sim.networks.push(net);
    }
}

function engineUpdate(){
    sim.frame++;
    /* FPS counter — sampled every 30 frames for stability */
    sim.fpsFrames++;
    var now=performance.now();
    if(sim.fpsLast===0) sim.fpsLast=now;
    var elapsed=now-sim.fpsLast;
    if(elapsed>=500){
        sim.fps=Math.round(sim.fpsFrames*1000/elapsed);
        sim.fpsFrames=0; sim.fpsLast=now;
    }

    /* Tick block cooldown */
    if(sim.blockCooldown>0) sim.blockCooldown--;

    sim.networks.forEach(function(n){n.update();});

    /* Remove dead networks */
    sim.networks=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    sim.coreNets=sim.coreNets.filter(function(c){return c.state!==ST.DEAD;});

    /* Maintain NUM_CORES count — spawn replacement cores as needed */
    var targetCores=Math.max(2,CFG.NUM_CORES);
    while(sim.coreNets.length<targetCores){
        var pos=_bestCoreSpawnPos();
        var newCore=new Network(pos.x,pos.y,true);
        /* Replacement cores fade in */
        newCore.state=ST.FADE_IN; newCore.stf=0; newCore.alpha=0;
        sim.networks.push(newCore);
        sim.coreNets.push(newCore);
    }
    sim.coreNet=sim.coreNets[0]||null;

    /* Maintain overlay count */
    sim.networks=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    var ovCount=sim.networks.filter(function(n){return !n.isCore;}).length;
    while(ovCount<CFG.MAX_OVERLAYS){
        sim.networks.push(new Network(bestSpawn().x,bestSpawn().y,false));
        ovCount++;
    }

    sim.pulses.forEach(function(p){p.update();});
    sim.pulses=sim.pulses.filter(function(p){return p.alive;});

    engineTickWAN();
    engineTickLAN();
}

function engineDraw(){
    var ctx=scene.ctx;
    var live=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    ctx.clearRect(0,0,scene.W,scene.H);
    /* Apply zoom centred on canvas middle */
    var z=_zoom();
    ctx.save();
    ctx.translate(scene.W*0.5,scene.H*0.5);
    ctx.scale(z,z);
    ctx.translate(-scene.W*0.5,-scene.H*0.5);

    /* 1 — Per-core ambient halos (breathe + spike on block win) */
    sim.coreNets.forEach(function(core,ci){
        if(core.state===ST.DEAD||core.alpha<0.01) return;
        var cGlow=core.pendingGlow||0;
        /* Phase offset per core so they don't all pulse in sync */
        var breath=0.10+Math.sin(sim.frame*0.018+ci*2.1)*0.04+cGlow*0.22;
        _drawGlow(ctx,core.cx,core.cy,CFG.SIZE_CORE*1.85,breath*core.alpha,false);
        _drawGlow(ctx,core.cx,core.cy,CFG.SIZE_CORE*0.70,breath*0.55*core.alpha,true);
    });

    /* 2 — Per-core block confirmation rings */
    sim.coreNets.forEach(function(core){
        if(core.state===ST.DEAD||!core.blockRings) return;
        core.blockRings.forEach(function(ring){
            var r=ring.maxR*smooth(ring.t);
            var a=(1-ring.t)*0.56*core.alpha;
            if(a<0.005||r<1) return;
            ctx.beginPath(); ctx.arc(ring.cx,ring.cy,r,0,Math.PI*2);
            ctx.strokeStyle=col(a,true);
            ctx.lineWidth=1.8*(1-ring.t*0.5); ctx.stroke();
            if(r>20){
                ctx.beginPath(); ctx.arc(ring.cx,ring.cy,r*0.82,0,Math.PI*2);
                ctx.strokeStyle=col(a*0.32,true);
                ctx.lineWidth=0.7; ctx.stroke();
            }
        });
    });

    /* 3 — WAN backbone dashed lines
           Build activeRoutes map keyed by sorted ID pair.
           Active routes are ALWAYS drawn at full boost alpha regardless
           of distance — so every travelling orb has a visible path.     */
    var activeRouteMap={};
    sim.pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        var k=Math.min(p.fromNet.id,p.toNet.id)+'_'+Math.max(p.fromNet.id,p.toNet.id);
        var boost=Math.sin(p.t*Math.PI)*0.55;
        if(!activeRouteMap[k]||activeRouteMap[k].boost<boost){
            activeRouteMap[k]={
                boost:boost,
                coreEdge:p.toCore||p.fromCore,
                isBroadcast:p.isWinBroadcast||false,
            };
        }
    });
    var diag=Math.sqrt(scene.W*scene.W+scene.H*scene.H)||1;

    ctx.setLineDash([3,7]);
    for(var i=0;i<live.length;i++){
        for(var j=i+1;j<live.length;j++){
            var rp1=live[i].nearestAnchorTo(live[j]), rp2=live[j].nearestAnchorTo(live[i]);
            var dx=rp1.x-rp2.x, dy=rp1.y-rp2.y;
            var d=Math.sqrt(dx*dx+dy*dy);
            var baseA=Math.pow(1-d/diag,2.5)*0.28*live[i].alpha*live[j].alpha;
            /* Minimum floor for core-adjacent lines */
            if(live[i].isCore||live[j].isCore)
                baseA=Math.max(baseA, 0.07*live[i].alpha*live[j].alpha);
            var pairKey=Math.min(live[i].id,live[j].id)+'_'+Math.max(live[i].id,live[j].id);
            var ar=activeRouteMap[pairKey]||null;
            var routeBoost=ar?ar.boost:0;
            var isCoreEdge=(live[i].isCore||live[j].isCore)||(ar?ar.coreEdge:false);
            var isBroadcast=ar?ar.isBroadcast:false;
            /* ALWAYS visible when active — minimum 0.20 forced alpha */
            if(ar) baseA=Math.max(baseA, 0.20*live[i].alpha*live[j].alpha);
            var a=Math.min(0.88,baseA+routeBoost*(isBroadcast?1.4:1.0));
            if(a<0.004) continue;
            var lw=routeBoost>0?(isBroadcast?2.2:1.4):0.60;
            ctx.beginPath();
            if(isBroadcast&&routeBoost>0)      ctx.strokeStyle=col(a,true);
            else if(isCoreEdge&&routeBoost>0)  ctx.strokeStyle=col(a,true);
            else                               ctx.strokeStyle=col(a,false);
            ctx.lineWidth=lw;
            ctx.moveTo(rp1.x,rp1.y); ctx.lineTo(rp2.x,rp2.y);
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);

    /* 4 — LAN edges */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.edges.forEach(function(e){
            var da=net.devices[e.a], db=net.devices[e.b];
            if(!da||!db) return;
            if(net.isCore && (e.a===0||e.b===0)) return;
            var lw=e.t==='trunk'?1.25:e.t==='uplink'?0.90:0.52;
            var am=e.t==='trunk'?0.60:e.t==='uplink'?0.44:0.28;
            if(net.isCore){lw*=1.25;am*=1.35;}
            var a=net.alpha*am;
            if(a<0.004) return;
            ctx.beginPath();
            ctx.strokeStyle=col(a,false);
            ctx.lineWidth=lw;
            ctx.moveTo(da.x,da.y); ctx.lineTo(db.x,db.y);
            ctx.stroke();
        });
    });

    /* 4.5 — Electric arc force-fields (per core, hex → inner ring) */
    sim.coreNets.forEach(function(core){
        if(core.state===ST.DEAD||!core.arcTargets||!core.devices[0]) return;
        var hd=core.devices[0];
        core.arcTargets.forEach(function(tIdx){
            var td=core.devices[tIdx];
            if(!td) return;
            _drawElectricArc(ctx,hd.x,hd.y,td.x,td.y,sim.frame,0.46*core.alpha);
        });
    });

    /* 5 — Devices (pass net for per-core BSV symbol brightness) */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.devices.forEach(function(dev){
            drawDevice(ctx,dev,net.alpha,net.isCore,net);
        });
    });

    /* 6 — WAN packets (large glowing dot; gold for core; extra-bright for broadcasts) */
    sim.pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        var ac=p.toCore||p.fromCore||p.isWinBroadcast;
        var bc=p.isWinBroadcast;
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            ctx.beginPath();
            ctx.arc(p.trail[k].x,p.trail[k].y,frac*(bc?3.5:2.4),0,Math.PI*2);
            ctx.fillStyle=col(frac*(ac?0.72:0.55),ac);
            ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        /* Win broadcast pulses: larger glow + double ring effect */
        if(bc){
            _drawGlow(ctx,p.cx,p.cy,28,env*1.0,true);
            _drawGlow(ctx,p.cx,p.cy,14,env*0.70,true);
            ctx.beginPath(); ctx.arc(p.cx,p.cy,4.5,0,Math.PI*2);
            ctx.fillStyle=col(env*0.99,true); ctx.fill();
        } else {
            _drawGlow(ctx,p.cx,p.cy,ac?17:13,env*0.75,ac);
            ctx.beginPath(); ctx.arc(p.cx,p.cy,ac?3.1:2.6,0,Math.PI*2);
            ctx.fillStyle=col(env*(ac?0.98:0.92),ac); ctx.fill();
        }
    });

    /* 7 — LAN packets (small dot; gold in core) */
    sim.pulses.filter(function(p){return !p.isWan&&!p.isLaser;}).forEach(function(p){
        var na=p.net.alpha; if(na<0.01) return;
        var ac=p.net.isCore;
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            ctx.beginPath();
            ctx.arc(p.trail[k].x,p.trail[k].y,frac*1.2,0,Math.PI*2);
            ctx.fillStyle=col(frac*0.38*na,ac);
            ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        _drawGlow(ctx,p.cx,p.cy,7,env*0.48*na,ac);
        ctx.beginPath(); ctx.arc(p.cx,p.cy,1.5,0,Math.PI*2);
        ctx.fillStyle=col(env*0.86*na,ac); ctx.fill();
    });

    /* 7.5 — Laser pulses (orange laser beams, BSV hex ↔ gateways) */
    sim.pulses.filter(function(p){return p.isLaser;}).forEach(function(p){
        if(!p.alive) return;
        var env=Math.sin(p.t*Math.PI);
        var na=p.net.alpha||1;
        var ox=p.fx, oy=p.fy;
        /* Outer glow beam — wide, soft */
        ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(p.cx,p.cy);
        ctx.strokeStyle=col(env*0.32*na,true);
        ctx.lineWidth=3.2; ctx.lineCap='round'; ctx.stroke();
        /* Core beam — bright thin */
        ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(p.cx,p.cy);
        ctx.strokeStyle=col(env*0.88*na,true);
        ctx.lineWidth=0.9; ctx.stroke();
        /* Leading head glow + dot */
        _drawGlow(ctx,p.cx,p.cy,10,env*0.72*na,true);
        ctx.beginPath(); ctx.arc(p.cx,p.cy,1.8,0,Math.PI*2);
        ctx.fillStyle=col(env*0.98*na,true); ctx.fill();
    });

    /* 8 — Close zoom transform */
    ctx.restore();

    /* 9 — UI breathe + monitor (drawn in screen-space, not zoomed) */
    _ctrlAnimatePulse();
    _monitorUpdate();
}

function engineStop(){if(scene.animId){cancelAnimationFrame(scene.animId);scene.animId=null;}}
function engineLoop(){engineUpdate();engineDraw();scene.animId=requestAnimationFrame(engineLoop);}


/* ============================================================
   UI STATE  — three fixed panels + one edge button stack
   Left   bottom : overlay table (blue)  + overlays toggle
   Right  bottom : core table (gold)     + cores toggle
   Centre bottom : speed toggle
   Right  middle : zoom +/- buttons
   ============================================================ */
var ui={
    left:null,  leftRows:[],  leftCtrl:null,
    right:null, rightRows:[], rightCtrl:null,
    speed:null, speedCtrl:null,
    zoom:null,  fpsBox:null,
    ctrlPulse:0, observer:null,
};

var _prefersReducedMotion=(typeof window.matchMedia==='function')&&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Lifecycle helpers ──────────────────────────────────────── */
function _netTotalSpan(net){var ff=_effFadeFrames();return ff+Math.round(net.aliveDuration/_speed())+ff;}
function _netElapsed(net){
    var ff=_effFadeFrames();
    if(net.state===ST.FADE_IN)  return net.stf;
    if(net.state===ST.ALIVE)    return ff+net.stf;
    if(net.state===ST.FADE_OUT) return ff+Math.round(net.aliveDuration/_speed())+net.stf;
    return _netTotalSpan(net);
}
function _netProgress(net){return Math.min(1,_netElapsed(net)/_netTotalSpan(net));}
function _netRemaining(net){return Math.max(0,(_netTotalSpan(net)-_netElapsed(net))/60);}


/* ── Shared button factory ──────────────────────────────────── */
/* ── ARROW TOGGLE (overlays / cores) — 200% size, ◄ ► glyphs ── */
function _arrowBtn(glyph, onClick, accent){
    var el=document.createElement('span');
    el.textContent=glyph;
    el.dataset.arrow='1';
    el.dataset.accent=accent?'1':'0';
    el.style.cssText=
        'font:10px/1 monospace;cursor:pointer;'+
        'user-select:none;-webkit-user-select:none;'+
        'display:inline-flex;align-items:center;justify-content:center;'+
        'padding:0 3px;pointer-events:auto;';
    el.addEventListener('click',onClick);
    el.addEventListener('mouseenter',function(){el.style.opacity='1';});
    el.addEventListener('mouseleave',function(){el.style.opacity='';});
    return el;
}

function _arrowLbl(text, accent){
    var el=document.createElement('span');
    el.textContent=text;
    el.dataset.lbl='1';
    el.dataset.accent=accent?'1':'0';
    el.style.cssText='font:10px/1 monospace;letter-spacing:0.04em;white-space:nowrap;'+
        'display:inline-block;text-align:center;min-width:12ch;';
    return el;
}

function _makeToggle(labelFn, onDec, onInc, accent){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:4px;pointer-events:auto;';
    var dec=_arrowBtn('\u25c4', function(){onDec();refresh();_uiUpdateColour();}, accent);
    var lbl=_arrowLbl(labelFn(), accent);
    var inc=_arrowBtn('\u25ba', function(){onInc();refresh();_uiUpdateColour();}, accent);
    function refresh(){ lbl.textContent=labelFn(); }
    row.appendChild(dec); row.appendChild(lbl); row.appendChild(inc);
    row._refresh=refresh;
    return row;
}

/* ── SQUARE BUTTON (speed / zoom) — 300% size, bordered box ─── */
function _squareBtn(glyph, onClick, accent){
    var el=document.createElement('span');
    el.textContent=glyph;
    el.dataset.arrow='1';
    el.dataset.accent=accent?'1':'0';
    el.style.cssText=
        'font:700 14px/1 monospace;cursor:pointer;'+
        'user-select:none;-webkit-user-select:none;'+
        'display:inline-flex;align-items:center;justify-content:center;'+
        'width:26px;height:26px;box-sizing:border-box;pointer-events:auto;'+
        'border:1.5px solid currentColor;border-radius:2px;letter-spacing:0;';
    el.addEventListener('click',onClick);
    el.addEventListener('mouseenter',function(){el.style.opacity='1';});
    el.addEventListener('mouseleave',function(){el.style.opacity='';});
    return el;
}

function _squareLbl(text, accent){
    var el=document.createElement('span');
    el.textContent=text;
    el.dataset.lbl='1';
    el.dataset.accent=accent?'1':'0';
    el.style.cssText='font:700 13px/1 monospace;letter-spacing:0.05em;white-space:nowrap;text-align:center;min-width:6ch;display:inline-block;';
    return el;
}

/* Legacy small label (used for speed prefix and zoom %) */
function _lbl(text, accent){
    var el=document.createElement('span');
    el.textContent=text;
    el.dataset.lbl='1';
    el.dataset.accent=accent?'1':'0';
    el.style.cssText='font:10px/1 monospace;letter-spacing:0.04em;white-space:nowrap;';
    return el;
}

/* ── Panel factory ──────────────────────────────────────────── */
function _makePanel(css){
    var el=document.createElement('div');
    el.style.cssText=css;
    if(scene.layer) scene.layer.insertAdjacentElement('afterend',el);
    else document.body.appendChild(el);
    return el;
}

function _makeRow(panel, rows){
    var row=document.createElement('div');
    row.style.cssText='font:10px/1 monospace;letter-spacing:0.04em;white-space:pre;';
    panel.appendChild(row);
    rows.push(row);
    return row;
}
function _syncRows(panel, rows, need){
    while(rows.length<need) _makeRow(panel,rows);
    while(rows.length>need){ var rm=rows.pop(); if(rm.parentNode) rm.parentNode.removeChild(rm); }
}
function _syncRowOrder(panel, rows, ctrlEl){
    rows.forEach(function(r){
        if(r.parentNode===panel&&ctrlEl.parentNode===panel) panel.insertBefore(r,ctrlEl);
    });
}


/* ── Inject all panels ──────────────────────────────────────── */
function injectPanels(){
    var BASE='position:fixed;z-index:9999;pointer-events:none;display:flex;flex-direction:column;gap:2px;';

    /* LEFT — overlay table + toggle */
    if(ui.left){ui.left.remove();ui.left=null;ui.leftRows=[];}
    ui.left=_makePanel(BASE+'bottom:14px;left:16px;align-items:flex-start;');
    ui.leftCtrl=_makeToggle(
        function(){return 'overlays: '+CFG.MAX_OVERLAYS;},
        function(){ CFG.MAX_OVERLAYS=Math.max(3,CFG.MAX_OVERLAYS-1); },
        function(){
            var prev=CFG.MAX_OVERLAYS;
            CFG.MAX_OVERLAYS=Math.min(32,CFG.MAX_OVERLAYS+1);
            for(var i=0;i<CFG.MAX_OVERLAYS-prev;i++)
                sim.networks.push(new Network(bestSpawn().x,bestSpawn().y,false));
        },
        false
    );
    /* FPS inline — prepended inside the toggle row, left of the ◄ arrow */
    var fpsInline=document.createElement('span');
    fpsInline.id='pbg-fps-val';
    fpsInline.dataset.lbl='1';
    fpsInline.dataset.accent='0';
    fpsInline.style.cssText=
        'font:10px/1 monospace;letter-spacing:0.04em;white-space:nowrap;'+
        'border:1px solid currentColor;border-radius:2px;padding:1px 4px;'+
        'box-sizing:border-box;margin-right:4px;';
    fpsInline.textContent='-- FPS';
    ui.leftCtrl.insertBefore(fpsInline, ui.leftCtrl.firstChild);
    ui.left.appendChild(ui.leftCtrl);

    /* RIGHT — core table + toggle */
    if(ui.right){ui.right.remove();ui.right=null;ui.rightRows=[];}
    ui.right=_makePanel(BASE+'bottom:14px;right:16px;align-items:flex-end;');
    ui.rightCtrl=_makeToggle(
        function(){return 'cores: '+CFG.NUM_CORES;},
        function(){
            CFG.NUM_CORES=Math.max(2,CFG.NUM_CORES-1);
            var excess=sim.coreNets.filter(function(c){return c.state!==ST.DEAD;}).length-CFG.NUM_CORES;
            sim.coreNets.filter(function(c){return c.state===ST.ALIVE;})
                .slice(0,Math.max(0,excess))
                .forEach(function(c){c.state=ST.FADE_OUT;c.stf=0;});
        },
        function(){ CFG.NUM_CORES=Math.min(16,CFG.NUM_CORES+1); },
        true
    );
    ui.rightCtrl.style.width='100%';
    ui.rightCtrl.style.justifyContent='center';
    ui.right.appendChild(ui.rightCtrl);

    /* CENTRE BOTTOM — speed: two square [−][+] with label between */
    if(ui.speed){ui.speed.remove();ui.speed=null;}
    ui.speed=_makePanel(
        'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);'+
        'z-index:9999;pointer-events:none;display:flex;align-items:center;gap:5px;'
    );
    var sDecBtn=_squareBtn('\u2212', function(){
        sim.speedIdx=Math.max(0,sim.speedIdx-1);
        sValLbl.textContent=_speedLabel();
        _uiUpdateColour();
    }, false);
    var sIncBtn=_squareBtn('+', function(){
        sim.speedIdx=Math.min(SPEED_STEPS.length-1,sim.speedIdx+1);
        sValLbl.textContent=_speedLabel();
        _uiUpdateColour();
    }, false);
    function _speedLabel(){
        var s=_speed();
        return s===1?'1\u00d7':(s<1?s.toFixed(s<0.5?3:2)+'\u00d7':
            (Number.isInteger(s)?s+'\u00d7':s.toFixed(2)+'\u00d7'));
    }
    var sValLbl=_squareLbl(_speedLabel(), false);
    sDecBtn.dataset.speedBtn='1'; sIncBtn.dataset.speedBtn='1';
    ui.speed.appendChild(sDecBtn);
    ui.speed.appendChild(sValLbl);
    ui.speed.appendChild(sIncBtn);

    /* RIGHT EDGE CENTRE — zoom: two square [+][%][−] stacked */
    if(ui.zoom){ui.zoom.remove();ui.zoom=null;}
    ui.zoom=_makePanel(
        'position:fixed;right:8px;top:50%;transform:translateY(-50%);'+
        'z-index:9999;pointer-events:none;display:flex;flex-direction:column;'+
        'align-items:center;gap:4px;'
    );
    var zoomPlus=_squareBtn('+', function(){
        sim.zoomLevel=Math.min(10,sim.zoomLevel+1);
        _updateZoomBtn();
    }, false);
    var zoomMinus=_squareBtn('\u2212', function(){
        sim.zoomLevel=Math.max(-10,sim.zoomLevel-1);
        _updateZoomBtn();
    }, false);
    var zoomLbl=document.createElement('span');
    zoomLbl.id='pbg-zoom-lbl';
    zoomLbl.dataset.lbl='1';
    zoomLbl.style.cssText=
        'font:700 11px/1 monospace;letter-spacing:0.05em;text-align:center;'+
        'white-space:nowrap;min-width:26px;display:block;';

    function _updateZoomBtn(){
        var pct=Math.round(_zoom()*100);
        zoomLbl.textContent=pct+'%';
        zoomPlus.style.opacity=sim.zoomLevel>=10?'0.18':'';
        zoomMinus.style.opacity=sim.zoomLevel<=-10?'0.18':'';
        _uiUpdateColour();
    }
    _updateZoomBtn();

    ui.zoom.appendChild(zoomPlus);
    ui.zoom.appendChild(zoomLbl);
    ui.zoom.appendChild(zoomMinus);

    /* FPS is now inlined left of the overlays toggle — no separate panel needed */
    if(ui.fpsBox){ui.fpsBox.remove();ui.fpsBox=null;}

    _uiUpdateColour();
}


/* ── Colour application ─────────────────────────────────────── */
function _uiUpdateColour(){
    var pr='rgba('+colour.pr+','+colour.pg+','+colour.pb+',';
    var ac='rgba('+colour.ar+','+colour.ag+','+colour.ab+',';

    function _applyPanel(panel, isAccent){
        if(!panel) return;
        panel.querySelectorAll('[data-lbl]').forEach(function(el){
            var elAcc=el.dataset.accent==='1';
            var ec=elAcc?ac:pr;
            el.style.color=ec+'0.62)';
        });
        panel.querySelectorAll('[data-arrow]').forEach(function(el){
            var elAcc=el.dataset.accent==='1';
            var ec=elAcc?ac:pr;
            el.style.color=ec+'0.55)';
            /* Square buttons also need their border coloured */
            if(el.style.borderRadius) el.style.borderColor=ec+'0.55)';
        });
    }

    _applyPanel(ui.left,   false);
    _applyPanel(ui.right,  true);
    _applyPanel(ui.speed,  false);
    _applyPanel(ui.zoom,   false);
    _applyPanel(ui.fpsBox, false);
    var fv=document.getElementById('pbg-fps-val');
    if(fv){
        var pr2='rgba('+colour.pr+','+colour.pg+','+colour.pb+',';
        fv.style.color=pr2+'0.72)'; fv.style.borderColor=pr2+'0.45)';
    }

    /* Zoom label */
    var zlbl=document.getElementById('pbg-zoom-lbl');
    if(zlbl) zlbl.style.color=pr+'0.38)';
}

/* ── Breathe animation on arrows ─────────────────────────────── */
function _ctrlAnimatePulse(){
    ui.ctrlPulse++;
    var t=ui.ctrlPulse;
    /* Update FPS readout */
    var fv=document.getElementById('pbg-fps-val');
    if(fv) fv.textContent=(sim.fps>0?sim.fps:'--')+' FPS';
    var bP=0.38+Math.sin(t*0.018)*0.18;
    var bA=0.45+Math.sin(t*0.018+1.0)*0.20;
    var bZ=0.42+Math.sin(t*0.013+2.5)*0.18;
    var pr='rgba('+colour.pr+','+colour.pg+','+colour.pb+',';
    var ac='rgba('+colour.ar+','+colour.ag+','+colour.ab+',';
    function _breathePanel(panel){
        if(!panel) return;
        panel.querySelectorAll('[data-arrow]').forEach(function(el){
            if(el.matches(':hover')) return;
            var isAcc=el.dataset.accent==='1';
            var c=(isAcc?ac:pr)+(isAcc?bA:bP)+')';
            el.style.color=c;
            if(el.style.borderRadius) el.style.borderColor=c;
        });
    }
    _breathePanel(ui.left);
    _breathePanel(ui.right);
    _breathePanel(ui.speed);
    /* FPS box border breathes with primary */
    var fv2=document.getElementById('pbg-fps-val');
    if(fv2&&!fv2.matches(':hover')){
        var pr3='rgba('+colour.pr+','+colour.pg+','+colour.pb+',';
        var bFps=0.50+Math.sin(t*0.015+3.8)*0.22;
        fv2.style.color=pr3+Math.min(1,bFps+0.20)+')';
        fv2.style.borderColor=pr3+bFps+')';
    }
    /* Zoom buttons use a slower separate breathe */
    if(ui.zoom){
        ui.zoom.querySelectorAll('[data-arrow]').forEach(function(el){
            if(!el.matches(':hover')){
                var c=pr+bZ+')';
                el.style.color=c;
                if(el.style.borderRadius) el.style.borderColor=c;
            }
        });
    }
}


/* ── LEFT PANEL: overlay table ──────────────────────────────── */
function _overlayMonitorUpdate(){
    if(!ui.left||!ui.leftCtrl) return;
    var overlays=sim.networks.filter(function(n){return !n.isCore&&n.state!==ST.DEAD;});
    overlays.sort(function(a,b){return _netRemaining(b)-_netRemaining(a);});

    var need=1+overlays.length;
    _syncRows(ui.left, ui.leftRows, need);
    _syncRowOrder(ui.left, ui.leftRows, ui.leftCtrl);

    /* Sep */
    ui.leftRows[0].textContent=
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'+
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    ui.leftRows[0].style.color=col(0.12,false);

    for(var i=0;i<overlays.length;i++){
        var nw=overlays[i];
        var rem=_netRemaining(nw);
        var prog=_netProgress(nw);
        var filled=Math.round((1-prog)*10);
        var bar=''; for(var b=0;b<10;b++) bar+=(b<filled?'\u2588':'\u2591');
        var glyph=nw.state===ST.FADE_IN?' \u2191':nw.state===ST.FADE_OUT?' \u2193':'  ';
        var name=TOPO_NAMES[nw.topoType]||'???';
        while(name.length<8) name+=' ';
        var timeStr=nw.state===ST.FADE_IN?'  --s':
            (rem<10?'   ':rem<100?'  ':' ')+Math.ceil(rem)+'s';
        var rowIdx=overlays.length-i;
        ui.leftRows[rowIdx].textContent=name+' '+bar+' '+timeStr+glyph;
        var alpha=nw.state===ST.ALIVE?0.36:nw.state===ST.FADE_IN?0.20:0.14;
        ui.leftRows[rowIdx].style.color=col(alpha,false);
    }
}

/* ── RIGHT PANEL: core table ─────────────────────────────────── */
function _coreMonitorUpdate(){
    if(!ui.right||!ui.rightCtrl) return;
    var n=CFG.BLOCK_PACKETS;
    var liveCores=sim.coreNets.filter(function(c){return c.state!==ST.DEAD;});
    liveCores=liveCores.slice().sort(function(a,b){return (b.blockPackets||0)-(a.blockPackets||0);});

    var need=1+liveCores.length+1;
    _syncRows(ui.right, ui.rightRows, need);
    _syncRowOrder(ui.right, ui.rightRows, ui.rightCtrl);

    /* Sep */
    ui.rightRows[0].textContent=
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'+
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    ui.rightRows[0].style.color=col(0.12,true);

    for(var ci=0;ci<liveCores.length;ci++){
        var core=liveCores[ci];
        var rowIdx=liveCores.length-ci;
        var pkts=core.blockPackets||0;
        var filled=Math.round((pkts/n)*8);
        var bar=''; for(var b=0;b<8;b++) bar+=(b<filled?'\u2588':'\u2591');
        var hasRing=core.blockRings&&core.blockRings.length>0;
        var suffix=hasRing?' \u25c6':' \u00b7';
        var fadeGlyph=core.state===ST.FADE_IN?' \u2191':core.state===ST.FADE_OUT?' \u2193':'';
        ui.rightRows[rowIdx].textContent='C'+(ci+1)+' '+bar+' '+pkts+'/'+n+suffix+fadeGlyph;
        var ra=hasRing?0.78:pkts>n*0.6?0.50:0.30;
        ui.rightRows[rowIdx].style.color=col(ra,true);
    }

    var headerIdx=liveCores.length+1;
    var ringAny=sim.coreNets.some(function(c){return c.blockRings&&c.blockRings.length>0;});
    ui.rightRows[headerIdx].textContent='\u2b21 BSV  blocks: '+sim.globalBlocks+
        '  '+(ringAny?'\u25cf':'\u25cb');
    ui.rightRows[headerIdx].style.color=col(0.58,true);
}

/* Combined update called from engineDraw */
function _monitorUpdate(){
    _overlayMonitorUpdate();
    _coreMonitorUpdate();
}

/* Backward-compat aliases */
function injectMonitor(){ injectPanels(); }
function injectControls(){ }
function _ctrlUpdateColour(){ _uiUpdateColour(); }


/* ============================================================
   startPlugin / stop / destroy
   ============================================================ */
function startPlugin(){
    try{
        if(!scene.layer){
            scene.layer=document.createElement('div');
            scene.layer.id='particle-layer';
            scene.layer.style.cssText=
                'position:fixed;inset:0;width:100%;height:100%;'+
                'z-index:1;pointer-events:none;overflow:hidden;';
            document.body.appendChild(scene.layer);
        }
        scene.layer.style.opacity=CFG.OPACITY;

        if(_prefersReducedMotion){
            CFG.WAN_TRAIL=0; CFG.LAN_TRAIL=0;
            CFG.WAN_INTERVAL=Math.max(CFG.WAN_INTERVAL,600);
            CFG.LAN_INTERVAL=Math.max(CFG.LAN_INTERVAL,600);
        }

        engineStop();
        scene.running=true;
        var mode=document.documentElement.getAttribute('data-crt-mode')||'default';
        setColour(PARTICLE_CRT_COLOURS[mode]||PARTICLE_CRT_COLOURS['default']);
        engineInit();
        engineLoop();
        injectPanels();
    }catch(e){/* silent fail */}
}

function particleBgStart(){
    if(scene.animId) return;
    startPlugin();
}

function particleBgStop(){
    scene.running=false;
    engineStop();
    if(scene.layer) scene.layer.style.opacity=0;
    if(ui.left)     ui.left.style.opacity=0;
    if(ui.right)    ui.right.style.opacity=0;
    if(ui.speed)    ui.speed.style.opacity=0;
    if(ui.zoom)     ui.zoom.style.opacity=0;
    if(ui.fpsBox)   ui.fpsBox.style.opacity=0;
}

function particleBgDestroy(){
    engineStop();
    scene.running=false;
    if(scene.layer){ scene.layer.remove(); scene.layer=null; }
    if(ui.left){     ui.left.remove();     ui.left=null; }
    if(ui.right){    ui.right.remove();    ui.right=null; }
    if(ui.speed){    ui.speed.remove();    ui.speed=null; }
    if(ui.zoom){     ui.zoom.remove();     ui.zoom=null; }
    if(ui.fpsBox){   ui.fpsBox.remove();   ui.fpsBox=null; }
    if(ui.observer){ ui.observer.disconnect(); ui.observer=null; }
    scene.canvas=null; scene.ctx=null;
    sim.networks=[]; sim.pulses=[]; sim.frame=0;
    sim.coreNets=[]; sim.coreNet=null;
    sim.globalBlocks=0; sim.blockCooldown=0;
    ui.leftRows=[]; ui.rightRows=[];
    _glowCacheInvalidate();
}

function particleBgSetOpacity(v){
    CFG.OPACITY=Math.max(0,Math.min(1,+v||0));
    if(scene.layer) scene.layer.style.opacity=CFG.OPACITY;
}


/* ============================================================
   CRT MODE OBSERVER
   ============================================================ */
(function(){
    function attach(){
        if(typeof MutationObserver==='undefined') return;
        if(ui.observer) ui.observer.disconnect();
        var last=document.documentElement.getAttribute('data-crt-mode')||'default';
        ui.observer=new MutationObserver(function(){
            var now=document.documentElement.getAttribute('data-crt-mode')||'default';
            if(now===last) return; last=now;
            setColour(PARTICLE_CRT_COLOURS[now]||PARTICLE_CRT_COLOURS['default']);
            _uiUpdateColour();
        });
        ui.observer.observe(document.documentElement,
            {attributes:true,attributeFilter:['data-crt-mode']});
    }
    if(document.readyState==='loading')
        document.addEventListener('DOMContentLoaded',attach);
    else attach();
})();


/* ── Page Visibility pause ────────────────────────────────── */
document.addEventListener('visibilitychange',function(){
    if(!scene.running) return;
    if(document.hidden){ engineStop(); }
    else { if(!scene.animId) engineLoop(); }
});


/* ── Public API ───────────────────────────────────────────── */
global.CFG                  = CFG;
global.particleBgStart      = particleBgStart;
global.particleBgStop       = particleBgStop;
global.particleBgDestroy    = particleBgDestroy;
global.particleBgSetOpacity = particleBgSetOpacity;

}(window));
