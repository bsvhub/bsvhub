/* ============================================================
   PARTICLE NETWORK PLUGIN — particle-bg.js  v2.0
   ============================================================
   Custom canvas-based mesh network animation.
   No external library dependency.

   VISUAL DESIGN:
     Hub nodes    — large glowing anchors that drift slowly
     Satellites   — smaller nodes loosely bound to each hub,
                    forming a dense intra-cluster mesh
     Backbone     — long lines between nearby hubs, fading as
                    clusters drift into/out of range
     Pulses       — bright signal dots with glowing trails
                    travelling backbone lines (data transfer)
     Hub flash    — hubs briefly brighten when a pulse arrives

   SECTIONS:
     1. Colour map (CRT mode support)
     2. Config / tuning
     3. Colour helpers
     4. Classes — Hub, Satellite, Pulse
     5. Engine — init, update, draw, loop
     6. Layer injection
     7. CRT mode observer
   ============================================================ */


/* ============================================================
   1 — COLOUR MAP
   ============================================================ */
var PARTICLE_CRT_COLOURS = {
    'default': '#7a8fa8',
    'amber':   '#FFB000',
    'green':   '#00CC44',
    'white':   '#C8D8EE',
    'blue':    '#5599FF',
    'cyan':    '#00CCDD',
};


/* ============================================================
   2 — CONFIG
   ============================================================ */
var CFG = {
    HUB_COUNT:       8,
    SATS_PER_HUB:    11,
    CLUSTER_RADIUS:  130,
    HUB_LINK_DIST:   420,
    SAT_LINK_DIST:   85,
    CROSS_LINK_DIST: 70,
    HUB_SPEED:       0.28,
    SAT_SPEED:       0.45,
    PULSE_INTERVAL:  55,
};


/* ============================================================
   3 — COLOUR HELPERS
   ============================================================ */
var _r = 122, _g = 143, _b = 168;

function setColour(hex) {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        _r = parseInt(hex.slice(1,3), 16);
        _g = parseInt(hex.slice(3,5), 16);
        _b = parseInt(hex.slice(5,7), 16);
    } else if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        _r = parseInt(hex[1]+hex[1], 16);
        _g = parseInt(hex[2]+hex[2], 16);
        _b = parseInt(hex[3]+hex[3], 16);
    } else {
        try {
            var tmp = document.createElement('canvas');
            tmp.width = tmp.height = 1;
            var tc = tmp.getContext('2d');
            tc.fillStyle = hex;
            tc.fillRect(0,0,1,1);
            var d = tc.getImageData(0,0,1,1).data;
            _r = d[0]; _g = d[1]; _b = d[2];
        } catch(e) {}
    }
}

function rgba(a) {
    return 'rgba('+_r+','+_g+','+_b+','+a+')';
}


/* ============================================================
   4 — CLASSES
   ============================================================ */

/* Hub ─────────────────────────────────────────────────────── */
function Hub(x, y) {
    this.x     = x;
    this.y     = y;
    this.vx    = (Math.random() - 0.5) * CFG.HUB_SPEED * 2;
    this.vy    = (Math.random() - 0.5) * CFG.HUB_SPEED * 2;
    this.r     = 3.5 + Math.random() * 2;
    this.phase = Math.random() * Math.PI * 2;
    this.flash = 0;
}
Hub.prototype.update = function(W, H) {
    this.x += this.vx;
    this.y += this.vy;
    var M = 80;
    if (this.x < M)     this.vx += 0.03;
    if (this.x > W - M) this.vx -= 0.03;
    if (this.y < M)     this.vy += 0.03;
    if (this.y > H - M) this.vy -= 0.03;
    var spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if (spd > CFG.HUB_SPEED) {
        this.vx = (this.vx / spd) * CFG.HUB_SPEED;
        this.vy = (this.vy / spd) * CFG.HUB_SPEED;
    }
    this.phase += 0.018;
    this.flash  = Math.max(0, this.flash - 0.04);
};

