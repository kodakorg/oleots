const express = require('express');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use('/css', express.static(path.join(__dirname, 'public/css')))

app.set('view engine', 'ejs');

const redisURL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const client = redis.createClient({
  url: redisURL
});
const PORT = process.env.PORT || 8088;

client.on('error', (err) => console.error('Redis Client Error', err));

app.get('/', (req, res) => {
  res.render('create_secret');
});

app.post('/secret', async (req, res) => {
  const encryptedSecret = req.body.encryptedSecret;
  let timeToLive = req.body.ttl;

  console.log('encryptedSecret:', encryptedSecret);
  console.log('timeToLive:', timeToLive);

  if (!encryptedSecret) {
    return res.status(400).json({ error: 'ecryptedSecret missing' });
  }

  const id = uuidv4().replace(/-/g, '');

  if (timeToLive == "week") {
    timeToLive = 168;
  }
  let ttl = timeToLive * 3600;
  let ttlInt = parseInt(ttl);

  try {
    await client.set(id, JSON.stringify(encryptedSecret), { EX: ttlInt });
    res.json({ id });
  } catch (error) {
    console.error('Could not store secret:', error);
    res.status(500).json({ error: 'Could not store secret' });
  }
});

app.get('/secret/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const encryptedSecret = await client.get(id);
    if (!encryptedSecret) {
      return res.render('view_secret', { secret: "notfound" });
    }
    await client.del(id);
    res.render('view_secret', { secret: encryptedSecret });
  } catch (error) {
    console.error('Error getting secret:', error);
    res.status(500).send('Error getting secret (500)');
  }
});

async function startServer() {
  try {
    await client.connect();
    console.log('Connected to Redis');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

startServer();
