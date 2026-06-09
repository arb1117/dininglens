const INSTALL_ID_RE = /^[a-zA-Z0-9_\-]{1,80}$/;

function identityMiddleware(req, res, next) {
  const raw = req.headers['x-dininglens-install-id'];
  if (raw && INSTALL_ID_RE.test(raw)) {
    req.actor = { type: 'install', id: raw };
  } else {
    req.actor = { type: 'anonymous', id: `anon-${req.requestId}` };
  }
  next();
}

module.exports = identityMiddleware;
