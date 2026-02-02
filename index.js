const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const fileDB = {}; 

const RESERVED_IDS = ['send', 'api', 'download', 'style.css', 'favicon.ico', 'about', 'legal'];

const getExpiryMs = (duration) => {
    const times = {
        '1m': 60 * 1000, '5m': 5 * 60 * 1000, '10m': 10 * 60 * 1000,
        '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000, '5h': 5 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000, '1d': 24 * 60 * 60 * 1000,
    };
    return times[duration] || 60 * 60 * 1000;
};

const generateUniqueId = (length = 3, attempt = 0) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    // Generate string acak
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Cek apakah ID sudah ada di DB atau di Reserved List
    if (fileDB[result] || RESERVED_IDS.includes(result)) {
        // Jika sudah ada:
        // Jika sudah mencoba 10x di panjang yang sama dan gagal, tambah panjang digit
        if (attempt > 10) {
            return generateUniqueId(length + 1, 0); 
        }
        // Coba lagi dengan panjang yang sama
        return generateUniqueId(length, attempt + 1);
    }

    return result;
};

app.get('/', (req, res) => res.render('dashboard', { title: 'dashboard' }));
app.get('/send', (req, res) => res.render('send', { title: 'Send File' }));

// API UPLOAD
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        let { type, textContent, duration, customId } = req.body;
        let id;

        // LOGIKA ID
        if (customId && customId.trim() !== "") {
            // 1. Sanitasi (Hanya alfanumerik & strip)
            const sanitizedId = customId.trim().replace(/[^a-zA-Z0-9-_]/g, '');
            
            // 2. Validasi Custom ID (Minimal 1 karakter)
            if (sanitizedId.length < 1) {
                return res.status(400).json({ error: 'Custom ID minimal 1 karakter.' });
            }
            // 3. Cek ketersediaan
            if (RESERVED_IDS.includes(sanitizedId) || fileDB[sanitizedId]) {
                return res.status(400).json({ error: 'ID tersebut sudah terpakai.' });
            }
            id = sanitizedId;
        } else {
            // Auto Generate (Mulai dari 3 digit)
            id = generateUniqueId(3);
        }

        const expiryTime = Date.now() + getExpiryMs(duration);

        const newFile = {
            id,
            type,
            expiryTime,
            createdAt: Date.now()
        };

        if (type === 'txt') {
            newFile.content = textContent;
            newFile.filename = `text_${id}.txt`;
        } else {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            newFile.buffer = req.file.buffer;
            newFile.mimetype = req.file.mimetype;
            newFile.filename = req.file.originalname;
            newFile.size = (req.file.size / 1024 / 1024).toFixed(2) + ' MB';
        }

        fileDB[id] = newFile;
        res.json({ success: true, id: id });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Download Route
app.get('/download/:id', (req, res) => {
    const { id } = req.params;
    const file = fileDB[id];
    if (!file || !file.buffer) return res.status(404).send('File not found');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Type', file.mimetype);
    res.send(file.buffer);
});

// View Route
app.get('/:id', (req, res) => {
    const { id } = req.params;
    const file = fileDB[id];

    if (!file) return res.render('error', { title: 'Not Found', message: 'File tidak ditemukan.' });
    
    if (Date.now() > file.expiryTime) {
        delete fileDB[id];
        return res.render('error', { title: 'Expired', message: 'Link kadaluarsa.' });
    }

    let imageBase64 = null;
    if (file.type === 'img' && file.buffer) {
        imageBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }

    res.render('view', { title: file.filename, id, file, imageBase64 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
