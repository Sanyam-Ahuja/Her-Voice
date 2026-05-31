import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import ratingsRouter from './routes/ratings.js';
import heatmapRouter from './routes/heatmap.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', ratingsRouter);
app.use('/api', heatmapRouter);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'HerVoice API Service is running. Use /api/heatmap or /health.' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`HerVoice backend running on port ${port}`);
});
