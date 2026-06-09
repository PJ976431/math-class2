const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 允许接收较大的 Base64 图片数据
app.use(express.static(__dirname));
app.use(express.json({ limit: '15mb' })); 

// 需求③：将账号更新为 group1 到 group10
const users = {
    'group1': { password: '123456', role: 'student' },
    'group2': { password: '123456', role: 'student' },
    'group3': { password: '123456', role: 'student' },
    'group4': { password: '123456', role: 'student' },
    'group5': { password: '123456', role: 'student' },
    'group6': { password: '123456', role: 'student' },
    'group7': { password: '123456', role: 'student' },
    'group8': { password: '123456', role: 'student' },
    'group9': { password: '123456', role: 'student' },
    'group10': { password: '123456', role: 'student' },
    'teacher': { password: '123456', role: 'teacher' }
};

let works = []; 

// 1. 登录接口
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        res.json({ success: true, role: users[username].role, username });
    } else {
        res.json({ success: false, message: '账号或密码错误' });
    }
});

// 2. 获取所有作品
app.get('/api/works', (req, res) => res.json(works));

// 3. 上传作品 (接收 Base64 字符串)
app.post('/api/upload', (req, res) => {
    const { username, groupName, imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, message: '图片数据为空' });
    
    // 【修改1】：处理同组重复上传覆盖逻辑，防止教师端出现同一小组的多个作品
    const existingIndex = works.findIndex(w => w.username === username);
    if (existingIndex !== -1) {
        const oldWork = works[existingIndex];
        works.splice(existingIndex, 1);
        io.emit('work_deleted', oldWork.id); // 通知教师端移除旧作品
    }

    const newWork = {
        id: Date.now(),
        username,
        group: groupName, // 将 groupName 赋值给 group 字段，以兼容教师端的 work.group 显示
        imageUrl: imageBase64, // 直接存 Base64 文本
        time: new Date().toLocaleTimeString()
    };
    
    works.push(newWork);
    io.emit('new_work', newWork); 
    
    // 【修改2】：返回 workId，以匹配前端 student.html 中的 myWorkId = data.workId
    res.json({ success: true, workId: newWork.id, work: newWork });
});

// 4. 删除单个作品
app.delete('/api/works/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    // 【修改3】：前端学生端传的是 username，教师端传的是 role，这里解构 username
    const { role, username } = req.body; 
    const index = works.findIndex(w => w.id === id);
    
    if (index === -1) return res.json({ success: false, message: '作品不存在' });
    const work = works[index];

    // 【修改4】：校验权限，如果是学生，只能删除自己 username 对应的作品
    if (role !== 'teacher' && work.username !== username) {
        return res.json({ success: false, message: '无权删除其他小组作品' });
    }

    works.splice(index, 1);
    io.emit('work_deleted', id); 
    res.json({ success: true });
});

// 5. 一键清空
app.delete('/api/works', (req, res) => {
    if (req.body.role !== 'teacher') return res.json({ success: false, message: '仅教师可清空' });
    works = [];
    io.emit('works_cleared'); 
    res.json({ success: true });
});

// 设置默认首页
app.get('/', (req, res) => res.redirect('/login.html'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`云端服务器已启动，监听端口: ${PORT}`);
});
