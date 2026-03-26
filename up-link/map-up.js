/* ═══════════════════════════════════════════════════════════════
   map-up.js — S2 MAP Record Table (v7.1)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Builds the MAP record table for Screen 2 (#p2-map).
             Takes collected form data and renders a preview table
             showing all MAP fields that will be written on-chain.
             In UPDATE mode, highlights changed/added rows with diff
             colouring against the loaded original record.

   INPUTS:   App.Utils (from app-core.js).
             SETTINGS (from settings.js).
             Form data object from App.Form.collectData().

   OUTPUTS:  App.Panels.S2.map — { _buildRows(data), render(data, loadedRecord) }

   DEPENDS:  settings.js, app-core.js.

   NOTES:    Absorbed from app-panels-s2.js (App.Panels.S2.map).
             "map-up" because it pushes local form data UP to chain
             (contrast with map-down.js which pulls FROM chain).
             Rendering is called by app-core-s2.js each time S2 mounts.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S2 = App.Panels.S2 || {};


App.Panels.S2.map = {

  /**
   * Build the full MAP row array from collected form data.
   * Mirrors the field order of App.MAPExport._buildMAPFields.
   */
  _buildRows: function(data) {
    var d = data;
    var rows = [
      ['protocol',         d.protocol],
      ['protocol_version', d.protocol_version],
      ['name',             d.name || ''],
      ['abbreviation',     d.abbreviation || ''],
      ['url',              d.url || ''],
      ['tor_url',          d.tor_url || ''],
      ['bsv_address',      d.bsv_address || ''],
      ['category',         d.category || ''],
      ['subcategory',      d.subcategory || ''],
      ['status',           d.status || ''],
      ['language',         d.language || ''],
      ['bsv_content',      String(!!d.bsv_content)],
      ['brc100',           String(d.brc100)],
      ['on_chain',         String(!!d.on_chain)],
      ['accepts_bsv',      String(!!d.accepts_bsv)],
      ['open_source',      String(!!d.open_source)],
      ['release_date',     d.release_date || ''],
      ['version',          d.version || ''],
      ['tags',             d.tags || ''],
      ['description',      d.description || '']
    ];

    /* Features */
    var feats = d.features || [];
    for (var fi = 0; fi < feats.length; fi++) {
      if (feats[fi]) rows.push(['feature_' + (fi + 1), feats[fi]]);
    }

    /* Icon fields */
    rows.push(
      ['icon_txid',       d.icon_txid || '(pending)'],
      ['icon_format',     d.icon_format || ''],
      ['icon_size_kb',    String(d.icon_size_kb || '')],
      ['icon_bg_enabled', String(d.icon_bg_enabled)],
      ['icon_fg_enabled', String(d.icon_fg_enabled)],
      ['icon_bg_colour',  d.icon_bg_colour || ''],
      ['icon_fg_colour',  d.icon_fg_colour || ''],
      ['icon_bg_alpha',   String(d.icon_bg_alpha)],
      ['icon_zoom',       String(d.icon_zoom)],
      ['alt_text',        d.alt_text || ''],
      ['developer_paymail',  d.developer_paymail || ''],
      ['developer_twitter',  d.developer_twitter || ''],
      ['developer_github',   d.developer_github || ''],
      ['developer_bio',      d.developer_bio || '']
    );

    /* Screenshot fields — per-slot zoom + alt_text */
    var ss = d.screenshots || [null, null, null, null];
    for (var si = 0; si < 4; si++) {
      var n = si + 1;
      var slot = ss[si];
      if (slot || d['ss' + n + '_txid']) {
        rows.push(['ss' + n + '_txid',     d['ss' + n + '_txid'] || '(pending)']);
        rows.push(['ss' + n + '_format',   (slot && slot.mime) || d['ss' + n + '_format'] || '']);
        rows.push(['ss' + n + '_size_kb',  (slot && String(slot.kb)) || d['ss' + n + '_size_kb'] || '']);
        rows.push(['ss' + n + '_zoom',     d['ss' + n + '_zoom'] || (slot && String(slot.zoom)) || '1']);
        rows.push(['ss' + n + '_alt_text', d['ss' + n + '_alt_text'] || (slot && slot.altText) || '']);
      }
    }

    return rows;
  },

  /**
   * Render the MAP record table HTML.
   * @param {Object} data — collected form data
   * @param {Object|null} loadedRecord — original record for diff (update mode)
   * @returns {string} HTML string
   */
  render: function(data, loadedRecord) {
    var esc = App.Utils.esc;
    var rows = this._buildRows(data);
    var old = loadedRecord;
    var hasChanges = false;
    var html = '';

    for (var i = 0; i < rows.length; i++) {
      var k = rows[i][0];
      var v = rows[i][1];
      var newVal = esc(String(v));
      var fvClass = (k.indexOf('feature') === 0) ? ' fv' : '';

      if (old && old[k] !== undefined) {
        var oldVal = esc(String(old[k]));
        if (oldVal !== newVal) {
          /* Changed row — show old crossed out, new below */
          hasChanges = true;
          html += '<tr class="changed"><td>' + esc(k) + '</td>' +
            '<td class="' + fvClass + '"><div class="map-old">' + oldVal + '</div>' +
            '<div class="map-new">' + newVal + '</div></td></tr>';
        } else {
          html += '<tr><td>' + esc(k) + '</td><td class="' + fvClass + '">' + newVal + '</td></tr>';
        }
      } else if (old) {
        /* New field not in original record */
        html += '<tr class="added"><td>' + esc(k) + '</td><td class="' + fvClass + '">' + newVal + '</td></tr>';
      } else {
        /* Submit mode — no diff */
        html += '<tr><td>' + esc(k) + '</td><td class="' + fvClass + '">' + newVal + '</td></tr>';
      }
    }

    /* No-change warning for update mode */
    var warnHtml = '';
    if (old && !hasChanges) {
      warnHtml = '<div class="no-change-warn">' +
        '<span class="no-change-icon">\u26a0</span> NO CHANGES DETECTED' +
        '<div class="no-change-sub">This update is identical to the loaded record</div>' +
        '</div>';
    }

    return '<div class="plabel">ON-CHAIN MAP RECORD</div>' +
      warnHtml +
      '<table class="map-table"><tbody>' + html + '</tbody></table>';
  }
};