/* Satellite ────────────────────────────────────────────────── */
function Satellite(hub) {
    this.hub   = hub;
    var angle  = Math.random() * Math.PI * 2;
    var dist   = 30 + Math.random() * CFG.CLUSTER_RADIUS * 0.8;
    this.x     = hub.x + Math.cos(angle) * dist;
    this.y     = hub.y + Math.sin(angle) * dist;
    this.vx    = (Math.random() - 0.5) * CFG.SAT_SPEED;
    this.vy    = (Math.random() - 0.5) * CFG.SAT_SPEED;
    this.r     = 1.2 + Math.random() * 1.4;
    this.phase = Math.random() * Math.PI * 2;
}
Satellite.prototype.update = function() {
    var dx   = this.hub.x - this.x;
    var dy   = this.hub.y - this.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var pull = (dist > CFG.CLUSTER_RADIUS)
        ? 0.0010 * (dist - CFG.CLUSTER_RADIUS) / CFG.CLUSTER_RADIUS
        : 0.0002;
    this.vx += dx * pull;
    this.vy += dy * pull;
    this.vx += (Math.random() - 0.5) * 0.04;
    this.vy += (Math.random() - 0.5) * 0.04;
    this.vx *= 0.978;
    this.vy *= 0.978;
    this.x  += this.vx;
    this.y  += this.vy;
    this.phase += 0.022;
};

/* Pulse ─────────────────────────────────────────────────────── */
function Pulse(fromHub, toHub) {
    this.fromHub   = fromHub;
    this.toHub     = toHub;
    this.t         = 0;
    this.speed     = 0.0025 + Math.random() * 0.003;
    this.alive     = true;
    this.trail     = [];
    this.TRAIL_LEN = 18;
    this.cx        = fromHub.x;
    this.cy        = fromHub.y;
}
Pulse.prototype.update = function() {
    if (this.t > 0) {
        this.trail.push({ x: this.cx, y: this.cy });
        if (this.trail.length > this.TRAIL_LEN) this.trail.shift();
    }
    this.t += this.speed;
    if (this.t >= 1) {
        this.alive = false;
        this.toHub.flash = 1.0;
    }
    this.cx = this.fromHub.x + (this.toHub.x - this.fromHub.x) * this.t;
    this.cy = this.fromHub.y + (this.toHub.y - this.fromHub.y) * this.t;
};


/* ============================================================
   5 — ENGINE
   ============================================================ */
var _canvas = null;
var _ctx    = null;
var _animId = null;
var _layer  = null;
var _W = 0, _H = 0;
var _hubs   = [];
var _sats   = [];
var _pulses = [];
var _frame  = 0;

function engineInit() {
    _W = window.innerWidth;
    _H = window.innerHeight;

    if (!_canvas) {
        _canvas = document.createElement('canvas');
        _canvas.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;' +
            'pointer-events:none;z-index:2;';
        _layer.appendChild(_canvas);
        window.addEventListener('resize', function() {
            _W = _canvas.width  = window.innerWidth;
            _H = _canvas.height = window.innerHeight;
        });
    }
    _canvas.width  = _W;
    _canvas.height = _H;
    _ctx   = _canvas.getContext('2d');
    _hubs  = [];
    _sats  = [];
    _pulses = [];
    _frame = 0;

    for (var i = 0; i < CFG.HUB_COUNT; i++) {
        var h = new Hub(
            120 + Math.random() * (_W - 240),
            120 + Math.random() * (_H - 240)
        );
        _hubs.push(h);
        for (var j = 0; j < CFG.SATS_PER_HUB; j++) {
            _sats.push(new Satellite(h));
        }
    }
}

