const jsonServer = require('json-server');

const server = jsonServer.create();
const router = jsonServer.router('mock/db.json');
const db = router.db; // lowdb instance

server.use(jsonServer.defaults());
server.use(jsonServer.bodyParser);

const reject = (res, status, code, message) =>
  res.status(status).json({ status: 'REJECTED', code, message });

const apiKey = process.env.MOCK_API_KEY || 'mock-api-key';

// every /provider route requires a valid x-api-key header
server.use('/provider', (req, res, next) => {
  const sent = req.get('x-api-key');
  if (!sent) {
    return reject(res, 403, 'MISSING_API_KEY', 'The x-api-key header is required');
  }
  if (sent !== apiKey) {
    return reject(res, 403, 'INVALID_API_KEY', 'The provided api key is not valid');
  }
  return next();
});

server.post('/provider/v1/execute', (req, res) => {
  const { accountId, type, amount, currency } = req.body;

  // simulate a provider outage on demand
  if (accountId === 'acc-timeout') {
    return reject(res, 503, 'PROVIDER_UNAVAILABLE', 'Provider is temporarily unavailable');
  }

  const account = db.get('accounts').find({ id: accountId }).value();
  if (!account) {
    return reject(res, 404, 'ACCOUNT_NOT_FOUND', 'The account does not exist');
  }
  if (account.currency !== currency) {
    return reject(res, 422, 'CURRENCY_MISMATCH', 'Account currency does not match');
  }
  if (type === 'DEBIT' && account.balance < amount) {
    return reject(res, 422, 'INSUFFICIENT_FUNDS',
      'The account does not have enough balance to complete the transaction');
  }

  const balance = type === 'CREDIT' ? account.balance + amount : account.balance - amount;
  const transaction = {
    transactionId: `txn-${Date.now()}`,
    accountId, type, amount, currency,
    status: 'APPROVED',
    balance,
    executedAt: new Date().toISOString(),
  };

  db.get('accounts').find({ id: accountId }).assign({ balance }).write();
  db.get('transactions').push(transaction).write();

  return res.status(200).json({
    transactionId: transaction.transactionId,
    status: transaction.status,
    balance: transaction.balance,
    executedAt: transaction.executedAt,
  });
});

// keeps GET /accounts and GET /transactions available for inspection
server.use(router);

const port = process.env.MOCK_PORT || 3001;
server.listen(port, () => console.log(`Mock provider on http://localhost:${port}`));
