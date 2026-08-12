import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Simulated live state database in memory for mockup
const db = {
  history: {
    EC2: [12, 14, 15, 14, 13, 15, 16, 15, 14, 16, 17, 16],
    RDS: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    Lambda: [4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4],
    S3: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    DynamoDB: [2, 2, 3, 2, 2, 2, 3, 2, 2, 3, 2, 2],
    ElastiCache: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ECS: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    CloudFront: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
  },
  healthChecks: [
    { id: 'hc-1', name: 'web-server-01', service: 'EC2', region: 'ap-south-1', status: 'Healthy', lastCheck: '', details: 'Response time: 120 ms', val: 120 },
    { id: 'hc-2', name: 'users-table', service: 'DynamoDB', region: 'ap-south-1', status: 'Degraded', lastCheck: '', details: 'Throttled requests detected', val: 0 },
    { id: 'hc-3', name: 'cache-cluster', service: 'ElastiCache', region: 'ap-south-1', status: 'Unhealthy', lastCheck: '', details: 'Connection failed', val: 0 },
    { id: 'hc-4', name: 'my-app-bucket', service: 'S3', region: 'ap-south-1', status: 'Healthy', lastCheck: '', details: 'Accessible', val: 0 }
  ]
};

// Update mock data dynamically for the sparklines and live ticks
function updateMockState() {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true });
  
  // Tweak metrics
  const services = Object.keys(db.history);
  services.forEach(service => {
    const list = db.history[service];
    let newVal = list[list.length - 1];
    
    // Add minor fluctuations
    if (service === 'EC2') newVal = Math.max(4, Math.min(10, newVal + (Math.random() > 0.5 ? 1 : -1)));
    if (service === 'Lambda') newVal = Math.max(2, Math.min(8, newVal + (Math.random() > 0.6 ? 1 : -1)));
    if (service === 'DynamoDB') newVal = Math.random() > 0.85 ? (newVal === 2 ? 3 : 2) : newVal;
    
    list.push(newVal);
    if (list.length > 20) list.shift(); // Keep history size controlled
  });

  // Update health checks
  db.healthChecks.forEach(hc => {
    hc.lastCheck = timestamp;
    if (hc.service === 'EC2') {
      hc.val = Math.floor(100 + Math.random() * 50);
      hc.details = `Response time: ${hc.val} ms`;
      hc.status = hc.val > 140 ? 'Degraded' : 'Healthy';
    }
  });
}

// Initialize times
const initTime = () => {
  const date = new Date();
  db.healthChecks.forEach((hc, i) => {
    const offsetDate = new Date(date.getTime() - i * 3000);
    hc.lastCheck = offsetDate.toLocaleTimeString('en-US', { hour12: true });
  });
};
initTime();

// Interval for mock updates
setInterval(updateMockState, 15000);

// API Endpoints
app.get('/api/dashboard', async (req, res) => {
  // Check if real AWS query is forced and credentials exist
  const forceMock = process.env.USE_MOCK_DATA !== 'false';
  
  if (!forceMock && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const { EC2Client, DescribeInstancesCommand } = await import('@aws-sdk/client-ec2');
      const ec2Client = new EC2Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const ec2Data = await ec2Client.send(new DescribeInstancesCommand({}));
      
      let ec2Count = 0;
      ec2Data.Reservations.forEach(res => {
        ec2Count += res.Instances.filter(i => i.State.Name === 'running').length;
      });
      
      db.history.EC2.push(ec2Count);
      if (db.history.EC2.length > 20) db.history.EC2.shift();
    } catch (err) {
      console.warn('Real AWS fetch error (falling back to Mock data):', err.message);
    }
  }

  // Calculate summary counts
  const ec2Running = db.history.EC2[db.history.EC2.length - 1];
  const rdsRunning = db.history.RDS[db.history.RDS.length - 1];
  const lambdaRunning = db.history.Lambda[db.history.Lambda.length - 1];
  const s3Active = db.history.S3[db.history.S3.length - 1];
  const dynamoDbActive = db.history.DynamoDB[db.history.DynamoDB.length - 1];
  const elasticacheActive = db.history.ElastiCache[db.history.ElastiCache.length - 1];
  const ecsRunning = db.history.ECS[db.history.ECS.length - 1];
  const cloudfrontActive = db.history.CloudFront[db.history.CloudFront.length - 1];

  const totalRunning = ec2Running + rdsRunning + lambdaRunning + s3Active + dynamoDbActive + elasticacheActive + ecsRunning + cloudfrontActive;

  let healthy = 0;
  let degraded = 0;
  let unhealthy = 0;

  const resources = [
    { service: 'EC2 Instances', key: 'EC2', count: ec2Running, region: 'ap-south-1', status: 'Healthy', history: db.history.EC2 },
    { service: 'RDS Instances', key: 'RDS', count: rdsRunning, region: 'ap-south-1', status: 'Healthy', history: db.history.RDS },
    { service: 'Lambda Functions', key: 'Lambda', count: lambdaRunning, region: 'ap-south-1', status: 'Healthy', history: db.history.Lambda },
    { service: 'S3 Buckets', key: 'S3', count: s3Active, region: 'ap-south-1', status: 'Healthy', history: db.history.S3 },
    { service: 'DynamoDB Tables', key: 'DynamoDB', count: dynamoDbActive, region: 'ap-south-1', status: 'Degraded', history: db.history.DynamoDB },
    { service: 'ElastiCache Clusters', key: 'ElastiCache', count: elasticacheActive, region: 'ap-south-1', status: 'Unhealthy', history: db.history.ElastiCache },
    { service: 'ECS Services', key: 'ECS', count: ecsRunning, region: 'ap-south-1', status: 'Healthy', history: db.history.ECS },
    { service: 'CloudFront Dist.', key: 'CloudFront', count: cloudfrontActive, region: 'ap-south-1', status: 'Healthy', history: db.history.CloudFront }
  ];

  resources.forEach(r => {
    if (r.status === 'Healthy') healthy += r.count;
    else if (r.status === 'Degraded') degraded += r.count;
    else if (r.status === 'Unhealthy') unhealthy += r.count;
  });

  const healthyPct = totalRunning > 0 ? ((healthy / totalRunning) * 100).toFixed(1) : '0.0';
  const degradedPct = totalRunning > 0 ? ((degraded / totalRunning) * 100).toFixed(1) : '0.0';
  const unhealthyPct = totalRunning > 0 ? ((unhealthy / totalRunning) * 100).toFixed(1) : '0.0';

  res.json({
    summary: {
      total: totalRunning,
      healthy,
      healthyPct,
      degraded,
      degradedPct,
      unhealthy,
      unhealthyPct
    },
    resources,
    healthChecks: db.healthChecks
  });
});

app.post('/api/refresh', (req, res) => {
  updateMockState();
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 AWS Monitoring Server running at http://localhost:${PORT}`);
  console.log(`===================================================`);
});