function engineUpdate() {
    _frame++;
    _hubs.forEach(function(h) { h.update(_W, _H); });
    _sats.forEach(function(s) { s.update(); });
    _pulses.forEach(function(p) { p.update(); });
    _pulses = _pulses.filter(function(p) { return p.alive; });

    if (_frame % CFG.PULSE_INTERVAL === 0) {
        var pairs = [];
        for (var i = 0; i < _hubs.length; i++) {
            for (var j = i + 1; j < _hubs.length; j++) {
                var dx = _hubs[i].x - _hubs[j].x;
                var dy = _hubs[i].y - _hubs[j].y;
                if (Math.sqrt(dx*dx + dy*dy) < CFG.HUB_LINK_DIST) {
                    pairs.push([i, j]);
                }
            }
        }
        if (pairs.length) {
            var pair = pairs[Math.floor(Math.random() * pairs.length)];
            var from = Math.random() < 0.5 ? pair[0] : pair[1];
            var to   = from === pair[0] ? pair[1] : pair[0];
            _pulses.push(new Pulse(_hubs[from], _hubs[to]));
        }
    }
}

function engineDraw() {
    _ctx.clearRect(0, 0, _W, _H);

    /* 1 — backbone lines between hubs */
    for (var i = 0; i < _hubs.length; i++) {
        for (var j = i + 1; j < _hubs.length; j++) {
            var dx = _hubs[i].x - _hubs[j].x;
            var dy = _hubs[i].y - _hubs[j].y;
            var d  = Math.sqrt(dx*dx + dy*dy);
            if (d < CFG.HUB_LINK_DIST) {
                var a = Math.pow(1 - d / CFG.HUB_LINK_DIST, 1.6) * 0.55;
                _ctx.beginPath();
                _ctx.strokeStyle = rgba(a);
                _ctx.lineWidth   = 1.2;
                _ctx.moveTo(_hubs[i].x, _hubs[i].y);
                _ctx.lineTo(_hubs[j].x, _hubs[j].y);
                _ctx.stroke();
            }
        }
    }

    /* 2 — hub-to-satellite spokes */
    _sats.forEach(function(s) {
        var dx = s.x - s.hub.x;
        var dy = s.y - s.hub.y;
        var d  = Math.sqrt(dx*dx + dy*dy);
        var a  = Math.max(0, (1 - d / (CFG.CLUSTER_RADIUS * 1.3))) * 0.18;
        _ctx.beginPath();
        _ctx.strokeStyle = rgba(a);
        _ctx.lineWidth   = 0.5;
        _ctx.moveTo(s.hub.x, s.hub.y);
        _ctx.lineTo(s.x, s.y);
        _ctx.stroke();
    });

    /* 3 — intra-cluster mesh + cross-cluster proximity links */
    for (var i = 0; i < _sats.length; i++) {
        for (var j = i + 1; j < _sats.length; j++) {
            var same  = _sats[i].hub === _sats[j].hub;
            var limit = same ? CFG.SAT_LINK_DIST : CFG.CROSS_LINK_DIST;
            var dx = _sats[i].x - _sats[j].x;
            var dy = _sats[i].y - _sats[j].y;
            var d  = Math.sqrt(dx*dx + dy*dy);
            if (d < limit) {
                var a = (1 - d / limit) * (same ? 0.30 : 0.14);
                _ctx.beginPath();
                _ctx.strokeStyle = rgba(a);
                _ctx.lineWidth   = same ? 0.6 : 0.35;
                _ctx.moveTo(_sats[i].x, _sats[i].y);
                _ctx.lineTo(_sats[j].x, _sats[j].y);
                _ctx.stroke();
            }
        }
    }

    /* 4 — pulse trails + heads */
    _pulses.forEach(function(p) {
        for (var k = 0; k < p.trail.length; k++) {
            var frac = k / p.trail.length;
            _ctx.beginPath();
            _ctx.arc(p.trail[k].x, p.trail[k].y, frac * 1.8, 0, Math.PI * 2);
            _ctx.fillStyle = rgba(frac * 0.5);
            _ctx.fill();
        }
        var env  = Math.sin(p.t * Math.PI);
        var grad = _ctx.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, 14);
        grad.addColorStop(0, rgba(env * 0.55));
        grad.addColorStop(1, rgba(0));
        _ctx.beginPath();
        _ctx.arc(p.cx, p.cy, 14, 0, Math.PI * 2);
        _ctx.fillStyle = grad;
        _ctx.fill();
        _ctx.beginPath();
        _ctx.arc(p.cx, p.cy, 2.8, 0, Math.PI * 2);
        _ctx.fillStyle = rgba(env * 0.95);
        _ctx.fill();
    });

    /* 5 — satellite dots */
    _sats.forEach(function(s) {
        var tw = 0.45 + Math.sin(s.phase) * 0.15;
        _ctx.beginPath();
        _ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        _ctx.fillStyle = rgba(tw);
        _ctx.fill();
    });

    /* 6 — hub nodes */
    _hubs.forEach(function(h) {
        var pulse  = 0.55 + Math.sin(h.phase) * 0.25;
        var bright = pulse + h.flash * 0.8;
        var outerR = 28 + h.flash * 18;

        var g1 = _ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, outerR);
        g1.addColorStop(0,   rgba(bright * 0.45));
        g1.addColorStop(0.4, rgba(bright * 0.15));
        g1.addColorStop(1,   rgba(0));
        _ctx.beginPath();
        _ctx.arc(h.x, h.y, outerR, 0, Math.PI * 2);
        _ctx.fillStyle = g1;
        _ctx.fill();

        var g2 = _ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 10);
        g2.addColorStop(0, rgba(bright * 0.9));
        g2.addColorStop(1, rgba(bright * 0.1));
        _ctx.beginPath();
        _ctx.arc(h.x, h.y, 10, 0, Math.PI * 2);
        _ctx.fillStyle = g2;
        _ctx.fill();

        _ctx.beginPath();
        _ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        _ctx.fillStyle = rgba(Math.min(1, bright));
        _ctx.fill();
    });
}

