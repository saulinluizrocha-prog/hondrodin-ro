const https = require('https');
const crypto = require('crypto');

const CONFIG = {
  api_key: 'c66289394c2a6e8515c8e8b382fba719',
  offer_id: '12870',
  user_id: '75329',
  api_domain: 'https://t-api.org',
};

function checkSum(jsonData) {
  return crypto.createHash('sha1').update(jsonData + CONFIG.api_key).digest('hex');
}

function postRequest(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

async function createLead(params) {
  const data = {
    user_id: CONFIG.user_id,
    data: {
      name: (params.name || '').trim(),
      phone: (params.phone || '').trim(),
      offer_id: CONFIG.offer_id,
      country: params.country || 'RO',
      tz: params.tz || '',
      address: params.address || null,
      region: params.region || null,
      city: params.city || null,
      zip: params.zip || null,
      stream_id: params.stream_id || '',
      count: params.count || null,
      email: params.email || null,
      user_comment: params.user_comment || null,
      utm_source: params.utm_source || null,
      utm_medium: params.utm_medium || null,
      utm_campaign: params.utm_campaign || null,
      utm_term: params.utm_term || null,
      utm_content: params.utm_content || null,
      sub_id: params.sub_id || null,
      sub_id_1: params.sub_id_1 || null,
      sub_id_2: params.sub_id_2 || null,
      sub_id_3: params.sub_id_3 || null,
      sub_id_4: params.sub_id_4 || null,
      referer: params.referer || null,
    }
  };

  const jsonData = JSON.stringify(data);
  const checksum = checkSum(jsonData);
  const apiUrl = `${CONFIG.api_domain}/api/lead/create?check_sum=${checksum}`;

  const response = await postRequest(apiUrl, jsonData);

  if (response.statusCode === 200) {
    const body = JSON.parse(response.body);
    if (body.status === 'ok') {
      return body.data;
    } else {
      throw new Error(body.error || 'API error');
    }
  } else {
    throw new Error(`HTTP error: ${response.statusCode}`);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const params = new URLSearchParams(body);
        const obj = {};
        for (const [key, value] of params.entries()) {
          obj[key] = value;
        }
        resolve(obj);
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = async function handler(req, res) {
  // Redireciona GET para a página inicial
  if (req.method === 'GET') {
    return res.writeHead(302, { Location: '/' }).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);

    if (!body.name || !body.phone) {
      return res.writeHead(302, { Location: '/' }).end();
    }

    // Pegar parâmetros da query string (UTMs, sub_ids, etc.)
    const urlParams = new URL(req.url, `https://${req.headers.host}`);
    const queryParams = {};
    for (const [key, value] of urlParams.searchParams.entries()) {
      queryParams[key] = value;
    }

    const params = {
      ...body,
      ...queryParams,
      referer: queryParams.referer || req.headers.referer || null,
    };

    const lead = await createLead(params);

    // Redireciona para a página de sucesso
    return res.writeHead(302, { Location: `/success.html?id=${lead.id}` }).end();

  } catch (err) {
    console.error('Error creating lead:', err.message);
    // Em caso de erro, redireciona para success mesmo assim (para não mostrar erro ao cliente)
    // ou muda para mostrar mensagem de erro
    return res.writeHead(302, { Location: '/success.html' }).end();
  }
};
