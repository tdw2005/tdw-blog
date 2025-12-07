const crypto = require('crypto');

function generateETag(data) {
  const content = (typeof data === 'string' || Buffer.isBuffer(data)) ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(content).digest('hex');
}

module.exports = { generateETag };