function engineStop() {
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
}

function engineLoop() {
    engineUpdate();
    engineDraw();
    _animId = requestAnimationFrame(engineLoop);
}


/* ============================================================
   6 — LAYER INJECTION & START
   ============================================================ */
function startPlugin() {
    try {
        if (!_layer) {
            _layer    = document.createElement('div');
            _layer.id = 'particle-layer';
            var bg    = document.getElementById('background-layer');
            if (!bg) return;
            bg.insertAdjacentElement('afterend', _layer);
        }
        engineStop();
        var mode = document.documentElement.getAttribute('data-crt-mode') || 'default';
        setColour(PARTICLE_CRT_COLOURS[mode] || PARTICLE_CRT_COLOURS['default']);
        engineInit();
        engineLoop();
    } catch(e) { /* silent fail */ }
}

function scheduleStart() {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(startPlugin, { timeout: 1500 });
    } else {
        setTimeout(startPlugin, 300);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleStart);
} else {
    scheduleStart();
}


/* ============================================================
   7 — CRT MODE OBSERVER
   Recolours particles live when the swatch changes.
   ============================================================ */
(function() {
    function attach() {
        if (typeof MutationObserver === 'undefined') return;
        var last = document.documentElement.getAttribute('data-crt-mode') || 'default';
        new MutationObserver(function() {
            var now = document.documentElement.getAttribute('data-crt-mode') || 'default';
            if (now === last) return;
            last = now;
            setColour(PARTICLE_CRT_COLOURS[now] || PARTICLE_CRT_COLOURS['default']);
        }).observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-crt-mode']
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();


/* ============================================================
   8 — MOBILE MODE OBSERVER
   Watches body.mobile-mode class and actually stops/starts
   the rAF loop — display:none alone doesn't stop JS execution.
   ============================================================ */
(function() {
    function isMobile() {
        return document.body.classList.contains('mobile-mode');
    }

    function attach() {
        if (typeof MutationObserver === 'undefined') return;
        var wasMobile = isMobile();

        /* Stop immediately if already in mobile mode on load */
        if (wasMobile) engineStop();

        new MutationObserver(function() {
            var nowMobile = isMobile();
            if (nowMobile === wasMobile) return;
            wasMobile = nowMobile;
            if (nowMobile) {
                engineStop();
            } else {
                /* Resume — only restart loop if engine is initialised */
                if (_canvas && !_animId) engineLoop();
            }
        }).observe(document.body, {
            attributes:      true,
            attributeFilter: ['class']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();
