const zlib = require("zlib");

// Express middleware that gzip-encodes JSON responses to minimize outbound
// bandwidth (Render egress). It wraps res.json() and only compresses payloads
// at or above `minBytes` when the client advertises gzip support. Uses the
// built-in zlib module so no extra dependency (and no package-lock change) is
// required.
const createGzipJsonMiddleware = ({ minBytes = 1024 } = {}) => (req, res, next) => {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  const clientAcceptsGzip = /\bgzip\b/i.test(acceptEncoding);
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    let payload;
    try {
      payload = JSON.stringify(body === undefined ? null : body);
    } catch {
      return sendJson(body);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Vary", "Accept-Encoding");
    if (!clientAcceptsGzip || res.getHeader("Content-Encoding") || Buffer.byteLength(payload) < minBytes) {
      return res.end(payload);
    }
    zlib.gzip(payload, (error, compressed) => {
      if (error) {
        res.removeHeader("Content-Encoding");
        return res.end(payload);
      }
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", compressed.length);
      res.end(compressed);
    });
    return res;
  };
  next();
};

module.exports = { createGzipJsonMiddleware };
