const express = require('express');
const cors = require('cors');
const { runAutomation, startTask, stopTask } = require('./engine');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve o site do painel

const activeTasks = {};

// Iniciar Tarefa
app.post('/api/start-task', (req, res) => {
    const { referralLink, loops } = req.body;
    const taskId = Date.now().toString();

    console.log(`[API] Nova tarefa: ${loops} loops no link ${referralLink}`);

    activeTasks[taskId] = { status: 'running', logs: [] };
    startTask(taskId);

    // Roda sem travar a resposta
    runAutomation({ referralLink, loops, taskId }, (msg) => {
        if(activeTasks[taskId]) activeTasks[taskId].logs.push(msg);
    }).then(() => {
        if(activeTasks[taskId]) activeTasks[taskId].status = 'completed';
    }).catch((err) => {
        if(activeTasks[taskId]) activeTasks[taskId].status = 'failed';
    });

    res.json({ success: true, taskId });
});

// Parar Tarefa
app.post('/api/stop-task', (req, res) => {
    const { taskId } = req.body;
    stopTask(taskId);
    if(activeTasks[taskId]) {
        activeTasks[taskId].logs.push("🛑 Parada forçada.");
        activeTasks[taskId].status = 'stopped';
    }
    res.json({ success: true });
});

// Pegar Status e Logs
app.get('/api/task-status/:id', (req, res) => {
    const task = activeTasks[req.params.id];
    res.json(task || { status: 'not_found' });
});

// Mock da licença (para o front não quebrar)
app.post('/api/check-license', (req, res) => {
    res.json({ success: true, credits: 9999, active: true });
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`🚀 Servidor V2 online na porta ${PORT}`));