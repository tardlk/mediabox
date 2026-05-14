// pdfh/pdfa/pd — DrPy template helpers
// These are referenced by drpy2.min.js but not defined in cheerio module
globalThis.pdfh = function(html, parse) {
    if (!html || !parse) return '';
    try { return cheerio.jp(parse, html) || ''; } catch(e) { return ''; }
};
globalThis.pdfa = function(html, parse) {
    if (!html || !parse) return [];
    try { var r = cheerio.jp(parse, html); return Array.isArray(r) ? r : (r ? [r] : []); } catch(e) { return []; }
};
globalThis.pd = function(html, parse) {
    return pdfh(html, parse);
};
